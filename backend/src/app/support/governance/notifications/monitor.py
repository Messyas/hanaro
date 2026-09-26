"""Periodic evaluation runs with the worker; it cannot detect total backend outages."""

from datetime import UTC, timedelta
from decimal import Decimal

from sqlalchemy import select

from src.app.models.governance.models import ActionParticipant, ImprovementAction, NotificationRule, RuleEvaluation, now
from src.app.models.material_scrap.models import IngestionRun
from src.app.services.governance.notifications.service import emit
from src.app.support.governance.notifications.rules import RuleInput


def _normalize_timezone(dt):
    """Ensure datetime has UTC timezone."""
    return dt.replace(tzinfo=UTC) if dt and dt.tzinfo is None else dt


async def _get_update_late_subjects(db, rule, config):
    """Get subjects for UPDATE_LATE event type."""
    run = await db.scalar(select(IngestionRun).order_by(IngestionRun.ingestion_finished_at.desc()).limit(1))
    last = run.ingestion_finished_at if run else None
    last = _normalize_timezone(last)
    if not last or now() - last > timedelta(days=config.window_days):
        return [(rule.id, "Atualização atrasada", "/execucoes", config.user_ids)]
    return []


async def _get_task_subjects(db, rule, config):
    """Get subjects for TASK_DUE or TASK_OVERDUE event types."""
    tasks = list(
        await db.scalars(
            select(ImprovementAction)
            .where(
                ImprovementAction.status != "COMPLETED",
                ImprovementAction.due_at.is_not(None),
                ImprovementAction.due_at < now() + timedelta(days=1),
            )
            .order_by(ImprovementAction.id)
        )
    )
    subjects = []
    for task in tasks:
        due = _normalize_timezone(task.due_at)
        if (rule.event_type == "TASK_OVERDUE") != (due < now()):
            continue
        participants = list(await db.scalars(select(ActionParticipant.user_id).where(ActionParticipant.action_id == task.id)))
        subjects.append(
            (
                task.id,
                task.title,
                f"/planos-de-acao/{task.plan_id}?task={task.id}",
                sorted(set(config.user_ids + participants)),
            )
        )
    return subjects


async def _process_subject(db, rule, entity_id, title, link, recipients, config):
    """Process a single subject and emit notification if needed."""
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

    last = _normalize_timezone(evaluation.last_fired_at)
    if last and now() - last < timedelta(minutes=config.cooldown_minutes):
        return

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


async def monitor(db):
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
            subjects = await _get_update_late_subjects(db, rule, config)
        else:
            subjects = await _get_task_subjects(db, rule, config)

        for entity_id, title, link, recipients in subjects:
            await _process_subject(db, rule, entity_id, title, link, recipients, config)

    await db.commit()
