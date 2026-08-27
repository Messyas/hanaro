from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from automation.material_scrap.builder import build_canonical_batch
from automation.material_scrap.decimal_parser import parse_decimal
from automation.material_scrap.exchange import ManualExchangeRateProvider
from automation.material_scrap.parser import GerpStructureError, parse_gerp_tsv
from automation.material_scrap.source import RunContext

FIXTURE = (
    Path(__file__).parents[1] / "fixtures" / "Other_Account_Transaction_Text_anonymized"
)


def test_extensionless_tsv_reconstructs_comments_without_losing_rows() -> None:
    parsed = parse_gerp_tsv(FIXTURE)

    assert FIXTURE.suffix == ""
    assert parsed.encoding == "cp1252"
    assert len(parsed.rows) == 6
    assert parsed.expanded_comment_rows == 1
    assert "expanded_req_comment_fields" in parsed.rows[0].parser_flags
    assert (
        parsed.rows[0]
        .values["requisition_comment"]
        .startswith("Linha inicial | continua")
    )


def test_canonical_batch_uses_decimal_strings_and_reconciles() -> None:
    batch = build_canonical_batch(
        FIXTURE,
        RunContext(reference_date=date(2026, 8, 26)),
        ManualExchangeRateProvider(rate=Decimal("5.15"), source="manual_fixture"),
    )

    serialized = batch.model_dump_json()
    assert '"issue_amount_brl":"-25.00"' in serialized
    assert (
        batch.statistics.source_rows
        == batch.statistics.accepted_rows
        == len(batch.records)
    )
    assert batch.statistics.rejected_rows == 0
    assert batch.statistics.expanded_comment_rows == 1
    assert all(record.amount_usd.as_tuple().exponent == -6 for record in batch.records)


def test_decimal_parser_never_uses_float_and_rounds_half_up() -> None:
    assert parse_decimal("1.234,565", Decimal("0.01"), field_name="amount") == Decimal(
        "1234.57"
    )
    with pytest.raises(ValueError, match="required"):
        parse_decimal(None, Decimal("0.01"), field_name="amount", required=True)


def test_short_row_fails_instead_of_being_silently_skipped(tmp_path: Path) -> None:
    source = tmp_path / "broken.tsv"
    source.write_text(
        "\t".join(["Organization Code"] * 29) + "\nNWK\t1\n", encoding="utf-8"
    )
    with pytest.raises(GerpStructureError):
        parse_gerp_tsv(source)
