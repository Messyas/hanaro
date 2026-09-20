from decimal import Decimal

from scripts.seed_relative_efficiency import (
    PRODUCT_DEMONSTRATION_SHARES,
    demonstration_data_for,
    product_demonstration_data_for,
)


def test_product_demo_denominators_reconcile_to_global_baseline() -> None:
    global_data = demonstration_data_for(2026, 2025)
    product_data = product_demonstration_data_for(2026, 2025)

    assert sum(PRODUCT_DEMONSTRATION_SHARES.values(), Decimal("0")) == Decimal("1.00")
    for month, (global_value, global_quantity) in enumerate(global_data):
        assert sum(values[month][0] for values in product_data.values()) == global_value
        assert sum(values[month][1] for values in product_data.values()) == global_quantity
