"""Single content builder shared by V2 preview and publication."""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.governance.models import (
    ImprovementAction,
    PublishedEvidence,
    Report,
    ReportActionSource,
    ReportEvidenceSource,
    ReportScope,
    ReportSection,
)
from src.app.models.material_scrap.models import ScrapReviewAttachment
from src.app.services.governance.evidence import preserve_evidence
from src.app.support.governance.reporting.analytics import ReportAnalyticsService
from src.app.support.governance.service_types import canonical_sha256


async def _actions(db: AsyncSession, report_id) -> list[dict[str, Any]]:
    rows = (
        await db.execute(
            select(ImprovementAction)
            .join(ReportActionSource, ReportActionSource.action_id == ImprovementAction.id)
            .where(ReportActionSource.report_id == report_id)
            .order_by(ReportActionSource.position, ImprovementAction.id)
        )
    ).scalars()
    return [
        {
            "id": str(action.id),
            "code": action.code,
            "title": action.title,
            "description": action.description,
            "status": action.status,
            "priority": action.priority,
            "owner_id": action.owner_id,
            "due_at": action.due_at.isoformat() if action.due_at else None,
            "blocked_reason": action.blocked_reason,
            "validated_at": action.validated_at.isoformat() if action.validated_at else None,
            "version": action.version,
        }
        for action in rows
    ]


def _published_evidence(evidence: PublishedEvidence) -> dict[str, Any]:
    return {
        "id": str(evidence.id),
        "sha256": evidence.sha256,
        "size_bytes": evidence.size_bytes,
        "filename": evidence.filename,
        "content_type": evidence.content_type,
        "download_url": f"/api/v1/report-evidence/{evidence.id}",
        "requires_authentication": True,
    }


async def _evidence(
    db: AsyncSession,
    report_id,
    sections: list[ReportSection],
    *,
    preserve_files: bool,
) -> list[dict[str, Any]]:
    section_keys = {section.id: section.section_key for section in sections}
    sources = list(
        await db.scalars(
            select(ReportEvidenceSource)
            .where(ReportEvidenceSource.report_id == report_id)
            .order_by(ReportEvidenceSource.position, ReportEvidenceSource.id)
        )
    )
    attachments = {
        attachment.id: attachment
        for attachment in await db.scalars(
            select(ScrapReviewAttachment).where(
                ScrapReviewAttachment.id.in_([source.review_attachment_id for source in sources if source.review_attachment_id])
            )
        )
    }
    published = {
        evidence.id: evidence
        for evidence in await db.scalars(
            select(PublishedEvidence).where(
                PublishedEvidence.id.in_([source.published_evidence_id for source in sources if source.published_evidence_id])
            )
        )
    }
    result: list[dict[str, Any]] = []
    for source in sources:
        item: dict[str, Any] = {
            "source_id": str(source.id),
            "section_key": section_keys[source.section_id],
            "caption": source.caption,
            "role": source.role,
            "captured_at": source.captured_at.isoformat() if source.captured_at else None,
        }
        if source.review_attachment_id:
            attachment = attachments[source.review_attachment_id]
            item["source_attachment_id"] = str(attachment.id)
            if preserve_files:
                carrier = {"attachment_ids": [str(attachment.id)]}
                await preserve_evidence(db, [carrier])
                item["published"] = carrier["evidence"][0]
            else:
                item["preview"] = {
                    "filename": attachment.original_filename,
                    "content_type": attachment.content_type,
                    "size_bytes": attachment.size_bytes,
                }
        else:
            assert source.published_evidence_id is not None
            item["published"] = _published_evidence(published[source.published_evidence_id])
        result.append(item)
    return result


def _readiness(
    scope: ReportScope,
    sections: list[ReportSection],
    analytics: dict[str, Any],
    actions: list[dict[str, Any]],
    evidence: list[dict[str, Any]],
) -> dict[str, Any]:
    issues: list[dict[str, Any]] = []

    def add(code: str, severity: str, message: str, suggested_action: str, section_id: str | None = None) -> None:
        issues.append(
            {
                "code": code,
                "severity": severity,
                "message": message,
                "section_id": section_id,
                "source_id": None,
                "suggested_action": suggested_action,
            }
        )

    coverage = analytics["coverage"]
    if coverage["status"] != "COMPLETE":
        severity = "WARNING" if scope.is_provisional else "BLOCKER"
        add(
            "SOURCE_COVERAGE_INCOMPLETE",
            severity,
            "A cobertura diária da fonte de scrap não está completa para o período.",
            "Registre a cobertura faltante ou marque o fechamento como provisório.",
        )
    if analytics["occurrence_count"] == 0:
        add(
            "EMPTY_FINANCIAL_WINDOW",
            "WARNING",
            "Nenhuma ocorrência ativa foi encontrada no recorte.",
            "Confira o período, os filtros e a cobertura antes de emitir.",
        )
    if analytics["target"] is None:
        add(
            "TARGET_UNAVAILABLE",
            "WARNING",
            "Não existe meta aprovada para o mesmo escopo e período.",
            "Cadastre uma meta compatível ou apresente o indicador sem meta.",
        )
    action_section = next((section for section in sections if section.enabled and section.kind == "ACTIONS"), None)
    if action_section and not actions:
        add(
            "ACTIONS_EMPTY",
            "WARNING",
            "A seção de ações está habilitada e não possui ações selecionadas.",
            "Selecione ações existentes ou desabilite a seção.",
            str(action_section.id),
        )
    evidence_section = next((section for section in sections if section.enabled and section.kind == "EVIDENCE"), None)
    if evidence_section and not evidence:
        add(
            "EVIDENCE_EMPTY",
            "WARNING",
            "A seção de evidências está habilitada e não possui evidências selecionadas.",
            "Selecione evidências ou desabilite a seção.",
            str(evidence_section.id),
        )
    return {"ready": all(issue["severity"] != "BLOCKER" for issue in issues), "issues": issues}


