import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .enums import IngestionStatus
from .models import DailyExchangeRate, IngestionRun, IngestionSourceFile, ScrapTransaction
from .schemas import CanonicalScrapRecord, ExchangeRateMetadata, MaterialScrapPayload

REPORT_NAME = "MATERIAL_SCRAP"


async def find_completed_replay(payload: MaterialScrapPayload, db: AsyncSession) -> IngestionRun | None:
    statement = (
        select(IngestionRun)
        .join(IngestionSourceFile, IngestionSourceFile.run_id == IngestionRun.id)
        .where(
            IngestionRun.report_name == REPORT_NAME,
            IngestionRun.organization_scope == payload.execution.organization_parameter,
            IngestionRun.date_from == payload.execution.query_date_from,
            IngestionRun.date_to == payload.execution.query_date_to,
            IngestionRun.status == IngestionStatus.COMPLETED.value,
            IngestionSourceFile.sha256 == payload.source_file.sha256,
        )
        .order_by(IngestionRun.ingestion_finished_at.desc())
        .limit(1)
    )
    return (await db.execute(statement)).scalar_one_or_none()


async def _get_or_create_daily_rate(rate: ExchangeRateMetadata, db: AsyncSession) -> DailyExchangeRate:
    statement = select(DailyExchangeRate).where(
        DailyExchangeRate.rate_date == rate.rate_date,
        DailyExchangeRate.base_currency == rate.base_currency,
        DailyExchangeRate.quote_currency == rate.quote_currency,
        DailyExchangeRate.quote_type == rate.quote_type,
        DailyExchangeRate.source == rate.source,
    )
    existing = (await db.execute(statement)).scalar_one_or_none()
    if existing is not None:
        if (
            existing.brl_per_usd != rate.brl_per_usd
            or existing.effective_date != rate.effective_date
            or existing.fallback_used != rate.fallback_used
        ):
            raise ValueError("conflicting exchange rate for the same daily rate identity")
        return existing
    daily_rate = DailyExchangeRate(
        rate_date=rate.rate_date,
        effective_date=rate.effective_date,
        base_currency=rate.base_currency,
        quote_currency=rate.quote_currency,
        brl_per_usd=rate.brl_per_usd,
        quote_type=rate.quote_type,
        source=rate.source,
        fallback_used=rate.fallback_used,
        retrieved_at=rate.retrieved_at,
    )
    db.add(daily_rate)
    await db.flush()
    return daily_rate


async def create_pending_run(payload: MaterialScrapPayload, db: AsyncSession) -> IngestionRun:
    rate = await _get_or_create_daily_rate(payload.exchange_rate, db)
    run = IngestionRun(
        execution_id=payload.execution.execution_id,
        exchange_rate_id=rate.id,
        report_name=REPORT_NAME,
        organization_scope=payload.execution.organization_parameter,
        date_from=payload.execution.query_date_from,
        date_to=payload.execution.query_date_to,
        status=IngestionStatus.PENDING.value,
        schema_version=payload.schema_version,
        mapping_version=payload.mapping.version,
        mode=payload.execution.mode,
        processing_date=payload.execution.processing_date,
        query_window_inferred=payload.execution.query_window_inferred,
        source_started_at=payload.execution.extracted_at,
        source_finished_at=payload.execution.extracted_at,
        read_count=payload.statistics.source_rows,
        accepted_count=0,
        rejected_count=0,
        issue_amount_brl_total=payload.statistics.issue_amount_brl_total,
        sales_amount_total=payload.statistics.sales_amount_total,
        expanded_comment_rows=payload.statistics.expanded_comment_rows,
        quality_flag_counts=payload.statistics.quality_flag_counts,
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
            reconstructed_rows=payload.statistics.expanded_comment_rows,
            size_bytes=payload.source_file.size_bytes,
            request_id=payload.execution.gerp_request_id,
            extracted_at=payload.execution.extracted_at,
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
    records: list[CanonicalScrapRecord],
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
