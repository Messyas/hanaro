import hashlib
import uuid
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

from .schemas import (
    ExchangeRateInput,
    ExecutionMetadata,
    MaterialScrapPayload,
    QueryWindow,
    SourceFileMetadata,
)
from .transformer import parse_date, parse_scrap_tsv


def simulate_smart_office_output(
    source: Path,
    exchange_rate: Decimal,
    *,
    organization_scope: str = "ALL",
    timezone: str = "America/Manaus",
    request_id: str | None = None,
) -> MaterialScrapPayload:
    """Build the contract expected from the future Smart Office automation."""
    started_at = datetime.now(ZoneInfo(timezone))
    raw_bytes = source.read_bytes()
    parsed = parse_scrap_tsv(source)
    if not parsed.records:
        raise ValueError("The source file contains no Material Scrap records")
    transaction_dates = [parse_date(record.get("transaction_date")) for record in parsed.records]
    requested_date = max(transaction_dates)
    finished_at = datetime.now(ZoneInfo(timezone))
    return MaterialScrapPayload(
        execution=ExecutionMetadata(
            execution_id=uuid.uuid4(),
            source="SMART_OFFICE_SIMULATOR",
            request_id=request_id or f"SIMULATED-{uuid.uuid4().hex[:12].upper()}",
            started_at=started_at,
            finished_at=finished_at,
        ),
        query=QueryWindow(
            organization_scope=organization_scope,
            date_from=min(transaction_dates),
            date_to=max(transaction_dates),
            timezone=timezone,
        ),
        source_file=SourceFileMetadata(
            name=source.name,
            sha256=hashlib.sha256(raw_bytes).hexdigest(),
            encoding="cp1252",
            delimiter="TAB",
            reconstructed_rows=parsed.reconstructed_rows,
        ),
        exchange_rate=ExchangeRateInput(
            brl_per_usd=exchange_rate,
            requested_date=requested_date,
            effective_date=requested_date,
        ),
        records=parsed.records,
    )
