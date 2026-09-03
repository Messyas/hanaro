import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.infrastructure.database.session import Base
from src.modules.material_scrap.enums import DashboardCurrency
from src.modules.material_scrap.models import (
    DailyExchangeRate,
    IngestionRun,
    ScrapDashboardAggregate,
    ScrapDashboardState,
    ScrapOccurrence,
    ScrapOccurrenceObservation,
    ScrapTransaction,
)
from src.modules.material_scrap.repository import OccurrenceIdentityCollisionError
from src.modules.material_scrap.schemas import MaterialScrapPayload, ScrapTargetUpsert
from src.modules.material_scrap.service import CanonicalBatchValidationError, ingest_material_scrap
from src.modules.material_scrap.target_service import ScrapTargetService

from .helpers import canonical_fixture, refresh_payload


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
    assert await scrap_db.scalar(select(func.count(ScrapOccurrence.id))) == 6
    assert await scrap_db.scalar(select(func.count(ScrapOccurrenceObservation.id))) == 6
    assert await scrap_db.scalar(select(func.count(DailyExchangeRate.id))) == 1
    assert await scrap_db.scalar(select(func.sum(ScrapDashboardAggregate.record_count))) == 6
    assert await scrap_db.get(ScrapDashboardState, 1) is not None


@pytest.mark.asyncio
async def test_new_file_version_records_observations_without_new_versions(scrap_db: AsyncSession) -> None:
    first = await ingest_material_scrap(canonical_fixture(), scrap_db)
    second_payload = canonical_fixture().model_copy(deep=True)
    second_payload.execution.execution_id = uuid.uuid4()
    second_payload.source_file.sha256 = "a" * 64

    second = await ingest_material_scrap(second_payload, scrap_db)

    runs = list((await scrap_db.execute(select(IngestionRun).order_by(IngestionRun.ingestion_started_at))).scalars())
    assert second.run_id != first.run_id
    assert [run.is_active for run in runs] == [False, True]
    assert await scrap_db.scalar(select(func.count(ScrapTransaction.id))) == 6
    assert await scrap_db.scalar(select(func.count(ScrapOccurrence.id))) == 6
    assert await scrap_db.scalar(select(func.count(ScrapOccurrenceObservation.id))) == 12
    assert await scrap_db.scalar(select(func.sum(ScrapDashboardAggregate.record_count))) == 6


def _daily_payload(records: int) -> MaterialScrapPayload:
    payload = canonical_fixture().model_copy(deep=True)
    payload.records = payload.records[:records]
    for record in payload.records:
        record.organization_code = "NWK"
        record.transaction_date = payload.execution.processing_date
        record.period = record.transaction_date.strftime("%Y-%m")
        record.period_yy_mm = record.transaction_date.strftime("%y.%m")
    payload.execution.query_date_from = payload.execution.processing_date
    payload.execution.query_date_to = payload.execution.processing_date
    return refresh_payload(payload)


@pytest.mark.asyncio
async def test_daily_growth_keeps_stable_occurrences(scrap_db: AsyncSession) -> None:
    first_payload = _daily_payload(2)
    await ingest_material_scrap(first_payload, scrap_db)
    original_ids = list((await scrap_db.execute(select(ScrapOccurrence.id).order_by(ScrapOccurrence.record_key))).scalars())

    second_payload = _daily_payload(3)
    second_payload.execution.execution_id = uuid.uuid4()
    second_payload.source_file.sha256 = "c" * 64
    await ingest_material_scrap(second_payload, scrap_db)

    current_ids = list((await scrap_db.execute(select(ScrapOccurrence.id).order_by(ScrapOccurrence.record_key))).scalars())
    assert set(original_ids).issubset(current_ids)
    assert await scrap_db.scalar(select(func.count(ScrapTransaction.id))) == 3
    assert await scrap_db.scalar(select(func.count(ScrapOccurrenceObservation.id))) == 5