async def build_period_close_document(
    db: AsyncSession,
    report: Report,
    *,
    preserve_files: bool = False,
) -> dict[str, Any]:
    scope = await db.scalar(select(ReportScope).where(ReportScope.report_id == report.id))
    if scope is None:
        raise ValueError("PERIOD_CLOSE report has no scope")
    sections = list(
        await db.scalars(
            select(ReportSection).where(ReportSection.report_id == report.id).order_by(ReportSection.position, ReportSection.id)
        )
    )
    analytics = await ReportAnalyticsService().build_dataset(db, report, scope)
    actions = await _actions(db, report.id)
    evidence = await _evidence(db, report.id, sections, preserve_files=preserve_files)
    readiness = _readiness(scope, sections, analytics, actions, evidence)
    public_analytics = {key: value for key, value in analytics.items() if key != "financial_rows"}
    if analytics.get("comparison"):
        public_analytics["comparison"] = {
            key: value for key, value in analytics["comparison"].items() if key != "financial_rows"
        }
    blocks = []
    for section in sections:
        if not section.enabled:
            continue
        block: dict[str, Any] = {
            "id": str(section.id),
            "key": section.section_key,
            "kind": section.kind,
            "title": section.title,
            "payload_schema_version": section.payload_schema_version,
            "payload": section.payload,
            "evidence": [item for item in evidence if item["section_key"] == section.section_key],
        }
        if section.kind == "KPI":
            block["data"] = {
                key: public_analytics[key]
                for key in ("metric", "occurrence_count", "total", "target", "target_revision", "coverage")
            }
        elif section.kind == "TREND":
            block["data"] = {
                "monthly": public_analytics["monthly"],
                "comparison": public_analytics["comparison"],
            }
        elif section.kind == "PARETO":
            block["data"] = {"lines": public_analytics["pareto_lines"]}
        elif section.kind == "ACTIONS":
            block["data"] = {"actions": actions}
        blocks.append(block)
    document = {
        "report": {
            "id": str(report.id),
            "code": report.code,
            "title": report.title,
            "description": report.description,
            "kind": report.report_kind,
        },
        "scope": {
            "period_from": scope.period_from.isoformat(),
            "period_to": scope.period_to.isoformat(),
            "cutoff_at": scope.cutoff_at.isoformat() if scope.cutoff_at else None,
            "timezone": scope.timezone,
            "currency": scope.currency,
            "comparison_mode": scope.comparison_mode,
            "comparison_from": scope.comparison_from.isoformat() if scope.comparison_from else None,
            "comparison_to": scope.comparison_to.isoformat() if scope.comparison_to else None,
            "is_provisional": scope.is_provisional,
            "filters": scope.filters,
        },
        "analytics": public_analytics,
        "sections": blocks,
        "actions": actions,
        "evidence": evidence,
    }
    manifest = {
        "metric_policy": f"{scope.metric_code}@{scope.metric_policy_version}",
        "scope_key": scope.scope_key,
        "coverage": analytics["coverage"],
        "target_revision": analytics["target_revision"],
        "financial_sources": [
            {
                "occurrence_id": row["occurrence_id"],
                "transaction_id": row["transaction_id"],
                "window_key": window_key,
            }
            for window_key, rows in (
                ("CURRENT", analytics["financial_rows"]),
                ("COMPARISON", (analytics.get("comparison") or {}).get("financial_rows", [])),
            )
            for row in rows
        ],
        "action_sources": [{"id": action["id"], "version": action["version"]} for action in actions],
        "evidence_sources": [
            item.get("published", {"source_attachment_id": item.get("source_attachment_id")}) for item in evidence
        ],
    }
    return {
        "document": document,
        "readiness": readiness,
        "manifest": manifest,
        "financial_rows": [
            {**row, "window_key": window_key}
            for window_key, rows in (
                ("CURRENT", analytics["financial_rows"]),
                ("COMPARISON", (analytics.get("comparison") or {}).get("financial_rows", [])),
            )
            for row in rows
        ],
        "fingerprint": canonical_sha256({"report_version": report.version, "document": document, "manifest": manifest}),
    }
