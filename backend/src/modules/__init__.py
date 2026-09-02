"""Initialize all modules and models to ensure SQLAlchemy registration."""

from .api_keys.models import APIKey, KeyPermission, KeyUsage
from .material_scrap.models import (
    DailyExchangeRate,
    IngestionRun,
    IngestionSourceFile,
    ScrapAutomationExecution,
    ScrapDashboardAggregate,
    ScrapDashboardState,
    ScrapExecutionNotification,
    ScrapExecutionStep,
    ScrapTarget,
    ScrapTransaction,
)
from .rate_limit.models import RateLimit
from .tier.models import Tier
from .user.models import User

__all__ = [
    "User",
    "Tier",
    "RateLimit",
    "APIKey",
    "KeyUsage",
    "KeyPermission",
    "IngestionRun",
    "IngestionSourceFile",
    "ScrapAutomationExecution",
    "ScrapExecutionStep",
    "ScrapExecutionNotification",
    "DailyExchangeRate",
    "ScrapTransaction",
    "ScrapDashboardAggregate",
    "ScrapDashboardState",
    "ScrapTarget",
]
