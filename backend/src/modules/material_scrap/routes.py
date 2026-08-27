from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ...infrastructure.dependencies import AsyncSessionDep
from .enums import BreakdownGroupBy, BreakdownMetric, ScrapSortField, SortOrder, TrendGroupBy
from .query_service import ScrapFilters, get_breakdown, get_filter_options, get_summary, get_trend, list_scrap
from .schemas import ScrapBreakdownItem, ScrapFilterOptions, ScrapPage, ScrapSummary, ScrapTrendPoint

scrap_router = APIRouter(tags=["Material Scrap"])
dashboard_router = APIRouter(tags=["Material Scrap Dashboard"])


def build_filters(
    date_from: date | None = None,
    date_to: date | None = None,
    organizations: Annotated[list[str] | None, Query()] = None,
    receipt_departments: Annotated[list[str] | None, Query()] = None,
    departments: Annotated[list[str] | None, Query()] = None,
    products: Annotated[list[str] | None, Query()] = None,
    divisions: Annotated[list[str] | None, Query()] = None,
    item_types: Annotated[list[str] | None, Query()] = None,
    account_codes: Annotated[list[str] | None, Query()] = None,
    to_be_counted: bool | None = None,
) -> ScrapFilters:
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
        to_be_counted=to_be_counted,
    )


ScrapFiltersDep = Annotated[ScrapFilters, Depends(build_filters)]


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
