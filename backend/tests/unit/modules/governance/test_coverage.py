from datetime import date

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.app.models.governance.models import Factory, SourceCoverage
from src.app.services.governance.coverage import coverage_summary, latest_coverage_for_day
from src.infrastructure.database.session import Base


@pytest.mark.asyncio
async def test_missing_coverage_stays_unknown_and_latest_revision_wins() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with sessions() as db:
        factory = Factory(code="MNS", name="Manaus")
        db.add(factory)
        await db.flush()
        key = "a" * 64
        assert (
            await latest_coverage_for_day(
                db,
                factory_id=factory.id,
                source_system="MATERIAL_SCRAP",
                scope_key=key,
                business_date=date(2026, 8, 1),
            )
            is None
        )
        db.add_all(
            [
                SourceCoverage(
                    factory_id=factory.id,
                    source_system="MATERIAL_SCRAP",
                    scope_key=key,
                    business_date=date(2026, 8, 1),
                    revision=1,
                    status="PARTIAL",
                ),
                SourceCoverage(
                    factory_id=factory.id,
                    source_system="MATERIAL_SCRAP",
                    scope_key=key,
                    business_date=date(2026, 8, 1),
                    revision=2,
                    status="COMPLETE",
                ),
            ]
        )
        await db.commit()
        result = await latest_coverage_for_day(
            db,
            factory_id=factory.id,
            source_system="MATERIAL_SCRAP",
            scope_key=key,
            business_date=date(2026, 8, 1),
        )
        assert result is not None
        assert result.revision == 2
        assert result.status == "COMPLETE"
        summary = await coverage_summary(
            db,
            factory_id=factory.id,
            source_system="MATERIAL_SCRAP",
            scope_key=key,
            period_from=date(2026, 8, 1),
            period_to=date(2026, 8, 2),
        )
        assert summary["status"] == "UNKNOWN"
        assert summary["complete_days"] == 1
        assert summary["missing_dates"] == ["2026-08-02"]
    await engine.dispose()
