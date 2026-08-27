import math
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Numeric, and_, asc, case, cast, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import InstrumentedAttribute
from sqlalchemy.sql import ColumnElement, Select

from .enums import (
    BreakdownGroupBy,
    BreakdownMetric,
    IngestionStatus,
    ScrapSortField,
    SortOrder,
    TrendGroupBy,
)
from .models import ExchangeRate, IngestionRun, ScrapTransaction
from .schemas import (
    ScrapBreakdownItem,
    ScrapFilterOptions,
    ScrapItem,
    ScrapPage,
    ScrapSummary,
    ScrapTrendPoint,
)

MONEY_QUANTUM = Decimal("0.01")
SIX_PLACE_QUANTUM = Decimal("0.000001")


def _scaled_decimal(value: object, quantum: Decimal) -> Decimal:
    return Decimal(str(value)).quantize(quantum)


@dataclass(frozen=True)
class ScrapFilters:
    date_from: date | None = None
    date_to: date | None = None
    organizations: list[str] | None = None
    receipt_departments: list[str] | None = None
    departments: list[str] | None = None
    products: list[str] | None = None
    divisions: list[str] | None = None
    item_types: list[str] | None = None
    account_codes: list[str] | None = None
    to_be_counted: bool | None = None


def _filter_conditions(filters: ScrapFilters) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = []
    scalar_ranges = (
        (filters.date_from, ScrapTransaction.transaction_date >= filters.date_from if filters.date_from else None),
        (filters.date_to, ScrapTransaction.transaction_date <= filters.date_to if filters.date_to else None),
    )
    conditions.extend(condition for value, condition in scalar_ranges if value is not None and condition is not None)
    list_filters = (
        (filters.organizations, ScrapTransaction.organization_code),
        (filters.receipt_departments, ScrapTransaction.receipt_department),
        (filters.departments, ScrapTransaction.department),
        (filters.products, ScrapTransaction.product),
        (filters.divisions, ScrapTransaction.division),
        (filters.item_types, ScrapTransaction.item_type),
        (filters.account_codes, ScrapTransaction.account_code),
    )
    conditions.extend(column.in_(values) for values, column in list_filters if values)
    if filters.to_be_counted is not None:
        conditions.append(ScrapTransaction.to_be_counted.is_(filters.to_be_counted))
    return conditions


def _active_query(*columns: Any) -> Select[Any]:
    statement: Select[Any] = select(*columns) if columns else select(ScrapTransaction)
    return statement.join(IngestionRun, IngestionRun.id == ScrapTransaction.run_id).where(
        IngestionRun.is_active.is_(True),
        IngestionRun.status == IngestionStatus.COMPLETED.value,
    )


def _apply_filters(statement: Select[Any], filters: ScrapFilters) -> Select[Any]:
    conditions = _filter_conditions(filters)
    return statement.where(and_(*conditions)) if conditions else statement


