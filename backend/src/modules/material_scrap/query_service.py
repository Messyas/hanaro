import math
import uuid
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
    ScrapReviewFilterStatus,
    ScrapReviewStatus,
    ScrapSortField,
    SortOrder,
    ToBeCountedFilter,
    TrendGroupBy,
)
from .models import (
    DailyExchangeRate,
    IngestionRun,
    ScrapDashboardAggregate,
    ScrapDefectType,
    ScrapOccurrence,
    ScrapReview,
    ScrapReviewAttachment,
    ScrapTransaction,
)
from .projection import UNMAPPED_DIMENSION
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
    account_aliases: list[str] | None = None
    item_codes: list[str] | None = None
    to_be_counted: ToBeCountedFilter | None = None
    week: int | None = None


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
        (filters.account_aliases, ScrapTransaction.account_alias),
        (filters.item_codes, ScrapTransaction.item_code),
    )
    conditions.extend(column.in_(values) for values, column in list_filters if values)
    if filters.to_be_counted is not None:
        if filters.to_be_counted == ToBeCountedFilter.UNMAPPED:
            conditions.append(ScrapTransaction.to_be_counted.is_(None))
        else:
            conditions.append(ScrapTransaction.to_be_counted.is_(filters.to_be_counted == ToBeCountedFilter.TRUE))
    if filters.week is not None:
        conditions.append(cast(func.extract("week", ScrapTransaction.transaction_date), Numeric) == filters.week)
    return conditions


def _aggregate_filter_conditions(filters: ScrapFilters) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = []
    if filters.date_from is not None:
        conditions.append(ScrapDashboardAggregate.transaction_date >= filters.date_from)
    if filters.date_to is not None:
        conditions.append(ScrapDashboardAggregate.transaction_date <= filters.date_to)
    list_filters = (
        (filters.organizations, ScrapDashboardAggregate.organization_code),
        (filters.receipt_departments, ScrapDashboardAggregate.receipt_department),
        (filters.departments, ScrapDashboardAggregate.department),
        (filters.products, ScrapDashboardAggregate.product),
        (filters.divisions, ScrapDashboardAggregate.division),
        (filters.item_types, ScrapDashboardAggregate.item_type),
        (filters.account_codes, ScrapDashboardAggregate.account_code),
        (filters.account_aliases, ScrapDashboardAggregate.account_alias),
        (filters.item_codes, ScrapDashboardAggregate.item_code),
    )
    conditions.extend(column.in_(values) for values, column in list_filters if values)
    if filters.to_be_counted is not None:
        conditions.append(ScrapDashboardAggregate.to_be_counted_key == filters.to_be_counted.value)
    if filters.week is not None:
        conditions.append(cast(func.extract("week", ScrapDashboardAggregate.transaction_date), Numeric) == filters.week)
    return conditions


def _active_query(*columns: Any) -> Select[Any]:
    statement: Select[Any] = select(*columns) if columns else select(ScrapTransaction)
    return statement.join(ScrapOccurrence, ScrapOccurrence.current_transaction_id == ScrapTransaction.id).where(
        ScrapOccurrence.status == "ACTIVE",
    )


def _active_aggregate_query(*columns: Any) -> Select[Any]:
    statement: Select[Any] = select(*columns) if columns else select(ScrapDashboardAggregate)
    return statement.join(ScrapOccurrence, ScrapOccurrence.id == ScrapDashboardAggregate.occurrence_id).where(
        ScrapOccurrence.status == "ACTIVE",
    )


def _apply_filters(statement: Select[Any], filters: ScrapFilters) -> Select[Any]:
    conditions = _filter_conditions(filters)
    return statement.where(and_(*conditions)) if conditions else statement


