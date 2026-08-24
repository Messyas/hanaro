"""Unit tests for Tier routes."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from src.infrastructure.database.session import async_session
from src.interfaces.main import app
from src.modules.common.exceptions import TierNotFoundError
from src.modules.tier.dependencies import get_tier_service


@pytest.fixture
def mock_tier_service():
    return AsyncMock()


@pytest.fixture
def valid_tier_read():
    now = datetime.now(UTC)
    return {
        "id": 1,
        "name": "free",
        "description": "Free Tier",
        "created_at": now,
        "updated_at": now,
    }


@pytest_asyncio.fixture
async def async_client(mock_tier_service):
    mock_db = AsyncMock()

    app.dependency_overrides[async_session] = lambda: mock_db
    app.dependency_overrides[get_tier_service] = lambda: mock_tier_service

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_tiers_route(async_client, mock_tier_service, valid_tier_read):
    # 1. Success
    mock_tier_service.get_all.return_value = {
        "data": [valid_tier_read],
        "total": 1,
    }
    resp = await async_client.get("/api/v1/tiers/?page=1&items_per_page=10")
    assert resp.status_code == 200

    # 2. Unexpected error -> 500
    mock_tier_service.get_all.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.get("/api/v1/tiers/")
    assert resp_500.status_code == 500
    assert resp_500.json()["detail"] == "An unexpected error occurred"


@pytest.mark.asyncio
async def test_get_tier_by_name_route(async_client, mock_tier_service, valid_tier_read):
    # 1. Success
    mock_tier_service.get_by_name.return_value = valid_tier_read
    resp = await async_client.get("/api/v1/tiers/free")
    assert resp.status_code == 200

    # 2. TierNotFoundError -> 404
    mock_tier_service.get_by_name.side_effect = TierNotFoundError("Not found")
    resp_404 = await async_client.get("/api/v1/tiers/ghost")
    assert resp_404.status_code == 404

    # 3. Unexpected error -> 500
    mock_tier_service.get_by_name.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.get("/api/v1/tiers/free")
    assert resp_500.status_code == 500