async def list_scrap(
    db: AsyncSession,
    filters: ScrapFilters,
    *,
    search: str | None,
    page: int,
    page_size: int,
    sort_by: ScrapSortField,
    sort_order: SortOrder,
) -> ScrapPage:
    statement = _apply_filters(_active_query(ScrapTransaction), filters)
    if search and search.strip():
        term = search.strip()
        statement = statement.where(
            or_(
                ScrapTransaction.item_code.icontains(term, autoescape=True),
                ScrapTransaction.item_description.icontains(term, autoescape=True),
                ScrapTransaction.account_code.icontains(term, autoescape=True),
                ScrapTransaction.account_description.icontains(term, autoescape=True),
                ScrapTransaction.work_order.icontains(term, autoescape=True),
                ScrapTransaction.requisition_comment.icontains(term, autoescape=True),
            )
        )
    total_statement = select(func.count()).select_from(statement.order_by(None).subquery())
    total_items = int((await db.execute(total_statement)).scalar_one())
    sort_columns = {
        ScrapSortField.TRANSACTION_DATE: ScrapTransaction.transaction_date,
        ScrapSortField.ORGANIZATION_CODE: ScrapTransaction.organization_code,
        ScrapSortField.RECEIPT_DEPARTMENT: ScrapTransaction.receipt_department,
        ScrapSortField.ITEM_CODE: ScrapTransaction.item_code,
        ScrapSortField.ISSUE_QUANTITY: ScrapTransaction.issue_quantity,
        ScrapSortField.ISSUE_AMOUNT_BRL: ScrapTransaction.issue_amount_brl,
        ScrapSortField.AMOUNT_USD: ScrapTransaction.amount_usd,
    }
    order_function = desc if sort_order == SortOrder.DESC else asc
    statement = (
        statement.order_by(
            order_function(sort_columns[sort_by]),
            asc(ScrapTransaction.source_row_number),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = list((await db.execute(statement)).scalars().all())
    return ScrapPage(
        items=[ScrapItem.model_validate(item) for item in items],
        page=page,
        page_size=page_size,
        total_items=total_items,
        total_pages=math.ceil(total_items / page_size) if total_items else 0,
    )


async def get_filter_options(db: AsyncSession, filters: ScrapFilters) -> ScrapFilterOptions:
    async def distinct_values(column: InstrumentedAttribute[Any]) -> list[str]:
        statement = _apply_filters(_active_query(column), filters).where(column.is_not(None)).distinct().order_by(column)
        return [str(value) for value in (await db.execute(statement)).scalars().all()]

    return ScrapFilterOptions(
        organizations=await distinct_values(ScrapTransaction.organization_code),
        receipt_departments=await distinct_values(ScrapTransaction.receipt_department),
        departments=await distinct_values(ScrapTransaction.department),
        products=await distinct_values(ScrapTransaction.product),
        divisions=await distinct_values(ScrapTransaction.division),
        item_types=await distinct_values(ScrapTransaction.item_type),
        periods=await distinct_values(ScrapTransaction.period_yy_mm),
    )


async def get_summary(db: AsyncSession, filters: ScrapFilters) -> ScrapSummary:
    counted = ScrapTransaction.to_be_counted.is_(True)
    statement = _apply_filters(
        _active_query(
            func.count(ScrapTransaction.id),
            func.coalesce(func.sum(func.abs(ScrapTransaction.issue_quantity)), 0),
            func.coalesce(func.sum(func.abs(ScrapTransaction.issue_amount_brl)), 0),
            func.coalesce(func.sum(func.abs(ScrapTransaction.amount_usd)), 0),
            func.count(case((counted, ScrapTransaction.id))),
            func.coalesce(func.sum(case((counted, func.abs(ScrapTransaction.issue_amount_brl)), else_=0)), 0),
            func.coalesce(func.sum(case((counted, func.abs(ScrapTransaction.amount_usd)), else_=0)), 0),
        ),
        filters,
    )
    row = (await db.execute(statement)).one()
    latest_statement = (
        select(ExchangeRate.brl_per_usd, IngestionRun.ingestion_finished_at)
        .join(IngestionRun, IngestionRun.id == ExchangeRate.run_id)
        .join(ScrapTransaction, ScrapTransaction.run_id == IngestionRun.id)
        .where(IngestionRun.is_active.is_(True), IngestionRun.status == IngestionStatus.COMPLETED.value)
        .order_by(IngestionRun.ingestion_finished_at.desc())
        .limit(1)
    )
    latest_conditions = _filter_conditions(filters)
    if latest_conditions:
        latest_statement = latest_statement.where(and_(*latest_conditions))
    latest = (await db.execute(latest_statement)).one_or_none()
    return ScrapSummary(
        total_records=int(row[0]),
        total_issue_quantity=_scaled_decimal(row[1], SIX_PLACE_QUANTUM),
        total_issue_amount_brl=_scaled_decimal(row[2], MONEY_QUANTUM),
        total_amount_usd=_scaled_decimal(row[3], SIX_PLACE_QUANTUM),
        counted_records=int(row[4]),
        counted_amount_brl=_scaled_decimal(row[5], MONEY_QUANTUM),
        counted_amount_usd=_scaled_decimal(row[6], SIX_PLACE_QUANTUM),
        exchange_rate_used=_scaled_decimal(latest[0], SIX_PLACE_QUANTUM) if latest else None,
        last_successful_ingestion_at=latest[1] if latest else None,
    )


def _period_expression(db: AsyncSession, group_by: TrendGroupBy) -> ColumnElement[object]:
    dialect_name = db.bind.dialect.name if db.bind is not None else "postgresql"
    if dialect_name == "sqlite":
        formats = {
            TrendGroupBy.DAY: "%Y-%m-%d",
            TrendGroupBy.WEEK: "%Y-W%W",
            TrendGroupBy.MONTH: "%Y-%m",
        }
        return func.strftime(formats[group_by], ScrapTransaction.transaction_date)
    return func.date_trunc(group_by.value, ScrapTransaction.transaction_date)


def _format_period(value: date | datetime | str, group_by: TrendGroupBy) -> str:
    if isinstance(value, str):
        return value
    if group_by == TrendGroupBy.MONTH:
        return value.strftime("%Y-%m")
    if group_by == TrendGroupBy.WEEK:
        return f"{value:%Y-%m-%d}"
    return value.strftime("%Y-%m-%d")


async def get_trend(db: AsyncSession, filters: ScrapFilters, group_by: TrendGroupBy) -> list[ScrapTrendPoint]:
    period = _period_expression(db, group_by).label("period")
    statement = (
        _apply_filters(
            _active_query(
                period,
                func.count(ScrapTransaction.id),
                func.sum(func.abs(ScrapTransaction.issue_quantity)),
                func.sum(func.abs(ScrapTransaction.issue_amount_brl)),
                func.sum(func.abs(ScrapTransaction.amount_usd)),
            ),
            filters,
        )
        .group_by(period)
        .order_by(period)
    )
    return [
        ScrapTrendPoint(
            period=_format_period(row[0], group_by),
            record_count=int(row[1]),
            total_issue_quantity=_scaled_decimal(row[2], SIX_PLACE_QUANTUM),
            total_issue_amount_brl=_scaled_decimal(row[3], MONEY_QUANTUM),
            total_amount_usd=_scaled_decimal(row[4], SIX_PLACE_QUANTUM),
        )
        for row in (await db.execute(statement)).all()
    ]


async def get_breakdown(
    db: AsyncSession,
    filters: ScrapFilters,
    group_by: BreakdownGroupBy,
    metric: BreakdownMetric,
    sort_order: SortOrder,
) -> list[ScrapBreakdownItem]:
    group_columns = {
        BreakdownGroupBy.ORGANIZATION: ScrapTransaction.organization_code,
        BreakdownGroupBy.RECEIPT_DEPARTMENT: ScrapTransaction.receipt_department,
        BreakdownGroupBy.DEPARTMENT: ScrapTransaction.department,
        BreakdownGroupBy.PRODUCT: ScrapTransaction.product,
        BreakdownGroupBy.DIVISION: ScrapTransaction.division,
        BreakdownGroupBy.ITEM_TYPE: ScrapTransaction.item_type,
    }
    metric_expressions = {
        BreakdownMetric.AMOUNT_BRL: func.sum(func.abs(ScrapTransaction.issue_amount_brl)),
        BreakdownMetric.AMOUNT_USD: func.sum(func.abs(ScrapTransaction.amount_usd)),
        BreakdownMetric.QUANTITY: func.sum(func.abs(ScrapTransaction.issue_quantity)),
        BreakdownMetric.RECORDS: cast(func.count(ScrapTransaction.id), Numeric(20, 6)),
    }
    group_column = group_columns[group_by]
    metric_expression = metric_expressions[metric].label("metric")
    statement = _apply_filters(
        _active_query(group_column, metric_expression, func.count(ScrapTransaction.id)), filters
    ).group_by(group_column)
    statement = statement.order_by(desc(metric_expression) if sort_order == SortOrder.DESC else asc(metric_expression))
    metric_quantum = MONEY_QUANTUM if metric == BreakdownMetric.AMOUNT_BRL else SIX_PLACE_QUANTUM
    return [
        ScrapBreakdownItem(
            key=row[0],
            metric=_scaled_decimal(row[1], metric_quantum),
            record_count=int(row[2]),
        )
        for row in (await db.execute(statement)).all()
    ]
