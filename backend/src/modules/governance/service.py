import hashlib
import json
import math
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, Literal

from sqlalchemy import delete, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..material_scrap.models import (
    DailyExchangeRate,
    IngestionRun,
    ScrapOccurrence,
    ScrapReview,
    ScrapReviewAttachment,
    ScrapTransaction,
)
from ..user.models import User
from .evidence import preserve_evidence
from .exceptions import ReportConflictError, ReportNotFoundError, ReportValidationError
from .models import (
    AuditEvent,
    DatasetSnapshot,
    Factory,
    ImprovementAction,
    OutboxEvent,
    PublishedEvidence,
    Report,
    ReportActionSource,
    ReportEvidenceSource,
    ReportOccurrenceSource,
    ReportPublishReceipt,
    ReportScope,
    ReportSection,
    ReportSource,
    ReportVersion,
    ReportVersionSource,
    SnapshotFinancialRow,
    SnapshotItem,
    now,
)
from .reporting.period_close import build_period_close_document
from .reporting.scope import canonical_scope_key

MAX_SOURCES = 500
MAX_DEPTH = 12
DEFAULT_FACTORY_CODE = "HANARO-LOCAL"
DEFAULT_FACTORY_NAME = "Fábrica local"


def _json_default(value: Any) -> str:
    if isinstance(value, (Decimal, uuid.UUID, datetime)):
        return str(value)
    raise TypeError(f"Unsupported canonical value: {type(value).__name__}")


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=_json_default)


