import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.infrastructure.database.session import Base
from src.modules.material_scrap.enums import DashboardCurrency
from src.modules.material_scrap.models import (
    DailyExchangeRate,
    IngestionRun,
    ScrapDashboardAggregate,
    ScrapDashboardState,
    ScrapTransaction,
)
from src.modules.material_scrap.schemas import ScrapTargetUpsert
from src.modules.material_scrap.service import CanonicalBatchValidationError, ingest_material_scrap
from src.modules.material_scrap.target_service import ScrapTargetService

from .helpers import canonical_fixture


@pytest_asyncio.fixture
async def scrap_db() -> AsyncSession:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_first_load_and_exact_replay_are_idempotent(scrap_db: AsyncSession) -> None:
    payload = canonical_fixture()

    first = await ingest_material_scrap(payload, scrap_db)
    replay = await ingest_material_scrap(payload, scrap_db)

    assert first.accepted_count == 6
    assert replay.is_replay is True
    assert replay.run_id == first.run_id
    assert await scrap_db.scalar(select(func.count(ScrapTransaction.id))) == 6
    assert await scrap_db.scalar(select(func.count(DailyExchangeRate.id))) == 1
    assert await scrap_db.scalar(select(func.sum(ScrapDashboardAggregate.record_count))) == 6
    assert await scrap_db.get(ScrapDashboardState, 1) is not None


@pytest.mark.asyncio
async def test_new_file_version_replaces_active_snapshot(scrap_db: AsyncSession) -> None:
    first = await ingest_material_scrap(canonical_fixture(), scrap_db)
    second_payload = canonical_fixture().model_copy(deep=True)
    second_payload.execution.execution_id = uuid.uuid4()
    second_payload.source_file.sha256 = "a" * 64

    second = await ingest_material_scrap(second_payload, scrap_db)

    runs = list((await scrap_db.execute(select(IngestionRun).order_by(IngestionRun.ingestion_started_at))).scalars())
    assert second.run_id != first.run_id
    assert [run.is_active for run in runs] == [False, True]
    assert await scrap_db.scalar(select(func.count(ScrapTransaction.id))) == 12
    assert await scrap_db.scalar(select(func.sum(ScrapDashboardAggregate.record_count))) == 12
    assert await scrap_db.scalar(select(func.count(ScrapDashboardAggregate.id))) < 12


@pytest.mark.asyncio
async def test_rejects_tampered_canonical_record_before_persistence(scrap_db: AsyncSession) -> None:
    payload = canonical_fixture().model_copy(deep=True)
    payload.records[0].amount_usd += 1

    with pytest.raises(CanonicalBatchValidationError, match="invalid amount_usd"):
        await ingest_material_scrap(payload, scrap_db)

    assert await scrap_db.scalar(select(func.count(IngestionRun.id))) == 0


@pytest.mark.asyncio
async def test_rejects_partial_snapshot_overlap_instead_of_double_counting(scrap_db: AsyncSession) -> None:
    broad = canonical_fixture().model_copy(deep=True)
    broad.execution.query_date_from = broad.execution.query_date_from.replace(day=23)
    broad.execution.query_date_to = broad.execution.query_date_to.replace(day=27)
    await ingest_material_scrap(broad, scrap_db)

    partial = canonical_fixture().model_copy(deep=True)
    partial.execution.execution_id = uuid.uuid4()
    partial.source_file.sha256 = "b" * 64
    with pytest.raises(ValueError, match="fully cover"):
        await ingest_material_scrap(partial, scrap_db)

    assert await scrap_db.scalar(select(func.sum(ScrapDashboardAggregate.record_count))) == 6


@pytest.mark.asyncio
async def test_target_upsert_is_idempotent_and_versions_dashboard(scrap_db: AsyncSession) -> None:
    await ingest_material_scrap(canonical_fixture(), scrap_db)
    state = await scrap_db.get(ScrapDashboardState, 1)
    assert state is not None
    initial_revision = state.revision
    service = ScrapTargetService()

    created = await service.upsert(
        scrap_db,
        year=2026,
        month=8,
        command=ScrapTargetUpsert(currency=DashboardCurrency.USD, amount="1000.00"),
        actor_id=1,
    )
    updated = await service.upsert(
        scrap_db,
        year=2026,
        month=8,
        command=ScrapTargetUpsert(currency=DashboardCurrency.USD, amount="900.00"),
        actor_id=1,
    )

    assert created.amount == Decimal("1000.00")
    assert updated.amount == Decimal("900.00")
    assert len(await service.list(scrap_db, year=2026)) == 1
    await scrap_db.refresh(state)
    assert state.revision != initial_revision
