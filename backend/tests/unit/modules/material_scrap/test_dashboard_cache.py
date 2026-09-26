import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.app.models.material_scrap.enums import DashboardCurrency, ImpactMode
from src.app.models.material_scrap.schemas import (
    DashboardKpis,
    DashboardMetadata,
    DashboardRankings,
    DashboardResponse,
)
from src.app.services.material_scrap.dashboard_cache import DashboardResponseCache


def dashboard_response(revision: uuid.UUID) -> DashboardResponse:
    return DashboardResponse(
        metadata=DashboardMetadata(
            revision=revision,
            generated_at=datetime.now(UTC),
            data_through=None,
            currency=DashboardCurrency.USD,
            impact_mode=ImpactMode.ABSOLUTE,
        ),
        kpis=DashboardKpis(
            actual=0,
            target=None,
            target_attainment_percent=None,
            previous_year_actual=0,
            previous_year_variation_percent=None,
        ),
        monthly=[],
        weekly=[],
        rankings=DashboardRankings(products=[], components=[], lines=[], models=[], offenders=[]),
        priority_occurrences=[],
    )


@pytest.mark.asyncio
async def test_dashboard_cache_round_trip_and_revision_isolation() -> None:
    revision = uuid.uuid4()
    response = dashboard_response(revision)
    backend = MagicMock()
    backend.get = AsyncMock(return_value=response.model_dump(mode="json"))
    backend.set = AsyncMock()
    cache = DashboardResponseCache(ttl_seconds=123)
    cache._enabled = True

    with patch(
        "src.app.services.material_scrap.dashboard_cache.cache_provider.get_backend",
        return_value=backend,
    ):
        await cache.set(revision, {"year": 2026}, response)
        cached = await cache.get(revision, {"year": 2026})

    assert cached == response
    assert backend.set.call_args.args[2] == 123
    assert cache._key(revision, {"year": 2026}) != cache._key(uuid.uuid4(), {"year": 2026})


@pytest.mark.asyncio
async def test_dashboard_cache_failure_bypasses_without_breaking_response() -> None:
    backend = MagicMock()
    backend.get = AsyncMock(side_effect=ConnectionError("cache unavailable"))
    backend.set = AsyncMock(side_effect=ConnectionError("cache unavailable"))
    cache = DashboardResponseCache(ttl_seconds=123)
    cache._enabled = True
    revision = uuid.uuid4()

    with patch(
        "src.app.services.material_scrap.dashboard_cache.cache_provider.get_backend",
        return_value=backend,
    ):
        assert await cache.get(revision, {}) is None
        await cache.set(revision, {}, dashboard_response(revision))
