import hashlib
import uuid
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo

from .exchange import ExchangeRateProvider
from .mappings import MAPPING_VERSION
from .normalizer import normalize_file
from .parser import parse_gerp_tsv
from .schemas import (
    BatchStatistics,
    CanonicalMaterialScrapBatch,
    ExecutionMetadata,
    MappingMetadata,
    SourceFileMetadata,
)
from .source import RunContext

TIMEZONE = ZoneInfo("America/Manaus")


def build_canonical_batch(
    source_file: Path,
    context: RunContext,
    exchange_rate_provider: ExchangeRateProvider,
    *,
    extracted_at: datetime | None = None,
    mode: Literal["LOCAL_FILE_SIMULATION", "GERP_RPA"] = "LOCAL_FILE_SIMULATION",
) -> CanonicalMaterialScrapBatch:
    source_file = source_file.resolve()
    parsed = parse_gerp_tsv(source_file)
    rate = exchange_rate_provider.get_daily_rate(context.reference_date)
    records, quality_counts = normalize_file(parsed, rate)
    if len(records) != len(parsed.rows):
        raise ValueError("Record reconciliation failed after normalization")

    transaction_dates = [record.transaction_date for record in records]
    if context.query_date_from is None and context.query_date_to is None:
        query_date_from = min(transaction_dates)
        query_date_to = max(transaction_dates)
        query_window_inferred = True
    elif context.query_date_from is not None and context.query_date_to is not None:
        query_date_from = context.query_date_from
        query_date_to = context.query_date_to
        query_window_inferred = False
    else:
        raise ValueError("query_date_from and query_date_to must be supplied together")
    if query_date_to < query_date_from:
        raise ValueError("query_date_to must not be before query_date_from")
    if (
        min(transaction_dates) < query_date_from
        or max(transaction_dates) > query_date_to
    ):
        raise ValueError("Transaction dates fall outside the declared query window")

    raw_bytes = source_file.read_bytes()
    extracted = extracted_at or datetime.now(TIMEZONE)
    if extracted.tzinfo is None:
        raise ValueError("extracted_at must include timezone information")

    issue_total = sum(
        (record.issue_amount_brl for record in records), start=Decimal("0.00")
    )
    sales_total = sum(
        (record.sales_amount or Decimal("0.00") for record in records),
        start=Decimal("0.00"),
    )
    batch = CanonicalMaterialScrapBatch(
        execution=ExecutionMetadata(
            execution_id=uuid.uuid4(),
            mode=mode,
            processing_date=context.reference_date,
            extracted_at=extracted,
            query_date_from=query_date_from,
            query_date_to=query_date_to,
            query_window_inferred=query_window_inferred,
            gerp_request_id=context.gerp_request_id,
            organization_parameter=context.organization_parameter,
            organizations_found=sorted(
                {record.organization_code for record in records}
            ),
        ),
        source_file=SourceFileMetadata(
            name=source_file.name,
            sha256=hashlib.sha256(raw_bytes).hexdigest(),
            encoding=parsed.encoding,
            size_bytes=len(raw_bytes),
        ),
        exchange_rate=rate,
        mapping=MappingMetadata(version=MAPPING_VERSION),
        statistics=BatchStatistics(
            source_rows=len(parsed.rows),
            accepted_rows=len(records),
            rejected_rows=0,
            expanded_comment_rows=parsed.expanded_comment_rows,
            issue_amount_brl_total=issue_total.quantize(Decimal("0.01")),
            sales_amount_total=sales_total.quantize(Decimal("0.01")),
            quality_flag_counts=dict(sorted(quality_counts.items())),
        ),
        records=records,
    )
    return CanonicalMaterialScrapBatch.model_validate_json(batch.model_dump_json())
