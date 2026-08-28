"""Versioned, fail-open cache for public dashboard responses."""

import hashlib
import json
import uuid
from typing import Any

from ...infrastructure.cache.provider import cache_provider
from ...infrastructure.config import get_settings
from ...infrastructure.logging import get_logger
from .schemas import DashboardResponse

logger = get_logger(__name__)


class DashboardResponseCache:
    def __init__(self, ttl_seconds: int | None = None) -> None:
        settings = get_settings()
        self._enabled = settings.CACHE_ENABLED
        self._ttl_seconds = ttl_seconds or settings.DASHBOARD_CACHE_TTL_SECONDS

    @staticmethod
    def _key(revision: uuid.UUID, parameters: dict[str, Any]) -> str:
        canonical = json.dumps(parameters, sort_keys=True, separators=(",", ":"), default=str)
        digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        return f"hanaro:material-scrap:dashboard:{revision}:{digest}"

    async def get(self, revision: uuid.UUID, parameters: dict[str, Any]) -> DashboardResponse | None:
        if not self._enabled:
            return None
        try:
            cached = await cache_provider.get_backend().get(self._key(revision, parameters))
            return DashboardResponse.model_validate(cached) if cached is not None else None
        except Exception as error:
            logger.warning("dashboard_cache_read_bypassed", extra={"error_type": type(error).__name__})
            return None

    async def set(self, revision: uuid.UUID, parameters: dict[str, Any], value: DashboardResponse) -> None:
        if not self._enabled:
            return
        try:
            await cache_provider.get_backend().set(
                self._key(revision, parameters),
                value.model_dump(mode="json"),
                self._ttl_seconds,
            )
        except Exception as error:
            logger.warning("dashboard_cache_write_bypassed", extra={"error_type": type(error).__name__})
