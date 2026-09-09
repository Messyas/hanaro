import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.infrastructure.database.session import Base
from src.modules.governance.exceptions import ReportConflictError, ReportValidationError
from src.modules.governance.exports import render_csv, render_pdf, render_pptx
from src.modules.governance.models import Factory, SnapshotItem
from src.modules.governance.service import (
    create_report,
    get_version,
    list_reports,
    mutate_sources,
    preview_report,
    publish_report,
    update_report,
)
from src.modules.governance.storage import ReportArtifactStorage
from src.modules.material_scrap.models import ScrapOccurrence, ScrapReview
from src.modules.material_scrap.service import ingest_material_scrap
from src.modules.user.models import User

from ..material_scrap.helpers import canonical_fixture


@pytest.mark.asyncio
async def test_report_draft_composition_publication_and_real_exports(tmp_path: Path) -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with sessions() as db:
        user = User(name="Analyst", username="analyst", email="analyst@example.com", hashed_password="hash")
        db.add(user)
        await db.flush()
        await ingest_material_scrap(canonical_fixture(), db)
        occurrence = await db.scalar(select(ScrapOccurrence))
        review = ScrapReview(
            occurrence_id=occurrence.id,
            responsible_user_id=user.id,
            responsible_name=user.name,
            status="REVIEWED",
            title="Final review",
            description="Original finding",
            version=1,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.add(review)
        factory = Factory(code="MANAUS", name="Manaus")
        db.add(factory)
        await db.commit()

        source = await create_report(
            db,
            title="Source report",
            description="One occurrence",
            factory_id=factory.id,
            actor_id=user.id,
            correlation_id="test-source",
        )
        source = await mutate_sources(
            db,
            source.id,
            kind="occurrence",
            operation="add",
            ids=[occurrence.id],
            expected_version=source.version,
            actor_id=user.id,
            correlation_id="test-source-items",
        )
        source_version = await publish_report(
            db,
            source.id,
            expected_version=source.version,
            template_version="1",
            actor_id=user.id,
            correlation_id="test-source-publish",
        )

        consolidated = await create_report(
            db,
            title="Consolidated report",
            description="Mixed sources",
            factory_id=factory.id,
            actor_id=user.id,
            correlation_id="test-consolidated",
        )
        consolidated = await mutate_sources(
            db,
            consolidated.id,
            kind="occurrence",
            operation="add",
            ids=[occurrence.id],
            expected_version=consolidated.version,
            actor_id=user.id,
            correlation_id="test-direct",
        )
        consolidated = await mutate_sources(
            db,
            consolidated.id,
            kind="report",
            operation="add",
            ids=[source.id],
            expected_version=consolidated.version,
            actor_id=user.id,
            correlation_id="test-report-source",
        )
        preview = await preview_report(db, consolidated.id)
        assert preview["metrics"]["occurrence_count"] == 1
        assert len(preview["lineage"][str(occurrence.id)]) == 2

        version = await publish_report(
            db,
            consolidated.id,
            expected_version=consolidated.version,
            template_version="1",
            actor_id=user.id,
            correlation_id="test-publish",
        )
        select_statements: list[str] = []

        def track_selects(_connection, _cursor, statement, _parameters, _context, _executemany) -> None:
            if statement.lstrip().upper().startswith("SELECT"):
                select_statements.append(statement)

        event.listen(engine.sync_engine, "before_cursor_execute", track_selects)
        report_page = await list_reports(db, page=1, page_size=25)
        event.remove(engine.sync_engine, "before_cursor_execute", track_selects)
        assert len(select_statements) == 2
        listed = {item["id"]: item for item in report_page["items"]}
        assert listed[str(consolidated.id)]["occurrence_count"] == 1
        assert listed[str(consolidated.id)]["latest_revision"] == 1

        frozen = await get_version(db, consolidated.id, 1)
        assert frozen["items"][0]["review_description"] == "Original finding"
        review.description = "Finding changed after publication"
        review.version += 1
        await db.commit()
        assert (await preview_report(db, consolidated.id))["items"][0][
            "review_description"
        ] == "Finding changed after publication"
        assert (await get_version(db, consolidated.id, 1))["items"][0]["review_description"] == "Original finding"

        snapshot_items = [
            item.frozen_values
            for item in await db.scalars(select(SnapshotItem).where(SnapshotItem.snapshot_id == version.snapshot_id))
        ]
        csv_data = render_csv(version, [{**snapshot_items[0], "review_title": "=cmd|' /C calc'!A0"}])
        pdf_data = render_pdf(version, snapshot_items)
        pptx_data = render_pptx(version, snapshot_items)
        assert b"'=cmd" in csv_data
        assert pdf_data.startswith(b"%PDF")
        assert pptx_data.startswith(b"PK")
        assert source_version.sha256 and version.sha256

        with pytest.raises(ReportConflictError):
            await update_report(
                db,
                consolidated.id,
                expected_version=1,
                actor_id=user.id,
                correlation_id="stale",
                title="Stale title",
            )
        with pytest.raises(ReportValidationError):
            await mutate_sources(
                db,
                consolidated.id,
                kind="report",
                operation="add",
                ids=[consolidated.id],
                expected_version=consolidated.version,
                actor_id=user.id,
                correlation_id="self-cycle",
            )
    await engine.dispose()


def test_private_storage_rejects_traversal(tmp_path: Path) -> None:
    storage = ReportArtifactStorage(tmp_path)
    with pytest.raises(ValueError):
        storage.write_once("../outside.pdf", b"unsafe")
    key = f"safe/{uuid.uuid4()}.csv"
    storage.write_once(key, b"content")
    assert storage.read(key) == b"content"
