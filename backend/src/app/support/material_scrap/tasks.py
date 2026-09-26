import asyncio
import logging
import smtplib
from datetime import UTC, datetime
from email.message import EmailMessage
from typing import Any, cast

from src.app.models.material_scrap.enums import ExecutionStepCode, ExecutionStepStatus
from src.app.models.material_scrap.models import ScrapAutomationExecution, ScrapExecutionNotification
from src.app.models.material_scrap.schemas import ExecutionStepUpdate, IngestionResult, MaterialScrapPayload
from src.app.services.material_scrap.execution_service import begin_execution_attempt, update_step
from src.app.services.material_scrap.service import ingest_material_scrap
from src.infrastructure.config.settings import get_settings
from src.infrastructure.database.session import local_session
from src.infrastructure.taskiq.brokers import default_broker
from src.infrastructure.taskiq.deps import DBSession
from src.infrastructure.taskiq.registry import register_task

logger = logging.getLogger(__name__)


async def run_material_scrap_ingestion(payload: MaterialScrapPayload, db: DBSession) -> IngestionResult:
    """Run one canonical batch and expose its worker state to the execution monitor."""
    attempt = await begin_execution_attempt(payload.execution.execution_id, db)
    await update_step(
        payload.execution.execution_id,
        ExecutionStepCode.JSON_VALIDATION,
        ExecutionStepUpdate(
            status=ExecutionStepStatus.RUNNING,
            attempt=attempt,
            message="Worker is validating and publishing the Material Scrap ingestion.",
            metadata={"records_total": payload.statistics.source_rows},
        ),
        db,
    )
    return await ingest_material_scrap(payload, db, attempt=attempt)


async def ingest_material_scrap_in_web_process(payload: MaterialScrapPayload) -> None:
    """Demo-only fallback for hosts without a separate worker service.

    The durable Taskiq path remains the default. Render's free demo does not
    provide a worker, so this path lets a manual video demonstration show the
    same execution lifecycle without importing the external RPA package.
    """
    try:
        async with local_session() as db:
            await run_material_scrap_ingestion(payload, db)
    except Exception:
        logger.exception("manual_material_scrap_ingestion_failed", extra={"execution_id": str(payload.execution.execution_id)})


@default_broker.task(task_name="material_scrap.ingest")
async def ingest_material_scrap_task(payload: dict[str, Any], db: DBSession) -> dict[str, Any]:
    """Worker-ready entry point for the future Smart Office payload."""
    canonical_payload = MaterialScrapPayload.model_validate(payload)
    result = await run_material_scrap_ingestion(canonical_payload, db)
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
            "\n".join(
                (
                    f"execution_id: {execution.execution_id}",
                    f"category: {execution.failure_category}",
                    f"code: {execution.failure_code}",
                    f"message: {execution.failure_message}",
                )
            ),
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
