import uuid
from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.infrastructure.database.session import Base
from src.modules.governance.exceptions import ReportConflictError, ReportValidationError
from src.modules.governance.exports import render_csv, render_pdf, render_pptx
from src.modules.governance.models import Factory, SnapshotFinancialRow, SnapshotItem
from src.modules.governance.service import (
    create_report,
    get_report_detail,
    get_report_scope,
    get_report_sections,
    get_version,
    list_reports,
    mutate_sources,
    preview_report,
    publish_report,
    replace_report_sections,
    update_report,
    update_report_scope,
)
from src.modules.governance.storage import ReportArtifactStorage
from src.modules.material_scrap.models import ScrapOccurrence, ScrapReview
from src.modules.material_scrap.service import ingest_material_scrap
from src.modules.user.models import User

from ..material_scrap.helpers import canonical_fixture


@pytest.mark.asyncio
async def test_report_creation_provisions_the_internal_local_factory() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with sessions() as db:
        user = User(name="Analyst", username="analyst", email="analyst@example.com", hashed_password="hash")
        db.add(user)
        await db.flush()

        report = await create_report(
            db,
            title="First report",
            description="",
            factory_id=None,
            actor_id=user.id,
            correlation_id="test-local-factory",
        )

        factory = await db.get(Factory, report.factory_id)
        assert factory is not None
        assert factory.code == "HANARO-LOCAL"
        assert factory.name == "Fábrica local"
        assert factory.is_active is True
    await engine.dispose()


@pytest.mark.asyncio
async def test_period_close_persists_its_scope_and_rejects_legacy_composition() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with sessions() as db:
        user = User(name="Analyst", username="analyst", email="analyst@example.com", hashed_password="hash")
        db.add(user)
        await db.flush()
        scope = {
            "period_from": date(2026, 8, 1),
            "period_to": date(2026, 8, 31),
            "cutoff_at": None,
            "timezone": "America/Manaus",
            "metric_code": "MATERIAL_SCRAP_COST",
            "metric_policy_version": "scrap-cost-v1",
            "currency": "USD",
            "comparison_mode": "PREVIOUS_YEAR",
            "comparison_from": None,
            "comparison_to": None,
            "is_provisional": False,
            "filters": {"organization_codes": ["MNS"], "product_codes": [], "divisions": [], "lines": ["L1"]},
        }
        report = await create_report(
            db,
            title="August close",
            description="",
            factory_id=None,
            report_kind="PERIOD_CLOSE",
            content_schema_version=2,
            scope=scope,
            actor_id=user.id,
            correlation_id="test-period-close",
        )

        detail = await get_report_detail(db, report.id)
        assert detail["report_kind"] == "PERIOD_CLOSE"
        assert detail["content_schema_version"] == 2
        assert detail["scope"]["period_from"] == "2026-08-01"
        assert detail["scope"]["metric_policy_version"] == "scrap-cost-v1"
        assert detail["scope"]["filters"]["lines"] == ["L1"]

        updated_scope = {**scope, "period_to": date(2026, 9, 1)}
        report = await update_report_scope(
            db,
            report.id,
            expected_version=report.version,
            scope=updated_scope,
            actor_id=user.id,
            correlation_id="test-period-close-update",
        )
        assert report.version == 2
        assert (await get_report_scope(db, report.id)).period_to == date(2026, 9, 1)

        report = await replace_report_sections(
            db,
            report.id,
            expected_version=report.version,
            sections=[
                {
                    "section_key": "summary",
                    "kind": "EXECUTIVE_SUMMARY",
                    "enabled": True,
                    "title": "Resumo executivo",
                    "payload_schema_version": 1,
                    "payload": {"narrative": "Aguardando métricas calculadas."},
                },
                {
                    "section_key": "conclusion",
                    "kind": "CONCLUSIONS",
                    "enabled": False,
                    "title": "Conclusão",
                    "payload_schema_version": 1,
                    "payload": {},
                },
            ],
            actor_id=user.id,
            correlation_id="test-period-close-sections",
        )
        saved_sections = await get_report_sections(db, report.id)
        assert report.version == 3
        assert [(section.section_key, section.position) for section in saved_sections] == [
            ("summary", 0),
            ("conclusion", 1),
        ]

        with pytest.raises(ReportConflictError):
            await update_report_scope(
                db,
                report.id,
                expected_version=2,
                scope=scope,
                actor_id=user.id,
                correlation_id="test-period-close-stale",
            )
        with pytest.raises(ReportValidationError):
            await mutate_sources(
                db,
                report.id,
                kind="occurrence",
                operation="add",
                ids=[],
                expected_version=report.version,
                actor_id=user.id,
                correlation_id="test-period-close-legacy-sources",
            )
    await engine.dispose()


