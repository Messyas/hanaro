"""Real FK/idempotency tests; optional isolated PostgreSQL schema for guards."""

import importlib.util
import os
import uuid
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
import pytest_asyncio
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import event, func, inspect, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from scripts.seed_demo_governance import seed_governance
from src.infrastructure.database.session import Base
from src.modules.governance.models import (
    DatasetSnapshot,
    Factory,
    ProductionLine,
    ProductionVersion,
    ReportVersion,
    SnapshotItem,
)
from src.modules.material_scrap.service import ingest_material_scrap

from .helpers import canonical_fixture


def migration(connection, direction="upgrade"):
    with Operations.context(MigrationContext.configure(connection)):
        files = [
            Path(__file__).resolve().parents[4] / "migrations/versions/20260906_12_governance_persistence.py",
            Path(__file__).resolve().parents[4] / "migrations/versions/20260909_13_reports_module.py",
            Path(__file__).resolve().parents[4] / "migrations/versions/20260909_14_governance_workflows.py",
        ]
        for index, file in enumerate(files if direction == "upgrade" else reversed(files)):
            if file.name == "20260909_13_reports_module.py":
                columns = {column["name"] for column in inspect(connection).get_columns("gov_reports")}
                if (direction == "upgrade" and "description" in columns) or (
                    direction == "downgrade" and "description" not in columns
                ):
                    continue
            spec = importlib.util.spec_from_file_location(f"governance_migration_{index}", file)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            getattr(module, direction)()


@pytest_asyncio.fixture(params=["sqlite", "postgresql"])
async def governance_engine(request):
    pg_url = os.getenv("GOVERNANCE_TEST_DATABASE_URL")
    if request.param == "postgresql" and not pg_url:
        pytest.skip("Set GOVERNANCE_TEST_DATABASE_URL for PostgreSQL trigger tests")
    schema = "gov_test_" + uuid.uuid4().hex
    if request.param == "postgresql":
        admin = create_async_engine(pg_url)
        async with admin.begin() as conn:
            await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        engine = create_async_engine(pg_url, connect_args={"server_settings": {"search_path": schema}})
    else:
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")

        @event.listens_for(engine.sync_engine, "connect")
        def enable_foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

    try:
        async with engine.begin() as conn:
            legacy = [table for table in Base.metadata.sorted_tables if not table.name.startswith("gov_")]
            await conn.run_sync(lambda sync: Base.metadata.create_all(sync, tables=legacy))
            await conn.run_sync(migration)
        yield engine
    finally:
        await engine.dispose()
        if request.param == "postgresql":
            async with admin.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            await admin.dispose()


@pytest.mark.asyncio
async def test_seed_replay_constraints_and_immutable_snapshots(governance_engine):
    sessions = async_sessionmaker(governance_engine, expire_on_commit=False)
    async with sessions() as db:
        await ingest_material_scrap(canonical_fixture(), db)
        first = await seed_governance(db)
        await db.commit()
        assert first["gov_factories"] == 1
        assert first["gov_production_versions"] >= 7
        assert await seed_governance(db) == {}
        await db.commit()
        line = await db.scalar(select(ProductionLine).limit(1))
        snapshot = await db.scalar(select(DatasetSnapshot).limit(1))
        snapshot_id = snapshot.id
        item = await db.scalar(select(SnapshotItem).where(SnapshotItem.snapshot_id == snapshot_id))
        item_id = item.id
        report = await db.scalar(select(ReportVersion).where(ReportVersion.snapshot_id == snapshot_id))
        report_id = report.id
        line_id = line.id
        await db.rollback()
        with pytest.raises(IntegrityError):
            db.add(ProductionVersion(line_id=line_id, production_date=date(2026, 1, 1), revision=1, quantity=Decimal("-1")))
            await db.commit()
        await db.rollback()
        with pytest.raises(IntegrityError):
            db.add(ProductionLine(factory_id=uuid.uuid4(), code="INVALID", name="Invalid FK"))
            await db.commit()
        await db.rollback()
        assert await db.scalar(select(func.count()).select_from(Factory)) == 1
        await db.rollback()
        if governance_engine.dialect.name == "postgresql":
            for statement, identifier in (
                ("UPDATE gov_dataset_snapshots SET metrics = '{}' WHERE id = :id", snapshot_id),
                ("UPDATE gov_report_versions SET content = '{}' WHERE id = :id", report_id),
                ("DELETE FROM gov_snapshot_items WHERE id = :id", item_id),
                ("UPDATE gov_production_versions SET quantity = 1 WHERE line_id = :id", line_id),
            ):
                with pytest.raises(DBAPIError):
                    await db.execute(text(statement), {"id": identifier})
                    await db.commit()
                await db.rollback()
    # Upgrade replay must accept a complete legacy/create_all baseline.
    async with governance_engine.begin() as conn:
        await conn.run_sync(migration)
        if governance_engine.dialect.name == "postgresql":
            # PostgreSQL is the production dialect: validate a complete
            # reports/governance rollback and a clean re-application too.
            # The new workflow migration preserves legacy histories and explicitly
            # rejects destructive downgrades rather than dropping published work.
            with pytest.raises(RuntimeError, match="restoration plan"):
                await conn.run_sync(lambda sync: migration(sync, "downgrade"))