@pytest.mark.asyncio
async def test_changed_non_identity_content_creates_a_version(scrap_db: AsyncSession) -> None:
    first_payload = _daily_payload(1)
    await ingest_material_scrap(first_payload, scrap_db)
    occurrence = (await scrap_db.execute(select(ScrapOccurrence))).scalar_one()
    initial_transaction_id = occurrence.current_transaction_id

    changed = _daily_payload(1)
    changed.execution.execution_id = uuid.uuid4()
    changed.source_file.sha256 = "d" * 64
    changed.records[0].account_description = "Corrected presentation description"
    refresh_payload(changed)
    await ingest_material_scrap(changed, scrap_db)

    await scrap_db.refresh(occurrence)
    assert occurrence.current_transaction_id != initial_transaction_id
    assert await scrap_db.scalar(select(func.count(ScrapTransaction.id))) == 2


@pytest.mark.asyncio
async def test_absent_row_becomes_not_present_without_touching_other_days(scrap_db: AsyncSession) -> None:
    initial = _daily_payload(3)
    await ingest_material_scrap(initial, scrap_db)
    follow_up = _daily_payload(2)
    follow_up.execution.execution_id = uuid.uuid4()
    follow_up.source_file.sha256 = "e" * 64
    await ingest_material_scrap(follow_up, scrap_db)

    statuses = list((await scrap_db.execute(select(ScrapOccurrence.status))).scalars())
    assert statuses.count("ACTIVE") == 2
    assert statuses.count("NOT_PRESENT") == 1
    assert await scrap_db.scalar(select(func.sum(ScrapDashboardAggregate.record_count))) == 2


@pytest.mark.asyncio
async def test_identity_collision_rolls_back_published_partition(scrap_db: AsyncSession) -> None:
    valid = _daily_payload(1)
    await ingest_material_scrap(valid, scrap_db)
    collision = _daily_payload(2)
    collision.execution.execution_id = uuid.uuid4()
    collision.source_file.sha256 = "f" * 64
    collision.records[1] = collision.records[0].model_copy(update={"source_line": 3, "item_description": "Different row"})
    refresh_payload(collision)

    with pytest.raises(OccurrenceIdentityCollisionError, match="incompatible stable identity"):
        await ingest_material_scrap(collision, scrap_db)

    assert await scrap_db.scalar(select(func.count(ScrapOccurrence.id))) == 1
    assert await scrap_db.scalar(select(func.count(ScrapTransaction.id))) == 1


@pytest.mark.asyncio
async def test_concurrent_occurrence_creation_is_protected_by_unique_constraint(scrap_db: AsyncSession) -> None:
    now = datetime.now(UTC)
    scrap_db.add_all(
        [
            ScrapOccurrence(
                record_key="a" * 64,
                record_key_version="v1",
                identity_slot=1,
                organization_code="NWK",
                transaction_date=canonical_fixture().execution.processing_date,
                first_seen_at=now,
                last_seen_at=now,
                created_at=now,
                updated_at=now,
            ),
            ScrapOccurrence(
                record_key="a" * 64,
                record_key_version="v1",
                identity_slot=1,
                organization_code="NWK",
                transaction_date=canonical_fixture().execution.processing_date,
                first_seen_at=now,
                last_seen_at=now,
                created_at=now,
                updated_at=now,
            ),
        ]
    )
    with pytest.raises(IntegrityError):
        await scrap_db.commit()
    await scrap_db.rollback()


@pytest.mark.asyncio
async def test_rejects_tampered_canonical_record_before_persistence(scrap_db: AsyncSession) -> None:
    payload = canonical_fixture().model_copy(deep=True)
    payload.records[0].amount_usd += 1

    with pytest.raises(CanonicalBatchValidationError, match="invalid amount_usd"):
        await ingest_material_scrap(payload, scrap_db)

    assert await scrap_db.scalar(select(func.count(IngestionRun.id))) == 0


@pytest.mark.asyncio
async def test_overlapping_windows_reconcile_per_partition_without_double_counting(scrap_db: AsyncSession) -> None:
    broad = canonical_fixture().model_copy(deep=True)
    broad.execution.query_date_from = broad.execution.query_date_from.replace(day=23)
    broad.execution.query_date_to = broad.execution.query_date_to.replace(day=27)
    await ingest_material_scrap(broad, scrap_db)

    partial = canonical_fixture().model_copy(deep=True)
    partial.execution.execution_id = uuid.uuid4()
    partial.source_file.sha256 = "b" * 64
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
