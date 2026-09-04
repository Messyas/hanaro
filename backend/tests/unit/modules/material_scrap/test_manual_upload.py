from decimal import Decimal
from pathlib import Path

import pytest

from src.modules.material_scrap.manual_upload import ManualUploadValidationError, _decode, _records

PROJECT_ROOT = Path(__file__).parents[5]
GERP_FIXTURE = PROJECT_ROOT / "automation" / "fixtures" / "Other_Account_Transaction_Text_anonymized"
DEMO_FIXTURE = (
    PROJECT_ROOT / "automation" / "fixtures" / "demo-history" / "Other_Account_Transaction_Text_synthetic_20260901_20260904"
)


@pytest.mark.unit
@pytest.mark.parametrize(("fixture", "expected_rows"), [(GERP_FIXTURE, 1063), (DEMO_FIXTURE, 369)])
def test_manual_gerp_report_layout_is_normalized(fixture: Path, expected_rows: int) -> None:
    text, encoding = _decode(fixture.read_bytes())

    records, expanded_comments = _records(text, Decimal("5.15"))

    assert encoding in {"utf-8-sig", "cp1252"}
    assert len(records) == expected_rows
    assert expanded_comments == 0
    assert records[0].amount_usd != Decimal("0")


@pytest.mark.unit
def test_manual_report_rejects_unknown_header() -> None:
    with pytest.raises(ManualUploadValidationError, match="layout Other Account Transaction Text"):
        _records("unknown\theader\nvalue\tvalue\n", Decimal("5.15"))
