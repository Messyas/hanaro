import uuid
from decimal import Decimal
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.infrastructure.database.session import Base
from src.modules.material_scrap.enums import IngestionStatus
from src.modules.material_scrap.models import IngestionRun, ScrapTransaction
from src.modules.material_scrap.service import ingest_material_scrap
from src.modules.material_scrap.simulator import simulate_smart_office_output
from src.modules.material_scrap.transformer import ScrapTransformationError

FIXTURE = Path(__file__).parents[4] / "fixtures" / "Other_Account_Transaction_Text_anonymized"


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
    payload = simulate_smart_office_output(FIXTURE, Decimal("5.15"))

    first = await ingest_material_scrap(payload, scrap_db)
    replay = await ingest_material_scrap(payload, scrap_db)

    assert first.accepted_count == 6
    assert replay.is_replay is True
    assert replay.run_id == first.run_id
    transaction_count = await scrap_db.scalar(select(func.count(ScrapTransaction.id)))
    assert transaction_count == 6


@pytest.mark.asyncio
async def test_new_file_version_replaces_active_snapshot_without_deduplicating_rows(scrap_db: AsyncSession) -> None:
    first_payload = simulate_smart_office_output(FIXTURE, Decimal("5.15"))
    first = await ingest_material_scrap(first_payload, scrap_db)
    second_payload = first_payload.model_copy(deep=True)
    second_payload.execution.execution_id = uuid.uuid4()
    second_payload.source_file.sha256 = "a" * 64
    second_payload.records[0]["issue_amount_brl"] = "-30,00"

    second = await ingest_material_scrap(second_payload, scrap_db)

    runs = list((await scrap_db.execute(select(IngestionRun).order_by(IngestionRun.ingestion_started_at))).scalars())
    assert second.run_id != first.run_id
    assert [run.is_active for run in runs] == [False, True]
    active_rows = await scrap_db.scalar(
        select(func.count(ScrapTransaction.id))
        .join(IngestionRun, IngestionRun.id == ScrapTransaction.run_id)
        .where(IngestionRun.is_active.is_(True))
    )
    assert active_rows == 6
    assert await scrap_db.scalar(select(func.count(ScrapTransaction.id))) == 12


@pytest.mark.asyncio
async def test_failed_new_version_keeps_previous_snapshot_active(scrap_db: AsyncSession) -> None:
    first_payload = simulate_smart_office_output(FIXTURE, Decimal("5.15"))
    first = await ingest_material_scrap(first_payload, scrap_db)
    broken_payload = first_payload.model_copy(deep=True)
    broken_payload.execution.execution_id = uuid.uuid4()
    broken_payload.source_file.sha256 = "b" * 64
    broken_payload.records[0]["issue_amount_brl"] = "not-money"

    with pytest.raises(ScrapTransformationError):
        await ingest_material_scrap(broken_payload, scrap_db)

    first_run = await scrap_db.get(IngestionRun, first.run_id)
    failed_run = await scrap_db.scalar(select(IngestionRun).where(IngestionRun.status == IngestionStatus.FAILED.value))
    assert first_run is not None and first_run.is_active is True
    assert failed_run is not None and failed_run.is_active is False
    assert failed_run.read_count == 6
    assert failed_run.rejected_count == 6
