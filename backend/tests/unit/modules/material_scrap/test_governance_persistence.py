"""Real FK/idempotency tests; optional isolated PostgreSQL schema for guards."""

import asyncio
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
from src.modules.governance.actions import PlanInput, TaskInput, plan_detail, plan_list_items, save_plan, save_task
from src.modules.governance.exceptions import ReportConflictError
from src.modules.governance.models import (
    ActionPlan,
    Alert,
    AlertRecipient,
    ConsumerReceipt,
    DatasetSnapshot,
    Factory,
    ImprovementAction,
    PlanReport,
    ProductionLine,
    ProductionVersion,
    Report,
    ReportVersion,
    SnapshotItem,
)
from src.modules.material_scrap.service import ingest_material_scrap
from src.modules.user.models import User

from .helpers import canonical_fixture


def migration(connection, direction="upgrade"):
    with Operations.context(MigrationContext.configure(connection)):
        files = [
            Path(__file__).resolve().parents[4] / "migrations/versions/20260906_12_governance_persistence.py",
            Path(__file__).resolve().parents[4] / "migrations/versions/20260909_13_reports_module.py",
            Path(__file__).resolve().parents[4] / "migrations/versions/20260909_14_governance_workflows.py",
            Path(__file__).resolve().parents[4] / "migrations/versions/20260910_15_report_scope_v2.py",
            Path(__file__).resolve().parents[4] / "migrations/versions/20260911_16_report_scope_sources.py",
            Path(__file__).resolve().parents[4] / "migrations/versions/20260911_17_report_action_sources.py",
            Path(__file__).resolve().parents[4] / "migrations/versions/20260911_18_report_snapshot_v2.py",
            Path(__file__).resolve().parents[4] / "migrations/versions/20260911_19_report_publish_receipts.py",
            Path(__file__).resolve().parents[4] / "migrations/versions/20260924_25_action_blocking.py",
            Path(__file__).resolve().parents[4] / "migrations/versions/20260924_26_action_tags_evidence.py",
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
        db.add(User(name="Demo administrator", username="admin", email="admin@example.com", hashed_password="hash"))
        await db.commit()
        first = await seed_governance(db)
        await db.commit()
        assert first["gov_factories"] == 1
        assert first["gov_production_versions"] >= 7
        assert first["gov_alerts"] == 5
        assert first["gov_alert_recipients"] == 5
        assert first["gov_consumer_receipts"] == 5
        assert first["gov_plan_reports"] == 3
        assert await db.scalar(select(func.count()).select_from(Alert)) == 5
        assert await db.scalar(select(func.count()).select_from(AlertRecipient)) == 5
        assert await db.scalar(select(func.count()).select_from(ConsumerReceipt)) == 5
        assert await db.scalar(select(func.count()).select_from(PlanReport)) == 3
        assert await db.scalar(select(func.count()).select_from(Report).where(Report.status == "PUBLISHED")) == 3
        plan = await db.scalar(select(ActionPlan))
        linked = (await plan_detail(db, plan.id))["reports"]
        assert {item["code"] for item in linked} == {"DEMO-REL-001", "DEMO-REL-002", "DEMO-REL-003"}
        assert all(item["title"] == "Relatorio demonstrativo" for item in linked)
        assert (await plan_list_items(db, [plan]))[0]["reports"] == linked
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


@pytest.mark.asyncio
async def test_concurrent_plan_and_task_edits_reject_stale_versions(governance_engine):
    if governance_engine.dialect.name != "postgresql":
        pytest.skip("Concurrent row locks require PostgreSQL")

    sessions = async_sessionmaker(governance_engine, expire_on_commit=False)
    async with sessions() as db:
        await ingest_material_scrap(canonical_fixture(), db)
        db.add(User(name="Demo administrator", username="admin", email="admin@example.com", hashed_password="hash"))
        await db.commit()
        await seed_governance(db)
        await db.commit()
        plan = await db.scalar(select(ActionPlan))
        task = await db.scalar(select(ImprovementAction).where(ImprovementAction.plan_id == plan.id))
        report = await db.scalar(select(ReportVersion).where(ReportVersion.published_at.is_not(None)))
        plan_id, plan_version = plan.id, plan.version
        task_id, task_version = task.id, task.version

    async def edit_task(title):
        async with sessions() as db:
            return await save_task(
                db,
                plan_id,
                TaskInput(title=title, expected_version=task_version),
                1,
                task_id,
            )

    task_results = await asyncio.gather(edit_task("First edit"), edit_task("Second edit"), return_exceptions=True)
    assert sum(isinstance(result, dict) for result in task_results) == 1
    assert sum(isinstance(result, ReportConflictError) for result in task_results) == 1

    async def edit_plan(title):
        async with sessions() as db:
            return await save_plan(
                db,
                PlanInput(title=title, report_version_ids=[report.id], expected_version=plan_version),
                1,
                plan_id,
            )

    plan_results = await asyncio.gather(edit_plan("First plan edit"), edit_plan("Second plan edit"), return_exceptions=True)
    assert sum(isinstance(result, dict) for result in plan_results) == 1
    assert sum(isinstance(result, ReportConflictError) for result in plan_results) == 1

    async with sessions() as db:
        saved_task = await db.get(ImprovementAction, task_id)
        saved_plan = await db.get(ActionPlan, plan_id)
        assert saved_task.version == task_version + 1
        assert saved_task.title in {"First edit", "Second edit"}
        assert saved_plan.version == plan_version + 1
        assert saved_plan.title in {"First plan edit", "Second plan edit"}
