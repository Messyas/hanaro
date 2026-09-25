import asyncio
import uuid
from datetime import timedelta
from typing import Literal, Protocol

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...user.models import User
from ..models import (
    Alert,
    AlertRecipient,
    ConsumerReceipt,
    EmailDelivery,
    EventAttempt,
    ExportJob,
    NotificationRule,
    OutboxEvent,
    now,
)
from .templates import email_content

NotificationChannel = Literal["FRONT", "EMAIL"]
BOTH: list[NotificationChannel] = ["FRONT", "EMAIL"]
CHANNELS: dict[str, list[NotificationChannel]] = {
    name: BOTH
    for name in (
        "SCRAP_RELEVANT",
        "COST_EXCEEDED",
        "GOAL_ACHIEVED",
        "INGESTION_FAILED",
        "UPDATE_LATE",
        "REPORT_EXPORT_FAILED",
        "TASK_OVERDUE",
        "TASK_BLOCKED",
    )
}
CHANNELS.update(
    {
        name: ["EMAIL"]
        for name in ("TASK_ASSIGNED", "TASK_DUE", "TASK_VERIFICATION", "TASK_VALIDATED", "REPORT_EXPORT_COMPLETED")
    }
)


class EmailProvider(Protocol):
    def result(self) -> tuple[str, str]: ...


class SimulatedEmailProvider:
    def result(self) -> tuple[str, str]:
        return "simulation", "SIMULATED"


def emit(db: AsyncSession, event_type: str, entity_id: uuid.UUID, payload: dict) -> OutboxEvent:
    event = OutboxEvent(event_type=event_type, aggregate_id=entity_id, payload=payload)
    db.add(event)
    return event


async def consume(db: AsyncSession, event: OutboxEvent, provider: EmailProvider | None = None) -> None:
    if await db.scalar(
        select(ConsumerReceipt.id).where(ConsumerReceipt.consumer == "notifications-v1", ConsumerReceipt.event_id == event.id)
    ):
        return
    configs = list(await db.scalars(select(NotificationRule).where(NotificationRule.event_type == event.event_type)))
    body = dict(event.payload)
    channels = body.get("channels", CHANNELS.get(event.event_type, []))
    recipients = set(body.get("recipient_ids", []))
    if configs and "rule_id" not in body:
        channels, recipients = [], set()
        for rule in configs:
            if rule.enabled:
                channels += rule.config.get("channels", [])
                recipients.update(rule.config.get("user_ids", []))
                tiers = rule.config.get("tier_ids", [])
                recipients.update(await db.scalars(select(User.id).where(User.tier_id.in_(tiers), User.is_deleted.is_(False))))
    if channels:
        users = list(await db.scalars(select(User).where(User.id.in_(recipients), User.is_deleted.is_(False))))
        if "FRONT" in channels and users:
            alert = Alert(
                event_id=event.id,
                event_type=event.event_type,
                severity=body.get("severity", "INFO"),
                title=body.get("title", event.event_type)[:240],
                body=body,
                entity_id=event.aggregate_id,
            )
            db.add(alert)
            await db.flush()
            db.add_all([AlertRecipient(alert_id=alert.id, user_id=user.id) for user in users])
        if "EMAIL" in channels:
            subject, text = email_content(event.event_type, body)
            provider_name, outcome = (provider or SimulatedEmailProvider()).result()
            for user in users:
                db.add(
                    EmailDelivery(
                        event_id=event.id,
                        user_id=user.id,
                        recipient=user.notification_email or user.email,
                        subject=subject,
                        body=text,
                        provider=provider_name,
                        status=outcome,
                    )
                )
    db.add(ConsumerReceipt(consumer="notifications-v1", event_id=event.id))


async def dispatch(db: AsyncSession, enqueue, limit: int = 50) -> int:
    """Lock one event per short transaction. Broker acceptance may duplicate; job claims fence it."""
    processed = 0
    for _ in range(limit):
        event = await db.scalar(
            select(OutboxEvent)
            .where(OutboxEvent.published_at.is_(None), OutboxEvent.available_at <= now(), OutboxEvent.attempts < 8)
            .order_by(OutboxEvent.available_at, OutboxEvent.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        if event is None:
            await db.rollback()
            break
        event_id, attempt = event.id, event.attempts + 1
        try:
            if event.event_type == "REPORT_EXPORT_REQUESTED":
                await asyncio.wait_for(enqueue(event.aggregate_id), timeout=10)
            else:
                await consume(db, event)
            event.attempts = attempt
            event.published_at = now()
            db.add(EventAttempt(event_id=event_id, attempt=attempt, outcome="ACCEPTED"))
            await db.commit()
            processed += 1
        except Exception:
            await db.rollback()
            event = await db.get(OutboxEvent, event_id, with_for_update=True)
            if event is None:
                raise RuntimeError("Outbox event disappeared during dispatch")
            event.attempts = attempt
            event.available_at = now() + timedelta(seconds=min(3600, 2**attempt * 5))
            if attempt >= 8 and event.event_type == "REPORT_EXPORT_REQUESTED":
                job = await db.get(ExportJob, event.aggregate_id, with_for_update=True)
                if job and job.status == "QUEUED":
                    job.status = "FAILED"
                    job.error_message = "Export dispatch retry limit reached"
                    emit(
                        db,
                        "REPORT_EXPORT_FAILED",
                        job.id,
                        {"title": "Export dispatch failed", "recipient_ids": [job.requested_by_user_id]},
                    )
            db.add(EventAttempt(event_id=event_id, attempt=attempt, outcome="FAILED", error="Notification dispatch failed"))
            await db.commit()
    return processed


async def recover_exports(db: AsyncSession) -> None:
    # Recover accepted-but-lost broker messages and abandoned worker leases.
    jobs = list(
        await db.scalars(
            select(ExportJob)
            .where(
                or_(
                    (ExportJob.status == "RUNNING") & (ExportJob.lease_until < now()),
                    (ExportJob.status == "QUEUED") & (ExportJob.updated_at < now() - timedelta(minutes=5)),
                )
            )
            .order_by(ExportJob.id)
            .limit(100)
            .with_for_update(skip_locked=True)
        )
    )
    for job in jobs:
        job.updated_at = now()
        if job.attempts >= 3:
            job.status = "FAILED"
            job.lease_token = None
            job.error_message = "Export retry limit reached"
            emit(db, "REPORT_EXPORT_FAILED", job.id, {"title": "Export failed", "recipient_ids": [job.requested_by_user_id]})
        else:
            job.status = "QUEUED"
            job.lease_token = None
            pending = await db.scalar(
                select(OutboxEvent.id).where(
                    OutboxEvent.aggregate_id == job.id,
                    OutboxEvent.event_type == "REPORT_EXPORT_REQUESTED",
                    OutboxEvent.published_at.is_(None),
                    OutboxEvent.attempts < 8,
                )
            )
            if not pending:
                emit(db, "REPORT_EXPORT_REQUESTED", job.id, {"export_job_id": str(job.id)})
    await db.commit()
