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
    OutboxEvent,
    Report,
    ReportOccurrenceSource,
    ReportSource,
    ReportVersion,
    ReportVersionSource,
    SnapshotItem,
    now,
)

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
) -> Report:
    factory = await _factory(db, factory_id)
    report = Report(
        factory_id=factory.id,
        code=f"REP-{datetime.now(UTC):%Y%m%d}-{uuid.uuid4().hex[:8].upper()}",
        title=title.strip(),
        description=description.strip(),
        created_by_user_id=actor_id,
        updated_by_user_id=actor_id,
    )
    db.add(report)
    _event(db, event_type="REPORT_CREATED", report_id=report.id, actor_id=actor_id, correlation_id=correlation_id)
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
        source_by_snapshot = {version.snapshot_id: version for version in versions}
        # Direct live sources win; otherwise the lowest source report UUID wins.
        # This precedence is independent of database row order.
        inherited.sort(key=lambda item: (str(source_by_snapshot[item.snapshot_id].report_id), str(item.occurrence_id)))
        for item in inherited:
            version = source_by_snapshot[item.snapshot_id]
            selected = resolved.get(item.occurrence_id)
            if selected and any(
                selected.get(k) != item.frozen_values.get(k)
                for k in ("transaction_id", "review_version", "review_description", "attachment_ids")
            ):
                conflicts.append(
                    {
                        "occurrence_id": str(item.occurrence_id),
                        "selected": dict(selected),
                        "alternative": dict(item.frozen_values),
                        "source_version_id": str(version.id),
                    }
                )
            resolved.setdefault(item.occurrence_id, dict(item.frozen_values))
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
    actor_id: int,
    correlation_id: str,
) -> ReportVersion:
    report = await _report(db, report_id, lock=True)
    _check_editable(report, expected_version)
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
                review_id=uuid.UUID(values["review_id"]),
                review_version=int(values["review_version"]),
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


def report_dict(report: Report) -> dict[str, Any]:
    return {
        "id": str(report.id),
        "factory_id": str(report.factory_id),
        "code": report.code,
        "title": report.title,
        "description": report.description,
        "status": report.status,
        "created_by_user_id": report.created_by_user_id,
        "updated_by_user_id": report.updated_by_user_id,
        "version": report.version,
        "created_at": report.created_at.isoformat(),
        "updated_at": report.updated_at.isoformat(),
        "archived_at": report.archived_at.isoformat() if report.archived_at else None,
    }


def version_dict(version: ReportVersion) -> dict[str, Any]:
    return {
        "id": str(version.id),
        "report_id": str(version.report_id),
        "snapshot_id": str(version.snapshot_id),
        "revision": version.revision,
        "content": version.content,
        "template_version": version.template_version,
        "sha256": version.sha256,
        "published_by_user_id": version.published_by_user_id,
        "published_at": version.published_at.isoformat() if version.published_at else None,
    }


async def get_report_detail(db: AsyncSession, report_id: uuid.UUID) -> dict[str, Any]:
    report = await _report(db, report_id)
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
