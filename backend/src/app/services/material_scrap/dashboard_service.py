"""Read-only application service for the frontend dashboard contract."""

import uuid
from collections.abc import Mapping
from dataclasses import asdict, replace
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any, Literal

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import InstrumentedAttribute

from src.app.models.material_scrap.enums import DashboardCurrency, DashboardMetric, ImpactMode
from src.app.models.material_scrap.models import ScrapDashboardAggregate, ScrapDashboardState, ScrapOccurrence, ScrapTarget
from src.app.models.material_scrap.schemas import (
    DashboardKpis,
    DashboardMetadata,
    DashboardRankingItem,
    DashboardRankings,
    DashboardRelativeRankingItem,
    DashboardResponse,
    DashboardSeriesPoint,
)
from src.app.services.governance.production_service import (
    monthly_product_production_denominators,
    monthly_production_denominators,
    product_production_denominators,
)
from src.app.services.material_scrap.dashboard_cache import DashboardResponseCache
from src.app.services.material_scrap.query_service import ScrapFilters, _aggregate_filter_conditions
from src.app.utils.material_scrap.projection import UNMAPPED_DIMENSION

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
        limit: int | None,
    ) -> list[DashboardRankingItem]:
        total = func.sum(metric).label("total")
        records = func.sum(ScrapDashboardAggregate.record_count).label("records")
        statement = (
            self._active_statement(dimension.label("key"), total, records)
            .group_by(dimension)
            .order_by(desc(total), asc(dimension))
        )
        if limit is not None:
            statement = statement.limit(limit)
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

    @staticmethod
    async def _production_denominators(
        db: AsyncSession,
        *,
        year: int,
        currency: DashboardCurrency,
        dashboard_metric: DashboardMetric,
        filters: ScrapFilters,
    ) -> dict[str, Decimal | None]:
        if not ScrapDashboardService._supports_global_production_denominator(filters):
            return {}
        values: Mapping[int, Decimal | None]
        if filters.products:
            values = await monthly_product_production_denominators(
                db,
                year=year,
                products=filters.products,
                currency=currency.value,
                use_quantity=dashboard_metric == DashboardMetric.QUANTITY,
            )
        else:
            values = await monthly_production_denominators(
                db,
                year=year,
                currency=currency.value,
                use_quantity=dashboard_metric == DashboardMetric.QUANTITY,
            )
        return {f"{year}-{month:02d}": value for month, value in values.items()}

    @staticmethod
    def _supports_global_production_denominator(filters: ScrapFilters) -> bool:
        scoped_filters = (
            filters.organizations,
            filters.receipt_departments,
            filters.departments,
            filters.divisions,
            filters.item_types,
            filters.account_codes,
            filters.account_aliases,
            filters.item_codes,
        )
        return not any(values for values in scoped_filters) and filters.week is None

    @staticmethod
    def _monthly_point(
        *,
        year: int,
        month: int,
        current_months: dict[str, Decimal],
        previous_months: dict[str, Decimal],
        targets: dict[int, Decimal],
        data_through: date | None,
        current_denominators: dict[str, Decimal | None],
        previous_denominators: dict[str, Decimal | None],
        denominator_scope_supported: bool,
    ) -> DashboardSeriesPoint:
        period = f"{year}-{month:02d}"
        actual = current_months.get(
            period,
            ZERO
            if data_through is not None
            and (year < data_through.year or (year == data_through.year and month <= data_through.month))
            else None,
        )
        previous = previous_months.get(f"{year - 1}-{month:02d}")
        denominator = current_denominators.get(period)
        previous_denominator = previous_denominators.get(f"{year - 1}-{month:02d}")
        relative_status = ScrapDashboardService._relative_status(denominator, denominator_scope_supported)
        previous_relative_status = ScrapDashboardService._relative_status(previous_denominator, denominator_scope_supported)
        return DashboardSeriesPoint(
            period=period,
            actual=actual,
            previous_year=previous,
            target=targets.get(month),
            denominator=denominator,
            previous_year_denominator=previous_denominator,
            relative_rate=(actual / denominator * 100)
            if actual is not None and denominator is not None and denominator != ZERO
            else None,
            previous_year_relative_rate=(previous / previous_denominator * 100)
            if previous is not None and previous_denominator is not None and previous_denominator != ZERO
            else None,
            relative_status=relative_status,
            previous_year_relative_status=previous_relative_status,
        )

    @staticmethod
    def _relative_status(
        denominator: Decimal | None,
        denominator_scope_supported: bool,
    ) -> Literal[
        "AVAILABLE",
        "MISSING_DENOMINATOR",
        "ZERO_DENOMINATOR",
        "UNSUPPORTED_DENOMINATOR_GRAIN",
    ]:
        if not denominator_scope_supported:
            return "UNSUPPORTED_DENOMINATOR_GRAIN"
        if denominator is None:
            return "MISSING_DENOMINATOR"
        if denominator == ZERO:
            return "ZERO_DENOMINATOR"
        return "AVAILABLE"

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
        current_denominators = await self._production_denominators(
            db,
            year=year,
            currency=currency,
            dashboard_metric=dashboard_metric,
            filters=current_filters,
        )
        previous_denominators = await self._production_denominators(
            db,
            year=year - 1,
            currency=currency,
            dashboard_metric=dashboard_metric,
            filters=previous_filters,
        )
        denominator_scope_supported = self._supports_global_production_denominator(current_filters)

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
                relative_status="UNSUPPORTED_DENOMINATOR_GRAIN",
                previous_year_relative_status="UNSUPPORTED_DENOMINATOR_GRAIN",
            )
            for w in display_weeks
        ]

        monthly_points = [
            self._monthly_point(
                year=year,
                month=month,
                current_months=current_months,
                previous_months=previous_months,
                targets=targets,
                data_through=data_through,
                current_denominators=current_denominators,
                previous_denominators=previous_denominators,
                denominator_scope_supported=denominator_scope_supported,
            )
            for month in range(1, 13)
        ]

        products = await self._ranking(db, current_filters, metric, ScrapDashboardAggregate.product, ranking_limit)
        components = await self._ranking(db, current_filters, metric, ScrapDashboardAggregate.item_type, ranking_limit)
        lines = await self._ranking(db, current_filters, metric, ScrapDashboardAggregate.receipt_department, ranking_limit)
        models = await self._ranking(db, current_filters, metric, ScrapDashboardAggregate.item_code, ranking_limit)
        offenders = await self._ranking(db, current_filters, metric, ScrapDashboardAggregate.account_alias, ranking_limit)
        all_products = await self._ranking(db, current_filters, metric, ScrapDashboardAggregate.product, None)
        months = list(range(current_date_from.month, current_date_to.month + 1))
        product_denominators = await product_production_denominators(
            db,
            year=year,
            months=months,
            currency=currency.value,
            use_quantity=dashboard_metric == DashboardMetric.QUANTITY,
        )
        relative_product_ranking: list[DashboardRelativeRankingItem] = []
        for item in all_products:
            denominator = product_denominators.get(item.key or "")
            status: Literal["AVAILABLE", "MISSING_DENOMINATOR", "ZERO_DENOMINATOR"]
            if denominator is None:
                status = "MISSING_DENOMINATOR"
                rate = None
            elif denominator == ZERO:
                status = "ZERO_DENOMINATOR"
                rate = None
            else:
                status = "AVAILABLE"
                rate = item.amount / denominator * 100
            relative_product_ranking.append(
                DashboardRelativeRankingItem(
                    key=item.key,
                    numerator=item.amount,
                    denominator=denominator,
                    rate=rate,
                    record_count=item.record_count,
                    denominator_status=status,
                )
            )
        relative_product_ranking.sort(key=lambda item: (item.rate is not None, item.rate or ZERO, item.numerator), reverse=True)
        relative_product_ranking = relative_product_ranking[:ranking_limit]
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
            relative_product_ranking=relative_product_ranking,
        )
        await self._cache.set(revision, parameters, response)
        return response
