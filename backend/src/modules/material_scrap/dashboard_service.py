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
from .enums import DashboardCurrency, ImpactMode, IngestionStatus
from .models import IngestionRun, ScrapDashboardAggregate, ScrapDashboardState, ScrapTarget
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
            .join(IngestionRun, IngestionRun.id == ScrapDashboardAggregate.run_id)
            .where(
                IngestionRun.is_active.is_(True),
                IngestionRun.status == IngestionStatus.COMPLETED.value,
            )
        )

    @staticmethod
    def _metric(currency: DashboardCurrency, impact_mode: ImpactMode) -> InstrumentedAttribute[Decimal]:
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
        impact_mode: ImpactMode,
        ranking_limit: int,
    ) -> DashboardResponse:
        state = await db.get(ScrapDashboardState, 1)
        revision = state.revision if state is not None else uuid.UUID(int=0)
        parameters = {
            "filters": asdict(filters),
            "year": year,
            "currency": currency.value,
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
        metric = self._metric(currency, impact_mode)
        actual = await self._total(db, current_filters, metric)
        previous_actual = await self._total(db, previous_filters, metric)
        targets = await self._targets(db, year=year, currency=currency)
        target_total = sum(targets.values(), ZERO) if targets else None

        current_months = await self._series(db, current_filters, metric, weekly=False)
        previous_months = await self._series(db, previous_filters, metric, weekly=False)
        weekly = await self._series(db, current_filters, metric, weekly=True)
        monthly_points = [
            DashboardSeriesPoint(
                period=f"{year}-{month:02d}",
                actual=current_months.get(f"{year}-{month:02d}", ZERO),
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

        data_statement = self._active_statement(func.max(ScrapDashboardAggregate.transaction_date))
        data_conditions = _aggregate_filter_conditions(current_filters)
        if data_conditions:
            data_statement = data_statement.where(*data_conditions)
        data_through = (await db.execute(data_statement)).scalar_one()
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
            weekly=[DashboardSeriesPoint(period=period, actual=amount) for period, amount in weekly.items()],
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
