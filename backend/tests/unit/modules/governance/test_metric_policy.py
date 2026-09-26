from decimal import Decimal

import pytest

from src.app.support.governance.reporting.metric_policy import (
    MATERIAL_SCRAP_COST_CODE,
    SCRAP_COST_V1,
    material_scrap_cost_policy,
    resolve_metric_policy,
)


def test_scrap_cost_policy_uses_active_occurrences_and_net_cost() -> None:
    policy = material_scrap_cost_policy("USD")

    assert policy.is_eligible({"occurrence_status": "ACTIVE"}) is True
    assert policy.is_eligible({"occurrence_status": "ARCHIVED"}) is False
    assert policy.measure({"amount_usd": "100.125"}) == Decimal("100.125")
    assert policy.measure({"amount_usd": "-10.50"}) == Decimal("-10.50")
    assert policy.round_for_display(Decimal("100.125")) == Decimal("100.13")


def test_scrap_cost_policy_resolves_only_the_stored_version() -> None:
    assert resolve_metric_policy(MATERIAL_SCRAP_COST_CODE, SCRAP_COST_V1, "BRL").currency == "BRL"
    with pytest.raises(ValueError, match="Unsupported metric policy"):
        resolve_metric_policy(MATERIAL_SCRAP_COST_CODE, "unknown", "USD")
