"""Unit tests for Rate Limit routes."""

from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from src.infrastructure.auth.dependencies import get_current_superuser
from src.infrastructure.database.session import async_session
from src.interfaces.main import app
from src.modules.common.exceptions import ResourceExistsError, ResourceNotFoundError
from src.modules.rate_limit.dependencies import get_rate_limit_service


@pytest.fixture
def mock_rate_limit_service():
    return AsyncMock()


@pytest.fixture
def valid_rate_limit_read():
    return {
        "id": 1,
        "tier_id": 1,
        "name": "users_limit",
        "path": "/api/v1/users",
        "limit": 100,
        "period": 60,
        "is_deleted": False,
    }


@pytest.fixture
def mock_superuser():
    return {
        "id": 99,
        "username": "admin",
        "is_superuser": True,
    }


@pytest_asyncio.fixture
async def async_client(mock_rate_limit_service, mock_superuser):
    mock_db = AsyncMock()

    app.dependency_overrides[async_session] = lambda: mock_db
    app.dependency_overrides[get_rate_limit_service] = lambda: mock_rate_limit_service
    app.dependency_overrides[get_current_superuser] = lambda: mock_superuser

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_rate_limits_route(async_client, mock_rate_limit_service, valid_rate_limit_read):
    # 1. Success
    mock_rate_limit_service.get_all.return_value = {
        "data": [valid_rate_limit_read],
        "total": 1,
    }
    resp = await async_client.get("/api/v1/rate-limits/?page=1&items_per_page=10")
    assert resp.status_code == 200

    # 2. Unexpected error -> 500
    mock_rate_limit_service.get_all.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.get("/api/v1/rate-limits/")
    assert resp_500.status_code == 500
    assert resp_500.json()["detail"] == "An unexpected error occurred"


@pytest.mark.asyncio
async def test_get_rate_limit_by_name_route(async_client, mock_rate_limit_service, valid_rate_limit_read):
    # 1. Success
    mock_rate_limit_service.get_by_name.return_value = valid_rate_limit_read
    resp = await async_client.get("/api/v1/rate-limits/users_limit")
    assert resp.status_code == 200

    # 2. ResourceNotFoundError -> 404
    mock_rate_limit_service.get_by_name.side_effect = ResourceNotFoundError("Not found")
    resp_404 = await async_client.get("/api/v1/rate-limits/ghost")
    assert resp_404.status_code == 404

    # 3. Unexpected error -> 500
    mock_rate_limit_service.get_by_name.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.get("/api/v1/rate-limits/users_limit")
    assert resp_500.status_code == 500


@pytest.mark.asyncio
async def test_update_rate_limit_route(async_client, mock_rate_limit_service):
    # 1. Success
    mock_rate_limit_service.update.return_value = {"id": 1}
    resp = await async_client.patch("/api/v1/rate-limits/users_limit", json={"limit": 200})
    assert resp.status_code == 200
    assert resp.json() == {"message": "Rate limit updated"}

    # 2. ResourceNotFoundError -> 404
    mock_rate_limit_service.update.side_effect = ResourceNotFoundError("Not found")
    resp_404 = await async_client.patch("/api/v1/rate-limits/ghost", json={"limit": 200})
    assert resp_404.status_code == 404

    # 3. ResourceExistsError -> 422 (DuplicateValueException)
    mock_rate_limit_service.update.side_effect = ResourceExistsError("Exists")
    resp_409 = await async_client.patch("/api/v1/rate-limits/users_limit", json={"limit": 200})
    assert resp_409.status_code == 422

    # 4. Unexpected error -> 500
    mock_rate_limit_service.update.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.patch("/api/v1/rate-limits/users_limit", json={"limit": 200})
    assert resp_500.status_code == 500


@pytest.mark.asyncio
async def test_delete_rate_limit_route(async_client, mock_rate_limit_service):
    # 1. Success
    mock_rate_limit_service.delete.return_value = None
    resp = await async_client.delete("/api/v1/rate-limits/users_limit")
    assert resp.status_code == 200
    assert resp.json() == {"message": "Rate limit deleted"}

    # 2. ResourceNotFoundError -> 404
    mock_rate_limit_service.delete.side_effect = ResourceNotFoundError("Not found")
    resp_404 = await async_client.delete("/api/v1/rate-limits/ghost")
    assert resp_404.status_code == 404

    # 3. Unexpected error -> 500
    mock_rate_limit_service.delete.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.delete("/api/v1/rate-limits/users_limit")
    assert resp_500.status_code == 500
