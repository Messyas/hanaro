from decimal import Decimal

import pytest
from pydantic import ValidationError

from src.app.models.governance.production_schemas import (
    ProductionMeasurementBatchWrite,
    ProductionMeasurementWrite,
)


def test_production_measurement_requires_at_least_one_denominator() -> None:
    with pytest.raises(ValidationError, match="At least one production measurement"):
        ProductionMeasurementWrite(month=1)


def test_production_measurement_batch_rejects_duplicate_months() -> None:
    measurement = ProductionMeasurementWrite(month=1, production_value=Decimal("100"))

    with pytest.raises(ValidationError, match="Each month can be submitted only once"):
        ProductionMeasurementBatchWrite(measurements=[measurement, measurement])


def test_production_measurement_accepts_an_expected_version() -> None:
    measurement = ProductionMeasurementWrite(
        month=1,
        production_quantity=Decimal("100"),
        expected_version=2,
    )

    assert measurement.expected_version == 2


def test_production_measurement_batch_accepts_product_scope() -> None:
    batch = ProductionMeasurementBatchWrite(
        scope_key="PRODUCT:TV",
        measurements=[ProductionMeasurementWrite(month=1, production_value=Decimal("1000"))],
    )

    assert batch.scope_key == "PRODUCT:TV"


def test_production_measurement_batch_rejects_unknown_scope() -> None:
    with pytest.raises(ValidationError, match="scope_key"):
        ProductionMeasurementBatchWrite(
            scope_key="LINE:G08",
            measurements=[ProductionMeasurementWrite(month=1, production_value=Decimal("1000"))],
        )