def _apply_aggregate_filters(statement: Select[Any], filters: ScrapFilters) -> Select[Any]:
    conditions = _aggregate_filter_conditions(filters)
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
    review_status: ScrapReviewFilterStatus | None = None,
    defect_type_ids: list[uuid.UUID] | None = None,
    responsible_user_ids: list[int] | None = None,
    exclude_reviewed: bool = False,
) -> ScrapPage:
    attachment_counts = (
        select(
            ScrapReviewAttachment.review_id.label("review_id"),
            func.count(ScrapReviewAttachment.id).label("attachment_count"),
        )
        .group_by(ScrapReviewAttachment.review_id)
        .subquery()
    )
    statement = _apply_filters(
        select(
            ScrapTransaction,
            ScrapOccurrence.id.label("occurrence_id"),
            ScrapOccurrence.status.label("occurrence_status"),
            ScrapReview.id.label("review_id"),
            ScrapReview.status.label("review_status"),
            ScrapReview.defect_type_id.label("defect_type_id"),
            ScrapDefectType.name.label("defect_type_name"),
            ScrapReview.responsible_user_id.label("responsible_user_id"),
            ScrapReview.responsible_name.label("responsible_name"),
            ScrapReview.reviewed_at.label("reviewed_at"),
            ScrapReview.updated_at.label("review_updated_at"),
            func.coalesce(attachment_counts.c.attachment_count, 0).label("attachment_count"),
        )
        .join(ScrapOccurrence, ScrapOccurrence.current_transaction_id == ScrapTransaction.id)
        .outerjoin(ScrapReview, ScrapReview.occurrence_id == ScrapOccurrence.id)
        .outerjoin(ScrapDefectType, ScrapDefectType.id == ScrapReview.defect_type_id)
        .outerjoin(attachment_counts, attachment_counts.c.review_id == ScrapReview.id)
        .where(ScrapOccurrence.status == "ACTIVE"),
        filters,
    )
    if exclude_reviewed:
        statement = statement.where(or_(ScrapReview.id.is_(None), ScrapReview.status != ScrapReviewStatus.REVIEWED.value))
    elif review_status == ScrapReviewFilterStatus.UNREVIEWED:
        statement = statement.where(ScrapReview.id.is_(None))
    elif review_status is not None:
        statement = statement.where(ScrapReview.status == review_status.value)
    if defect_type_ids:
        statement = statement.where(ScrapReview.defect_type_id.in_(defect_type_ids))
    if responsible_user_ids:
        statement = statement.where(ScrapReview.responsible_user_id.in_(responsible_user_ids))
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
            asc(ScrapTransaction.id),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(statement)).all()
    return ScrapPage(
        items=[
            ScrapItem.model_validate(transaction).model_copy(
                update={
                    "occurrence_id": occurrence_id,
                    "current_transaction_id": transaction.id,
                    "occurrence_status": occurrence_status,
                    "review_id": review_id,
                    "review_status": ScrapReviewStatus(item_review_status) if item_review_status else None,
                    "defect_type_id": defect_type_id,
                    "defect_type_name": defect_type_name,
                    "responsible_user_id": responsible_user_id,
                    "responsible_name": responsible_name,
                    "reviewed_at": reviewed_at,
                    "review_updated_at": review_updated_at,
                    "attachment_count": int(attachment_count),
                }
            )
            for (
                transaction,
                occurrence_id,
                occurrence_status,
                review_id,
                item_review_status,
                defect_type_id,
                defect_type_name,
                responsible_user_id,
                responsible_name,
                reviewed_at,
                review_updated_at,
                attachment_count,
            ) in rows
        ],
        page=page,
        page_size=page_size,
        total_items=total_items,
        total_pages=math.ceil(total_items / page_size) if total_items else 0,
    )


async def get_filter_options(db: AsyncSession, filters: ScrapFilters) -> ScrapFilterOptions:
    async def distinct_values(column: InstrumentedAttribute[Any]) -> list[str]:
        statement = (
            _apply_aggregate_filters(_active_aggregate_query(column), filters)
            .where(column != UNMAPPED_DIMENSION)
            .distinct()
            .order_by(column)
        )
        return [str(value) for value in (await db.execute(statement)).scalars().all()]

    date_statement = _apply_aggregate_filters(
        _active_aggregate_query(ScrapDashboardAggregate.transaction_date), filters
    ).distinct()
    available_dates = list((await db.execute(date_statement)).scalars())
    periods = sorted({value.strftime("%y.%m") for value in available_dates})
    return ScrapFilterOptions(
        years=sorted({value.year for value in available_dates}),
        weeks=sorted({value.isocalendar().week for value in available_dates}),
        organizations=await distinct_values(ScrapDashboardAggregate.organization_code),
        receipt_departments=await distinct_values(ScrapDashboardAggregate.receipt_department),
        departments=await distinct_values(ScrapDashboardAggregate.department),
        products=await distinct_values(ScrapDashboardAggregate.product),
        divisions=await distinct_values(ScrapDashboardAggregate.division),
        item_types=await distinct_values(ScrapDashboardAggregate.item_type),
        item_codes=await distinct_values(ScrapDashboardAggregate.item_code),
        account_aliases=await distinct_values(ScrapDashboardAggregate.account_alias),
        periods=periods,
    )


