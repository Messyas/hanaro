from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from pydantic import StringConstraints

from ...infrastructure.dependencies import AsyncSessionDep, CurrentSuperUserDep
from .dependencies import (
    ScrapDashboardServiceDep,
    ScrapTargetServiceDep,
    require_material_scrap_ingestion_key,
)
from .enums import (
    BreakdownGroupBy,
    BreakdownMetric,
    DashboardCurrency,
    ImpactMode,
    ScrapSortField,
    SortOrder,
    ToBeCountedFilter,
    TrendGroupBy,
)
from .query_service import ScrapFilters, get_breakdown, get_filter_options, get_summary, get_trend, list_scrap
from .schemas import (
    DashboardResponse,
    IngestionAccepted,
    MaterialScrapPayload,
    ScrapBreakdownItem,
    ScrapFilterOptions,
    ScrapPage,
    ScrapSummary,
    ScrapTargetRead,
    ScrapTargetUpsert,
    ScrapTrendPoint,
)
from .tasks import enqueue_material_scrap

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
    _: Annotated[int, Depends(require_material_scrap_ingestion_key)],
) -> IngestionAccepted:
    task_id = await enqueue_material_scrap(payload)
    return IngestionAccepted(task_id=task_id, execution_id=payload.execution.execution_id)


@scrap_router.get("", response_model=ScrapPage)
async def read_scrap(
    db: AsyncSessionDep,
    filters: ScrapFiltersDep,
    search: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    sort_by: ScrapSortField = ScrapSortField.TRANSACTION_DATE,
    sort_order: SortOrder = SortOrder.DESC,
) -> ScrapPage:
    return await list_scrap(
        db,
        filters,
        search=search,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@scrap_router.get("/filters", response_model=ScrapFilterOptions)
async def read_scrap_filters(db: AsyncSessionDep, filters: ScrapFiltersDep) -> ScrapFilterOptions:
    return await get_filter_options(db, filters)


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
