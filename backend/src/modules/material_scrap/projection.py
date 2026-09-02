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
    *, occurrence_id: uuid.UUID, run_id: uuid.UUID, record: CanonicalScrapRecord
) -> ScrapDashboardAggregate:
    """Create the current dashboard fact for exactly one stable occurrence."""
    return ScrapDashboardAggregate(
        occurrence_id=occurrence_id,
        run_id=run_id,
        transaction_date=record.transaction_date,
        organization_code=record.organization_code,
        receipt_department=_dimension(record.receipt_department),
        department=_dimension(record.department),
        product=_dimension(record.product),
        division=_dimension(record.division),
        item_type=_dimension(record.item_type),
        account_code=_dimension(record.account_code),
        account_alias=_dimension(record.account_alias),
        item_code=_dimension(record.item_code),
        to_be_counted_key=_counted_key(record.to_be_counted),
        record_count=1,
        issue_quantity=record.issue_quantity,
        issue_quantity_abs=abs(record.issue_quantity),
        issue_amount_brl=record.issue_amount_brl,
        issue_amount_brl_abs=abs(record.issue_amount_brl),
        amount_usd=record.amount_usd,
        amount_usd_abs=abs(record.amount_usd),
    )
