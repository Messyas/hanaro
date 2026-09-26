import uuid
from datetime import UTC, date, datetime, time
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Path, Query, Response, UploadFile, status
from pydantic import StringConstraints
from starlette.concurrency import run_in_threadpool
from starlette.responses import FileResponse

from src.app.models.material_scrap.enums import (
    AutomationExecutionStatus,
    AutomationMode,
    AutomationSnapshotStatus,
    AutomationTrigger,
    BreakdownGroupBy,
    BreakdownMetric,
    DashboardCurrency,
    DashboardMetric,
    ExecutionSortField,
    ExecutionStepCode,
    ImpactMode,
    ScrapReviewFilterStatus,
    ScrapSortField,
    SortOrder,
    ToBeCountedFilter,
    TrendGroupBy,
)
from src.app.models.material_scrap.schemas import (
    AutomationExecutionStart,
    DashboardResponse,
    ExecutionDetail,
    ExecutionFailure,
    ExecutionPage,
    ExecutionStepUpdate,
    IngestionAccepted,
    MaterialScrapPayload,
    ScrapBreakdownItem,
    ScrapClassificationReapplyResult,
    ScrapClassificationRuleRead,
    ScrapClassificationRuleWrite,
    ScrapDefectTypeCreate,
    ScrapDefectTypeRead,
    ScrapDefectTypeUpdate,
    ScrapFilterOptions,
    ScrapPage,
    ScrapReviewAttachmentRead,
    ScrapReviewBulkCreate,
    ScrapReviewBulkResult,
    ScrapReviewRead,
    ScrapReviewTemplateCreate,
    ScrapReviewTemplateRead,
    ScrapReviewTemplateUpdate,
    ScrapReviewWrite,
    ScrapSummary,
    ScrapTargetBatchUpsert,
    ScrapTargetRead,
    ScrapTargetUpsert,
    ScrapTrendPoint,
)
from src.app.services.material_scrap.execution_service import (
    ensure_execution_from_payload,
    get_execution_detail,
    list_executions,
    mark_execution_failed,
    prepare_execution_retry,
    record_enqueued_task,
    start_execution,
    update_step,
)
from src.app.services.material_scrap.manual_upload import ManualUploadValidationError, build_manual_upload_payload
from src.app.services.material_scrap.query_service import (
    ScrapFilters,
    get_breakdown,
    get_filter_options,
    get_summary,
    get_trend,
    list_scrap,
)
from src.app.services.material_scrap.review_image import ALLOWED_IMAGE_CONTENT_TYPES, ScrapReviewImageValidationError
from src.app.services.material_scrap.review_service import (
    ScrapReviewConflictError,
    ScrapReviewNotFoundError,
    ScrapReviewPermissionError,
    ScrapReviewValidationError,
    add_review_attachment,
    assert_review_accepts_attachment,
    create_bulk_reviews,
    create_defect_type,
    create_review_template,
    delete_defect_type,
    delete_review_attachment,
    delete_review_template,
    finalize_review,
    get_review_attachment,
    get_review_for_occurrence,
    list_defect_types,
    list_review_templates,
    save_review_draft,
    update_defect_type,
    update_review_template,
)
from src.app.support.material_scrap.dependencies import (
    ScrapClassificationServiceDep,
    ScrapDashboardServiceDep,
    ScrapReviewImageStorageDep,
    ScrapTargetServiceDep,
    require_material_scrap_ingestion_key,
)
from src.app.support.material_scrap.tasks import (
    enqueue_execution_notification,
    enqueue_material_scrap,
    ingest_material_scrap_in_web_process,
)
from src.infrastructure.config import get_settings
from src.infrastructure.dependencies import AsyncSessionDep, CurrentSuperUserDep, CurrentUserDep, OptionalUserDep

scrap_router = APIRouter(tags=["Material Scrap"])
dashboard_router = APIRouter(tags=["Material Scrap Dashboard"])

FilterValue = Annotated[str, StringConstraints(min_length=1, max_length=120)]


@scrap_router.get("/classifications", response_model=list[ScrapClassificationRuleRead])
async def list_scrap_classifications(
    db: AsyncSessionDep,
    service: ScrapClassificationServiceDep,
    _: CurrentUserDep,
) -> list[ScrapClassificationRuleRead]:
    return await service.list(db)


