"""Generate realistic, parser-compatible GERP TSV fixtures for local ingestion tests."""

from __future__ import annotations

import argparse
import json
import random
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from .decimal_parser import PRICE_QUANTUM, QUANTITY_QUANTUM
from .parser import CANONICAL_FIELDS, EXPECTED_HEADER, ParsedRow, parse_gerp_tsv

DEFAULT_TEMPLATE = (
    Path(__file__).parents[1] / "fixtures" / "Other_Account_Transaction_Text_anonymized"
)
MAX_INGESTION_WINDOW_DAYS = 366
SYNTHETIC_COMMENTS = (
    "Material sintético para teste de ingestão",
    "Reposição simulada de material",
    "Ajuste simulado de processo produtivo",
    "Registro sintético para validação de dashboard",
)

SYNTHETIC_ORGANIZATIONS = (
    "NW1",  # TV (HE)
    "NW1",
    "NW1",
    "NW4",  # AV (HE)
    "NW4",
    "NWK",  # BM (BM)
    "NWK",
    "NWH",  # MNT (MNT)
    "NWD",  # TV (HE)
    "NWX",  # AV (HE)
    "NWW",  # MNT (MNT)
)

SYNTHETIC_DEPARTMENTS = (
    "BMCELL",
    "Quale",
    "G08",
    "C02",
    "Ventito",
    "Misp",
    "G05",
    "G15",
    "PCB01",
    "A02",
    "BM1",
)

SYNTHETIC_MODELS = (
    "OLED55M",
    "OLED65C4",
    "75QNED73ASA",
    "32MR50C",
    "43LK5700PSA",
    "SMT-MAIN",
    "VS-43UR78",
    "BM-UR8750",
    "AV-50SQ11",
    "27UP650",
)

SYNTHETIC_ITEMS = (
    (
        "Module,OLED Display Panel 65 inch Ultra HD",
        "EAN66127501",
        Decimal("1"),
        Decimal("6"),
        Decimal("650.00"),
        Decimal("1850.00"),
    ),
    (
        "PCBA,Main Board Assembly SMD High Density",
        "EBR30715334",
        Decimal("2"),
        Decimal("15"),
        Decimal("120.00"),
        Decimal("380.00"),
    ),
    (
        "Cover Assembly,Top Bezel Anodized Aluminum",
        "COV45671201",
        Decimal("3"),
        Decimal("20"),
        Decimal("45.00"),
        Decimal("130.00"),
    ),
    (
        "Chassis,Main Support Stamped Steel Plate",
        "EBR23789555",
        Decimal("4"),
        Decimal("25"),
        Decimal("35.00"),
        Decimal("95.00"),
    ),
    (
        "Base,Stand Assembly Cast Aluminum Alloy",
        "BAS12345601",
        Decimal("2"),
        Decimal("12"),
        Decimal("40.00"),
        Decimal("110.00"),
    ),
    (
        "Cover,Rear Cabinet Stamped ABS/PC",
        "COV31556301",
        Decimal("5"),
        Decimal("30"),
        Decimal("25.00"),
        Decimal("75.00"),
    ),
    (
        "Tape,Double Sided Acrylic Adhesive 20mm",
        "RAC31549601",
        Decimal("20"),
        Decimal("120"),
        Decimal("3.50"),
        Decimal("12.00"),
    ),
    (
        "Box,Packaging Carton Double Wall Corrugated",
        "BOX78912301",
        Decimal("10"),
        Decimal("50"),
        Decimal("8.00"),
        Decimal("22.00"),
    ),
    ("Packing,EPS Cushion Left/Right Set", "PAK45678901", Decimal("8"), Decimal("40"), Decimal("6.50"), Decimal("18.00")),
    (
        "Lens,Optical Light Guide Diffuser Acrylic",
        "LEN98765401",
        Decimal("15"),
        Decimal("80"),
        Decimal("4.00"),
        Decimal("15.00"),
    ),
    (
        "Gasket,EMI Conductive Silicone Foam Strip",
        "EAE60364701",
        Decimal("25"),
        Decimal("150"),
        Decimal("1.80"),
        Decimal("6.50"),
    ),
    (
        "Sheet,Thermal Dissipation Graphite Film",
        "EAE61081701",
        Decimal("20"),
        Decimal("100"),
        Decimal("2.20"),
        Decimal("8.00"),
    ),
)

