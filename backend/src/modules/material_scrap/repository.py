import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .enums import IngestionStatus
from .models import ExchangeRate, IngestionRun, IngestionSourceFile, ScrapTransaction
from .schemas import MaterialScrapPayload, NormalizedScrapRecord


async def find_completed_replay(payload: MaterialScrapPayload, db: AsyncSession) -> IngestionRun | None:
    statement = (
        select(IngestionRun)
        .join(IngestionSourceFile, IngestionSourceFile.run_id == IngestionRun.id)
        .where(
            IngestionRun.report_name == "MATERIAL_SCRAP",
            IngestionRun.organization_scope == payload.query.organization_scope,
            IngestionRun.date_from == payload.query.date_from,
            IngestionRun.date_to == payload.query.date_to,
            IngestionRun.status == IngestionStatus.COMPLETED.value,
            IngestionSourceFile.sha256 == payload.source_file.sha256,
        )
        .order_by(IngestionRun.ingestion_finished_at.desc())
        .limit(1)
    )
    return (await db.execute(statement)).scalar_one_or_none()


async def create_pending_run(payload: MaterialScrapPayload, db: AsyncSession) -> IngestionRun:
    run = IngestionRun(
        execution_id=payload.execution.execution_id,
        report_name="MATERIAL_SCRAP",
        organization_scope=payload.query.organization_scope,
        date_from=payload.query.date_from,
        date_to=payload.query.date_to,
        status=IngestionStatus.PENDING.value,
        schema_version=payload.schema_version,
        source_started_at=payload.execution.started_at,
        source_finished_at=payload.execution.finished_at,
    )
    db.add(run)
    await db.flush()
    db.add(
        IngestionSourceFile(
            run_id=run.id,
            name=payload.source_file.name,
            sha256=payload.source_file.sha256,
            encoding=payload.source_file.encoding,
            delimiter=payload.source_file.delimiter,
            reconstructed_rows=payload.source_file.reconstructed_rows,
            request_id=payload.execution.request_id,
            extracted_at=payload.execution.finished_at,
        )
    )
    db.add(
        ExchangeRate(
            run_id=run.id,
            base_currency=payload.exchange_rate.base_currency,
            quote_currency=payload.exchange_rate.quote_currency,
            brl_per_usd=payload.exchange_rate.brl_per_usd,
            source=payload.exchange_rate.source,
            requested_date=payload.exchange_rate.requested_date,
            effective_date=payload.exchange_rate.effective_date,
            fallback_used=payload.exchange_rate.fallback_used,
        )
    )
    await db.commit()
    return run


async def mark_processing(run: IngestionRun, db: AsyncSession) -> None:
    run.status = IngestionStatus.PROCESSING.value
    run.ingestion_started_at = datetime.now(UTC)
    await db.commit()


async def publish_snapshot(
    run: IngestionRun,
    records: list[NormalizedScrapRecord],
    db: AsyncSession,
) -> None:
    db.add_all([ScrapTransaction(run_id=run.id, **record.model_dump()) for record in records])
    await db.flush()
    await db.execute(
        update(IngestionRun)
        .where(
            IngestionRun.id != run.id,
            IngestionRun.report_name == run.report_name,
            IngestionRun.organization_scope == run.organization_scope,
            IngestionRun.date_from == run.date_from,
            IngestionRun.date_to == run.date_to,
            IngestionRun.is_active.is_(True),
        )
        .values(is_active=False)
    )
    run.read_count = len(records)
    run.accepted_count = len(records)
    run.rejected_count = 0
    run.status = IngestionStatus.COMPLETED.value
    run.is_active = True
    run.ingestion_finished_at = datetime.now(UTC)
    await db.commit()


async def mark_failed(
    run_id: uuid.UUID,
    db: AsyncSession,
    *,
    read_count: int,
    rejected_count: int,
    error_message: str,
) -> None:
    await db.execute(
        update(IngestionRun)
        .where(IngestionRun.id == run_id)
        .values(
            status=IngestionStatus.FAILED.value,
            is_active=False,
            read_count=read_count,
            accepted_count=0,
            rejected_count=rejected_count,
            error_message=error_message[:2000],
            ingestion_finished_at=datetime.now(UTC),
        )
    )
    await db.commit()
