from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Protocol

from .decimal_parser import RATE_QUANTUM
from .schemas import ExchangeRateMetadata


class ExchangeRateProvider(Protocol):
    def get_daily_rate(self, rate_date: date) -> ExchangeRateMetadata: ...


@dataclass(frozen=True)
class ManualExchangeRateProvider:
    rate: Decimal
    source: str
    effective_date: date | None = None
    retrieved_at: datetime | None = None

    def get_daily_rate(self, rate_date: date) -> ExchangeRateMetadata:
        if self.rate <= 0:
            raise ValueError("Manual exchange rate must be greater than zero")
        return ExchangeRateMetadata(
            rate_date=rate_date,
            effective_date=self.effective_date or rate_date,
            brl_per_usd=self.rate.quantize(RATE_QUANTUM),
            quote_type="manual",
            source=self.source,
            retrieved_at=self.retrieved_at,
            fallback_used=False,
        )
