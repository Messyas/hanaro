"""Repeatable, insert-only demo governance data linked to existing Scrap.

Run after migrations and the existing Material Scrap seed. This module never
creates users, rewrites source transactions or fabricates generated artifacts.
"""

import asyncio
import hashlib
import json
import os
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import TypeVar

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.governance.models import (
    ActionCase,
    ActionPlan,
    Alert,
    AlertRecipient,
    AnalysisVersion,
    AuditCycle,
    AuditEvent,
    AuditFinding,
    CaseOccurrence,
    DatasetSnapshot,
    EffectivenessCheck,
    ExportJob,
    Factory,
    GovernanceEntity,
    ImprovementAction,
    LineLayout,
    OutboxEvent,
    ProductionLine,
    ProductionVersion,
    Report,
    ReportAnalysis,
    ReportVersion,
    ReviewDecision,
    ReviewPolicy,
    ScrapCase,
    SnapshotItem,
    Workstation,
)
from src.app.models.material_scrap.models import ScrapOccurrence, ScrapTransaction
from src.app.models.user.models import User
from src.infrastructure.database.session import local_session

NAMESPACE = uuid.UUID("8c4c562c-ce68-4368-bdc7-2e9eb8f7c8cd")
T = TypeVar("T", bound=GovernanceEntity)


def seed_id(key: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, key)


async def _lock_governance(db: AsyncSession) -> None:
    if db.get_bind().dialect.name == "postgresql":
        await db.execute(text("SELECT pg_advisory_xact_lock(728361904)"))


async def _seed_foundation(
    db: AsyncSession,
    add,
) -> tuple[Factory, User | None, ActionPlan, ReviewPolicy]:
    factory = await add(Factory, "factory", code="DEMO-HANARO", name="Hanaro demonstracao")
    admin_username = os.getenv("ADMIN_USERNAME", "").strip()
    recipient = await db.scalar(select(User).where(User.username == admin_username, User.is_deleted.is_(False)))
    if recipient is None:
        recipient = await db.scalar(select(User).where(User.is_deleted.is_(False)).order_by(User.id))
    plan = await add(
        ActionPlan,
        "action-plan",
        factory_id=factory.id,
        title="Plano demonstrativo de redução de Scrap",
        description="Ações corretivas baseadas nas análises publicadas.",
    )
    policy = await add(
        ReviewPolicy,
        "policy-v1",
        factory_id=factory.id,
        code="DEMO-REVIEW",
        revision=1,
        is_active=False,
        rules={"demo": True, "required_cost_brl": "5000.00", "default": "OPTIONAL"},
    )
    return factory, recipient, plan, policy


