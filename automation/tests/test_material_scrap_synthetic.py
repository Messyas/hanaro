from datetime import date
from pathlib import Path

from automation.material_scrap.parser import parse_gerp_tsv
from automation.material_scrap.synthetic import generate_synthetic_dataset


FIXTURE = (
    Path(__file__).parents[1] / "fixtures" / "Other_Account_Transaction_Text_anonymized"
)


def test_synthetic_dataset_is_parser_compatible_and_clamped_to_today(tmp_path: Path) -> None:
    generated = generate_synthetic_dataset(
        template=FIXTURE,
        output_directory=tmp_path,
        start_date=date(2023, 9, 1),
        end_date=date(2026, 12, 31),
        average_rows_per_day=2,
        window_days=366,
        seed=7,
        today=date(2026, 9, 3),
    )

    assert len(generated) == 4
    assert generated[-1].date_to == date(2026, 9, 3)
    assert all(file.rows > 0 for file in generated)

    parsed_rows = []
    for file in generated:
        parsed = parse_gerp_tsv(file.path)
        assert parsed.encoding in {"cp1252", "utf-8-sig"}
        parsed_rows.extend(parsed.rows)

    transaction_dates = [date.fromisoformat(row.values["transaction_date"] or "") for row in parsed_rows]
    assert min(transaction_dates) >= date(2023, 9, 1)
    assert max(transaction_dates) <= date(2026, 9, 3)
    assert all((row.values["work_order"] or "").startswith("SIM") for row in parsed_rows)
    assert all((row.values["created_by"] or "").startswith("SIM") for row in parsed_rows)