SYNTHETIC_ACCOUNTS = (
    ("45030101", "Defect for Excessive qty over QPA(BOM)", "D-EXPENSE"),
    ("45030101", "Defect for Excessive qty over QPA(BOM)", "D-EXPENSE"),
    ("45030102", "Defect - Direct Charged", "D-DIRECT"),
    ("45030102", "Defect - Direct Charged", "D-DIRECT"),
    ("45030103", "Defect - Intransit Damage", "Intransit Shipment"),
    ("45030104", "Material Request for R&D(Inside Lab)", "E-RND-INM"),
    ("45030105", "Defect - Stock Expired or Degraded", "A-STOCK"),
)


@dataclass(frozen=True)
class GeneratedFile:
    path: Path
    date_from: date
    date_to: date
    rows: int


def _parse_date(value: str) -> date:
    return date.fromisoformat(value)


def _date_years_ago(today: date, years: int) -> date:
    try:
        return today.replace(year=today.year - years)
    except ValueError:  # February 29
        return today.replace(year=today.year - years, month=2, day=28)


def _format_decimal(value: Decimal, places: int) -> str:
    quantized = value.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)
    rendered = f"{quantized:,.{places}f}"
    return rendered.replace(",", "_").replace(".", ",").replace("_", ".")


def _eligible_days(start_date: date, end_date: date) -> Iterable[date]:
    current = start_date
    while current <= end_date:
        # The reference export has transactions Monday through Saturday.
        if current.weekday() != 6:
            yield current
        current += timedelta(days=1)


