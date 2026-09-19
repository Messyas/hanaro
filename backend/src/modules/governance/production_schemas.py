from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ProductionMeasurementWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    month: int = Field(ge=1, le=12)
    production_value: Decimal | None = Field(default=None, ge=0, max_digits=24, decimal_places=6)
    production_quantity: Decimal | None = Field(default=None, ge=0, max_digits=24, decimal_places=6)
    note: str = Field(default="", max_length=240)
    expected_version: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def require_measurement(self) -> "ProductionMeasurementWrite":
        if self.production_value is None and self.production_quantity is None:
            raise ValueError("At least one production measurement is required")
        return self


class ProductionMeasurementBatchWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    currency: Literal["USD", "BRL"] = "USD"
    measurements: list[ProductionMeasurementWrite] = Field(min_length=1, max_length=12)

    @model_validator(mode="after")
    def require_unique_months(self) -> "ProductionMeasurementBatchWrite":
        months = [measurement.month for measurement in self.measurements]
        if len(months) != len(set(months)):
            raise ValueError("Each month can be submitted only once")
        return self


class ProductionMeasurementClearWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_versions: dict[int, int] = Field(default_factory=dict)


class ProductionMeasurementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    year: int
    month: int
    scope_key: str
    currency: str
    production_value: Decimal | None
    production_quantity: Decimal | None
    note: str
    revision: int
    status: str
    source: str
    author_id: int | None
    created_at: datetime
