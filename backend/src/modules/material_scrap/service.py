import hashlib
import json
from collections import Counter
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, localcontext

from sqlalchemy.ext.asyncio import AsyncSession

from ...infrastructure.logging import get_logger
from . import repository
from .schemas import CanonicalScrapRecord, IngestionResult, MaterialScrapPayload


class CanonicalBatchValidationError(ValueError):
    pass


logger = get_logger(__name__)


def _content_hash(record: CanonicalScrapRecord) -> str:
    values = record.model_dump(exclude={"content_hash"})
    encoded = json.dumps(
        values,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=lambda value: value.isoformat() if isinstance(value, date) else str(value),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def validate_canonical_batch(payload: MaterialScrapPayload) -> None:
    """Reconcile a canonical batch without performing source transformations."""
    records = payload.records
    statistics = payload.statistics
    if statistics.source_rows != len(records):
        raise CanonicalBatchValidationError("source_rows does not match records length")
    if statistics.accepted_rows != len(records) or statistics.rejected_rows != 0:
        raise CanonicalBatchValidationError("only complete, fully accepted batches can be ingested")
    source_lines = [record.source_line for record in records]
    if len(source_lines) != len(set(source_lines)):
        raise CanonicalBatchValidationError("source_line must be unique within a batch")

    organizations = sorted({record.organization_code for record in records})
    if organizations != sorted(payload.execution.organizations_found):
        raise CanonicalBatchValidationError("organizations_found does not reconcile with records")
    if records:
        dates = [record.transaction_date for record in records]
        if min(dates) < payload.execution.query_date_from or max(dates) > payload.execution.query_date_to:
            raise CanonicalBatchValidationError("transaction dates fall outside the query window")

    issue_total = sum((record.issue_amount_brl for record in records), Decimal("0.00")).quantize(Decimal("0.01"))
    sales_total = sum((record.sales_amount or Decimal("0.00") for record in records), Decimal("0.00")).quantize(Decimal("0.01"))
    if issue_total != statistics.issue_amount_brl_total:
        raise CanonicalBatchValidationError("issue_amount_brl_total does not reconcile")
    if sales_total != statistics.sales_amount_total:
        raise CanonicalBatchValidationError("sales_amount_total does not reconcile")

    quality_counts: Counter[str] = Counter()
    expanded_rows = 0
    for record in records:
        if record.period != record.transaction_date.strftime("%Y-%m"):
            raise CanonicalBatchValidationError(f"invalid period at source line {record.source_line}")
        if record.period_yy_mm != record.transaction_date.strftime("%y.%m"):
            raise CanonicalBatchValidationError(f"invalid period_yy_mm at source line {record.source_line}")
        with localcontext() as context:
            context.prec = 38
            expected_usd = (record.issue_amount_brl / payload.exchange_rate.brl_per_usd).quantize(
                Decimal("0.000001"), rounding=ROUND_HALF_UP
            )
        if record.amount_usd != expected_usd:
            raise CanonicalBatchValidationError(f"invalid amount_usd at source line {record.source_line}")
        if record.content_hash != _content_hash(record):
            raise CanonicalBatchValidationError(f"invalid content_hash at source line {record.source_line}")
        quality_counts.update(record.quality_flags)
        expanded_rows += "expanded_req_comment_fields" in record.quality_flags

    if expanded_rows != statistics.expanded_comment_rows:
        raise CanonicalBatchValidationError("expanded_comment_rows does not reconcile")
    if dict(sorted(quality_counts.items())) != dict(sorted(statistics.quality_flag_counts.items())):
        raise CanonicalBatchValidationError("quality_flag_counts does not reconcile")


async def ingest_material_scrap(payload: MaterialScrapPayload, db: AsyncSession) -> IngestionResult:
    """Validate and atomically publish one logical Material Scrap snapshot."""
    validate_canonical_batch(payload)
    replay = await repository.find_completed_replay(payload, db)
    if replay is not None:
        return IngestionResult(
            run_id=replay.id,
            execution_id=replay.execution_id,
            status=replay.status,
            read_count=replay.read_count,
            accepted_count=replay.accepted_count,
            rejected_count=replay.rejected_count,
            is_replay=True,
        )

    run = await repository.create_pending_run(payload, db)
    await repository.mark_processing(run, db)
    run_id = run.id
    execution_id = run.execution_id
    try:
        await repository.publish_snapshot(run, payload.records, db)
    except Exception as error:
        await db.rollback()
        await repository.mark_failed(
            run_id,
            db,
            read_count=len(payload.records),
            rejected_count=len(payload.records),
            error_message=type(error).__name__,
        )
        logger.exception(
            "material_scrap_ingestion_failed",
            extra={"run_id": str(run_id), "execution_id": str(execution_id)},
        )
        raise

    logger.info(
        "material_scrap_ingestion_completed",
        extra={"run_id": str(run.id), "accepted_count": run.accepted_count},
    )

    return IngestionResult(
        run_id=run.id,
        execution_id=run.execution_id,
        status=run.status,
        read_count=run.read_count,
        accepted_count=run.accepted_count,
        rejected_count=run.rejected_count,
    )
