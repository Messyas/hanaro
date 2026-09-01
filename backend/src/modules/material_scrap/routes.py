import uuid
from datetime import UTC, date, datetime, time
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Path, Query, Response, UploadFile, status
from pydantic import StringConstraints
from starlette.concurrency import run_in_threadpool
from starlette.responses import FileResponse

from ...infrastructure.dependencies import AsyncSessionDep, CurrentSuperUserDep, CurrentUserDep
from .dependencies import (
    ScrapDashboardServiceDep,
    ScrapReviewImageStorageDep,
    ScrapTargetServiceDep,
    require_material_scrap_ingestion_key,
)
from .enums import (
    AutomationExecutionStatus,
    AutomationMode,
    AutomationSnapshotStatus,
    AutomationTrigger,
    BreakdownGroupBy,
    BreakdownMetric,
    DashboardCurrency,
    ExecutionSortField,
    ExecutionStepCode,
    ImpactMode,
    ScrapReviewFilterStatus,
    ScrapSortField,
    SortOrder,
    ToBeCountedFilter,
    TrendGroupBy,
)
from .execution_service import (
    ensure_execution_from_payload,
    get_execution_detail,
    list_executions,
    mark_execution_failed,
    start_execution,
    update_step,
)
from .query_service import ScrapFilters, get_breakdown, get_filter_options, get_summary, get_trend, list_scrap
from .review_image import ALLOWED_IMAGE_CONTENT_TYPES, ScrapReviewImageValidationError
from .review_service import (
    ScrapReviewConflictError,
    ScrapReviewNotFoundError,
    ScrapReviewPermissionError,
    ScrapReviewValidationError,
    add_review_attachment,
    assert_review_accepts_attachment,
    create_bulk_reviews,
    create_defect_type,
    delete_review_attachment,
    finalize_review,
    get_review_attachment,
    get_review_for_occurrence,
    list_defect_types,
    save_review_draft,
    update_defect_type,
)
from .schemas import (
    AutomationExecutionStart,
    DashboardResponse,
    ExecutionDetail,
    ExecutionFailure,
    ExecutionPage,
    ExecutionStepUpdate,
    IngestionAccepted,
    MaterialScrapPayload,
    ScrapBreakdownItem,
    ScrapDefectTypeCreate,
    ScrapDefectTypeRead,
    ScrapDefectTypeUpdate,
    ScrapFilterOptions,
    ScrapPage,
    ScrapReviewAttachmentRead,
    ScrapReviewBulkCreate,
    ScrapReviewBulkResult,
    ScrapReviewRead,
    ScrapReviewWrite,
    ScrapSummary,
    ScrapTargetRead,
    ScrapTargetUpsert,
    ScrapTrendPoint,
)
from .tasks import enqueue_execution_notification, enqueue_material_scrap

scrap_router = APIRouter(tags=["Material Scrap"])
dashboard_router = APIRouter(tags=["Material Scrap Dashboard"])

FilterValue = Annotated[str, StringConstraints(min_length=1, max_length=120)]


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
    await ensure_execution_from_payload(payload, db)
    try:
        task_id = await enqueue_material_scrap(payload)
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
    _: CurrentSuperUserDep,
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
    _: CurrentSuperUserDep,
) -> ScrapDefectTypeRead:
    try:
        return await update_defect_type(db, defect_type_id, command)
    except (ScrapReviewNotFoundError, ScrapReviewConflictError) as error:
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
    except (ScrapReviewValidationError, ScrapReviewConflictError) as error:
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
    _: CurrentUserDep,
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


@dashboard_router.put("/targets/{year}/{month}", response_model=ScrapTargetRead)
async def upsert_scrap_target(
    command: ScrapTargetUpsert,
    db: AsyncSessionDep,
    current_user: CurrentSuperUserDep,
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