@scrap_router.post("/classifications", response_model=ScrapClassificationRuleRead, status_code=status.HTTP_201_CREATED)
async def create_scrap_classification(
    command: ScrapClassificationRuleWrite,
    db: AsyncSessionDep,
    service: ScrapClassificationServiceDep,
    current_user: CurrentUserDep,
) -> ScrapClassificationRuleRead:
    try:
        return await service.create(command, int(current_user["id"]), db)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@scrap_router.put("/classifications/{rule_id}", response_model=ScrapClassificationRuleRead)
async def update_scrap_classification(
    rule_id: uuid.UUID,
    command: ScrapClassificationRuleWrite,
    db: AsyncSessionDep,
    service: ScrapClassificationServiceDep,
    current_user: CurrentUserDep,
) -> ScrapClassificationRuleRead:
    try:
        return await service.update(rule_id, command, int(current_user["id"]), db)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@scrap_router.delete("/classifications/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scrap_classification(
    rule_id: uuid.UUID,
    db: AsyncSessionDep,
    service: ScrapClassificationServiceDep,
    _: CurrentUserDep,
) -> Response:
    try:
        await service.delete(rule_id, db)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@scrap_router.post("/classifications/reapply", response_model=ScrapClassificationReapplyResult)
async def reapply_scrap_classifications(
    db: AsyncSessionDep,
    service: ScrapClassificationServiceDep,
    _: CurrentUserDep,
) -> ScrapClassificationReapplyResult:
    count, revision = await service.reapply(db)
    return ScrapClassificationReapplyResult(reclassified_records=count, dashboard_revision=revision)


def build_filters(
    date_from: date | None = None,
    date_to: date | None = None,
    organizations: Annotated[list[FilterValue] | None, Query(max_length=50)] = None,
    receipt_departments: Annotated[list[FilterValue] | None, Query(max_length=50)] = None,
    departments: Annotated[list[FilterValue] | None, Query(max_length=50)] = None,
    products: Annotated[list[FilterValue] | None, Query(max_length=50)] = None,
    divisions: Annotated[list[FilterValue] | None, Query(max_length=50)] = None,
    item_types: Annotated[list[FilterValue] | None, Query(max_length=50)] = None,
    account_codes: Annotated[list[FilterValue] | None, Query(max_length=50)] = None,
    account_aliases: Annotated[list[FilterValue] | None, Query(max_length=50)] = None,
    item_codes: Annotated[list[FilterValue] | None, Query(max_length=50)] = None,
    to_be_counted: ToBeCountedFilter | None = None,
    week: int | None = Query(default=None, ge=1, le=53),
) -> ScrapFilters:
    if date_from is not None and date_to is not None and date_to < date_from:
        raise HTTPException(status_code=422, detail="date_to must not be before date_from")
    return ScrapFilters(
        date_from=date_from,
        date_to=date_to,
        organizations=organizations,
        receipt_departments=receipt_departments,
        departments=departments,
        products=products,
        divisions=divisions,
        item_types=item_types,
        account_codes=account_codes,
        account_aliases=account_aliases,
        item_codes=item_codes,
        to_be_counted=to_be_counted,
        week=week,
    )


ScrapFiltersDep = Annotated[ScrapFilters, Depends(build_filters)]


