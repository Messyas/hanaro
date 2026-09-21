from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.infrastructure.database.session import Base
from src.modules.governance.models import ProductionMeasurementVersion
from src.modules.governance.production_service import product_production_denominators
from src.modules.material_scrap.dashboard_service import ScrapDashboardService
from src.modules.material_scrap.enums import DashboardCurrency, DashboardMetric, ImpactMode
from src.modules.material_scrap.models import ScrapDashboardAggregate
from src.modules.material_scrap.query_service import ScrapFilters
from src.modules.material_scrap.service import ingest_material_scrap

from .helpers import canonical_fixture


@pytest.mark.asyncio
async def test_relative_product_ranking_uses_product_exposure_instead_of_absolute_scrap() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with factory() as db:
        await ingest_material_scrap(canonical_fixture(), db)
        aggregates = list((await db.scalars(select(ScrapDashboardAggregate))).all())
        for index, aggregate in enumerate(aggregates):
            aggregate.product = "TV" if index == 0 else "BM"
        db.add_all(
            [
                ProductionMeasurementVersion(
                    year=2026,
                    month=8,
                    scope_key="PRODUCT:BM",
                    currency="USD",
                    production_value=Decimal("1000000"),
                    production_quantity=Decimal("10000"),
                    note="test",
                    revision=1,
                    status="CONFIRMED",
                    source="IMPORT",
                ),
                ProductionMeasurementVersion(
                    year=2026,
                    month=8,
                    scope_key="PRODUCT:TV",
                    currency="USD",
                    production_value=Decimal("1000"),
                    production_quantity=Decimal("10"),
                    note="test",
                    revision=1,
                    status="CONFIRMED",
                    source="IMPORT",
                ),
            ]
        )
        await db.commit()

        denominators = await product_production_denominators(db, year=2026, months=[8], currency="USD", use_quantity=False)
        assert denominators == {"BM": Decimal("1000000"), "TV": Decimal("1000")}

        response = await ScrapDashboardService().get_dashboard(
            db,
            ScrapFilters(date_from=date(2026, 8, 1), date_to=date(2026, 8, 31)),
            year=2026,
            currency=DashboardCurrency.USD,
            dashboard_metric=DashboardMetric.IF_COST,
            impact_mode=ImpactMode.ABSOLUTE,
            ranking_limit=10,
        )

    available = [item for item in response.relative_product_ranking if item.rate is not None]
    assert [item.key for item in available[:2]] == ["TV", "BM"], [
        (item.key, item.denominator, item.denominator_status) for item in response.relative_product_ranking
    ]
    assert available[0].rate > available[1].rate
    assert available[0].denominator_status == "AVAILABLE"
    await engine.dispose()