async def _seed_scenarios(
    db: AsyncSession,
    add,
    rows: list[tuple[ScrapOccurrence, ScrapTransaction]],
    day: datetime,
    factory: Factory,
    policy: ReviewPolicy,
    plan: ActionPlan,
) -> list[ImprovementAction]:
    instant = datetime.combine(day, datetime.min.time(), tzinfo=UTC)
    actions: list[ImprovementAction] = []
    for index, (occurrence, transaction) in enumerate(rows):
        key = f"scenario-{index}"
        line = await add(
            ProductionLine,
            f"{key}-line",
            factory_id=factory.id,
            code=f"DEMO-A{index + 1:02}",
            name=f"Linha demonstrativa {index + 1}",
        )
        layout = await add(LineLayout, f"{key}-layout", line_id=line.id, revision=1, valid_from=day)
        await add(Workstation, f"{key}-station", layout_id=layout.id, code="P01", name="Montagem", position=1)
        for offset in range(7):
            await add(
                ProductionVersion,
                f"{key}-production-{offset}",
                line_id=line.id,
                production_date=day - timedelta(days=offset),
                revision=1,
                quantity=Decimal(1200 + index * 100 + offset * 10),
                source="DEMO",
                status="APPROVED",
                approved_at=instant,
                reason="Synthetic production; not eligible for real operational ranking",
            )
        case = await add(
            ScrapCase,
            f"{key}-case",
            factory_id=factory.id,
            code=f"DEMO-CAS-{index + 1:03}",
            title="Analise demonstrativa de scrap",
            status="ANALYZED",
            due_at=instant + timedelta(days=7),
        )
        primary = await db.scalar(
            select(CaseOccurrence.id).where(
                CaseOccurrence.occurrence_id == occurrence.id,
                CaseOccurrence.is_primary.is_(True),
                CaseOccurrence.unlinked_at.is_(None),
            )
        )
        await add(
            CaseOccurrence,
            f"{key}-occurrence",
            case_id=case.id,
            occurrence_id=occurrence.id,
            is_primary=primary is None,
            reason="Demonstration only; source occurrence preserved",
        )
        await add(
            ReviewDecision,
            f"{key}-decision",
            occurrence_id=occurrence.id,
            policy_id=policy.id,
            disposition=("REQUIRED", "OPTIONAL", "EXEMPT")[index],
            reason="Synthetic scenario, not an operational eligibility decision",
        )
        analysis = await add(
            AnalysisVersion,
            f"{key}-analysis",
            case_id=case.id,
            revision=1,
            decision="ACTION_REQUIRED",
            published_at=instant,
            content={
                "demo": True,
                "problem": "Dano identificado na montagem",
                "containment": "Segregar material",
                "root_cause": "Hipotese demonstrativa",
            },
        )
        action = await add(
            ImprovementAction,
            f"{key}-action",
            factory_id=factory.id,
            code=f"DEMO-ACT-{index + 1:03}",
            title="Melhoria demonstrativa da linha",
            plan_id=plan.id,
            description="Executar e verificar a melhoria identificada na análise.",
            priority=("HIGH", "MEDIUM", "LOW")[index],
            position=index * 1024,
            status=("PLANNED", "IN_PROGRESS", "UNDER_VERIFICATION")[index],
            due_at=instant + timedelta(days=14),
        )
        actions.append(action)
        await add(ActionCase, f"{key}-action-case", action_id=action.id, case_id=case.id)
        if index == 2:
            await add(
                EffectivenessCheck,
                f"{key}-effectiveness",
                action_id=action.id,
                result="INCONCLUSIVE",
                measurement={"demo": True, "reason": "Observation window incomplete"},
            )
        frozen = {
            "demo": True,
            "occurrence_id": str(occurrence.id),
            "issue_amount_brl": str(transaction.issue_amount_brl),
            "amount_usd": str(transaction.amount_usd),
            "source_line": transaction.receipt_department,
            "source_organization": transaction.organization_code,
        }
        digest = hashlib.sha256(json.dumps(frozen, sort_keys=True).encode()).hexdigest()
        snapshot = await add(
            DatasetSnapshot,
            f"{key}-snapshot",
            factory_id=factory.id,
            scope={"demo": True, "source": "existing_scrap"},
            metrics=frozen,
            sha256=digest,
        )
        await add(
            SnapshotItem,
            f"{key}-snapshot-item",
            snapshot_id=snapshot.id,
            occurrence_id=occurrence.id,
            transaction_id=transaction.id,
            frozen_values=frozen,
        )
        if snapshot.sealed_at is None:
            snapshot.sealed_at = instant
            await db.flush()
        report = await add(
            Report,
            f"{key}-report",
            factory_id=factory.id,
            code=f"DEMO-REL-{index + 1:03}",
            title="Relatorio demonstrativo",
        )
        version = await add(
            ReportVersion,
            f"{key}-report-version",
            report_id=report.id,
            snapshot_id=snapshot.id,
            revision=1,
            content={"demo": True, "summary": "Demonstracao"},
            template_version="1",
        )
        await add(ReportAnalysis, f"{key}-report-analysis", report_version_id=version.id, analysis_id=analysis.id)
        if version.published_at is None:
            version.published_at = instant
            await db.flush()
        await add(
            ExportJob,
            f"{key}-export",
            report_version_id=version.id,
            idempotency_key=f"demo-governance-{index}-pdf",
            format="PDF",
            options={
                "language": "pt",
                "include_money": True,
                "include_summary": True,
                "include_occurrences": True,
                "include_justifications": True,
                "include_evidence": True,
            },
        )
        await add(
            AuditEvent,
            f"{key}-audit-event",
            event_type="demo.seeded.v1",
            entity_type="case",
            entity_id=case.id,
            payload={"demo": True},
            correlation_id="demo-governance-v1",
        )
    return actions