@scrap_router.post(
    "/ingestions",
    response_model=IngestionAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_scrap_ingestion(
    payload: MaterialScrapPayload,
    db: AsyncSessionDep,
    _: Annotated[int, Depends(require_material_scrap_ingestion_key)],
) -> IngestionAccepted:
    # The execution is created before queueing so queue/worker failures remain observable.
    if not get_settings().TASKIQ_ENABLED:
        raise HTTPException(status_code=503, detail="Material Scrap worker is disabled")
    await ensure_execution_from_payload(payload, db, mark_running=False)
    try:
        task_id = await enqueue_material_scrap(payload)
        await record_enqueued_task(payload.execution.execution_id, task_id, db)
    except Exception as error:
        await mark_execution_failed(
            payload.execution.execution_id,
            ExecutionFailure(
                failure_category="QUEUE",
                failure_code=type(error).__name__,
                failure_message="Unable to enqueue Material Scrap ingestion",
                step_code=ExecutionStepCode.JSON_VALIDATION,
            ),
            db,
        )
        raise HTTPException(status_code=503, detail="Unable to queue Material Scrap ingestion") from error
    return IngestionAccepted(task_id=task_id, execution_id=payload.execution.execution_id)


@scrap_router.post("/manual-ingestions", response_model=IngestionAccepted, status_code=status.HTTP_202_ACCEPTED)
async def create_manual_scrap_ingestion(
    background_tasks: BackgroundTasks,
    db: AsyncSessionDep,
    _: CurrentSuperUserDep,
    file: UploadFile = File(...),
) -> IngestionAccepted:
    """Upload the approved GERP report and process it through the canonical pipeline."""
    raw_bytes = await file.read()
    try:
        payload = await build_manual_upload_payload(filename=file.filename, raw_bytes=raw_bytes, db=db)
    except ManualUploadValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    finally:
        await file.close()

    await ensure_execution_from_payload(payload, db, mark_running=False)
    if get_settings().TASKIQ_ENABLED:
        try:
            task_id = await enqueue_material_scrap(payload)
        except Exception as error:
            await mark_execution_failed(
                payload.execution.execution_id,
                ExecutionFailure(
                    failure_category="QUEUE",
                    failure_code=type(error).__name__,
                    failure_message="Unable to queue manual Material Scrap ingestion",
                    step_code=ExecutionStepCode.JSON_VALIDATION,
                ),
                db,
            )
            raise HTTPException(status_code=503, detail="Unable to queue manual ingestion") from error
    else:
        task_id = f"web-demo-{payload.execution.execution_id}"
        background_tasks.add_task(ingest_material_scrap_in_web_process, payload)
    await record_enqueued_task(payload.execution.execution_id, task_id, db)
    return IngestionAccepted(task_id=task_id, execution_id=payload.execution.execution_id)


@scrap_router.post("/executions/{execution_id}/retry", response_model=ExecutionDetail)
async def retry_automation_execution(
    execution_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSessionDep,
    _: CurrentSuperUserDep,
) -> ExecutionDetail:
    """Retry a failed ingestion from the payload retained in its execution record."""
    _execution, payload = await prepare_execution_retry(execution_id, db)
    if get_settings().TASKIQ_ENABLED:
        try:
            task_id = await enqueue_material_scrap(payload)
        except Exception as error:
            await mark_execution_failed(
                execution_id,
                ExecutionFailure(
                    failure_category="QUEUE",
                    failure_code=type(error).__name__,
                    failure_message="Unable to enqueue Material Scrap retry",
                    step_code=ExecutionStepCode.JSON_VALIDATION,
                ),
                db,
            )
            raise HTTPException(status_code=503, detail="Unable to queue Material Scrap retry") from error
    else:
        task_id = f"web-demo-{execution_id}"
        background_tasks.add_task(ingest_material_scrap_in_web_process, payload)
    await record_enqueued_task(execution_id, task_id, db)
    return await get_execution_detail(execution_id, db)


@scrap_router.post("/executions", response_model=ExecutionDetail, status_code=status.HTTP_201_CREATED)
async def create_automation_execution(
    command: AutomationExecutionStart,
    db: AsyncSessionDep,
    _: Annotated[int, Depends(require_material_scrap_ingestion_key)],
) -> ExecutionDetail:
    execution = await start_execution(command, db)
    return await get_execution_detail(execution.execution_id, db)


@scrap_router.put("/executions/{execution_id}/steps/{step_code}", response_model=ExecutionDetail)
async def update_automation_execution_step(
    command: ExecutionStepUpdate,
    db: AsyncSessionDep,
    _: Annotated[int, Depends(require_material_scrap_ingestion_key)],
    execution_id: uuid.UUID,
    step_code: ExecutionStepCode,
) -> ExecutionDetail:
    await update_step(execution_id, step_code, command, db)
    return await get_execution_detail(execution_id, db)


@scrap_router.post("/executions/{execution_id}/fail", response_model=ExecutionDetail)
async def fail_automation_execution(
    command: ExecutionFailure,
    db: AsyncSessionDep,
    _: Annotated[int, Depends(require_material_scrap_ingestion_key)],
    execution_id: uuid.UUID,
) -> ExecutionDetail:
    _execution, notification_id = await mark_execution_failed(execution_id, command, db)
    if notification_id is not None:
        try:
            await enqueue_execution_notification(str(notification_id))
        except Exception:
            # The outbox record is durable and can be retried by operations; a
            # notification-broker outage must not change the recorded failure.
            pass
    return await get_execution_detail(execution_id, db)


@scrap_router.get("/executions", response_model=ExecutionPage)
async def read_automation_executions(
    db: AsyncSessionDep,
    _: CurrentUserDep,
    date_from: date | None = None,
    date_to: date | None = None,
    status_filter: AutomationExecutionStatus | None = Query(default=None, alias="status"),
    mode: AutomationMode | None = None,
    trigger: AutomationTrigger | None = None,
    snapshot_status: AutomationSnapshotStatus | None = None,
    failure_category: str | None = Query(default=None, max_length=80),
    execution_id: uuid.UUID | None = None,
    gerp_request_id: str | None = Query(default=None, max_length=100),
    search: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    sort_by: ExecutionSortField = ExecutionSortField.STARTED_AT,
    sort_order: SortOrder = SortOrder.DESC,
) -> ExecutionPage:
    if date_from and date_to and date_to < date_from:
        raise HTTPException(status_code=422, detail="date_to must not be before date_from")
    return await list_executions(
        db,
        page=page,
        page_size=page_size,
        date_from=datetime.combine(date_from, time.min, tzinfo=UTC) if date_from else None,
        date_to=datetime.combine(date_to, time.max, tzinfo=UTC) if date_to else None,
        status_filter=status_filter,
        mode=mode.value if mode else None,
        trigger=trigger.value if trigger else None,
        snapshot_status=snapshot_status,
        failure_category=failure_category,
        execution_id=execution_id,
        gerp_request_id=gerp_request_id,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@scrap_router.get("/executions/{execution_id}", response_model=ExecutionDetail)
async def read_automation_execution(
    execution_id: uuid.UUID,
    db: AsyncSessionDep,
    _: CurrentUserDep,
) -> ExecutionDetail:
    return await get_execution_detail(execution_id, db)


@scrap_router.get("", response_model=ScrapPage)
async def read_scrap(
    db: AsyncSessionDep,
    _: CurrentUserDep,
    filters: ScrapFiltersDep,
    search: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    sort_by: ScrapSortField = ScrapSortField.TRANSACTION_DATE,
    sort_order: SortOrder = SortOrder.DESC,
    review_status: ScrapReviewFilterStatus | None = None,
    defect_type_ids: Annotated[list[uuid.UUID] | None, Query(max_length=50)] = None,
    responsible_user_ids: Annotated[list[int] | None, Query(max_length=50)] = None,
    exclude_reviewed: bool = False,
) -> ScrapPage:
    return await list_scrap(
        db,
        filters,
        search=search,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        review_status=review_status,
        defect_type_ids=defect_type_ids,
        responsible_user_ids=responsible_user_ids,
        exclude_reviewed=exclude_reviewed,
    )


@scrap_router.get("/filters", response_model=ScrapFilterOptions)
async def read_scrap_filters(db: AsyncSessionDep, filters: ScrapFiltersDep) -> ScrapFilterOptions:
    return await get_filter_options(db, filters)


def _review_http_exception(error: Exception) -> HTTPException:
    if isinstance(error, ScrapReviewNotFoundError):
        return HTTPException(status_code=404, detail=str(error))
    if isinstance(error, ScrapReviewPermissionError):
        return HTTPException(status_code=403, detail=str(error))
    if isinstance(error, ScrapReviewConflictError):
        return HTTPException(status_code=409, detail=str(error))
    if isinstance(error, (ScrapReviewValidationError, ScrapReviewImageValidationError)):
        return HTTPException(status_code=422, detail=str(error))
    return HTTPException(status_code=500, detail="Unable to process Scrap review")


@scrap_router.get("/review-types", response_model=list[ScrapDefectTypeRead])
async def read_scrap_review_types(
    db: AsyncSessionDep,
    _: CurrentUserDep,
    include_inactive: bool = False,
) -> list[ScrapDefectTypeRead]:
    return await list_defect_types(db, include_inactive=include_inactive)


@scrap_router.post("/review-types", response_model=ScrapDefectTypeRead, status_code=status.HTTP_201_CREATED)
async def create_scrap_review_type(
    command: ScrapDefectTypeCreate,
    db: AsyncSessionDep,
    _: CurrentUserDep,
) -> ScrapDefectTypeRead:
    try:
        return await create_defect_type(db, command)
    except ScrapReviewConflictError as error:
        raise _review_http_exception(error) from error


@scrap_router.patch("/review-types/{defect_type_id}", response_model=ScrapDefectTypeRead)
async def update_scrap_review_type(
    command: ScrapDefectTypeUpdate,
    defect_type_id: uuid.UUID,
    db: AsyncSessionDep,
    _: CurrentUserDep,
) -> ScrapDefectTypeRead:
    try:
        return await update_defect_type(db, defect_type_id, command)
    except (ScrapReviewNotFoundError, ScrapReviewConflictError) as error:
        raise _review_http_exception(error) from error


@scrap_router.delete("/review-types/{defect_type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scrap_review_type(
    defect_type_id: uuid.UUID,
    db: AsyncSessionDep,
    _: CurrentUserDep,
) -> None:
    try:
        await delete_defect_type(db, defect_type_id)
    except (ScrapReviewNotFoundError, ScrapReviewConflictError) as error:
        raise _review_http_exception(error) from error


@scrap_router.get("/reviews/templates", response_model=list[ScrapReviewTemplateRead])
async def read_scrap_review_templates(
    db: AsyncSessionDep,
    current_user: CurrentUserDep,
) -> list[ScrapReviewTemplateRead]:
    return await list_review_templates(db, int(current_user["id"]))


@scrap_router.post("/reviews/templates", response_model=ScrapReviewTemplateRead, status_code=status.HTTP_201_CREATED)
async def create_scrap_review_template(
    command: ScrapReviewTemplateCreate,
    db: AsyncSessionDep,
    current_user: CurrentUserDep,
) -> ScrapReviewTemplateRead:
    try:
        return await create_review_template(db, command, current_user)
    except (ScrapReviewValidationError, ScrapReviewNotFoundError) as error:
        raise _review_http_exception(error) from error


@scrap_router.patch("/reviews/templates/{template_id}", response_model=ScrapReviewTemplateRead)
async def update_scrap_review_template(
    command: ScrapReviewTemplateUpdate,
    template_id: uuid.UUID,
    db: AsyncSessionDep,
    current_user: CurrentUserDep,
) -> ScrapReviewTemplateRead:
    try:
        return await update_review_template(db, template_id, command, current_user)
    except (
        ScrapReviewNotFoundError,
        ScrapReviewPermissionError,
        ScrapReviewValidationError,
    ) as error:
        raise _review_http_exception(error) from error


@scrap_router.delete("/reviews/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scrap_review_template(
    template_id: uuid.UUID,
    db: AsyncSessionDep,
    current_user: CurrentUserDep,
) -> None:
    try:
        await delete_review_template(db, template_id, current_user)
    except (ScrapReviewNotFoundError, ScrapReviewPermissionError) as error:
        raise _review_http_exception(error) from error


@scrap_router.post("/reviews/bulk", response_model=ScrapReviewBulkResult, status_code=status.HTTP_201_CREATED)
async def create_scrap_reviews_in_bulk(
    command: ScrapReviewBulkCreate,
    db: AsyncSessionDep,
    current_user: CurrentUserDep,
    storage: ScrapReviewImageStorageDep,
) -> ScrapReviewBulkResult:
    try:
        return await create_bulk_reviews(db, command, current_user, storage)
    except (
        ScrapReviewValidationError,
        ScrapReviewConflictError,
        ScrapReviewPermissionError,
    ) as error:
        raise _review_http_exception(error) from error


@scrap_router.get("/reviews/{occurrence_id}", response_model=ScrapReviewRead)
async def read_scrap_review(
    occurrence_id: uuid.UUID,
    db: AsyncSessionDep,
    _: CurrentUserDep,
) -> ScrapReviewRead:
    try:
        return await get_review_for_occurrence(db, occurrence_id)
    except ScrapReviewNotFoundError as error:
        raise _review_http_exception(error) from error


@scrap_router.put("/reviews/{occurrence_id}", response_model=ScrapReviewRead)
async def upsert_scrap_review_draft(
    command: ScrapReviewWrite,
    occurrence_id: uuid.UUID,
    db: AsyncSessionDep,
    current_user: CurrentUserDep,
) -> ScrapReviewRead:
    try:
        return await save_review_draft(db, occurrence_id, command, current_user)
    except (
        ScrapReviewNotFoundError,
        ScrapReviewPermissionError,
        ScrapReviewConflictError,
        ScrapReviewValidationError,
    ) as error:
        raise _review_http_exception(error) from error


@scrap_router.post("/reviews/{occurrence_id}/finalize", response_model=ScrapReviewRead)
async def finalize_scrap_review(
    occurrence_id: uuid.UUID,
    db: AsyncSessionDep,
    current_user: CurrentUserDep,
    expected_version: int | None = Query(default=None, ge=1),
) -> ScrapReviewRead:
    try:
        return await finalize_review(db, occurrence_id, current_user, expected_version=expected_version)
    except (
        ScrapReviewNotFoundError,
        ScrapReviewPermissionError,
        ScrapReviewConflictError,
        ScrapReviewValidationError,
    ) as error:
        raise _review_http_exception(error) from error


@scrap_router.post(
    "/reviews/by-id/{review_id}/attachments",
    response_model=ScrapReviewAttachmentRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_scrap_review_attachment(
    review_id: uuid.UUID,
    image: Annotated[UploadFile, File(description="JPEG, PNG or WebP evidence image")],
    db: AsyncSessionDep,
    current_user: CurrentUserDep,
    storage: ScrapReviewImageStorageDep,
) -> ScrapReviewAttachmentRead:
    if image.content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported image media type")
    try:
        review = await assert_review_accepts_attachment(
            db,
            review_id,
            current_user,
            max_attachments=storage.max_attachments,
        )
        payload = await image.read(storage.max_bytes + 1)
        stored = await run_in_threadpool(storage.store, review.id, payload)
        try:
            return await add_review_attachment(db, review, stored, image.filename or "image", current_user)
        except Exception:
            await run_in_threadpool(storage.delete, review.id, stored.storage_key)
            raise
    except (
        ScrapReviewNotFoundError,
        ScrapReviewPermissionError,
        ScrapReviewConflictError,
        ScrapReviewValidationError,
        ScrapReviewImageValidationError,
    ) as error:
        raise _review_http_exception(error) from error


@scrap_router.get("/reviews/by-id/{review_id}/attachments/{attachment_id}", response_class=FileResponse)
async def read_scrap_review_attachment(
    review_id: uuid.UUID,
    attachment_id: uuid.UUID,
    db: AsyncSessionDep,
    _: OptionalUserDep,
    storage: ScrapReviewImageStorageDep,
) -> FileResponse:
    try:
        attachment = await get_review_attachment(db, review_id, attachment_id)
    except ScrapReviewNotFoundError as error:
        raise _review_http_exception(error) from error
    path = storage.resolve(review_id, attachment.storage_key)
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="Attachment file not found")
    return FileResponse(path, media_type="image/webp", filename=attachment.original_filename)


@scrap_router.delete(
    "/reviews/by-id/{review_id}/attachments/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_scrap_review_attachment(
    review_id: uuid.UUID,
    attachment_id: uuid.UUID,
    db: AsyncSessionDep,
    current_user: CurrentUserDep,
    storage: ScrapReviewImageStorageDep,
) -> Response:
    try:
        attachment = await delete_review_attachment(db, review_id, attachment_id, current_user)
    except (
        ScrapReviewNotFoundError,
        ScrapReviewPermissionError,
        ScrapReviewConflictError,
    ) as error:
        raise _review_http_exception(error) from error
    await run_in_threadpool(storage.delete, review_id, attachment.storage_key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@dashboard_router.get("/summary", response_model=ScrapSummary)
async def read_scrap_summary(db: AsyncSessionDep, filters: ScrapFiltersDep) -> ScrapSummary:
    return await get_summary(db, filters)


@dashboard_router.get("", response_model=DashboardResponse)
async def read_dashboard(
    db: AsyncSessionDep,
    filters: ScrapFiltersDep,
    service: ScrapDashboardServiceDep,
    year: int | None = Query(default=None, ge=2000, le=2100),
    currency: DashboardCurrency = DashboardCurrency.USD,
    metric: DashboardMetric = DashboardMetric.IF_COST,
    impact_mode: ImpactMode = ImpactMode.ABSOLUTE,
    ranking_limit: int = Query(default=10, ge=1, le=20),
) -> DashboardResponse:
    selected_year = year or (filters.date_from.year if filters.date_from is not None else date.today().year)
    for boundary in (filters.date_from, filters.date_to):
        if boundary is not None and boundary.year != selected_year:
            raise HTTPException(status_code=422, detail="dashboard date filters must be within the selected year")
    return await service.get_dashboard(
        db,
        filters,
        year=selected_year,
        currency=currency,
        dashboard_metric=metric,
        impact_mode=impact_mode,
        ranking_limit=ranking_limit,
    )


@dashboard_router.get("/trend", response_model=list[ScrapTrendPoint])
async def read_scrap_trend(
    db: AsyncSessionDep,
    filters: ScrapFiltersDep,
    group_by: TrendGroupBy = TrendGroupBy.DAY,
) -> list[ScrapTrendPoint]:
    return await get_trend(db, filters, group_by)


@dashboard_router.get("/breakdown", response_model=list[ScrapBreakdownItem])
async def read_scrap_breakdown(
    db: AsyncSessionDep,
    filters: ScrapFiltersDep,
    group_by: BreakdownGroupBy = BreakdownGroupBy.ORGANIZATION,
    metric: BreakdownMetric = BreakdownMetric.AMOUNT_BRL,
    sort_order: SortOrder = SortOrder.DESC,
) -> list[ScrapBreakdownItem]:
    return await get_breakdown(db, filters, group_by, metric, sort_order)


@dashboard_router.get("/targets", response_model=list[ScrapTargetRead])
async def read_scrap_targets(
    db: AsyncSessionDep,
    service: ScrapTargetServiceDep,
    year: int | None = Query(default=None, ge=2000, le=2100),
) -> list[ScrapTargetRead]:
    return await service.list(db, year=year)


@dashboard_router.put("/targets/{year}", response_model=list[ScrapTargetRead])
async def upsert_scrap_year_targets(
    command: ScrapTargetBatchUpsert,
    db: AsyncSessionDep,
    current_user: CurrentUserDep,
    service: ScrapTargetServiceDep,
    year: int = Path(ge=2000, le=2100),
) -> list[ScrapTargetRead]:
    monthly_map = {item.month: item.amount for item in command.targets}
    return await service.upsert_year_plan(
        db,
        year=year,
        currency=command.currency,
        targets=monthly_map,
        actor_id=int(current_user["id"]),
    )


@dashboard_router.put("/targets/{year}/{month}", response_model=ScrapTargetRead)
async def upsert_scrap_target(
    command: ScrapTargetUpsert,
    db: AsyncSessionDep,
    current_user: CurrentUserDep,
    service: ScrapTargetServiceDep,
    year: int = Path(ge=2000, le=2100),
    month: int = Path(ge=1, le=12),
) -> ScrapTargetRead:
    return await service.upsert(
        db,
        year=year,
        month=month,
        command=command,
        actor_id=int(current_user["id"]),
    )


@dashboard_router.delete("/targets/{year}", status_code=204)
async def delete_scrap_year_targets(
    db: AsyncSessionDep,
    current_user: CurrentUserDep,
    service: ScrapTargetServiceDep,
    year: int = Path(ge=2000, le=2100),
    currency: DashboardCurrency = Query(default=DashboardCurrency.USD),
) -> None:
    await service.delete_year_plan(db, year=year, currency=currency)
