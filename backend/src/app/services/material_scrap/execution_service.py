"""Lifecycle and read-model operations for Material Scrap automation runs."""

import re
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.material_scrap.enums import (
    AutomationExecutionStatus,
    AutomationMode,
    AutomationSnapshotStatus,
    AutomationTrigger,
    ExecutionSortField,
    ExecutionStepCode,
    ExecutionStepStatus,
    SortOrder,
)
from src.app.models.material_scrap.models import ScrapAutomationExecution, ScrapExecutionNotification, ScrapExecutionStep
from src.app.models.material_scrap.schemas import (
    AutomationExecutionStart,
    ExecutionDetail,
    ExecutionFailure,
    ExecutionListItem,
    ExecutionPage,
    ExecutionStepRead,
    ExecutionStepUpdate,
    MaterialScrapPayload,
)

STEP_SEQUENCE = {step: index for index, step in enumerate(ExecutionStepCode, start=1)}
TERMINAL_EXECUTION_STATES = {
    AutomationExecutionStatus.COMPLETED.value,
    AutomationExecutionStatus.FAILED.value,
    AutomationExecutionStatus.CANCELLED.value,
}
TERMINAL_STEP_STATES = {
    ExecutionStepStatus.COMPLETED.value,
    ExecutionStepStatus.FAILED.value,
    ExecutionStepStatus.SKIPPED.value,
}
_SECRET_PATTERN = re.compile(r"(?i)(password|secret|token|cookie|authorization)\s*[:=]\s*\S+")


def now_utc() -> datetime:
    return datetime.now(UTC)


def duration_ms(started_at: datetime, finished_at: datetime) -> int:
    """SQLite drops timezone offsets; normalize persisted timestamps for tests."""
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=UTC)
    if finished_at.tzinfo is None:
        finished_at = finished_at.replace(tzinfo=UTC)
    return max(0, int((finished_at - started_at).total_seconds() * 1000))


def sanitize_message(value: str) -> str:
    return _SECRET_PATTERN.sub(r"\1=[REDACTED]", value).strip()[:2000]


def _execution_list_item(execution: ScrapAutomationExecution) -> ExecutionListItem:
    duration = None
    if execution.finished_at is not None:
        duration = duration_ms(execution.started_at, execution.finished_at)
    return ExecutionListItem(
        id=execution.id,
        execution_id=execution.execution_id,
        correlation_id=execution.correlation_id,
        source_system=execution.source_system,
        report_name=execution.report_name,
        trigger=AutomationTrigger(execution.trigger),
        mode=AutomationMode(execution.mode),
        status=AutomationExecutionStatus(execution.status),
        current_step=ExecutionStepCode(execution.current_step) if execution.current_step else None,
        query_date_from=execution.query_date_from,
        query_date_to=execution.query_date_to,
        organization_parameter=execution.organization_parameter,
        organizations_found=execution.organizations_found,
        gerp_request_id=execution.gerp_request_id,
        started_at=execution.started_at,
        finished_at=execution.finished_at,
        duration_ms=duration,
        records_received=execution.records_received,
        records_accepted=execution.records_accepted,
        records_rejected=execution.records_rejected,
        snapshot_status=AutomationSnapshotStatus(execution.snapshot_status),
        failure_category=execution.failure_category,
    )


def _step_read(step: ScrapExecutionStep) -> ExecutionStepRead:
    return ExecutionStepRead(
        step_code=ExecutionStepCode(step.step_code),
        sequence=step.sequence,
        attempt=step.attempt,
        status=ExecutionStepStatus(step.status),
        started_at=step.started_at,
        finished_at=step.finished_at,
        duration_ms=step.duration_ms,
        message=step.message,
        error_code=step.error_code,
        metadata=step.metadata_,
    )


async def get_execution(execution_id: uuid.UUID, db: AsyncSession, *, lock: bool = False) -> ScrapAutomationExecution:
    statement = select(ScrapAutomationExecution).where(ScrapAutomationExecution.execution_id == execution_id)
    if lock:
        statement = statement.with_for_update()
    execution = (await db.execute(statement)).scalar_one_or_none()
    if execution is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Automation execution not found")
    return execution


