"""Read-only application service for the frontend dashboard contract."""

import uuid
from dataclasses import asdict, replace
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import InstrumentedAttribute

from .dashboard_cache import DashboardResponseCache
from .enums import DashboardCurrency, DashboardMetric, ImpactMode
from .models import ScrapDashboardAggregate, ScrapDashboardState, ScrapOccurrence, ScrapTarget
from .projection import UNMAPPED_DIMENSION
from .query_service import ScrapFilters, _aggregate_filter_conditions
from .schemas import (
    DashboardKpis,
    DashboardMetadata,
    DashboardRankingItem,
    DashboardRankings,
    DashboardResponse,
    DashboardSeriesPoint,
)

ZERO = Decimal("0")
PERCENT_QUANTUM = Decimal("0.1")


def _previous_year(value: date) -> date:
    try:
        return value.replace(year=value.year - 1)
    except ValueError:
        return value.replace(year=value.year - 1, day=28)


def _display_key(value: str) -> str | None:
    return None if value == UNMAPPED_DIMENSION else value


class ScrapDashboardService:
    def __init__(self, response_cache: DashboardResponseCache | None = None) -> None:
        self._cache = response_cache or DashboardResponseCache()

    @staticmethod
    def _active_statement(*columns: Any) -> Any:
        return (
            select(*columns)
            .select_from(ScrapDashboardAggregate)
            .join(ScrapOccurrence, ScrapOccurrence.id == ScrapDashboardAggregate.occurrence_id)
            .where(
                ScrapOccurrence.status == "ACTIVE",
            )
        )

    @staticmethod
    def _metric(
        dashboard_metric: DashboardMetric,
        currency: DashboardCurrency,
        impact_mode: ImpactMode,
    ) -> InstrumentedAttribute[Decimal]:
        if dashboard_metric == DashboardMetric.QUANTITY:
            return (
                ScrapDashboardAggregate.issue_quantity_abs
                if impact_mode == ImpactMode.ABSOLUTE
                else ScrapDashboardAggregate.issue_quantity
            )
        if currency == DashboardCurrency.BRL:
            return (
                ScrapDashboardAggregate.issue_amount_brl_abs
                if impact_mode == ImpactMode.ABSOLUTE
                else ScrapDashboardAggregate.issue_amount_brl
            )
        return (
            ScrapDashboardAggregate.amount_usd_abs if impact_mode == ImpactMode.ABSOLUTE else ScrapDashboardAggregate.amount_usd
        )

    async def _total(
        self,
        db: AsyncSession,
        filters: ScrapFilters,
        metric: InstrumentedAttribute[Decimal],
    ) -> Decimal:
        statement = self._active_statement(func.coalesce(func.sum(metric), 0))
        conditions = _aggregate_filter_conditions(filters)
        if conditions:
            statement = statement.where(*conditions)
        return Decimal(str((await db.execute(statement)).scalar_one()))

    async def _series(
        self,
        db: AsyncSession,
        filters: ScrapFilters,
        metric: InstrumentedAttribute[Decimal],
        *,
        weekly: bool,
    ) -> dict[str, Decimal]:
        dialect = db.bind.dialect.name if db.bind is not None else "postgresql"
        if weekly:
            period = (
                func.strftime("%Y-W%W", ScrapDashboardAggregate.transaction_date)
                if dialect == "sqlite"
                else func.to_char(ScrapDashboardAggregate.transaction_date, 'IYYY-"W"IW')
            )
        else:
            period = (
                func.strftime("%Y-%m", ScrapDashboardAggregate.transaction_date)
                if dialect == "sqlite"
                else func.to_char(ScrapDashboardAggregate.transaction_date, "YYYY-MM")
            )
        total = func.sum(metric).label("total")
        statement = self._active_statement(period.label("period"), total).group_by(period).order_by(asc(period))
        conditions = _aggregate_filter_conditions(filters)
        if conditions:
            statement = statement.where(*conditions)
        return {str(row.period): Decimal(str(row.total)) for row in (await db.execute(statement)).all()}

    async def _ranking(
        self,
        db: AsyncSession,
        filters: ScrapFilters,
        metric: InstrumentedAttribute[Decimal],
        dimension: InstrumentedAttribute[str],
        limit: int,
    ) -> list[DashboardRankingItem]:
        total = func.sum(metric).label("total")
        records = func.sum(ScrapDashboardAggregate.record_count).label("records")
        statement = (
            self._active_statement(dimension.label("key"), total, records)
            .group_by(dimension)
            .order_by(desc(total), asc(dimension))
            .limit(limit)
        )
        conditions = _aggregate_filter_conditions(filters)
        if conditions:
            statement = statement.where(*conditions)
        return [
            DashboardRankingItem(key=_display_key(row.key), amount=Decimal(str(row.total)), record_count=int(row.records))
            for row in (await db.execute(statement)).all()
        ]

    @staticmethod
    async def _targets(db: AsyncSession, *, year: int, currency: DashboardCurrency) -> dict[int, Decimal]:
        statement = select(ScrapTarget.month, ScrapTarget.amount).where(
            ScrapTarget.year == year,
            ScrapTarget.currency == currency.value,
        )
        return {int(row.month): Decimal(str(row.amount)) for row in (await db.execute(statement)).all()}

    async def get_dashboard(
        self,
        db: AsyncSession,
        filters: ScrapFilters,
        *,
        year: int,
        currency: DashboardCurrency,
        dashboard_metric: DashboardMetric,
        impact_mode: ImpactMode,
        ranking_limit: int,
    ) -> DashboardResponse:
        state = await db.get(ScrapDashboardState, 1)
        revision = state.revision if state is not None else uuid.UUID(int=0)
        parameters = {
            "filters": asdict(filters),
            "year": year,
            "currency": currency.value,
            "metric": dashboard_metric.value,
            "impact_mode": impact_mode.value,
            "ranking_limit": ranking_limit,
        }
        cached = await self._cache.get(revision, parameters)
        if cached is not None:
            return cached

        current_date_from = filters.date_from or date(year, 1, 1)
        current_date_to = filters.date_to or date(year, 12, 31)
        current_filters = replace(
            filters,
            date_from=current_date_from,
            date_to=current_date_to,
        )
        previous_filters = replace(
            current_filters,
            date_from=_previous_year(current_date_from),
            date_to=_previous_year(current_date_to),
        )
        metric = self._metric(dashboard_metric, currency, impact_mode)
        actual = await self._total(db, current_filters, metric)
        previous_actual = await self._total(db, previous_filters, metric)
        targets = await self._targets(db, year=year, currency=currency) if dashboard_metric == DashboardMetric.IF_COST else {}
        target_total = sum(targets.values(), ZERO) if targets else None

        data_statement = self._active_statement(func.max(ScrapDashboardAggregate.transaction_date))
        data_conditions = _aggregate_filter_conditions(current_filters)
        if data_conditions:
            data_statement = data_statement.where(*data_conditions)
        data_through = (await db.execute(data_statement)).scalar_one()

        current_months = await self._series(db, current_filters, metric, weekly=False)
        previous_months = await self._series(db, previous_filters, metric, weekly=False)
        current_weeks = await self._series(db, current_filters, metric, weekly=True)
        previous_weeks = await self._series(db, previous_filters, metric, weekly=True)

        current_by_week: dict[int, Decimal] = {}
        for period_key, val in current_weeks.items():
            if "-W" in period_key:
                try:
                    current_by_week[int(period_key.split("-W")[1])] = val
                except ValueError:
                    pass

        previous_by_week: dict[int, Decimal] = {}
        for period_key, val in previous_weeks.items():
            if "-W" in period_key:
                try:
                    previous_by_week[int(period_key.split("-W")[1])] = val
                except ValueError:
                    pass

        if data_through is not None:
            iso = data_through.isocalendar()
            if iso.year > year:
                max_current_week = 53
            elif iso.year == year:
                max_current_week = iso.week
            else:
                max_current_week = 0
        else:
            max_current_week = 0

        all_week_nums = set(current_by_week.keys()).union(previous_by_week.keys())
        if not (filters.date_from or filters.date_to):
            max_total_weeks = max(max(all_week_nums, default=52), 52)
            display_weeks = list(range(1, max_total_weeks + 1))
        else:
            display_weeks = sorted(all_week_nums)

        weekly_points = [
            DashboardSeriesPoint(
                period=f"{year}-W{w:02d}",
                actual=current_by_week.get(w, ZERO) if w <= max_current_week else None,
                previous_year=previous_by_week.get(w),
                target=None,
            )
            for w in display_weeks
        ]

        monthly_points = [
            DashboardSeriesPoint(
                period=f"{year}-{month:02d}",
                actual=current_months.get(
                    f"{year}-{month:02d}",
                    ZERO
                    if (
                        data_through is not None
                        and (year < data_through.year or (year == data_through.year and month <= data_through.month))
                    )
                    else None,
                ),
                previous_year=previous_months.get(f"{year - 1}-{month:02d}"),
                target=targets.get(month),
            )
            for month in range(1, 13)
        ]

        products = await self._ranking(db, current_filters, metric, ScrapDashboardAggregate.product, ranking_limit)
        components = await self._ranking(db, current_filters, metric, ScrapDashboardAggregate.item_type, ranking_limit)
        lines = await self._ranking(db, current_filters, metric, ScrapDashboardAggregate.receipt_department, ranking_limit)
        models = await self._ranking(db, current_filters, metric, ScrapDashboardAggregate.item_code, ranking_limit)
        offenders = await self._ranking(db, current_filters, metric, ScrapDashboardAggregate.account_alias, ranking_limit)
        target_attainment = (
            (target_total / actual * 100).quantize(PERCENT_QUANTUM) if target_total is not None and actual else None
        )
        previous_variation = (
            ((actual - previous_actual) / previous_actual * 100).quantize(PERCENT_QUANTUM) if previous_actual else None
        )
        response = DashboardResponse(
            metadata=DashboardMetadata(
                revision=revision,
                generated_at=datetime.now(UTC),
                data_through=data_through,
                currency=currency,
                impact_mode=impact_mode,
            ),
            kpis=DashboardKpis(
                actual=actual,
                target=target_total,
                target_attainment_percent=target_attainment,
                previous_year_actual=previous_actual,
                previous_year_variation_percent=previous_variation,
            ),
            monthly=monthly_points,
            weekly=weekly_points,
            rankings=DashboardRankings(
                products=products,
                components=components,
                lines=lines,
                models=models,
                offenders=offenders,
            ),
            priority_occurrences=offenders[:5],
        )
        await self._cache.set(revision, parameters, response)
        return response