def _daily_row_count(randomizer: random.Random, average_rows: int) -> int:
    """Return a regular daily load with occasional operational peaks."""
    variation = max(1, average_rows // 3)
    rows = randomizer.randint(max(1, average_rows - variation), average_rows + variation)
    if randomizer.random() < 0.04:
        rows *= randomizer.randint(3, 6)
    return rows


def _scaled_quantity(value: Decimal, randomizer: random.Random) -> Decimal:
    factor = Decimal(randomizer.choice((70, 80, 90, 100, 110, 120, 130))) / Decimal("100")
    result = (value * factor).quantize(QUANTITY_QUANTUM, rounding=ROUND_HALF_UP)
    if result == 0:
        return value
    return result


def _scaled_price(value: Decimal, randomizer: random.Random) -> Decimal:
    factor = Decimal(randomizer.choice((97, 98, 99, 100, 101, 102, 103))) / Decimal("100")
    return (value * factor).quantize(PRICE_QUANTUM, rounding=ROUND_HALF_UP)


def _synthetic_values(
    row: ParsedRow,
    transaction_date: date,
    sequence: int,
    randomizer: random.Random,
) -> dict[str, str | None]:
    values = dict(row.values)
    values["transaction_date"] = transaction_date.isoformat()

    # Distribute organizations across TV, BM, AV, MNT
    values["organization_code"] = randomizer.choice(SYNTHETIC_ORGANIZATIONS)

    # Distribute manufacturing lines / departments
    values["receipt_department"] = randomizer.choice(SYNTHETIC_DEPARTMENTS)

    # Distribute models
    values["make_item"] = randomizer.choice(SYNTHETIC_MODELS)

    # Distribute component items with realistic categories
    item_desc, item_code, min_qty, max_qty, min_price, max_price = randomizer.choice(SYNTHETIC_ITEMS)
    values["item_description"] = item_desc
    values["item_code"] = item_code

    # Distribute scrap account and alias
    acct_code, acct_desc, acct_alias = randomizer.choice(SYNTHETIC_ACCOUNTS)
    values["account_code"] = acct_code
    values["account_description"] = acct_desc
    values["account_alias"] = acct_alias

    # Generate realistic quantities and prices (scrap is registered as negative issue)
    qty_int = randomizer.randint(int(min_qty), int(max_qty))
    quantity = Decimal(qty_int)
    cents = Decimal(randomizer.randint(0, 99)) / Decimal("100")
    price_val = Decimal(randomizer.randint(int(min_price), int(max_price))) + cents
    price = price_val.quantize(PRICE_QUANTUM, rounding=ROUND_HALF_UP)
    amount_brl = (quantity * price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    values["issue_quantity"] = _format_decimal(-quantity, 6)
    values["issue_price"] = _format_decimal(price, 8)
    values["issue_amount_brl"] = _format_decimal(-amount_brl, 2)

    # Avoid reproducing people, comments, and operational identifiers from the template.
    values["warehouse_keeper"] = f"SIM-WH-{sequence % 20 + 1:02d}"
    values["planner"] = f"SIM-PL-{sequence % 15 + 1:02d}"
    values["work_order"] = f"SIM{transaction_date:%y%m}{sequence:06d}"
    values["requisition_comment"] = randomizer.choice(SYNTHETIC_COMMENTS)
    values["reference"] = f"SIM-REF-{transaction_date:%Y%m%d}-{sequence:06d}"
    values["created_by"] = f"SIM{sequence % 90 + 10:03d}"
    return values


def _write_tsv(path: Path, rows: list[dict[str, str | None]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = ["\t".join(EXPECTED_HEADER)]
    for values in rows:
        fields = [(values[field] or "").replace("\t", " ").replace("\r", " ").replace("\n", " ") for field in CANONICAL_FIELDS]
        lines.append("\t".join([*fields, ""]))
    path.write_bytes(("\n".join(lines) + "\n").encode("cp1252", errors="replace"))


def generate_synthetic_dataset(
    *,
    template: Path,
    output_directory: Path,
    start_date: date,
    end_date: date,
    average_rows_per_day: int = 24,
    window_days: int = MAX_INGESTION_WINDOW_DAYS,
    seed: int = 20260903,
    today: date | None = None,
) -> list[GeneratedFile]:
    """Create extensionless CP1252 TSV files that never contain future dates.

    Files are split into windows of at most 366 days because that is the API
    contract maximum for an ingestion run.
    """
    if average_rows_per_day < 1:
        raise ValueError("average_rows_per_day must be at least 1")
    if not 1 <= window_days <= MAX_INGESTION_WINDOW_DAYS:
        raise ValueError(f"window_days must be between 1 and {MAX_INGESTION_WINDOW_DAYS}")

    maximum_date = today or date.today()
    effective_end_date = min(end_date, maximum_date)
    if start_date > effective_end_date:
        raise ValueError("start_date must be on or before the effective end date")

    parsed = parse_gerp_tsv(template)
    randomizer = random.Random(seed)
    files: list[GeneratedFile] = []
    window_start = start_date
    sequence = 0
    while window_start <= effective_end_date:
        window_end = min(window_start + timedelta(days=window_days - 1), effective_end_date)
        rows: list[dict[str, str | None]] = []
        for business_day in _eligible_days(window_start, window_end):
            for _ in range(_daily_row_count(randomizer, average_rows_per_day)):
                sequence += 1
                rows.append(
                    _synthetic_values(
                        randomizer.choice(parsed.rows), business_day, sequence, randomizer
                    )
                )

        filename = f"Other_Account_Transaction_Text_synthetic_{window_start:%Y%m%d}_{window_end:%Y%m%d}"
        output_path = output_directory / filename
        _write_tsv(output_path, rows)
        files.append(GeneratedFile(output_path, window_start, window_end, len(rows)))
        window_start = window_end + timedelta(days=1)
    return files


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate synthetic, GERP-compatible Material Scrap TSV files"
    )
    parser.add_argument("--template", type=Path, default=DEFAULT_TEMPLATE)
    parser.add_argument("--output-directory", type=Path, default=Path("automation/artifacts/synthetic"))
    parser.add_argument("--start-date", type=_parse_date)
    parser.add_argument("--end-date", type=_parse_date)
    parser.add_argument("--years", type=int, default=3, choices=(2, 3))
    parser.add_argument("--average-rows-per-day", type=int, default=24)
    parser.add_argument("--window-days", type=int, default=MAX_INGESTION_WINDOW_DAYS)
    parser.add_argument("--seed", type=int, default=20260903)
    return parser


def main() -> None:
    args = _build_parser().parse_args()
    today = date.today()
    start_date = args.start_date or _date_years_ago(today, args.years)
    requested_end_date = args.end_date or today
    files = generate_synthetic_dataset(
        template=args.template,
        output_directory=args.output_directory,
        start_date=start_date,
        end_date=requested_end_date,
        average_rows_per_day=args.average_rows_per_day,
        window_days=args.window_days,
        seed=args.seed,
        today=today,
    )
    print(
        json.dumps(
            {
                "template": str(args.template.resolve()),
                "requested_date_from": start_date.isoformat(),
                "requested_date_to": requested_end_date.isoformat(),
                "effective_date_to": min(requested_end_date, today).isoformat(),
                "files": [
                    {
                        "path": str(file.path.resolve()),
                        "date_from": file.date_from.isoformat(),
                        "date_to": file.date_to.isoformat(),
                        "rows": file.rows,
                    }
                    for file in files
                ],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
