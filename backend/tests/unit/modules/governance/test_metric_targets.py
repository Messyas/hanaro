from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.app.models.governance.models import Factory, MetricTargetVersion
from src.app.services.governance.metric_targets import resolve_approved_target
from src.infrastructure.database.session import Base


@pytest.mark.asyncio
async def test_target_requires_an_exact_period_scope_and_latest_approved_revision() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with sessions() as db:
        factory = Factory(code="MNS-TARGET", name="Manaus")
        db.add(factory)
        await db.flush()
        key = "b" * 64
        for revision, status, amount in ((1, "APPROVED", "200"), (2, "APPROVED", "180")):
            db.add(
                MetricTargetVersion(
                    factory_id=factory.id,
                    metric_code="MATERIAL_SCRAP_COST",
                    currency="USD",
                    scope_key=key,
                    period_start=date(2026, 8, 1),
                    period_end=date(2026, 8, 31),
                    revision=revision,
                    amount=Decimal(amount),
                    status=status,
                )
            )
        await db.commit()
        target = await resolve_approved_target(
            db,
            factory_id=factory.id,
            metric_code="MATERIAL_SCRAP_COST",
            currency="USD",
            scope_key=key,
            period_from=date(2026, 8, 1),
            period_to=date(2026, 8, 31),
        )
        assert target is not None and target.amount == Decimal("180")
        assert (
            await resolve_approved_target(
                db,
                factory_id=factory.id,
                metric_code="MATERIAL_SCRAP_COST",
                currency="USD",
                scope_key=key,
                period_from=date(2026, 8, 2),
                period_to=date(2026, 8, 31),
            )
        ) is None
    await engine.dispose()