def _alert_definitions(
    rows: list[tuple[ScrapOccurrence, ScrapTransaction]],
    actions: list[ImprovementAction],
    factory: Factory,
) -> list[tuple[str, str, str, str, str | uuid.UUID, str]]:
    return [
        (
            "TASK_OVERDUE",
            "CRITICAL",
            "Prazo de acao corretiva proximo",
            "Uma acao demonstrativa precisa de acompanhamento imediato.",
            actions[0].id,
            "/planos-de-acao",
        ),
        (
            "COST_EXCEEDED",
            "WARNING",
            "Custo de Scrap acima do limiar",
            "O custo acumulado do periodo demonstrativo ultrapassou o limite definido.",
            rows[0][0].id,
            "/base-de-scrap",
        ),
        (
            "TASK_ASSIGNED",
            "INFO",
            "Nova tarefa atribuida para validacao",
            "Uma tarefa de melhoria foi atribuida ao fluxo de demonstracao.",
            actions[1].id,
            "/planos-de-acao",
        ),
        (
            "REPORT_EXPORT_COMPLETED",
            "POSITIVE",
            "Relatorio demonstrativo disponivel",
            "O relatorio de acompanhamento foi preparado para consulta.",
            factory.id,
            "/relatorios",
        ),
        (
            "SCRAP_RELEVANT",
            "WARNING",
            "Ocorrencia relevante identificada",
            "Uma ocorrencia de Scrap requer analise de causa e plano de acao.",
            rows[2][0].id,
            "/base-de-scrap",
        ),
    ]


async def _seed_alerts(add, recipient: User | None, rows, actions, factory: Factory) -> None:
    if recipient is None:
        return
    for index, (event_type, severity, title, description, entity_id, link) in enumerate(
        _alert_definitions(rows, actions, factory), start=1
    ):
        event = await add(
            OutboxEvent,
            f"demo-alert-{index}-event",
            event_type=event_type,
            aggregate_id=entity_id,
            payload={
                "demo": True,
                "title": title,
                "description": description,
                "severity": severity,
                "link": link,
                "recipient_ids": [recipient.id],
                "channels": ["FRONT"],
            },
        )
        alert = await add(
            Alert,
            f"demo-alert-{index}",
            event_id=event.id,
            event_type=event_type,
            severity=severity,
            title=title,
            body=event.payload,
            entity_id=entity_id,
        )
        await add(
            AlertRecipient,
            f"demo-alert-{index}-recipient-{recipient.id}",
            alert_id=alert.id,
            user_id=recipient.id,
        )


async def seed_governance(db: AsyncSession) -> dict[str, int]:
    """Caller owns the transaction. Stable IDs and a PG lock allow safe replay."""
    await _lock_governance(db)
    counts: dict[str, int] = {}

    async def add(model: type[T], key: str, **values) -> T:
        identifier = seed_id(key)
        existing = await db.get(model, identifier)
        if existing is not None:
            return existing
        row = model(id=identifier, **values)
        db.add(row)
        await db.flush()
        counts[model.__tablename__] = counts.get(model.__tablename__, 0) + 1
        return row

    rows = [
        (occurrence, transaction)
        for occurrence, transaction in (
            await db.execute(
                select(ScrapOccurrence, ScrapTransaction)
                .join(ScrapTransaction, ScrapOccurrence.current_transaction_id == ScrapTransaction.id)
                .where(ScrapOccurrence.status == "ACTIVE")
                .order_by(ScrapOccurrence.transaction_date.desc(), ScrapOccurrence.id)
                .limit(3)
            )
        ).all()
    ]
    if not rows:
        raise RuntimeError("Seed Material Scrap first: governance demo requires active occurrences")
    day = max(occ.transaction_date for occ, _ in rows)
    factory, recipient, plan, policy = await _seed_foundation(db, add)
    actions = await _seed_scenarios(db, add, rows, day, factory, policy, plan)
    cycle = await add(
        AuditCycle,
        "audit-cycle",
        factory_id=factory.id,
        code="DEMO-AUD-001",
        date_from=day - timedelta(days=6),
        date_to=day,
        status="PLANNED",
        population={"demo": True, "occurrence_ids": [str(o.id) for o, _ in rows]},
    )
    await add(AuditFinding, "audit-finding", cycle_id=cycle.id, description="Demonstracao: validar completude da producao")
    await add(OutboxEvent, "outbox", event_type="demo.governance_seeded.v1", aggregate_id=factory.id, payload={"demo": True})
    await _seed_alerts(add, recipient, rows, actions, factory)
    return counts


async def seed_demo_governance() -> dict[str, int]:
    if os.getenv("ENVIRONMENT", "development") == "production" and os.getenv("SEED_DEMO_DATA", "").lower() != "true":
        raise RuntimeError("Governance demo seed requires SEED_DEMO_DATA=true in production")
    async with local_session() as db, db.begin():
        return await seed_governance(db)


if __name__ == "__main__":
    print(asyncio.run(seed_demo_governance()))
