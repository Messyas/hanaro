from collections import Counter
from decimal import Decimal
from pathlib import Path

from src.app.models.material_scrap.schemas import MaterialScrapPayload
from src.app.utils.material_scrap.identity import content_hash


def canonical_fixture() -> MaterialScrapPayload:
    root = Path(__file__).parents[5]
    payload_path = root / "automation" / "fixtures" / "material_scrap_payload_example.json"
    return MaterialScrapPayload.model_validate_json(payload_path.read_text(encoding="utf-8"))


def refresh_payload(payload: MaterialScrapPayload) -> MaterialScrapPayload:
    """Recalculate all integrity values after a focused test-fixture change."""
    for record in payload.records:
        record.content_hash = content_hash(record)
    payload.statistics.source_rows = len(payload.records)
    payload.statistics.accepted_rows = len(payload.records)
    payload.statistics.rejected_rows = 0
    payload.statistics.issue_amount_brl_total = sum(
        (record.issue_amount_brl for record in payload.records), Decimal("0.00")
    ).quantize(Decimal("0.01"))
    payload.statistics.sales_amount_total = sum(
        (record.sales_amount or Decimal("0.00") for record in payload.records), Decimal("0.00")
    ).quantize(Decimal("0.01"))
    flags: Counter[str] = Counter(flag for record in payload.records for flag in record.quality_flags)
    payload.statistics.quality_flag_counts = dict(sorted(flags.items()))
    payload.statistics.expanded_comment_rows = sum(
        "expanded_req_comment_fields" in record.quality_flags for record in payload.records
    )
    payload.execution.organizations_found = sorted({record.organization_code for record in payload.records})
    return payload