@pytest.mark.asyncio
async def test_period_close_preview_and_publication_share_the_v2_document() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with sessions() as db:
        user = User(name="Analyst", username="analyst", email="analyst@example.com", hashed_password="hash")
        db.add(user)
        await db.flush()
        payload = canonical_fixture()
        await ingest_material_scrap(payload, db)
        period_from = min(record.transaction_date for record in payload.records)
        period_to = max(record.transaction_date for record in payload.records)
        report = await create_report(
            db,
            title="Fechamento consolidado",
            description="Resumo para reunião mensal",
            factory_id=None,
            report_kind="PERIOD_CLOSE",
            content_schema_version=2,
            scope={
                "period_from": period_from,
                "period_to": period_to,
                "cutoff_at": None,
                "timezone": "America/Manaus",
                "metric_code": "MATERIAL_SCRAP_COST",
                "metric_policy_version": "scrap-cost-v1",
                "currency": "USD",
                "comparison_mode": "NONE",
                "comparison_from": None,
                "comparison_to": None,
                "is_provisional": True,
                "filters": {"organization_codes": [], "product_codes": [], "divisions": [], "lines": []},
            },
            actor_id=user.id,
            correlation_id="test-period-close-v2",
        )

        preview = await preview_report(db, report.id)
        assert preview["content_schema_version"] == 2
        assert preview["readiness"]["ready"] is True
        assert preview["document"]["sections"]
        assert preview["document"]["analytics"]["coverage"]["status"] == "UNKNOWN"

        version = await publish_report(
            db,
            report.id,
            expected_version=report.version,
            template_version="2",
            content_schema_version=2,
            preview_fingerprint=preview["fingerprint"],
            idempotency_key="publish-period-close-1",
            actor_id=user.id,
            correlation_id="test-period-close-v2-publish",
        )
        assert version.content_schema_version == 2
        assert version.content["document"]["analytics"] == preview["document"]["analytics"]
        assert version.content["manifest"]["metric_policy"] == "MATERIAL_SCRAP_COST@scrap-cost-v1"
        frozen_rows = list(
            await db.scalars(select(SnapshotFinancialRow).where(SnapshotFinancialRow.snapshot_id == version.snapshot_id))
        )
        assert len(frozen_rows) == preview["document"]["analytics"]["occurrence_count"]
        retry = await publish_report(
            db,
            report.id,
            expected_version=report.version - 1,
            template_version="2",
            content_schema_version=2,
            preview_fingerprint=preview["fingerprint"],
            idempotency_key="publish-period-close-1",
            actor_id=user.id,
            correlation_id="test-period-close-v2-retry",
        )
        assert retry.id == version.id
    await engine.dispose()


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
        source_item = await db.scalar(select(SnapshotItem).where(SnapshotItem.snapshot_id == source_version.snapshot_id))
        assert source_item is not None
        # Early/demo editions stored a sparse JSON payload even though the
        # pinned transaction columns were complete.
        source_item.frozen_values = {
            key: value for key, value in source_item.frozen_values.items() if key != "transaction_date"
        }
        await db.commit()

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
        assert preview["items"][0]["transaction_date"]
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
