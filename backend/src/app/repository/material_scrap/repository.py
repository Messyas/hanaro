import uuid
from datetime import UTC, date, datetime

from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.material_scrap.enums import IngestionStatus
from src.app.models.material_scrap.models import (
    DailyExchangeRate,
    IngestionRun,
    IngestionSourceFile,
    ScrapDashboardAggregate,
    ScrapDashboardState,
    ScrapOccurrence,
    ScrapOccurrenceObservation,
    ScrapReconciliationPartition,
    ScrapTransaction,
)
from src.app.models.material_scrap.schemas import CanonicalScrapRecord, ExchangeRateMetadata, MaterialScrapPayload
from src.app.utils.material_scrap.identity import RECORD_KEY_VERSION, record_key, semantic_content_hash
from src.app.utils.material_scrap.projection import build_dashboard_projection

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
    """Atomically reconcile complete, authoritative organization/date partitions.

    A run remains an audit trail.  The published state instead lives in stable
    occurrences, their current immutable transaction, and one current
    aggregate fact per active occurrence.
    """
    partitions: dict[tuple[str, date], list[CanonicalScrapRecord]] = {}
    for record in records:
        partitions.setdefault((record.organization_code, record.transaction_date), []).append(record)

    for (organization_code, transaction_date), partition_records in sorted(partitions.items(), key=lambda item: item[0]):
        await _reconcile_partition(run, organization_code, transaction_date, partition_records, db)

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
    now = datetime.now(UTC)
    run.ingestion_finished_at = now
    state = await db.get(ScrapDashboardState, 1, with_for_update=True)
    if state is None:
        state = ScrapDashboardState(updated_at=now)
        db.add(state)
    else:
        state.revision = uuid.uuid4()
        state.updated_at = now
    await db.commit()


class OccurrenceIdentityCollisionError(ValueError):
    code = "OCCURRENCE_IDENTITY_COLLISION"


async def _lock_partition(db: AsyncSession, organization_code: str, transaction_date: date) -> ScrapReconciliationPartition:
    statement = select(ScrapReconciliationPartition).where(
        ScrapReconciliationPartition.organization_code == organization_code,
        ScrapReconciliationPartition.transaction_date == transaction_date,
    )
    partition = (await db.execute(statement.with_for_update())).scalar_one_or_none()
    if partition is not None:
        return partition
    try:
        async with db.begin_nested():
            candidate = ScrapReconciliationPartition(organization_code=organization_code, transaction_date=transaction_date)
            db.add(candidate)
            await db.flush()
    except IntegrityError:
        pass
    return (await db.execute(statement.with_for_update())).scalar_one()


async def _get_or_create_occurrence(
    db: AsyncSession,
    *,
    business_key: str,
    identity_slot: int,
    organization_code: str,
    transaction_date: date,
    observed_at: datetime,
) -> ScrapOccurrence:
    statement = select(ScrapOccurrence).where(
        ScrapOccurrence.record_key_version == RECORD_KEY_VERSION,
        ScrapOccurrence.record_key == business_key,
        ScrapOccurrence.identity_slot == identity_slot,
    )
    occurrence = (await db.execute(statement.with_for_update())).scalar_one_or_none()
    if occurrence is not None:
        return occurrence
    try:
        async with db.begin_nested():
            candidate = ScrapOccurrence(
                record_key=business_key,
                record_key_version=RECORD_KEY_VERSION,
                identity_slot=identity_slot,
                organization_code=organization_code,
                transaction_date=transaction_date,
                first_seen_at=observed_at,
                last_seen_at=observed_at,
                status="ACTIVE",
                created_at=observed_at,
                updated_at=observed_at,
            )
            db.add(candidate)
            await db.flush()
            return candidate
    except IntegrityError:
        return (await db.execute(statement.with_for_update())).scalar_one()


async def _reconcile_partition(
    run: IngestionRun,
    organization_code: str,
    transaction_date: date,
    records: list[CanonicalScrapRecord],
    db: AsyncSession,
) -> None:
    by_key: dict[str, list[CanonicalScrapRecord]] = {}
    for record in records:
        by_key.setdefault(record_key(record), []).append(record)
    for business_key, same_identity_records in by_key.items():
        semantic_versions = {semantic_content_hash(record) for record in same_identity_records}
        if len(semantic_versions) > 1:
            raise OccurrenceIdentityCollisionError(
                "incompatible stable identity in authoritative partition "
                f"{organization_code}/{transaction_date}: {business_key}"
            )

    await _lock_partition(db, organization_code, transaction_date)
    now = datetime.now(UTC)
    active_before = list(
        (
            await db.execute(
                select(ScrapOccurrence)
                .where(
                    ScrapOccurrence.organization_code == organization_code,
                    ScrapOccurrence.transaction_date == transaction_date,
                    ScrapOccurrence.status == "ACTIVE",
                )
                .with_for_update()
            )
        ).scalars()
    )
    observed_ids: set[uuid.UUID] = set()
    replacement_facts: list[ScrapDashboardAggregate] = []

    slotted_records = [
        (record, business_key, slot)
        for business_key, same_identity_records in by_key.items()
        for slot, record in enumerate(
            sorted(same_identity_records, key=lambda value: (semantic_content_hash(value), value.source_line)), start=1
        )
    ]
    for record, business_key, identity_slot in slotted_records:
        occurrence = await _get_or_create_occurrence(
            db,
            business_key=business_key,
            identity_slot=identity_slot,
            organization_code=organization_code,
            transaction_date=transaction_date,
            observed_at=now,
        )
        current_transaction = (
            await db.get(ScrapTransaction, occurrence.current_transaction_id)
            if occurrence.current_transaction_id is not None
            else None
        )
        if current_transaction is None or current_transaction.content_hash != record.content_hash:
            current_transaction = ScrapTransaction(run_id=run.id, occurrence_id=occurrence.id, **record.model_dump())
            db.add(current_transaction)
            await db.flush()
            occurrence.current_transaction_id = current_transaction.id
        occurrence.last_seen_at = now
        occurrence.updated_at = now
        occurrence.status = "ACTIVE"
        observed_ids.add(occurrence.id)
        db.add(
            ScrapOccurrenceObservation(
                run_id=run.id,
                occurrence_id=occurrence.id,
                transaction_id=current_transaction.id,
                source_line=record.source_line,
                content_hash=record.content_hash,
                observed_at=now,
            )
        )
        replacement_facts.append(build_dashboard_projection(occurrence_id=occurrence.id, run_id=run.id, record=record))

    absent_ids = [occurrence.id for occurrence in active_before if occurrence.id not in observed_ids]
    if absent_ids:
        await db.execute(
            update(ScrapOccurrence).where(ScrapOccurrence.id.in_(absent_ids)).values(status="NOT_PRESENT", updated_at=now)
        )
    affected_ids = [*observed_ids, *absent_ids]
    if affected_ids:
        await db.execute(delete(ScrapDashboardAggregate).where(ScrapDashboardAggregate.occurrence_id.in_(affected_ids)))
    db.add_all(replacement_facts)
    await db.flush()


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
