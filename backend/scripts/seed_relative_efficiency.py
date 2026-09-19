"""Populate demonstration production denominators for relative efficiency.

The relative dashboard needs one confirmed global production record per month.
This seed creates values and quantities for a selected year and its comparison
year, allowing the monetary and physical views to be exercised locally.

Existing non-superseded records are preserved by default. Use ``--replace``
only when synthetic data is intentionally meant to replace the current values.

Run from ``backend`` after applying migrations:
    python scripts/seed_relative_efficiency.py
    python scripts/seed_relative_efficiency.py --year 2026 --currency USD
"""

from __future__ import annotations

import argparse
import asyncio
import os
from datetime import date
from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.infrastructure.database.session import local_session
from src.modules.governance.models import ProductionMeasurementVersion
from src.modules.governance.production_service import bump_dashboard_revision


MONTHLY_DEMONSTRATION_DATA: tuple[tuple[Decimal, Decimal], ...] = (
    (Decimal("1480000"), Decimal("96000")),
    (Decimal("1540000"), Decimal("99500")),
    (Decimal("1610000"), Decimal("102000")),
    (Decimal("1570000"), Decimal("99000")),
    (Decimal("1660000"), Decimal("106000")),
    (Decimal("1720000"), Decimal("109000")),
    (Decimal("1680000"), Decimal("107000")),
    (Decimal("1750000"), Decimal("112000")),
    (Decimal("1710000"), Decimal("110000")),
    (Decimal("1790000"), Decimal("114000")),
    (Decimal("1820000"), Decimal("116000")),
    (Decimal("1880000"), Decimal("120000")),
)


def demonstration_data_for(target_year: int, reference_year: int) -> tuple[tuple[Decimal, Decimal], ...]:
    """Keep the comparison year slightly below the selected-year baseline."""
    factor = Decimal("0.93") if target_year == reference_year else Decimal("1.00")
    return tuple((value * factor, quantity * factor) for value, quantity in MONTHLY_DEMONSTRATION_DATA)


async def seed_relative_efficiency(
    db: AsyncSession,
    *,
    year: int,
    reference_year: int,
    currency: str,
    replace: bool,
) -> dict[str, int]:
    """Insert missing monthly denominators without disturbing operational data."""
    if db.get_bind().dialect.name == "postgresql":
        await db.execute(text("SELECT pg_advisory_xact_lock(728361905)"))

    years = (reference_year, year) if reference_year != year else (year,)
    current_rows = list(
        (
            await db.scalars(
                select(ProductionMeasurementVersion)
                .where(
                    ProductionMeasurementVersion.year.in_(years),
                    ProductionMeasurementVersion.scope_key == "GLOBAL",
                    ProductionMeasurementVersion.status != "SUPERSEDED",
                )
                .order_by(
                    ProductionMeasurementVersion.year,
                    ProductionMeasurementVersion.month,
                    ProductionMeasurementVersion.revision.desc(),
                )
                .with_for_update()
            )
        ).all()
    )
    rows_by_period: dict[tuple[int, int], ProductionMeasurementVersion] = {}
    for row in current_rows:
        rows_by_period.setdefault((row.year, row.month), row)
    created = 0
    replaced = 0
    skipped = 0

    for target_year in years:
        for month, (value, quantity) in enumerate(demonstration_data_for(target_year, reference_year), start=1):
            current = rows_by_period.get((target_year, month))
            if current is not None and not replace:
                skipped += 1
                continue

            revision = 1
            if current is not None:
                current.status = "SUPERSEDED"
                revision = current.revision + 1
                replaced += 1

            db.add(
                ProductionMeasurementVersion(
                    year=target_year,
                    month=month,
                    scope_key="GLOBAL",
                    currency=currency,
                    production_value=value,
                    production_quantity=quantity,
                    note="Dados demonstrativos para habilitar a eficiencia relativa.",
                    revision=revision,
                    status="CONFIRMED",
                    source="IMPORT",
                    author_id=None,
                )
            )
            created += 1

    if created:
        await bump_dashboard_revision(db)
    return {"created": created, "replaced": replaced, "skipped": skipped}


async def run_seed(*, year: int, reference_year: int, currency: str, replace: bool) -> dict[str, int]:
    if os.getenv("ENVIRONMENT", "development") == "production" and os.getenv("SEED_DEMO_DATA", "").lower() != "true":
        raise RuntimeError("Relative-efficiency demo seed requires SEED_DEMO_DATA=true in production")
    async with local_session() as db, db.begin():
        return await seed_relative_efficiency(
            db,
            year=year,
            reference_year=reference_year,
            currency=currency,
            replace=replace,
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed monthly production denominators for relative efficiency.")
    parser.add_argument("--year", type=int, default=date.today().year, help="Dashboard year to populate.")
    parser.add_argument(
        "--reference-year",
        type=int,
        default=None,
        help="Comparison year to populate (defaults to the preceding year).",
    )
    parser.add_argument("--currency", default="USD", help="ISO currency for production values (default: USD).")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Supersede existing active monthly records with the demonstration values.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    selected_year = arguments.year
    comparison_year = arguments.reference_year if arguments.reference_year is not None else selected_year - 1
    print(
        asyncio.run(
            run_seed(
                year=selected_year,
                reference_year=comparison_year,
                currency=arguments.currency.upper(),
                replace=arguments.replace,
            )
        )
    )