async def get_summary(db: AsyncSession, filters: ScrapFilters) -> ScrapSummary:
    counted = ScrapDashboardAggregate.to_be_counted_key == ToBeCountedFilter.TRUE.value
    statement = _apply_aggregate_filters(
        _active_aggregate_query(
            func.coalesce(func.sum(ScrapDashboardAggregate.record_count), 0),
            func.coalesce(func.sum(ScrapDashboardAggregate.issue_quantity_abs), 0),
            func.coalesce(func.sum(ScrapDashboardAggregate.issue_amount_brl_abs), 0),
            func.coalesce(func.sum(ScrapDashboardAggregate.amount_usd_abs), 0),
            func.coalesce(func.sum(case((counted, ScrapDashboardAggregate.record_count), else_=0)), 0),
            func.coalesce(func.sum(case((counted, ScrapDashboardAggregate.issue_amount_brl_abs), else_=0)), 0),
            func.coalesce(func.sum(case((counted, ScrapDashboardAggregate.amount_usd_abs), else_=0)), 0),
        ),
        filters,
    )
    row = (await db.execute(statement)).one()
    latest_statement = (
        select(DailyExchangeRate.brl_per_usd, IngestionRun.ingestion_finished_at)
        .join(IngestionRun, IngestionRun.exchange_rate_id == DailyExchangeRate.id)
        .join(ScrapTransaction, ScrapTransaction.run_id == IngestionRun.id)
        .join(ScrapOccurrence, ScrapOccurrence.current_transaction_id == ScrapTransaction.id)
        .where(ScrapOccurrence.status == "ACTIVE", IngestionRun.status == IngestionStatus.COMPLETED.value)
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
        return func.strftime(formats[group_by], ScrapDashboardAggregate.transaction_date)
    return func.date_trunc(group_by.value, ScrapDashboardAggregate.transaction_date)


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
        _apply_aggregate_filters(
            _active_aggregate_query(
                period,
                func.sum(ScrapDashboardAggregate.record_count),
                func.sum(ScrapDashboardAggregate.issue_quantity_abs),
                func.sum(ScrapDashboardAggregate.issue_amount_brl_abs),
                func.sum(ScrapDashboardAggregate.amount_usd_abs),
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
        BreakdownGroupBy.ORGANIZATION: ScrapDashboardAggregate.organization_code,
        BreakdownGroupBy.RECEIPT_DEPARTMENT: ScrapDashboardAggregate.receipt_department,
        BreakdownGroupBy.DEPARTMENT: ScrapDashboardAggregate.department,
        BreakdownGroupBy.PRODUCT: ScrapDashboardAggregate.product,
        BreakdownGroupBy.DIVISION: ScrapDashboardAggregate.division,
        BreakdownGroupBy.ITEM_TYPE: ScrapDashboardAggregate.item_type,
        BreakdownGroupBy.MODEL: ScrapDashboardAggregate.item_code,
        BreakdownGroupBy.OFFENDER: ScrapDashboardAggregate.account_alias,
    }
    metric_expressions = {
        BreakdownMetric.AMOUNT_BRL: func.sum(ScrapDashboardAggregate.issue_amount_brl_abs),
        BreakdownMetric.AMOUNT_USD: func.sum(ScrapDashboardAggregate.amount_usd_abs),
        BreakdownMetric.QUANTITY: func.sum(ScrapDashboardAggregate.issue_quantity_abs),
        BreakdownMetric.RECORDS: cast(func.sum(ScrapDashboardAggregate.record_count), Numeric(20, 6)),
    }
    group_column = group_columns[group_by]
    metric_expression = metric_expressions[metric].label("metric")
    statement = _apply_aggregate_filters(
        _active_aggregate_query(group_column, metric_expression, func.sum(ScrapDashboardAggregate.record_count)), filters
    ).group_by(group_column)
    statement = statement.order_by(desc(metric_expression) if sort_order == SortOrder.DESC else asc(metric_expression))
    metric_quantum = MONEY_QUANTUM if metric == BreakdownMetric.AMOUNT_BRL else SIX_PLACE_QUANTUM
    return [
        ScrapBreakdownItem(
            key=None if row[0] == UNMAPPED_DIMENSION else row[0],
            metric=_scaled_decimal(row[1], metric_quantum),
            record_count=int(row[2]),
        )
        for row in (await db.execute(statement)).all()
    ]
