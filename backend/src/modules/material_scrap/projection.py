"""Build the dashboard read model outside the HTTP request path."""

import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import NamedTuple

from .models import ScrapDashboardAggregate
from .schemas import CanonicalScrapRecord

UNMAPPED_DIMENSION = "__UNMAPPED__"


def _dimension(value: str | None) -> str:
    if value is None or value == "":
        return UNMAPPED_DIMENSION
    return value


def _counted_key(value: bool | None) -> str:
    if value is None:
        return "unmapped"
    return "true" if value else "false"


@dataclass
class _Totals:
    record_count: int = 0
    issue_quantity: Decimal = Decimal("0")
    issue_quantity_abs: Decimal = Decimal("0")
    issue_amount_brl: Decimal = Decimal("0")
    issue_amount_brl_abs: Decimal = Decimal("0")
    amount_usd: Decimal = Decimal("0")
    amount_usd_abs: Decimal = Decimal("0")

    def add(self, record: CanonicalScrapRecord) -> None:
        self.record_count += 1
        self.issue_quantity += record.issue_quantity
        self.issue_quantity_abs += abs(record.issue_quantity)
        self.issue_amount_brl += record.issue_amount_brl
        self.issue_amount_brl_abs += abs(record.issue_amount_brl)
        self.amount_usd += record.amount_usd
        self.amount_usd_abs += abs(record.amount_usd)


class _ProjectionKey(NamedTuple):
    transaction_date: date
    organization_code: str
    receipt_department: str
    department: str
    product: str
    division: str
    item_type: str
    account_code: str
    account_alias: str
    item_code: str
    to_be_counted_key: str


def build_dashboard_projection(
    run_id: uuid.UUID,
    records: list[CanonicalScrapRecord],
) -> list[ScrapDashboardAggregate]:
    """Collapse canonical rows to the supported dashboard-filter grain."""
    grouped: dict[_ProjectionKey, _Totals] = {}
    for record in records:
        key = _ProjectionKey(
            record.transaction_date,
            record.organization_code,
            _dimension(record.receipt_department),
            _dimension(record.department),
            _dimension(record.product),
            _dimension(record.division),
            _dimension(record.item_type),
            _dimension(record.account_code),
            _dimension(record.account_alias),
            _dimension(record.item_code),
            _counted_key(record.to_be_counted),
        )
        grouped.setdefault(key, _Totals()).add(record)

    return [
        ScrapDashboardAggregate(
            run_id=run_id,
            transaction_date=key.transaction_date,
            organization_code=key.organization_code,
            receipt_department=key.receipt_department,
            department=key.department,
            product=key.product,
            division=key.division,
            item_type=key.item_type,
            account_code=key.account_code,
            account_alias=key.account_alias,
            item_code=key.item_code,
            to_be_counted_key=key.to_be_counted_key,
            record_count=totals.record_count,
            issue_quantity=totals.issue_quantity,
            issue_quantity_abs=totals.issue_quantity_abs,
            issue_amount_brl=totals.issue_amount_brl,
            issue_amount_brl_abs=totals.issue_amount_brl_abs,
            amount_usd=totals.amount_usd,
            amount_usd_abs=totals.amount_usd_abs,
        )
        for key, totals in grouped.items()
    ]
