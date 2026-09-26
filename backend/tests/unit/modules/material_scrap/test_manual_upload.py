from decimal import Decimal
from pathlib import Path

import pytest

from src.app.models.material_scrap.schemas import SourceFileMetadata
from src.app.services.material_scrap.manual_upload import ManualUploadValidationError, _decode, _records

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


@pytest.mark.unit
def test_source_file_metadata_has_no_application_size_ceiling() -> None:
    source = SourceFileMetadata(
        name="Other_Account_Transaction_Text_large",
        sha256="a" * 64,
        encoding="utf-8",
        size_bytes=2_000_000_000,
    )

    assert source.size_bytes == 2_000_000_000