async def start_execution(command: AutomationExecutionStart, db: AsyncSession) -> ScrapAutomationExecution:
    existing = (
        await db.execute(select(ScrapAutomationExecution).where(ScrapAutomationExecution.execution_id == command.execution_id))
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    now = now_utc()
    execution = ScrapAutomationExecution(
        execution_id=command.execution_id,
        correlation_id=command.correlation_id or str(command.execution_id),
        source_system=command.source_system,
        report_name=command.report_name,
        trigger=command.trigger.value,
        mode=command.mode.value,
        status=AutomationExecutionStatus.QUEUED.value,
        organization_parameter=command.organization_parameter,
        query_date_from=command.query_date_from,
        query_date_to=command.query_date_to,
        processing_date=command.processing_date,
        timezone=command.timezone,
        gerp_request_id=command.gerp_request_id,
        started_at=command.started_at or now,
        created_at=now,
        updated_at=now,
        last_heartbeat_at=now,
    )
    db.add(execution)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return await get_execution(command.execution_id, db)
    await db.refresh(execution)
    return execution


async def ensure_execution_from_payload(
    payload: MaterialScrapPayload,
    db: AsyncSession,
    *,
    mark_running: bool = True,
) -> ScrapAutomationExecution:
    """Persist the canonical payload and move an execution into the requested state.

    Producers leave an execution as ``QUEUED``. Only a worker changes it to
    ``RUNNING`` so the operations page describes what is actually happening.
    """
    execution = (
        await db.execute(
            select(ScrapAutomationExecution).where(ScrapAutomationExecution.execution_id == payload.execution.execution_id)
        )
    ).scalar_one_or_none()
    if execution is None:
        command = AutomationExecutionStart(
            execution_id=payload.execution.execution_id,
            source_system=payload.execution.source_system,
            report_name=payload.execution.report_name,
            trigger=payload.execution.trigger,
            mode=AutomationMode(payload.execution.mode),
            organization_parameter=payload.execution.organization_parameter,
            query_date_from=payload.execution.query_date_from,
            query_date_to=payload.execution.query_date_to,
            processing_date=payload.execution.processing_date,
            timezone=payload.execution.timezone,
            gerp_request_id=payload.execution.gerp_request_id,
            started_at=payload.execution.extracted_at,
        )
        execution = await start_execution(command, db)
    if execution.status not in TERMINAL_EXECUTION_STATES:
        execution.status = AutomationExecutionStatus.RUNNING.value if mark_running else AutomationExecutionStatus.QUEUED.value
        execution.organizations_found = payload.execution.organizations_found
        execution.source_file_name = payload.source_file.name
        execution.source_file_sha256 = payload.source_file.sha256
        execution.records_received = payload.statistics.source_rows
        execution.ingestion_payload = payload.model_dump(mode="json")
        execution.updated_at = now_utc()
        execution.last_heartbeat_at = execution.updated_at
        await db.commit()
    return execution


async def record_enqueued_task(execution_id: uuid.UUID, task_id: str, db: AsyncSession) -> None:
    """Associate a durable execution record with its broker message."""
    execution = await get_execution(execution_id, db, lock=True)
    if execution.status in TERMINAL_EXECUTION_STATES:
        return
    now = now_utc()
    execution.task_id = task_id
    execution.status = AutomationExecutionStatus.QUEUED.value
    execution.updated_at = now
    execution.last_heartbeat_at = now
    await db.commit()


async def begin_execution_attempt(execution_id: uuid.UUID, db: AsyncSession) -> int:
    """Mark the broker-delivered attempt as running and return its attempt number."""
    execution = await get_execution(execution_id, db, lock=True)
    if execution.status in TERMINAL_EXECUTION_STATES:
        raise HTTPException(status_code=409, detail="Terminal automation execution cannot be started")
    now = now_utc()
    execution.status = AutomationExecutionStatus.RUNNING.value
    execution.current_step = ExecutionStepCode.JSON_VALIDATION.value
    execution.updated_at = now
    execution.last_heartbeat_at = now
    await db.commit()
    return execution.retry_count + 1


async def prepare_execution_retry(
    execution_id: uuid.UUID, db: AsyncSession
) -> tuple[ScrapAutomationExecution, MaterialScrapPayload]:
    """Reset a failed execution for a new worker attempt using its stored payload."""
    execution = await get_execution(execution_id, db, lock=True)
    if execution.status not in {AutomationExecutionStatus.FAILED.value, AutomationExecutionStatus.CANCELLED.value}:
        raise HTTPException(status_code=409, detail="Only failed or cancelled executions can be retried")
    if not execution.ingestion_payload:
        raise HTTPException(status_code=409, detail="This execution has no stored ingestion payload to retry")
    try:
        payload = MaterialScrapPayload.model_validate(execution.ingestion_payload)
    except Exception as error:
        raise HTTPException(status_code=409, detail="Stored ingestion payload is no longer valid") from error

    now = now_utc()
    execution.status = AutomationExecutionStatus.QUEUED.value
    execution.current_step = None
    execution.task_id = None
    execution.failure_category = None
    execution.failure_code = None
    execution.failure_message = None
    execution.snapshot_status = AutomationSnapshotStatus.NOT_PUBLISHED.value
    execution.finished_at = None
    execution.records_accepted = 0
    execution.records_rejected = 0
    execution.retry_count += 1
    execution.updated_at = now
    execution.last_heartbeat_at = now
    await db.commit()
    return execution, payload


def _validate_step_transition(existing: ScrapExecutionStep | None, command: ExecutionStepUpdate) -> None:
    if existing is None:
        return
    if existing.status in TERMINAL_STEP_STATES and existing.status != command.status.value:
        raise HTTPException(status_code=409, detail="Terminal execution step cannot change state")


async def update_step(
    execution_id: uuid.UUID,
    step_code: ExecutionStepCode,
    command: ExecutionStepUpdate,
    db: AsyncSession,
) -> ScrapAutomationExecution:
    execution = await get_execution(execution_id, db, lock=True)
    if execution.status in TERMINAL_EXECUTION_STATES:
        raise HTTPException(status_code=409, detail="Terminal automation execution cannot be updated")
    statement = select(ScrapExecutionStep).where(
        ScrapExecutionStep.execution_id == execution.id,
        ScrapExecutionStep.step_code == step_code.value,
        ScrapExecutionStep.attempt == command.attempt,
    )
    step = (await db.execute(statement.with_for_update())).scalar_one_or_none()
    _validate_step_transition(step, command)
    now = now_utc()
    started_at = command.started_at or (step.started_at if step is not None else now)
    finished_at = command.finished_at or (now if command.status.value in TERMINAL_STEP_STATES else None)
    elapsed_ms = None if finished_at is None else duration_ms(started_at, finished_at)
    if step is None:
        step = ScrapExecutionStep(
            execution_id=execution.id,
            step_code=step_code.value,
            sequence=STEP_SEQUENCE[step_code],
            attempt=command.attempt,
            status=command.status.value,
            started_at=started_at,
            finished_at=finished_at,
            duration_ms=elapsed_ms,
            message=sanitize_message(command.message) if command.message else None,
            error_code=command.error_code,
            metadata_=command.metadata,
            created_at=now,
            updated_at=now,
        )
        db.add(step)
    else:
        step.status = command.status.value
        step.finished_at = finished_at
        step.duration_ms = elapsed_ms
        step.message = sanitize_message(command.message) if command.message else step.message
        step.error_code = command.error_code or step.error_code
        step.metadata_ = command.metadata or step.metadata_
        step.updated_at = now
    execution.status = AutomationExecutionStatus.RUNNING.value
    execution.current_step = step_code.value
    execution.updated_at = now
    execution.last_heartbeat_at = now
    await db.commit()
    return execution


async def mark_execution_failed(
    execution_id: uuid.UUID,
    command: ExecutionFailure,
    db: AsyncSession,
) -> tuple[ScrapAutomationExecution, uuid.UUID | None]:
    execution = await get_execution(execution_id, db, lock=True)
    if execution.status == AutomationExecutionStatus.COMPLETED.value:
        raise HTTPException(status_code=409, detail="Completed automation execution cannot fail")
    if execution.status == AutomationExecutionStatus.FAILED.value:
        return execution, None
    now = now_utc()
    execution.status = AutomationExecutionStatus.FAILED.value
    execution.current_step = command.step_code.value
    execution.failure_category = command.failure_category
    execution.failure_code = command.failure_code
    execution.failure_message = sanitize_message(command.failure_message)
    execution.snapshot_status = AutomationSnapshotStatus.PRESERVED_PREVIOUS.value
    execution.finished_at = now
    execution.updated_at = now
    execution.last_heartbeat_at = now
    attempt = execution.retry_count + 1
    step = (
        await db.execute(
            select(ScrapExecutionStep).where(
                ScrapExecutionStep.execution_id == execution.id,
                ScrapExecutionStep.step_code == command.step_code.value,
                ScrapExecutionStep.attempt == attempt,
            )
        )
    ).scalar_one_or_none()
    if step is None:
        db.add(
            ScrapExecutionStep(
                execution_id=execution.id,
                step_code=command.step_code.value,
                sequence=STEP_SEQUENCE[command.step_code],
                attempt=attempt,
                status=ExecutionStepStatus.FAILED.value,
                started_at=now,
                finished_at=now,
                duration_ms=0,
                message=execution.failure_message,
                error_code=command.failure_code,
                created_at=now,
                updated_at=now,
            )
        )
    elif step.status not in TERMINAL_STEP_STATES:
        step.status = ExecutionStepStatus.FAILED.value
        step.finished_at = now
        step.duration_ms = duration_ms(step.started_at, now)
        step.message = execution.failure_message
        step.error_code = command.failure_code
        step.updated_at = now
    from src.app.services.governance.notifications.service import emit  # noqa: PLC0415

    emit(
        db,
        "INGESTION_FAILED",
        execution.id,
        {
            "title": "Falha na ingestão",
            "severity": "CRITICAL",
            "link": "/execucoes",
            "description": "A execução terminou com falha.",
        },
    )
    notification_id: uuid.UUID | None = None
    if command.notify_developers:
        notification = ScrapExecutionNotification(
            execution_id=execution.id,
            failure_code=command.failure_code,
            created_at=now,
            updated_at=now,
        )
        db.add(notification)
        await db.flush()
        notification_id = notification.id
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        execution = await get_execution(execution_id, db)
        notification_id = None
    return execution, notification_id


async def link_ingestion_result(
    payload: MaterialScrapPayload,
    db: AsyncSession,
    *,
    ingestion_run_id: uuid.UUID | None,
    is_replay: bool,
    failed: Exception | None = None,
    attempt: int = 1,
) -> None:
    execution = await ensure_execution_from_payload(payload, db)
    if failed is not None:
        _, notification_id = await mark_execution_failed(
            payload.execution.execution_id,
            ExecutionFailure(
                failure_category="INGESTION",
                failure_code=getattr(failed, "code", type(failed).__name__),
                failure_message=str(failed) or type(failed).__name__,
                step_code=ExecutionStepCode.JSON_VALIDATION,
            ),
            db,
        )
        return
    assert ingestion_run_id is not None
    now = now_utc()
    execution.ingestion_run_id = ingestion_run_id
    execution.records_received = payload.statistics.source_rows
    execution.records_accepted = payload.statistics.accepted_rows
    execution.records_rejected = payload.statistics.rejected_rows
    execution.status = AutomationExecutionStatus.COMPLETED.value
    execution.current_step = ExecutionStepCode.SNAPSHOT_PUBLICATION.value
    execution.snapshot_status = (
        AutomationSnapshotStatus.UNCHANGED_REPLAY.value if is_replay else AutomationSnapshotStatus.PUBLISHED.value
    )
    execution.finished_at = now
    execution.updated_at = now
    execution.last_heartbeat_at = now
    for code in (ExecutionStepCode.JSON_VALIDATION, ExecutionStepCode.SNAPSHOT_PUBLICATION):
        step = (
            await db.execute(
                select(ScrapExecutionStep).where(
                    ScrapExecutionStep.execution_id == execution.id,
                    ScrapExecutionStep.step_code == code.value,
                    ScrapExecutionStep.attempt == attempt,
                )
            )
        ).scalar_one_or_none()
        if step is None:
            db.add(
                ScrapExecutionStep(
                    execution_id=execution.id,
                    step_code=code.value,
                    sequence=STEP_SEQUENCE[code],
                    attempt=attempt,
                    status=ExecutionStepStatus.COMPLETED.value,
                    started_at=now,
                    finished_at=now,
                    duration_ms=0,
                    message="Exact replay" if is_replay and code == ExecutionStepCode.SNAPSHOT_PUBLICATION else None,
                    created_at=now,
                    updated_at=now,
                )
            )
        elif step.status not in TERMINAL_STEP_STATES or step.status == ExecutionStepStatus.COMPLETED.value:
            step.status = ExecutionStepStatus.COMPLETED.value
            step.finished_at = now
            step.duration_ms = duration_ms(step.started_at, now)
            step.updated_at = now
    await db.commit()


async def recover_stale_executions(db: AsyncSession, *, stale_after: timedelta) -> int:
    """Fail orphaned queued/running work so it can be retried instead of lying forever."""
    now = now_utc()
    cutoff = now - stale_after
    stale = list(
        (
            await db.execute(
                select(ScrapAutomationExecution)
                .where(
                    ScrapAutomationExecution.status.in_(
                        (AutomationExecutionStatus.QUEUED.value, AutomationExecutionStatus.RUNNING.value)
                    ),
                    or_(
                        ScrapAutomationExecution.last_heartbeat_at < cutoff,
                        (ScrapAutomationExecution.last_heartbeat_at.is_(None)) & (ScrapAutomationExecution.updated_at < cutoff),
                    ),
                )
                .with_for_update()
            )
        ).scalars()
    )
    for execution in stale:
        execution.status = AutomationExecutionStatus.FAILED.value
        execution.snapshot_status = AutomationSnapshotStatus.PRESERVED_PREVIOUS.value
        execution.failure_category = "WORKER"
        execution.failure_code = "WORKER_HEARTBEAT_TIMEOUT"
        execution.failure_message = "The worker stopped before this ingestion finished; retry the execution."
        execution.finished_at = now
        execution.updated_at = now
        execution.last_heartbeat_at = now
    if stale:
        await db.commit()
    return len(stale)


async def list_executions(
    db: AsyncSession,
    *,
    page: int,
    page_size: int,
    date_from: datetime | None,
    date_to: datetime | None,
    status_filter: AutomationExecutionStatus | None,
    mode: str | None,
    trigger: str | None,
    snapshot_status: AutomationSnapshotStatus | None,
    failure_category: str | None,
    execution_id: uuid.UUID | None,
    gerp_request_id: str | None,
    search: str | None,
    sort_by: ExecutionSortField,
    sort_order: SortOrder,
) -> ExecutionPage:
    filters = []
    if date_from:
        filters.append(ScrapAutomationExecution.started_at >= date_from)
    if date_to:
        filters.append(ScrapAutomationExecution.started_at <= date_to)
    if status_filter:
        filters.append(ScrapAutomationExecution.status == status_filter.value)
    if mode:
        filters.append(ScrapAutomationExecution.mode == mode)
    if trigger:
        filters.append(ScrapAutomationExecution.trigger == trigger)
    if snapshot_status:
        filters.append(ScrapAutomationExecution.snapshot_status == snapshot_status.value)
    if failure_category:
        filters.append(ScrapAutomationExecution.failure_category == failure_category)
    if execution_id:
        filters.append(ScrapAutomationExecution.execution_id == execution_id)
    if gerp_request_id:
        filters.append(ScrapAutomationExecution.gerp_request_id == gerp_request_id)
    if search:
        token = f"%{search.strip()}%"
        filters.append(
            or_(
                ScrapAutomationExecution.correlation_id.ilike(token),
                ScrapAutomationExecution.failure_message.ilike(token),
            )
        )
    total = await db.scalar(select(func.count(ScrapAutomationExecution.id)).where(*filters)) or 0
    sort_column = {
        ExecutionSortField.STARTED_AT: ScrapAutomationExecution.started_at,
        ExecutionSortField.FINISHED_AT: ScrapAutomationExecution.finished_at,
        ExecutionSortField.STATUS: ScrapAutomationExecution.status,
    }[sort_by]
    order = sort_column.asc() if sort_order == SortOrder.ASC else sort_column.desc()
    executions = list(
        (
            await db.execute(
                select(ScrapAutomationExecution)
                .where(*filters)
                .order_by(order, ScrapAutomationExecution.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).scalars()
    )
    return ExecutionPage(
        items=[_execution_list_item(item) for item in executions],
        page=page,
        page_size=page_size,
        total_items=total,
        total_pages=(total + page_size - 1) // page_size,
    )


async def get_execution_detail(execution_id: uuid.UUID, db: AsyncSession) -> ExecutionDetail:
    execution = await get_execution(execution_id, db)
    steps = list(
        (
            await db.execute(
                select(ScrapExecutionStep)
                .where(ScrapExecutionStep.execution_id == execution.id)
                .order_by(ScrapExecutionStep.sequence, ScrapExecutionStep.attempt, ScrapExecutionStep.started_at)
            )
        ).scalars()
    )
    return ExecutionDetail(
        **_execution_list_item(execution).model_dump(),
        processing_date=execution.processing_date,
        timezone=execution.timezone,
        source_file_name=execution.source_file_name,
        source_file_sha256=execution.source_file_sha256,
        failure_code=execution.failure_code,
        failure_message=execution.failure_message,
        retry_count=execution.retry_count,
        ingestion_run_id=execution.ingestion_run_id,
        steps=[_step_read(step) for step in steps],
    )
