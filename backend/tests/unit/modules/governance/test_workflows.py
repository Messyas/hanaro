import csv
import importlib.util
import io
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from pptx import Presentation
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.infrastructure.database.session import Base
from src.modules.governance.actions import PlanInput, TaskCommand, TaskInput, board, command_task, save_plan, save_task
from src.modules.governance.exceptions import ReportConflictError
from src.modules.governance.exports import request_export, run_export
from src.modules.governance.exports.document import Document
from src.modules.governance.exports.renderers import RENDERERS
from src.modules.governance.models import (
    Alert,
    AlertRecipient,
    Artifact,
    ConsumerReceipt,
    EmailDelivery,
    EventAttempt,
    OutboxEvent,
    ReportVersion,
)
from src.modules.governance.notifications.rules import RuleInput, evaluate, save_rule
from src.modules.governance.notifications.service import consume, dispatch, emit, recover_exports
from src.modules.governance.schemas import ExportOptions
from src.modules.governance.service import create_report, mutate_sources, publish_report
from src.modules.governance.storage import ReportArtifactStorage
from src.modules.material_scrap.models import ScrapOccurrence, ScrapReview
from src.modules.material_scrap.service import ingest_material_scrap
from src.modules.user.models import User

from ..material_scrap.helpers import canonical_fixture


@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        session.add_all(
            [
                User(name="Analyst", username="analyst", email="one@example.com", hashed_password="hash"),
                User(name="Peer", username="peer", email="two@example.com", hashed_password="hash"),
            ]
        )
        await session.commit()
        yield session
    await engine.dispose()


