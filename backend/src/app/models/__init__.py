"""Import every SQLAlchemy model so Alembic can discover metadata."""

from src.app.models.api_keys.models import APIKey, KeyPermission, KeyUsage
from src.app.models.governance import models as governance_models
from src.app.models.material_scrap.models import (
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
from src.app.models.rate_limit.models import RateLimit
from src.app.models.tier.models import Tier
from src.app.models.user.models import User

__all__ = [
    "governance_models",
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
