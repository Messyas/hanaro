"""Versioned, pure metric rules for report composition."""

from collections.abc import Mapping
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Literal, cast

MetricCurrency = Literal["BRL", "USD"]
MATERIAL_SCRAP_COST_CODE = "MATERIAL_SCRAP_COST"
SCRAP_COST_V1 = "scrap-cost-v1"


def _decimal(value: object | None) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


@dataclass(frozen=True, slots=True)
class MetricPolicy:
    """A named rule that can be stored with a report and replayed later."""

    code: str
    version: str
    currency: MetricCurrency

    def is_eligible(self, row: Mapping[str, Any]) -> bool:
        """Only active occurrences form the financial universe in V1."""

        return row.get("occurrence_status") == "ACTIVE"

    def measure(self, row: Mapping[str, Any]) -> Decimal:
        """Return net cost; reversals remain visible instead of being discarded."""

        key = "issue_amount_brl" if self.currency == "BRL" else "amount_usd"
        return _decimal(row.get(key))

    def round_for_display(self, value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def material_scrap_cost_policy(currency: MetricCurrency) -> MetricPolicy:
    return MetricPolicy(code=MATERIAL_SCRAP_COST_CODE, version=SCRAP_COST_V1, currency=currency)


def resolve_metric_policy(code: str, version: str, currency: str) -> MetricPolicy:
    if (code, version) != (MATERIAL_SCRAP_COST_CODE, SCRAP_COST_V1):
        raise ValueError(f"Unsupported metric policy: {code}@{version}")
    if currency not in {"BRL", "USD"}:
        raise ValueError(f"Unsupported metric currency: {currency}")
    return material_scrap_cost_policy(cast(MetricCurrency, currency))