async def published(db):
    await ingest_material_scrap(canonical_fixture(), db)
    occurrence = await db.scalar(select(ScrapOccurrence))
    review = ScrapReview(
        occurrence_id=occurrence.id,
        responsible_user_id=1,
        responsible_name="Analyst",
        status="REVIEWED",
        title="Review <&>",
        description="Complete analysis\n" * 150,
        version=1,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(review)
    await db.commit()
    report = await create_report(
        db, title="Relatório <&> 한글", description="Long report", factory_id=None, actor_id=1, correlation_id="test"
    )
    await mutate_sources(
        db,
        report.id,
        kind="occurrence",
        operation="add",
        ids=[occurrence.id],
        expected_version=report.version,
        actor_id=1,
        correlation_id="test",
    )
    return await publish_report(
        db, report.id, expected_version=report.version, template_version="1", actor_id=1, correlation_id="test"
    )


async def test_task_validation_participants_conflict_and_history(db):
    plan = await save_plan(db, PlanInput(title="Corrective actions"), 1)
    task = await save_task(db, plan["id"], TaskInput(title="Repair", participant_ids=[1, 2], blocked_reason="Waiting"), 1)
    assert {p["id"] for p in task["participants"]} == {1, 2}
    assert (await board(db, plan["id"], "PLANNED", 1, 1))["total"] == 1
    with pytest.raises(ReportConflictError):
        await command_task(db, task["id"], TaskCommand(expected_version=task["version"], command="validate"), 2)
    task = await command_task(
        db, task["id"], TaskCommand(expected_version=task["version"], command="move", status="UNDER_VERIFICATION"), 2
    )
    with pytest.raises(ReportConflictError):
        await command_task(db, task["id"], TaskCommand(expected_version=task["version"], command="validate"), 1)
    task = await save_task(
        db, plan["id"], TaskInput(title="Repair", participant_ids=[1, 2], expected_version=task["version"]), 2, task["id"]
    )
    task = await command_task(db, task["id"], TaskCommand(expected_version=task["version"], command="validate"), 2)
    assert task["status"] == "COMPLETED" and task["validated_by_id"] == 2
    with pytest.raises(ReportConflictError):
        await command_task(db, task["id"], TaskCommand(expected_version=1, command="reopen"), 1)
    task = await command_task(db, task["id"], TaskCommand(expected_version=task["version"], command="reopen"), 1)
    assert task["status"] == "IN_PROGRESS"


async def test_email_simulation_is_idempotent_and_separate_from_alerts(db):
    event = emit(db, "TASK_ASSIGNED", uuid.uuid4(), {"title": "Repair", "recipient_ids": [1, 2]})
    await db.flush()
    await consume(db, event)
    await db.commit()
    await consume(db, event)
    await db.commit()
    assert await db.scalar(select(func.count()).select_from(EmailDelivery)) == 2
    assert await db.scalar(select(func.count()).select_from(Alert)) == 0
    assert await db.scalar(select(func.count()).select_from(ConsumerReceipt)) == 1
    assert (await db.scalar(select(EmailDelivery))).status == "SIMULATED"
    event = emit(db, "TASK_OVERDUE", uuid.uuid4(), {"title": "Late", "recipient_ids": [1, 2]})
    await db.flush()
    await consume(db, event)
    await db.commit()
    recipients = list(await db.scalars(select(AlertRecipient).order_by(AlertRecipient.user_id)))
    recipients[0].read_at = datetime.now(UTC)
    await db.commit()
    assert recipients[1].read_at is None
    assert (await db.scalar(select(Alert))).resolved_at is None


async def test_broker_failure_is_recorded_and_recoverable(db):
    event = emit(db, "REPORT_EXPORT_REQUESTED", uuid.uuid4(), {})
    await db.commit()
    broker = AsyncMock(side_effect=RuntimeError("secret connection string"))
    assert await dispatch(db, broker) == 0
    await db.refresh(event)
    assert event.published_at is None and event.attempts == 1
    attempt = await db.scalar(select(EventAttempt))
    assert "secret" not in attempt.error
    event.available_at = datetime.now(UTC) - timedelta(seconds=1)
    await db.commit()
    assert await dispatch(db, AsyncMock()) == 1


async def test_exports_share_identity_and_expired_claim_is_recovered(db, tmp_path):
    version = await published(db)
    args = dict(report_version_id=version.id, format_="MARKDOWN", options={}, template_version="1", retry_failed=False)
    first, _ = await request_export(db, actor_id=1, **args)
    second, created = await request_export(db, actor_id=2, **{**args, "options": ExportOptions().model_dump()})
    assert first.id == second.id and not created
    storage = ReportArtifactStorage(tmp_path)
    result = await run_export(db, first.id, storage)
    assert result.status == "COMPLETED"
    artifact = await db.scalar(select(Artifact))
    original = storage.read(artifact.storage_key)
    await run_export(db, first.id, storage)
    assert storage.read(artifact.storage_key) == original
    assert result.attempts == 1
    completed = await db.scalar(select(OutboxEvent).where(OutboxEvent.event_type == "REPORT_EXPORT_COMPLETED"))
    await consume(db, completed)
    await db.commit()
    assert await db.scalar(select(func.count()).select_from(EmailDelivery)) == 0
    notified, _ = await request_export(
        db,
        actor_id=1,
        **{
            **args,
            "format_": "CSV",
            "options": ExportOptions(notify_on_completion=True).model_dump(),
        },
    )
    await run_export(db, notified.id, storage)
    notified_event = await db.scalar(
        select(OutboxEvent).where(
            OutboxEvent.event_type == "REPORT_EXPORT_COMPLETED",
            OutboxEvent.aggregate_id == notified.id,
        )
    )
    await consume(db, notified_event)
    await db.commit()
    assert await db.scalar(select(func.count()).select_from(EmailDelivery)) == 1
    other, _ = await request_export(db, actor_id=1, **{**args, "format_": "PDF"})
    other.status = "RUNNING"
    other.lease_until = datetime.now(UTC) - timedelta(seconds=1)
    other.lease_token = uuid.uuid4()
    await db.commit()
    await recover_exports(db)
    assert other.status == "QUEUED" and other.lease_token is None


async def test_rules_dedupe_and_closed_cost_goal(db):
    await published(db)
    await save_rule(db, RuleInput(name="Cost", event_type="SCRAP_RELEVANT", threshold=Decimal(0), user_ids=[1]))
    await evaluate(db, today=date(2026, 9, 9))
    before = await db.scalar(select(func.count()).select_from(OutboxEvent).where(OutboxEvent.event_type == "SCRAP_RELEVANT"))
    await evaluate(db, today=date(2026, 9, 9))
    assert (
        await db.scalar(select(func.count()).select_from(OutboxEvent).where(OutboxEvent.event_type == "SCRAP_RELEVANT"))
        == before
    )
    with pytest.raises(ValidationError):
        RuleInput(name="Bad goal", event_type="COST_EXCEEDED", severity="POSITIVE")
    with pytest.raises(ValidationError):
        ExportOptions(unsafe=True)


def test_real_formats_long_text_and_options(tmp_path):
    version = ReportVersion(
        report_id=uuid.uuid4(),
        snapshot_id=uuid.uuid4(),
        revision=1,
        template_version="1",
        sha256="f" * 64,
        published_at=datetime.now(UTC),
        content={
            "report": {"title": "Análise <&> 한글", "author": "Analyst"},
            "metrics": {"occurrence_count": 1, "amount_usd": "-12.34", "issue_amount_brl": "-50.00"},
        },
    )
    item = {
        "occurrence_id": str(uuid.uuid4()),
        "item_code": " \t=SUM(1,2)",
        "issue_quantity": "-12.340000",
        "amount_usd": "-12.34",
        "review_description": "Justificativa completa 한글 <script>\n" * 120,
        "review_title": "Title",
    }
    for language in ("pt", "en", "ko"):
        for name, renderer in RENDERERS.items():
            content = renderer(Document(version, [item], ExportOptions(language=language)))
            (tmp_path / f"report-{language}.{name.lower()}").write_bytes(content)
            if name == "PPTX":
                slides = Presentation(io.BytesIO(content)).slides
                assert len(slides) > 8
                assert "Justificativa completa" in " ".join(
                    shape.text for slide in slides for shape in slide.shapes if shape.has_text_frame
                )
            if name == "CSV":
                row = next(csv.DictReader(io.StringIO(content.decode("utf-8-sig"))))
                assert row["item_code"].startswith("'") and row["issue_quantity"] == "-12.340000"
            if name == "MARKDOWN":
                assert b"<script>" not in content
    minimal = RENDERERS["MARKDOWN"](Document(version, [item], ExportOptions(include_money=False, include_justifications=False)))
    assert b"12.34" not in minimal and b"Justificativa completa" not in minimal


async def test_migration_reconciles_precreated_schema(db):
    path = Path(__file__).parents[4] / "migrations/versions/20260909_14_governance_workflows.py"
    spec = importlib.util.spec_from_file_location("workflow_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    connection = await db.connection()

    def upgrade(connection):
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()

    await connection.run_sync(upgrade)
    await db.commit()