def _sha256(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def _decimal(value: Decimal | None) -> str | None:
    return format(value, "f") if value is not None else None


def _event(
    db: AsyncSession,
    *,
    event_type: str,
    report_id: uuid.UUID,
    actor_id: int | None,
    correlation_id: str,
    payload: dict[str, Any] | None = None,
) -> None:
    timestamp = now()
    body = {"report_id": str(report_id), "actor_id": actor_id, "occurred_at": timestamp.isoformat(), **(payload or {})}
    db.add(
        AuditEvent(
            event_type=event_type,
            entity_type="REPORT",
            entity_id=report_id,
            payload=body,
            correlation_id=correlation_id[:160],
            actor_id=actor_id,
        )
    )
    db.add(OutboxEvent(event_type=event_type, aggregate_id=report_id, payload=body, available_at=timestamp))


async def _factory(db: AsyncSession, requested: uuid.UUID | None) -> Factory:
    if requested:
        factory = await db.get(Factory, requested)
        if factory is None or not factory.is_active:
            raise ReportValidationError("Factory is not active or does not exist")
        return factory
    factory = (await db.scalars(select(Factory).where(Factory.is_active.is_(True)).order_by(Factory.code, Factory.id))).first()
    if factory is not None:
        return factory

    # Hanaro is deployed inside one plant. The Factory entity remains an
    # internal partition key for traceability, not a setup task exposed to
    # operators. Provision its singleton lazily for a fresh local database.
    factory = await db.scalar(select(Factory).where(Factory.code == DEFAULT_FACTORY_CODE))
    if factory is not None:
        factory.is_active = True
    else:
        factory = Factory(code=DEFAULT_FACTORY_CODE, name=DEFAULT_FACTORY_NAME)
        db.add(factory)
    await db.flush()
    return factory


async def _report(db: AsyncSession, report_id: uuid.UUID, *, lock: bool = False) -> Report:
    statement = select(Report).where(Report.id == report_id)
    if lock:
        statement = statement.with_for_update()
    report = (await db.scalars(statement)).one_or_none()
    if report is None:
        raise ReportNotFoundError("Report not found")
    return report


def _check_editable(report: Report, expected_version: int) -> None:
    if report.status == "ARCHIVED":
        raise ReportConflictError("Archived reports cannot be edited")
    if report.version != expected_version:
        raise ReportConflictError(f"Draft changed concurrently; current version is {report.version}")


async def create_report(
    db: AsyncSession,
    *,
    title: str,
    description: str,
    factory_id: uuid.UUID | None,
    actor_id: int,
    correlation_id: str,
    report_kind: str = "DOSSIER",
    content_schema_version: int = 1,
    scope: dict[str, Any] | None = None,
) -> Report:
    if report_kind not in {"DOSSIER", "PERIOD_CLOSE"}:
        raise ReportValidationError("Unsupported report kind")
    if report_kind == "PERIOD_CLOSE" and (scope is None or content_schema_version < 2):
        raise ReportValidationError("PERIOD_CLOSE reports require a V2 scope")
    if report_kind == "DOSSIER" and scope is not None:
        raise ReportValidationError("DOSSIER reports cannot have a period scope")
    factory = await _factory(db, factory_id)
    report = Report(
        factory_id=factory.id,
        code=f"REP-{datetime.now(UTC):%Y%m%d}-{uuid.uuid4().hex[:8].upper()}",
        title=title.strip(),
        description=description.strip(),
        report_kind=report_kind,
        content_schema_version=content_schema_version,
        created_by_user_id=actor_id,
        updated_by_user_id=actor_id,
    )
    db.add(report)
    await db.flush()
    if scope is not None:
        db.add(
            ReportScope(
                report_id=report.id,
                period_from=scope["period_from"],
                period_to=scope["period_to"],
                cutoff_at=scope.get("cutoff_at"),
                timezone=scope["timezone"],
                metric_code=scope["metric_code"],
                metric_policy_version=scope["metric_policy_version"],
                currency=scope["currency"],
                comparison_mode=scope["comparison_mode"],
                comparison_from=scope.get("comparison_from"),
                comparison_to=scope.get("comparison_to"),
                is_provisional=scope["is_provisional"],
                scope_key=canonical_scope_key(factory.id, scope["filters"]),
                filters=scope["filters"],
            )
        )
        default_sections = (
            ("executive_summary", "EXECUTIVE_SUMMARY", "Resumo executivo"),
            ("kpis", "KPI", "Indicadores"),
            ("trend", "TREND", "Evolução"),
            ("pareto", "PARETO", "Prioridades"),
            ("actions", "ACTIONS", "Ações"),
            ("evidence", "EVIDENCE", "Evidências"),
            ("conclusions", "CONCLUSIONS", "Conclusões e próximos passos"),
        )
        db.add_all(
            [
                ReportSection(
                    report_id=report.id,
                    section_key=section_key,
                    kind=kind,
                    position=position,
                    enabled=True,
                    title=title,
                    payload_schema_version=1,
                    payload={},
                )
                for position, (section_key, kind, title) in enumerate(default_sections)
            ]
        )
    _event(
        db,
        event_type="REPORT_CREATED",
        report_id=report.id,
        actor_id=actor_id,
        correlation_id=correlation_id,
        payload={"report_kind": report_kind, "content_schema_version": content_schema_version},
    )
    await db.commit()
    await db.refresh(report)
    return report


async def get_report_scope(db: AsyncSession, report_id: uuid.UUID) -> ReportScope | None:
    await _report(db, report_id)
    return (await db.scalars(select(ReportScope).where(ReportScope.report_id == report_id))).one_or_none()


async def update_report_scope(
    db: AsyncSession,
    report_id: uuid.UUID,
    *,
    expected_version: int,
    scope: dict[str, Any],
    actor_id: int,
    correlation_id: str,
) -> Report:
    report = await _report(db, report_id, lock=True)
    _check_editable(report, expected_version)
    if report.report_kind != "PERIOD_CLOSE":
        raise ReportValidationError("Only PERIOD_CLOSE reports have a period scope")
    saved_scope = (
        await db.scalars(select(ReportScope).where(ReportScope.report_id == report.id).with_for_update())
    ).one_or_none()
    if saved_scope is None:
        saved_scope = ReportScope(
            report_id=report.id,
            period_from=scope["period_from"],
            period_to=scope["period_to"],
            scope_key=canonical_scope_key(report.factory_id, scope["filters"]),
        )
        db.add(saved_scope)
    saved_scope.period_from = scope["period_from"]
    saved_scope.period_to = scope["period_to"]
    saved_scope.cutoff_at = scope.get("cutoff_at")
    saved_scope.timezone = scope["timezone"]
    saved_scope.metric_code = scope["metric_code"]
    saved_scope.metric_policy_version = scope["metric_policy_version"]
    saved_scope.currency = scope["currency"]
    saved_scope.comparison_mode = scope["comparison_mode"]
    saved_scope.comparison_from = scope.get("comparison_from")
    saved_scope.comparison_to = scope.get("comparison_to")
    saved_scope.is_provisional = scope["is_provisional"]
    saved_scope.scope_key = canonical_scope_key(report.factory_id, scope["filters"])
    saved_scope.filters = scope["filters"]
    report.updated_by_user_id = actor_id
    report.updated_at = now()
    report.version += 1
    _event(
        db,
        event_type="REPORT_SCOPE_UPDATED",
        report_id=report.id,
        actor_id=actor_id,
        correlation_id=correlation_id,
    )
    await db.commit()
    await db.refresh(report)
    return report


async def get_report_sections(db: AsyncSession, report_id: uuid.UUID) -> list[ReportSection]:
    await _report(db, report_id)
    return list(
        await db.scalars(
            select(ReportSection).where(ReportSection.report_id == report_id).order_by(ReportSection.position, ReportSection.id)
        )
    )


async def replace_report_action_sources(
    db: AsyncSession,
    report_id: uuid.UUID,
    *,
    expected_version: int,
    action_ids: list[uuid.UUID],
    actor_id: int,
    correlation_id: str,
) -> Report:
    report = await _report(db, report_id, lock=True)
    _check_editable(report, expected_version)
    if report.report_kind != "PERIOD_CLOSE":
        raise ReportValidationError("Only PERIOD_CLOSE reports have V2 action sources")
    ids = list(dict.fromkeys(action_ids))
    actions = list(await db.scalars(select(ImprovementAction).where(ImprovementAction.id.in_(ids)))) if ids else []
    if len(actions) != len(ids) or any(action.factory_id != report.factory_id for action in actions):
        raise ReportValidationError("Actions must exist and belong to the report factory")
    await db.execute(delete(ReportActionSource).where(ReportActionSource.report_id == report.id))
    db.add_all(
        [
            ReportActionSource(report_id=report.id, action_id=action_id, position=position)
            for position, action_id in enumerate(ids)
        ]
    )
    report.updated_by_user_id, report.updated_at = actor_id, now()
    report.version += 1
    _event(
        db,
        event_type="REPORT_ACTION_SOURCES_REPLACED",
        report_id=report.id,
        actor_id=actor_id,
        correlation_id=correlation_id,
        payload={"action_count": len(ids)},
    )
    await db.commit()
    await db.refresh(report)
    return report


async def replace_report_evidence_sources(
    db: AsyncSession,
    report_id: uuid.UUID,
    *,
    expected_version: int,
    evidence: list[dict[str, Any]],
    actor_id: int,
    correlation_id: str,
) -> Report:
    report = await _report(db, report_id, lock=True)
    _check_editable(report, expected_version)
    if report.report_kind != "PERIOD_CLOSE":
        raise ReportValidationError("Only PERIOD_CLOSE reports have V2 evidence sources")
    sections = {
        section.section_key: section
        for section in await db.scalars(select(ReportSection).where(ReportSection.report_id == report.id))
    }
    if any(item["section_key"] not in sections for item in evidence):
        raise ReportValidationError("Evidence must reference a section from the same report")
    attachment_ids = {item["review_attachment_id"] for item in evidence if item.get("review_attachment_id")}
    published_ids = {item["published_evidence_id"] for item in evidence if item.get("published_evidence_id")}
    found_attachments = (
        set(await db.scalars(select(ScrapReviewAttachment.id).where(ScrapReviewAttachment.id.in_(attachment_ids))))
        if attachment_ids
        else set()
    )
    found_published = (
        set(await db.scalars(select(PublishedEvidence.id).where(PublishedEvidence.id.in_(published_ids))))
        if published_ids
        else set()
    )
    if found_attachments != attachment_ids or found_published != published_ids:
        raise ReportValidationError("One or more evidence sources do not exist")
    await db.execute(delete(ReportEvidenceSource).where(ReportEvidenceSource.report_id == report.id))
    db.add_all(
        [
            ReportEvidenceSource(
                report_id=report.id,
                section_id=sections[item["section_key"]].id,
                review_attachment_id=item.get("review_attachment_id"),
                published_evidence_id=item.get("published_evidence_id"),
                caption=item["caption"].strip(),
                role=item["role"],
                captured_at=item.get("captured_at"),
                position=position,
            )
            for position, item in enumerate(evidence)
        ]
    )
    report.updated_by_user_id, report.updated_at = actor_id, now()
    report.version += 1
    _event(
        db,
        event_type="REPORT_EVIDENCE_SOURCES_REPLACED",
        report_id=report.id,
        actor_id=actor_id,
        correlation_id=correlation_id,
        payload={"evidence_count": len(evidence)},
    )
    await db.commit()
    await db.refresh(report)
    return report


async def replace_report_sections(
    db: AsyncSession,
    report_id: uuid.UUID,
    *,
    expected_version: int,
    sections: list[dict[str, Any]],
    actor_id: int,
    correlation_id: str,
) -> Report:
    report = await _report(db, report_id, lock=True)
    _check_editable(report, expected_version)
    if report.report_kind != "PERIOD_CLOSE":
        raise ReportValidationError("Only PERIOD_CLOSE reports have V2 sections")
    await db.execute(delete(ReportSection).where(ReportSection.report_id == report.id))
    for position, section in enumerate(sections):
        db.add(
            ReportSection(
                report_id=report.id,
                section_key=section["section_key"],
                kind=section["kind"],
                position=position,
                enabled=section["enabled"],
                title=section["title"].strip(),
                payload_schema_version=section["payload_schema_version"],
                payload=section["payload"],
            )
        )
    report.updated_by_user_id = actor_id
    report.updated_at = now()
    report.version += 1
    _event(
        db,
        event_type="REPORT_SECTIONS_REPLACED",
        report_id=report.id,
        actor_id=actor_id,
        correlation_id=correlation_id,
        payload={"section_count": len(sections)},
    )
    await db.commit()
    await db.refresh(report)
    return report


async def update_report(
    db: AsyncSession,
    report_id: uuid.UUID,
    *,
    expected_version: int,
    actor_id: int,
    correlation_id: str,
    title: str | None = None,
    description: str | None = None,
) -> Report:
    report = await _report(db, report_id, lock=True)
    _check_editable(report, expected_version)
    if title is not None:
        report.title = title.strip()
    if description is not None:
        report.description = description.strip()
    report.updated_by_user_id = actor_id
    report.updated_at = now()
    report.version += 1
    _event(db, event_type="REPORT_DRAFT_UPDATED", report_id=report.id, actor_id=actor_id, correlation_id=correlation_id)
    await db.commit()
    await db.refresh(report)
    return report


async def archive_report(db: AsyncSession, report_id: uuid.UUID, *, actor_id: int, correlation_id: str) -> Report:
    report = await _report(db, report_id, lock=True)
    if report.status == "ARCHIVED":
        return report
    report.status = "ARCHIVED"
    report.archived_at = report.updated_at = now()
    report.updated_by_user_id = actor_id
    report.version += 1
    _event(db, event_type="REPORT_ARCHIVED", report_id=report.id, actor_id=actor_id, correlation_id=correlation_id)
    await db.commit()
    return report


async def _eligible_occurrences(db: AsyncSession, ids: list[uuid.UUID]) -> dict[uuid.UUID, tuple[Any, ...]]:
    if not ids:
        return {}
    rows = (
        await db.execute(
            select(ScrapOccurrence, ScrapTransaction, ScrapReview, IngestionRun, DailyExchangeRate)
            .join(ScrapTransaction, ScrapTransaction.id == ScrapOccurrence.current_transaction_id)
            .join(ScrapReview, ScrapReview.occurrence_id == ScrapOccurrence.id)
            .join(IngestionRun, IngestionRun.id == ScrapTransaction.run_id)
            .join(DailyExchangeRate, DailyExchangeRate.id == IngestionRun.exchange_rate_id)
            .where(
                ScrapOccurrence.id.in_(ids),
                ScrapOccurrence.status == "ACTIVE",
                ScrapReview.status == "REVIEWED",
            )
        )
    ).all()
    return {row[0].id: tuple(row) for row in rows}


async def _latest_versions(db: AsyncSession, report_ids: list[uuid.UUID]) -> dict[uuid.UUID, ReportVersion]:
    if not report_ids:
        return {}
    ranked = (
        select(
            ReportVersion.id.label("id"),
            func.row_number()
            .over(partition_by=ReportVersion.report_id, order_by=(ReportVersion.revision.desc(), ReportVersion.id.desc()))
            .label("rank"),
        )
        .where(ReportVersion.report_id.in_(report_ids), ReportVersion.published_at.is_not(None))
        .subquery()
    )
    versions = (
        await db.scalars(select(ReportVersion).join(ranked, ranked.c.id == ReportVersion.id).where(ranked.c.rank == 1))
    ).all()
    return {version.report_id: version for version in versions}


async def _assert_acyclic(db: AsyncSession, report_id: uuid.UUID, proposed: set[uuid.UUID]) -> None:
    if report_id in proposed:
        raise ReportValidationError("A report cannot use itself as a source")
    frontier = [(source_id, 1) for source_id in sorted(proposed, key=str)]
    visited: set[uuid.UUID] = set()
    while frontier:
        current, depth = frontier.pop(0)
        if current == report_id:
            raise ReportValidationError("Report source cycle detected")
        if depth > MAX_DEPTH:
            raise ReportValidationError(f"Report source depth exceeds the limit of {MAX_DEPTH}")
        if current in visited:
            continue
        visited.add(current)
        children = (await db.scalars(select(ReportSource.source_report_id).where(ReportSource.report_id == current))).all()
        frontier.extend((child, depth + 1) for child in children)


async def mutate_sources(
    db: AsyncSession,
    report_id: uuid.UUID,
    *,
    kind: Literal["occurrence", "report"],
    operation: Literal["replace", "add", "remove"],
    ids: list[uuid.UUID],
    expected_version: int,
    actor_id: int,
    correlation_id: str,
) -> Report:
    if kind == "report" and db.bind.dialect.name == "postgresql":
        await db.execute(text("SELECT pg_advisory_xact_lock(726318421)"))
    unique_ids = list(dict.fromkeys(ids))
    if len(unique_ids) > MAX_SOURCES:
        raise ReportValidationError(f"At most {MAX_SOURCES} sources may be changed at once")
    report = await _report(db, report_id, lock=True)
    _check_editable(report, expected_version)
    if report.report_kind != "DOSSIER":
        raise ReportValidationError("PERIOD_CLOSE reports use the V2 analytics composition, not manual sources")
    model = ReportOccurrenceSource if kind == "occurrence" else ReportSource
    value_column = ReportOccurrenceSource.occurrence_id if kind == "occurrence" else ReportSource.source_report_id
    existing = set(await db.scalars(select(value_column).where(model.report_id == report_id)))
    target = (
        set(unique_ids)
        if operation == "replace"
        else (existing | set(unique_ids) if operation == "add" else existing - set(unique_ids))
    )
    if len(target) > MAX_SOURCES:
        raise ReportValidationError(f"A report may contain at most {MAX_SOURCES} direct {kind} sources")
    if kind == "occurrence":
        eligible = await _eligible_occurrences(db, list(target))
        missing = target - eligible.keys()
        if missing:
            raise ReportValidationError(
                f"Occurrences are not eligible for reporting: {', '.join(map(str, sorted(missing, key=str)))}"
            )
    else:
        source_reports = (
            list(await db.scalars(select(Report).where(Report.id.in_(target), Report.status != "ARCHIVED"))) if target else []
        )
        found = {source.id for source in source_reports}
        if found != target:
            raise ReportValidationError("One or more source reports do not exist or are archived")
        if any(source.factory_id != report.factory_id for source in source_reports):
            raise ReportValidationError("Source reports must belong to the same factory")
        versions = await _latest_versions(db, list(target))
        if versions.keys() != target:
            raise ReportValidationError("Every source report must have a published version")
        await _assert_acyclic(db, report_id, target)
    await db.execute(delete(model).where(model.report_id == report_id))
    for source_id in sorted(target, key=str):
        if kind == "occurrence":
            db.add(ReportOccurrenceSource(report_id=report_id, occurrence_id=source_id))
        else:
            db.add(ReportSource(report_id=report_id, source_report_id=source_id))
    report.updated_by_user_id = actor_id
    report.updated_at = now()
    report.version += 1
    _event(
        db,
        event_type="REPORT_DRAFT_UPDATED",
        report_id=report.id,
        actor_id=actor_id,
        correlation_id=correlation_id,
        payload={"source_kind": kind, "operation": operation, "source_count": len(target)},
    )
    await db.commit()
    await db.refresh(report)
    return report


def _frozen_values(
    occurrence: ScrapOccurrence,
    transaction: ScrapTransaction,
    review: ScrapReview,
    rate: DailyExchangeRate,
    attachments: list[ScrapReviewAttachment],
) -> dict[str, Any]:
    return {
        "occurrence_id": str(occurrence.id),
        "transaction_id": str(transaction.id),
        "review_id": str(review.id),
        "review_version": review.version,
        "organization_code": transaction.organization_code,
        "transaction_date": transaction.transaction_date.isoformat(),
        "item_code": transaction.item_code,
        "item_description": transaction.item_description,
        "product": transaction.product,
        "division": transaction.division,
        "line": transaction.receipt_department,
        "department": transaction.department,
        "issue_quantity": _decimal(transaction.issue_quantity),
        "issue_amount_brl": _decimal(transaction.issue_amount_brl),
        "amount_usd": _decimal(transaction.amount_usd),
        "currency_original": "BRL",
        "currency_converted": "USD",
        "exchange_rate": _decimal(rate.brl_per_usd),
        "exchange_rate_effective_date": rate.effective_date.isoformat(),
        "exchange_rate_fallback": rate.fallback_used,
        "review_title": review.title,
        "review_description": review.description,
        "reviewed_by_user_id": review.responsible_user_id,
        "reviewed_by_name": review.responsible_name,
        "reviewed_at": review.reviewed_at.isoformat() if review.reviewed_at else None,
        "attachment_ids": [str(item.id) for item in sorted(attachments, key=lambda item: item.position)],
    }


async def _normalized_snapshot_values(db: AsyncSession, items: list[SnapshotItem]) -> dict[uuid.UUID, dict[str, Any]]:
    """Complete sparse legacy snapshots from their pinned transaction IDs."""

    if not items:
        return {}
    transaction_rows = (
        await db.execute(
            select(ScrapTransaction, DailyExchangeRate)
            .join(IngestionRun, IngestionRun.id == ScrapTransaction.run_id)
            .join(DailyExchangeRate, DailyExchangeRate.id == IngestionRun.exchange_rate_id)
            .where(ScrapTransaction.id.in_([item.transaction_id for item in items]))
        )
    ).all()
    transactions = {transaction.id: (transaction, rate) for transaction, rate in transaction_rows}
    result: dict[uuid.UUID, dict[str, Any]] = {}
    for item in items:
        transaction, rate = transactions[item.transaction_id]
        values: dict[str, Any] = {
            "occurrence_id": str(item.occurrence_id),
            "transaction_id": str(item.transaction_id),
            "review_id": str(item.review_id) if item.review_id else None,
            "review_version": item.review_version,
            "organization_code": transaction.organization_code,
            "transaction_date": transaction.transaction_date.isoformat(),
            "item_code": transaction.item_code,
            "item_description": transaction.item_description,
            "product": transaction.product,
            "division": transaction.division,
            "line": transaction.receipt_department,
            "department": transaction.department,
            "issue_quantity": _decimal(transaction.issue_quantity),
            "issue_amount_brl": _decimal(transaction.issue_amount_brl),
            "amount_usd": _decimal(transaction.amount_usd),
            "currency_original": "BRL",
            "currency_converted": "USD",
            "exchange_rate": _decimal(rate.brl_per_usd),
            "exchange_rate_effective_date": rate.effective_date.isoformat(),
            "exchange_rate_fallback": rate.fallback_used,
            "review_title": "",
            "review_description": "",
            "reviewed_by_user_id": None,
            "reviewed_by_name": "",
            "reviewed_at": None,
            "attachment_ids": [],
        }
        # Values explicitly frozen by the source edition always win.
        values.update(item.frozen_values)
        result[item.id] = values
    return result


async def _resolve(
    db: AsyncSession, report: Report, *, lock: bool = False
) -> tuple[list[dict[str, Any]], list[ReportVersion], dict[str, Any]]:
    direct_ids = list(
        await db.scalars(
            select(ReportOccurrenceSource.occurrence_id)
            .where(ReportOccurrenceSource.report_id == report.id)
            .order_by(ReportOccurrenceSource.occurrence_id)
        )
    )
    source_ids = list(
        await db.scalars(
            select(ReportSource.source_report_id)
            .where(ReportSource.report_id == report.id)
            .order_by(ReportSource.source_report_id)
        )
    )
    versions_by_report = await _latest_versions(db, source_ids)
    if versions_by_report.keys() != set(source_ids):
        raise ReportValidationError("Every source report must have a published version")
    if lock and direct_ids:
        # All review mutations lock the review; ingestion updates the occurrence.
        # Acquire in stable order before reading their joined current values.
        await db.execute(
            select(ScrapOccurrence.id).where(ScrapOccurrence.id.in_(direct_ids)).order_by(ScrapOccurrence.id).with_for_update()
        )
        await db.execute(
            select(ScrapReview.id).where(ScrapReview.occurrence_id.in_(direct_ids)).order_by(ScrapReview.id).with_for_update()
        )
    direct_rows = await _eligible_occurrences(db, direct_ids)
    if direct_rows.keys() != set(direct_ids):
        raise ReportValidationError("Every direct occurrence must remain active and reviewed")

    resolved: dict[uuid.UUID, dict[str, Any]] = {}
    lineage: dict[str, list[dict[str, str]]] = {}
    conflicts: list[dict[str, Any]] = []
    review_ids = [row[2].id for row in direct_rows.values()]
    attachments: dict[uuid.UUID, list[ScrapReviewAttachment]] = {review_id: [] for review_id in review_ids}
    if review_ids:
        for attachment in await db.scalars(
            select(ScrapReviewAttachment).where(ScrapReviewAttachment.review_id.in_(review_ids))
        ):
            attachments[attachment.review_id].append(attachment)
    for occurrence_id in sorted(direct_rows, key=str):
        occurrence, transaction, review, _run, rate = direct_rows[occurrence_id]
        resolved[occurrence_id] = _frozen_values(occurrence, transaction, review, rate, attachments[review.id])
        lineage[str(occurrence_id)] = [{"kind": "DIRECT", "report_id": str(report.id)}]

    versions = [versions_by_report[source_id] for source_id in source_ids]
    if versions:
        snapshot_ids = [version.snapshot_id for version in versions]
        inherited = list(
            await db.scalars(
                select(SnapshotItem).where(SnapshotItem.snapshot_id.in_(snapshot_ids)).order_by(SnapshotItem.occurrence_id)
            )
        )
        normalized_inherited = await _normalized_snapshot_values(db, inherited)
        source_by_snapshot = {version.snapshot_id: version for version in versions}
        # Direct live sources win; otherwise the lowest source report UUID wins.
        # This precedence is independent of database row order.
        inherited.sort(key=lambda item: (str(source_by_snapshot[item.snapshot_id].report_id), str(item.occurrence_id)))
        for item in inherited:
            version = source_by_snapshot[item.snapshot_id]
            inherited_values = normalized_inherited[item.id]
            selected = resolved.get(item.occurrence_id)
            if selected and any(
                selected.get(k) != inherited_values.get(k)
                for k in ("transaction_id", "review_version", "review_description", "attachment_ids")
            ):
                conflicts.append(
                    {
                        "occurrence_id": str(item.occurrence_id),
                        "selected": dict(selected),
                        "alternative": dict(inherited_values),
                        "source_version_id": str(version.id),
                    }
                )
            resolved.setdefault(item.occurrence_id, dict(inherited_values))
            lineage.setdefault(str(item.occurrence_id), []).append(
                {
                    "kind": "REPORT_VERSION",
                    "report_id": str(version.report_id),
                    "report_version_id": str(version.id),
                    "revision": str(version.revision),
                }
            )
    items = [resolved[key] for key in sorted(resolved, key=str)]
    total_brl = sum((Decimal(item["issue_amount_brl"] or "0") for item in items), Decimal("0"))
    total_usd = sum((Decimal(item["amount_usd"] or "0") for item in items), Decimal("0"))
    metrics = {"occurrence_count": len(items), "issue_amount_brl": format(total_brl, "f"), "amount_usd": format(total_usd, "f")}
    return (
        items,
        versions,
        {
            "metrics": metrics,
            "lineage": lineage,
            "conflicts": conflicts,
            "precedence": "DIRECT_CURRENT_THEN_SOURCE_REPORT_UUID_ASC",
        },
    )


async def preview_report(db: AsyncSession, report_id: uuid.UUID) -> dict[str, Any]:
    report = await _report(db, report_id)
    if report.report_kind == "PERIOD_CLOSE":
        composition = await build_period_close_document(db, report)
        return {
            "report": report_dict(report),
            "content_schema_version": 2,
            "document": composition["document"],
            "readiness": composition["readiness"],
            "manifest": composition["manifest"],
            "fingerprint": composition["fingerprint"],
            "generated_at": now().isoformat(),
        }
    items, versions, meta = await _resolve(db, report)
    return {
        "report": report_dict(report),
        "items": items,
        "metrics": meta["metrics"],
        "lineage": meta["lineage"],
        "source_versions": [version_dict(item) for item in versions],
        "generated_at": now().isoformat(),
        "conflicts": meta["conflicts"],
        "precedence": meta["precedence"],
    }


async def publish_report(
    db: AsyncSession,
    report_id: uuid.UUID,
    *,
    expected_version: int,
    template_version: str,
    content_schema_version: int = 1,
    preview_fingerprint: str | None = None,
    acknowledged_warning_codes: list[str] | None = None,
    idempotency_key: str | None = None,
    actor_id: int,
    correlation_id: str,
) -> ReportVersion:
    acknowledged_warning_codes = acknowledged_warning_codes or []
    request_hash = _sha256(
        {
            "report_id": str(report_id),
            "expected_version": expected_version,
            "template_version": template_version,
            "content_schema_version": content_schema_version,
            "preview_fingerprint": preview_fingerprint,
            "acknowledged_warning_codes": sorted(acknowledged_warning_codes),
        }
    )
    if idempotency_key and template_version == "2":
        receipt = await db.scalar(
            select(ReportPublishReceipt).where(
                ReportPublishReceipt.report_id == report_id,
                ReportPublishReceipt.requested_by_user_id == actor_id,
                ReportPublishReceipt.idempotency_key == idempotency_key,
            )
        )
        if receipt is not None:
            if receipt.request_hash != request_hash:
                raise ReportConflictError("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST")
            version = await db.get(ReportVersion, receipt.report_version_id)
            if version is None:
                raise ReportConflictError("Publication receipt points to a missing version")
            return version
    report = await _report(db, report_id, lock=True)
    _check_editable(report, expected_version)
    if report.report_kind == "PERIOD_CLOSE":
        if template_version != "2":
            raise ReportValidationError("PERIOD_CLOSE reports require template version 2")
        return await _publish_period_close(
            db,
            report,
            actor_id=actor_id,
            correlation_id=correlation_id,
            expected_fingerprint=preview_fingerprint,
            content_schema_version=content_schema_version,
            acknowledged_warning_codes=acknowledged_warning_codes,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
        )
    if template_version != "1":
        raise ReportValidationError("Unknown template version")
    items, source_versions, meta = await _resolve(db, report, lock=True)
    await preserve_evidence(db, items)
    if not items:
        raise ReportValidationError("A report must contain at least one eligible occurrence")
    current_revision = await db.scalar(
        select(func.coalesce(func.max(ReportVersion.revision), 0)).where(ReportVersion.report_id == report.id)
    )
    next_revision = int(current_revision or 0) + 1
    scope = {
        "report_id": str(report.id),
        "factory_id": str(report.factory_id),
        "source_report_version_ids": [str(v.id) for v in source_versions],
        "date_from": min(item["transaction_date"] for item in items),
        "date_to": max(item["transaction_date"] for item in items),
    }
    canonical = {
        "report": {
            "id": str(report.id),
            "code": report.code,
            "title": report.title,
            "description": report.description,
            "author": await db.scalar(select(User.name).where(User.id == actor_id)),
        },
        "revision": next_revision,
        "template_version": template_version,
        "scope": scope,
        "metrics": meta["metrics"],
        "lineage": meta["lineage"],
        "items": items,
        "conflicts": meta["conflicts"],
        "precedence": meta["precedence"],
    }
    digest = _sha256(canonical)
    snapshot = DatasetSnapshot(
        scope=scope, metrics=meta["metrics"], sha256=digest, factory_id=report.factory_id, sealed_at=None
    )
    db.add(snapshot)
    await db.flush()
    for values in items:
        db.add(
            SnapshotItem(
                snapshot_id=snapshot.id,
                occurrence_id=uuid.UUID(values["occurrence_id"]),
                transaction_id=uuid.UUID(values["transaction_id"]),
                review_id=uuid.UUID(values["review_id"]) if values.get("review_id") else None,
                review_version=int(values["review_version"]) if values.get("review_version") is not None else None,
                frozen_values=values,
            )
        )
    await db.flush()
    snapshot.sealed_at = now()
    await db.flush()
    version = ReportVersion(
        report_id=report.id,
        snapshot_id=snapshot.id,
        revision=next_revision,
        content={
            "report": canonical["report"],
            "metrics": meta["metrics"],
            "lineage": meta["lineage"],
            "scope": scope,
            "conflicts": meta["conflicts"],
            "precedence": meta["precedence"],
        },
        template_version=template_version,
        sha256=digest,
        published_by_user_id=actor_id,
        published_at=now(),
    )
    db.add(version)
    await db.flush()
    for source in source_versions:
        db.add(
            ReportVersionSource(
                report_version_id=version.id,
                source_report_id=source.report_id,
                source_report_version_id=source.id,
            )
        )
    report.status = "PUBLISHED"
    report.updated_by_user_id = actor_id
    report.updated_at = now()
    report.version += 1
    _event(
        db,
        event_type="REPORT_PUBLISHED",
        report_id=report.id,
        actor_id=actor_id,
        correlation_id=correlation_id,
        payload={"report_version_id": str(version.id), "revision": next_revision},
    )
    await db.commit()
    await db.refresh(version)
    return version


async def _publish_period_close(
    db: AsyncSession,
    report: Report,
    *,
    actor_id: int,
    correlation_id: str,
    expected_fingerprint: str | None = None,
    content_schema_version: int = 2,
    acknowledged_warning_codes: list[str] | None = None,
    idempotency_key: str | None = None,
    request_hash: str | None = None,
) -> ReportVersion:
    if content_schema_version not in (1, 2):
        raise ReportValidationError("PERIOD_CLOSE reports require content schema version 2")
    composition = await build_period_close_document(db, report)
    draft_fingerprint = composition["fingerprint"]
    if expected_fingerprint is not None and expected_fingerprint != draft_fingerprint:
        raise ReportConflictError("PREVIEW_OUTDATED")
    blockers = [issue["code"] for issue in composition["readiness"]["issues"] if issue["severity"] == "BLOCKER"]
    if blockers:
        raise ReportValidationError(f"Report is not ready for publication: {', '.join(blockers)}")
    composition = await build_period_close_document(db, report, preserve_files=True)
    current_revision = await db.scalar(
        select(func.coalesce(func.max(ReportVersion.revision), 0)).where(ReportVersion.report_id == report.id)
    )
    next_revision = int(current_revision or 0) + 1
    author = await db.scalar(select(User.name).where(User.id == actor_id))
    document = composition["document"]
    document["report"]["author"] = author
    canonical = {
        "revision": next_revision,
        "content_schema_version": 2,
        "template_version": "2",
        "document": document,
        "readiness": composition["readiness"],
        "manifest": composition["manifest"],
    }
    digest = _sha256(canonical)
    snapshot = DatasetSnapshot(
        scope=document["scope"],
        metrics=document["analytics"],
        sha256=digest,
        factory_id=report.factory_id,
        schema_version=2,
        manifest=composition["manifest"],
        sealed_at=None,
    )
    db.add(snapshot)
    await db.flush()
    for values in composition["financial_rows"]:
        db.add(
            SnapshotFinancialRow(
                snapshot_id=snapshot.id,
                occurrence_id=uuid.UUID(values["occurrence_id"]),
                transaction_id=uuid.UUID(values["transaction_id"]),
                frozen_values=values,
                window_key=values["window_key"],
            )
        )
    await db.flush()
    snapshot.sealed_at = now()
    await db.flush()
    version = ReportVersion(
        report_id=report.id,
        snapshot_id=snapshot.id,
        revision=next_revision,
        content={
            "document": document,
            "readiness": composition["readiness"],
            "manifest": composition["manifest"],
            "draft_fingerprint": draft_fingerprint,
            "publication_fingerprint": _sha256(
                {"report_version": report.version, "document": document, "manifest": composition["manifest"]}
            ),
        },
        template_version="2",
        content_schema_version=2,
        sha256=digest,
        published_by_user_id=actor_id,
        published_at=now(),
    )
    db.add(version)
    await db.flush()
    if idempotency_key:
        db.add(
            ReportPublishReceipt(
                report_id=report.id,
                report_version_id=version.id,
                requested_by_user_id=actor_id,
                idempotency_key=idempotency_key,
                request_hash=request_hash or "",
            )
        )
    report.status = "PUBLISHED"
    report.updated_by_user_id = actor_id
    report.updated_at = now()
    report.version += 1
    _event(
        db,
        event_type="REPORT_PUBLISHED",
        report_id=report.id,
        actor_id=actor_id,
        correlation_id=correlation_id,
        payload={"report_version_id": str(version.id), "revision": next_revision, "content_schema_version": 2},
    )
    await db.commit()
    await db.refresh(version)
    return version


def report_dict(report: Report) -> dict[str, Any]:
    return {
        "id": str(report.id),
        "factory_id": str(report.factory_id),
        "code": report.code,
        "title": report.title,
        "description": report.description,
        "status": report.status,
        "report_kind": report.report_kind,
        "content_schema_version": report.content_schema_version,
        "created_by_user_id": report.created_by_user_id,
        "updated_by_user_id": report.updated_by_user_id,
        "version": report.version,
        "created_at": report.created_at.isoformat(),
        "updated_at": report.updated_at.isoformat(),
        "archived_at": report.archived_at.isoformat() if report.archived_at else None,
    }


def report_scope_dict(scope: ReportScope | None) -> dict[str, Any] | None:
    if scope is None:
        return None
    return {
        "period_from": scope.period_from.isoformat(),
        "period_to": scope.period_to.isoformat(),
        "cutoff_at": scope.cutoff_at.isoformat() if scope.cutoff_at else None,
        "timezone": scope.timezone,
        "metric_code": scope.metric_code,
        "metric_policy_version": scope.metric_policy_version,
        "currency": scope.currency,
        "comparison_mode": scope.comparison_mode,
        "comparison_from": scope.comparison_from.isoformat() if scope.comparison_from else None,
        "comparison_to": scope.comparison_to.isoformat() if scope.comparison_to else None,
        "is_provisional": scope.is_provisional,
        "scope_key": scope.scope_key,
        "filters": scope.filters,
    }


def report_section_dict(section: ReportSection) -> dict[str, Any]:
    return {
        "id": str(section.id),
        "section_key": section.section_key,
        "kind": section.kind,
        "position": section.position,
        "enabled": section.enabled,
        "title": section.title,
        "payload_schema_version": section.payload_schema_version,
        "payload": section.payload,
    }


def version_dict(version: ReportVersion) -> dict[str, Any]:
    return {
        "id": str(version.id),
        "report_id": str(version.report_id),
        "snapshot_id": str(version.snapshot_id),
        "revision": version.revision,
        "content": version.content,
        "content_schema_version": version.content_schema_version,
        "template_version": version.template_version,
        "sha256": version.sha256,
        "published_by_user_id": version.published_by_user_id,
        "published_at": version.published_at.isoformat() if version.published_at else None,
    }


async def get_report_detail(db: AsyncSession, report_id: uuid.UUID) -> dict[str, Any]:
    report = await _report(db, report_id)
    scope = await get_report_scope(db, report_id)
    sections = await get_report_sections(db, report_id)
    action_ids = list(
        await db.scalars(
            select(ReportActionSource.action_id)
            .where(ReportActionSource.report_id == report_id)
            .order_by(ReportActionSource.position)
        )
    )
    evidence_sources = list(
        await db.scalars(
            select(ReportEvidenceSource)
            .where(ReportEvidenceSource.report_id == report_id)
            .order_by(ReportEvidenceSource.position, ReportEvidenceSource.id)
        )
    )
    section_keys = {section.id: section.section_key for section in sections}
    occurrence_ids = list(
        await db.scalars(select(ReportOccurrenceSource.occurrence_id).where(ReportOccurrenceSource.report_id == report.id))
    )
    source_ids = list(await db.scalars(select(ReportSource.source_report_id).where(ReportSource.report_id == report.id)))
    latest = await _latest_versions(db, [report.id])
    data = report_dict(report)
    data.update(
        {
            "occurrence_source_ids": [str(item) for item in occurrence_ids],
            "report_source_ids": [str(item) for item in source_ids],
            "scope": report_scope_dict(scope),
            "sections": [report_section_dict(section) for section in sections],
            "action_source_ids": [str(action_id) for action_id in action_ids],
            "evidence_sources": [
                {
                    "id": str(item.id),
                    "section_key": section_keys[item.section_id],
                    "review_attachment_id": str(item.review_attachment_id) if item.review_attachment_id else None,
                    "published_evidence_id": str(item.published_evidence_id) if item.published_evidence_id else None,
                    "caption": item.caption,
                    "role": item.role,
                    "captured_at": item.captured_at.isoformat() if item.captured_at else None,
                    "position": item.position,
                }
                for item in evidence_sources
            ],
            "latest_version": version_dict(latest[report.id]) if report.id in latest else None,
        }
    )
    return data


async def list_reports(
    db: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    status: str | None = None,
    author_id: int | None = None,
) -> dict[str, Any]:
    filters = [Report.status != "ARCHIVED"]
    if search:
        term = f"%{search.strip()}%"
        filters.append(or_(Report.title.ilike(term), Report.code.ilike(term)))
    if status:
        filters.append(Report.status == status)
    if author_id:
        filters.append(Report.created_by_user_id == author_id)
    total = int(await db.scalar(select(func.count()).select_from(Report).where(*filters)) or 0)
    occurrence_counts = (
        select(
            ReportOccurrenceSource.report_id.label("report_id"),
            func.count(ReportOccurrenceSource.id).label("occurrence_count"),
        )
        .group_by(ReportOccurrenceSource.report_id)
        .subquery()
    )
    latest_revisions = (
        select(
            ReportVersion.report_id.label("report_id"),
            func.max(ReportVersion.revision).label("revision"),
        )
        .where(ReportVersion.published_at.is_not(None))
        .group_by(ReportVersion.report_id)
        .subquery()
    )
    rows = (
        await db.execute(
            select(
                Report,
                User.name,
                func.coalesce(occurrence_counts.c.occurrence_count, 0),
                ReportVersion.published_at,
                ReportVersion.revision,
            )
            .outerjoin(User, User.id == Report.created_by_user_id)
            .outerjoin(occurrence_counts, occurrence_counts.c.report_id == Report.id)
            .outerjoin(latest_revisions, latest_revisions.c.report_id == Report.id)
            .outerjoin(
                ReportVersion,
                (ReportVersion.report_id == latest_revisions.c.report_id)
                & (ReportVersion.revision == latest_revisions.c.revision),
            )
            .where(*filters)
            .order_by(Report.updated_at.desc(), Report.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    result = []
    for report, author_name, occurrence_count, published_at, latest_revision in rows:
        item = report_dict(report)
        item["author_name"] = author_name
        item["occurrence_count"] = int(occurrence_count)
        item["latest_publication"] = published_at.isoformat() if published_at else None
        item["latest_revision"] = latest_revision
        result.append(item)
    pages = math.ceil(total / page_size) if total else 0
    return {
        "items": result,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": pages,
        "has_next": page < pages,
        "has_previous": page > 1,
    }


async def list_versions(db: AsyncSession, report_id: uuid.UUID, *, page: int, page_size: int) -> dict[str, Any]:
    await _report(db, report_id)
    total = int(
        await db.scalar(select(func.count()).select_from(ReportVersion).where(ReportVersion.report_id == report_id)) or 0
    )
    versions = list(
        await db.scalars(
            select(ReportVersion)
            .where(ReportVersion.report_id == report_id)
            .order_by(ReportVersion.revision.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    pages = math.ceil(total / page_size) if total else 0
    return {
        "items": [version_dict(item) for item in versions],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": pages,
        "has_next": page < pages,
        "has_previous": page > 1,
    }


async def get_version(db: AsyncSession, report_id: uuid.UUID, revision: int) -> dict[str, Any]:
    version = (
        await db.scalars(select(ReportVersion).where(ReportVersion.report_id == report_id, ReportVersion.revision == revision))
    ).one_or_none()
    if version is None:
        raise ReportNotFoundError("Report version not found")
    items = list(
        await db.scalars(
            select(SnapshotItem).where(SnapshotItem.snapshot_id == version.snapshot_id).order_by(SnapshotItem.occurrence_id)
        )
    )
    result = version_dict(version)
    result["items"] = [item.frozen_values for item in items]
    if version.content_schema_version >= 2:
        rows = list(
            await db.scalars(
                select(SnapshotFinancialRow)
                .where(SnapshotFinancialRow.snapshot_id == version.snapshot_id)
                .order_by(SnapshotFinancialRow.window_key, SnapshotFinancialRow.occurrence_id)
            )
        )
        result["financial_rows"] = [row.frozen_values for row in rows]
    return result


async def list_eligible_occurrences(
    db: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    organization: str | None = None,
    product: str | None = None,
    division: str | None = None,
    line: str | None = None,
) -> dict[str, Any]:
    filters = [ScrapOccurrence.status == "ACTIVE", ScrapReview.status == "REVIEWED"]
    if search:
        term = f"%{search.strip()}%"
        filters.append(or_(ScrapTransaction.item_code.ilike(term), ScrapTransaction.item_description.ilike(term)))
    if organization:
        filters.append(ScrapTransaction.organization_code == organization)
    if product:
        filters.append(ScrapTransaction.product == product)
    if division:
        filters.append(ScrapTransaction.division == division)
    if line:
        filters.append(ScrapTransaction.receipt_department == line)
    base = (
        select(ScrapOccurrence, ScrapTransaction, ScrapReview)
        .join(ScrapTransaction, ScrapTransaction.id == ScrapOccurrence.current_transaction_id)
        .join(ScrapReview, ScrapReview.occurrence_id == ScrapOccurrence.id)
        .where(*filters)
    )
    total = int(await db.scalar(select(func.count()).select_from(base.subquery())) or 0)
    rows = (
        await db.execute(
            base.order_by(ScrapTransaction.transaction_date.desc(), ScrapOccurrence.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    items = [
        {
            "id": str(occ.id),
            "organization_code": tx.organization_code,
            "transaction_date": tx.transaction_date.isoformat(),
            "item_code": tx.item_code,
            "item_description": tx.item_description,
            "product": tx.product,
            "division": tx.division,
            "line": tx.receipt_department,
            "amount_usd": _decimal(tx.amount_usd),
            "review_title": review.title,
            "reviewed_by": review.responsible_name,
        }
        for occ, tx, review in rows
    ]
    pages = math.ceil(total / page_size) if total else 0
    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": pages,
        "has_next": page < pages,
        "has_previous": page > 1,
    }


async def list_eligible_actions(
    db: AsyncSession,
    *,
    factory_id: uuid.UUID,
    page: int,
    page_size: int,
    search: str | None = None,
) -> dict[str, Any]:
    filters = [ImprovementAction.factory_id == factory_id]
    if search:
        term = f"%{search.strip()}%"
        filters.append(or_(ImprovementAction.code.ilike(term), ImprovementAction.title.ilike(term)))
    total = int(await db.scalar(select(func.count()).select_from(ImprovementAction).where(*filters)) or 0)
    actions = list(
        await db.scalars(
            select(ImprovementAction)
            .where(*filters)
            .order_by(ImprovementAction.position, ImprovementAction.due_at, ImprovementAction.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    pages = math.ceil(total / page_size) if total else 0
    return {
        "items": [
            {
                "id": str(action.id),
                "code": action.code,
                "title": action.title,
                "status": action.status,
                "priority": action.priority,
                "owner_id": action.owner_id,
                "due_at": action.due_at.isoformat() if action.due_at else None,
                "version": action.version,
            }
            for action in actions
        ],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": pages,
        "has_next": page < pages,
        "has_previous": page > 1,
    }


async def list_report_evidence_candidates(
    db: AsyncSession,
    report_id: uuid.UUID,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
) -> dict[str, Any]:
    report = await _report(db, report_id)
    scope = await get_report_scope(db, report.id)
    if report.report_kind != "PERIOD_CLOSE" or scope is None:
        raise ReportValidationError("Evidence candidates are available only for PERIOD_CLOSE reports")
    filters = [
        ScrapOccurrence.status == "ACTIVE",
        ScrapReview.status == "REVIEWED",
        ScrapTransaction.transaction_date >= scope.period_from,
        ScrapTransaction.transaction_date <= scope.period_to,
    ]
    for values, column in (
        (scope.filters.get("organization_codes"), ScrapTransaction.organization_code),
        (scope.filters.get("product_codes"), ScrapTransaction.product),
        (scope.filters.get("divisions"), ScrapTransaction.division),
        (scope.filters.get("lines"), ScrapTransaction.receipt_department),
    ):
        if values:
            filters.append(column.in_(values))
    if search:
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                ScrapTransaction.item_code.ilike(term),
                ScrapTransaction.item_description.ilike(term),
                ScrapReview.title.ilike(term),
            )
        )
    base = (
        select(ScrapReviewAttachment, ScrapOccurrence, ScrapTransaction, ScrapReview)
        .join(ScrapReview, ScrapReview.id == ScrapReviewAttachment.review_id)
        .join(ScrapOccurrence, ScrapOccurrence.id == ScrapReview.occurrence_id)
        .join(ScrapTransaction, ScrapTransaction.id == ScrapOccurrence.current_transaction_id)
        .where(*filters)
    )
    total = int(await db.scalar(select(func.count()).select_from(base.subquery())) or 0)
    rows = (
        await db.execute(
            base.order_by(ScrapTransaction.transaction_date.desc(), ScrapReviewAttachment.position)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    pages = math.ceil(total / page_size) if total else 0
    return {
        "items": [
            {
                "id": str(attachment.id),
                "occurrence_id": str(occurrence.id),
                "transaction_date": transaction.transaction_date.isoformat(),
                "item_code": transaction.item_code,
                "item_description": transaction.item_description,
                "review_title": review.title,
                "filename": attachment.original_filename,
                "content_type": attachment.content_type,
                "size_bytes": attachment.size_bytes,
                "width": attachment.width,
                "height": attachment.height,
            }
            for attachment, occurrence, transaction, review in rows
        ],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": pages,
        "has_next": page < pages,
        "has_previous": page > 1,
    }


async def list_source_reports(
    db: AsyncSession, report_id: uuid.UUID, *, page: int, page_size: int, search: str | None = None
) -> dict[str, Any]:
    current = await _report(db, report_id)
    latest = (
        select(ReportVersion.report_id, func.max(ReportVersion.revision).label("revision"))
        .where(ReportVersion.published_at.is_not(None))
        .group_by(ReportVersion.report_id)
        .subquery()
    )
    filters = [Report.id != report_id, Report.factory_id == current.factory_id, Report.status != "ARCHIVED"]
    if search:
        term = f"%{search.strip()}%"
        filters.append(or_(Report.title.ilike(term), Report.code.ilike(term)))
    base = select(Report, latest.c.revision).join(latest, latest.c.report_id == Report.id).where(*filters)
    total = int(await db.scalar(select(func.count()).select_from(base.subquery())) or 0)
    rows = (
        await db.execute(
            base.order_by(Report.updated_at.desc(), Report.id.desc()).offset((page - 1) * page_size).limit(page_size)
        )
    ).all()
    items = [{**report_dict(report), "latest_revision": revision} for report, revision in rows]
    pages = math.ceil(total / page_size) if total else 0
    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": pages,
        "has_next": page < pages,
        "has_previous": page > 1,
    }
