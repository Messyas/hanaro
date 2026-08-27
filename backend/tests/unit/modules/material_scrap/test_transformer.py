from decimal import Decimal
from pathlib import Path

import pytest

from src.modules.material_scrap.simulator import simulate_smart_office_output
from src.modules.material_scrap.transformer import (
    ScrapTransformationError,
    normalize_payload,
    parse_decimal,
    parse_scrap_tsv,
)

FIXTURE = Path(__file__).parents[4] / "fixtures" / "Other_Account_Transaction_Text_anonymized"


def test_extensionless_cp1252_tsv_is_reconstructed_without_losing_rows() -> None:
    assert FIXTURE.suffix == ""
    assert b"\xe7" in FIXTURE.read_bytes()

    parsed = parse_scrap_tsv(FIXTURE)

    assert len(parsed.records) == 6
    assert parsed.reconstructed_rows == 1
    assert parsed.records[0]["account_description"] == "Scrap Account"
    assert parsed.records[0]["item_description"] == "Panel"
    assert parsed.records[0]["requisition_comment"] == "Linha inicial\tcontinuação"
    first_duplicate = {key: value for key, value in parsed.records[4].items() if key != "source_row_number"}
    second_duplicate = {key: value for key, value in parsed.records[5].items() if key != "source_row_number"}
    assert first_duplicate == second_duplicate


def test_financial_values_use_decimal_preserve_sign_and_defined_scales() -> None:
    payload = simulate_smart_office_output(FIXTURE, Decimal("5.15"))
    records = normalize_payload(payload)

    assert payload.exchange_rate.brl_per_usd == Decimal("5.150000")
    assert isinstance(records[0].issue_amount_brl, Decimal)
    assert records[0].issue_quantity == Decimal("-2.500000")
    assert records[0].issue_price == Decimal("10.00000000")
    assert records[0].issue_amount_brl == Decimal("-25.00")
    assert records[0].amount_usd == Decimal("-4.854369")
    assert records[2].issue_amount_brl == Decimal("50.00")
    assert all(not isinstance(value, float) for record in records for value in record.model_dump().values())


def test_unmapped_values_are_kept_and_flagged() -> None:
    records = normalize_payload(simulate_smart_office_output(FIXTURE, Decimal("5.15")))

    assert records[2].receipt_department == "NOVO_SETOR"
    assert records[2].department is None
    assert "unmapped_department" in records[2].quality_flags
    assert records[2].item_type is None
    assert "unmapped_item_type" in records[2].quality_flags
    assert records[3].organization_code == "NQX"
    assert records[3].product is None
    assert "unmapped_organization" in records[3].quality_flags


def test_payload_without_physical_row_numbers_assigns_stable_positions() -> None:
    payload = simulate_smart_office_output(FIXTURE, Decimal("5.15"))
    for record in payload.records:
        record.pop("source_row_number")

    records = normalize_payload(payload)

    assert [record.source_row_number for record in records] == [1, 2, 3, 4, 5, 6]


def test_decimal_parser_accepts_comma_and_never_uses_binary_float() -> None:
    result = parse_decimal("1.234,56", Decimal("0.01"), field_name="amount", required=True)
    assert result == Decimal("1234.56")
    assert isinstance(result, Decimal)


def test_malformed_row_fails_instead_of_being_silently_skipped(tmp_path: Path) -> None:
    source = tmp_path / "Other_Account_Transaction_Text_broken"
    source.write_bytes(
        "Organization\tTransaction Date\tIssue Quantity\tIssue Amount BRL\t\r\nNWK\t26/08/2026\t-1,0\t\r\n".encode("cp1252")
    )
    with pytest.raises(ScrapTransformationError, match="fields; expected"):
        parse_scrap_tsv(source)
