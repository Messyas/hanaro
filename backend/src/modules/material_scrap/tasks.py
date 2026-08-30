import asyncio
import smtplib
from datetime import UTC, datetime
from email.message import EmailMessage
from typing import Any, cast

from ...infrastructure.config.settings import get_settings
from ...infrastructure.taskiq.brokers import default_broker
from ...infrastructure.taskiq.deps import DBSession
from ...infrastructure.taskiq.registry import register_task
from .models import ScrapAutomationExecution, ScrapExecutionNotification
from .schemas import IngestionResult, MaterialScrapPayload
from .service import ingest_material_scrap


@default_broker.task(task_name="material_scrap.ingest")
async def ingest_material_scrap_task(payload: dict[str, Any], db: DBSession) -> dict[str, Any]:
    """Worker-ready entry point for the future Smart Office payload."""
    result: IngestionResult = await ingest_material_scrap(MaterialScrapPayload.model_validate(payload), db)
    return result.model_dump(mode="json")


register_task("material_scrap.ingest", "default", ingest_material_scrap_task)


async def enqueue_material_scrap(payload: MaterialScrapPayload) -> str:
    """Publish a canonical batch and return its Taskiq identifier."""
    # Taskiq injects the DBSession dependency in the worker; its type overload
    # still exposes that injected argument to producers, so narrow it here.
    task = await ingest_material_scrap_task.kiq(  # type: ignore[call-overload]
        payload.model_dump(mode="json")
    )
    return cast(str, task.task_id)


def _send_failure_email(subject: str, body: str) -> None:
    settings = get_settings()
    recipients = settings.MATERIAL_SCRAP_DEVELOPER_EMAIL_LIST
    if not recipients or not settings.SMTP_HOST or not settings.SMTP_FROM:
        raise RuntimeError("SMTP notification is not configured")
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM
    message["To"] = ", ".join(recipients)
    message.set_content(body)
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as client:
        if settings.SMTP_USE_TLS:
            client.starttls()
        if settings.SMTP_USERNAME:
            client.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        client.send_message(message)


@default_broker.task(task_name="material_scrap.notify_failure")
async def notify_material_scrap_failure(notification_id: str, db: DBSession) -> None:
    notification = await db.get(ScrapExecutionNotification, notification_id, with_for_update=True)
    if notification is None or notification.status == "SENT":
        return
    execution = await db.get(ScrapAutomationExecution, notification.execution_id)
    if execution is None:
        return
    settings = get_settings()
    notification.attempts += 1
    notification.updated_at = datetime.now(UTC)
    if not settings.MATERIAL_SCRAP_DEVELOPER_EMAIL_LIST or not settings.SMTP_HOST or not settings.SMTP_FROM:
        notification.status = "SKIPPED"
        notification.last_error = "SMTP notification is not configured"
        await db.commit()
        return
    try:
        await asyncio.to_thread(
            _send_failure_email,
            f"[Hanaro] Material Scrap failure: {execution.failure_code}",
            "\n".join((
                f"execution_id: {execution.execution_id}",
                f"category: {execution.failure_category}",
                f"code: {execution.failure_code}",
                f"message: {execution.failure_message}",
            )),
        )
    except Exception as error:
        notification.status = "FAILED"
        notification.last_error = type(error).__name__[:1000]
    else:
        notification.status = "SENT"
        notification.sent_at = datetime.now(UTC)
        notification.last_error = None
    await db.commit()


register_task("material_scrap.notify_failure", "default", notify_material_scrap_failure)


async def enqueue_execution_notification(notification_id: str) -> str:
    task = await notify_material_scrap_failure.kiq(notification_id)  # type: ignore[call-overload]
    return cast(str, task.task_id)
