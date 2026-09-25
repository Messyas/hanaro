"""Periodic evaluation runs with the worker; it cannot detect total backend outages."""

import uuid
from datetime import UTC, timedelta
from decimal import Decimal

from sqlalchemy import or_, select

from ...material_scrap.models import IngestionRun
from ..models import ActionParticipant, ActionPlan, ImprovementAction, NotificationRule, OutboxEvent, RuleEvaluation, now
from .rules import RuleInput
from .service import emit


async def monitor_task_deadlines(db, active_rule_types: set[str]) -> None:
    instant = now()
    tasks = list(
        await db.scalars(
            select(ImprovementAction)
            .join(ActionPlan, ActionPlan.id == ImprovementAction.plan_id)
            .where(
                ActionPlan.status == "OPEN",
                ImprovementAction.status != "COMPLETED",
                ImprovementAction.due_at.is_not(None),
                ImprovementAction.due_at < instant + timedelta(days=1),
            )
            .order_by(ImprovementAction.id)
            .with_for_update(of=ImprovementAction, skip_locked=True)
        )
    )
    for task in tasks:
        due = task.due_at.replace(tzinfo=UTC) if task.due_at.tzinfo is None else task.due_at.astimezone(UTC)
        event_type = "TASK_OVERDUE" if due < instant else "TASK_DUE"
        if event_type in active_rule_types:
            continue
        event_id = uuid.uuid5(uuid.NAMESPACE_URL, f"action-deadline:{task.id}:{due.isoformat()}:{event_type}")
        if await db.get(OutboxEvent, event_id):
            continue
        recipients = sorted(
            set(await db.scalars(select(ActionParticipant.user_id).where(ActionParticipant.action_id == task.id)))
        )
        event = emit(
            db,
            event_type,
            task.id,
            {
                "title": task.title,
                "due_at": due.isoformat(),
                "recipient_ids": recipients,
                "link": f"/planos-de-acao/{task.plan_id}?task={task.id}",
            },
        )
        event.id = event_id


async def monitor(db):
    active_rule_types = set(
        await db.scalars(
            select(NotificationRule.event_type).where(
                NotificationRule.enabled.is_(True), NotificationRule.event_type.in_(["TASK_DUE", "TASK_OVERDUE"])
            )
        )
    )
    rules = list(
        await db.scalars(
            select(NotificationRule)
            .where(
                NotificationRule.enabled.is_(True), NotificationRule.event_type.in_(["TASK_DUE", "TASK_OVERDUE", "UPDATE_LATE"])
            )
            .order_by(NotificationRule.id)
            .with_for_update(skip_locked=True)
        )
    )
    for rule in rules:
        config = RuleInput.model_validate(rule.config)
        if rule.event_type == "UPDATE_LATE":
            run = await db.scalar(select(IngestionRun).order_by(IngestionRun.ingestion_finished_at.desc()).limit(1))
            last = run.ingestion_finished_at if run else None
            if last and last.tzinfo is None:
                last = last.replace(tzinfo=UTC)
            subjects = (
                [(rule.id, "Atualização atrasada", "/execucoes", config.user_ids)]
                if not last or now() - last > timedelta(days=config.window_days)
                else []
            )
        else:
            tasks = list(
                await db.scalars(
                    select(ImprovementAction)
                    .outerjoin(ActionPlan, ActionPlan.id == ImprovementAction.plan_id)
                    .where(
                        or_(ImprovementAction.plan_id.is_(None), ActionPlan.status == "OPEN"),
                        ImprovementAction.status != "COMPLETED",
                        ImprovementAction.due_at.is_not(None),
                        ImprovementAction.due_at < now() + timedelta(days=1),
                    )
                    .order_by(ImprovementAction.id)
                )
            )
            subjects = []
            for task in tasks:
                due = task.due_at.replace(tzinfo=UTC) if task.due_at.tzinfo is None else task.due_at
                if (rule.event_type == "TASK_OVERDUE") != (due < now()):
                    continue
                participants = list(
                    await db.scalars(select(ActionParticipant.user_id).where(ActionParticipant.action_id == task.id))
                )
                subjects.append(
                    (
                        task.id,
                        task.title,
                        f"/planos-de-acao/{task.plan_id}?task={task.id}",
                        sorted(set(config.user_ids + participants)),
                    )
                )
        for entity_id, title, link, recipients in subjects:
            evaluation = await db.scalar(
                select(RuleEvaluation).where(
                    RuleEvaluation.rule_id == rule.id,
                    RuleEvaluation.window_key == "reminder",
                    RuleEvaluation.subject == str(entity_id),
                )
            )
            if evaluation is None:
                evaluation = RuleEvaluation(
                    rule_id=rule.id,
                    window_key="reminder",
                    subject=str(entity_id),
                    observed=Decimal("0"),
                )
                db.add(evaluation)
            last = evaluation.last_fired_at
            if last and last.tzinfo is None:
                last = last.replace(tzinfo=UTC)
            if last and now() - last < timedelta(minutes=config.cooldown_minutes):
                continue
            evaluation.last_fired_at, evaluation.sequence = now(), evaluation.sequence + 1
            emit(
                db,
                rule.event_type,
                entity_id,
                {
                    "title": title,
                    "link": link,
                    "recipient_ids": recipients,
                    "channels": config.channels,
                    "severity": config.severity,
                    "rule_id": str(rule.id),
                },
            )
    await monitor_task_deadlines(db, active_rule_types)
    await db.commit()
