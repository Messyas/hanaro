"""Unit tests for API key routes."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from src.app.main import app
from src.app.support.api_keys.dependencies import get_api_key_service
from src.app.support.common.exceptions import PermissionDeniedError, ResourceNotFoundError
from src.infrastructure.auth.dependencies import get_current_user
from src.infrastructure.database.session import async_session


class DummyUserObj:
    id = 42


@pytest.fixture
def mock_api_key_service():
    return AsyncMock()


@pytest.fixture
def mock_current_user_dict():
    return {"id": 1, "username": "keyowner"}


@pytest.fixture
def valid_key_read():
    now = datetime.now(UTC)
    return {
        "id": 1,
        "name": "Key 1",
        "user_id": 1,
        "key_prefix": "fai_1234",
        "last_used_at": None,
        "last_used_ip": None,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "permissions": {},
        "usage_limits": {},
    }


@pytest_asyncio.fixture
async def async_client(mock_api_key_service, mock_current_user_dict):
    mock_db = AsyncMock()

    app.dependency_overrides[async_session] = lambda: mock_db
    app.dependency_overrides[get_api_key_service] = lambda: mock_api_key_service
    app.dependency_overrides[get_current_user] = lambda: mock_current_user_dict

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_api_key_route_dict_user(async_client, mock_api_key_service, valid_key_read):
    # 1. Success
    resp_key = dict(valid_key_read)
    resp_key["api_key"] = "fai_secret_key_12345"
    mock_api_key_service.create_api_key.return_value = resp_key

    resp = await async_client.post("/api/v1/api-keys/", json={"name": "Key 1"})
    assert resp.status_code == 201
    assert resp.json()["name"] == "Key 1"

    # 2. Unexpected error -> 500
    mock_api_key_service.create_api_key.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.post("/api/v1/api-keys/", json={"name": "Key 1"})
    assert resp_500.status_code == 500
    assert resp_500.json()["detail"] == "Internal server error"


@pytest.mark.asyncio
async def test_create_api_key_route_object_user(mock_api_key_service, valid_key_read):
    app.dependency_overrides[async_session] = lambda: AsyncMock()
    app.dependency_overrides[get_api_key_service] = lambda: mock_api_key_service
    app.dependency_overrides[get_current_user] = lambda: DummyUserObj()

    resp_key = dict(valid_key_read)
    resp_key["api_key"] = "fai_secret_key_12345"
    mock_api_key_service.create_api_key.return_value = resp_key

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        resp = await client.post("/api/v1/api-keys/", json={"name": "Key 1"})
        assert resp.status_code == 201

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_user_api_keys_route(async_client, mock_api_key_service, valid_key_read):
    # 1. Success
    mock_api_key_service.get_user_api_keys.return_value = {
        "data": [valid_key_read],
        "total": 1,
    }
    resp = await async_client.get("/api/v1/api-keys/?active_only=true&page=1&items_per_page=10")
    assert resp.status_code == 200

    # 2. Unexpected error -> 500
    mock_api_key_service.get_user_api_keys.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.get("/api/v1/api-keys/")
    assert resp_500.status_code == 500


@pytest.mark.asyncio
async def test_get_api_key_route(async_client, mock_api_key_service, valid_key_read):
    # 1. Success
    mock_api_key_service.get_api_key.return_value = valid_key_read
    resp = await async_client.get("/api/v1/api-keys/1")
    assert resp.status_code == 200
    assert resp.json()["id"] == 1

    # 2. ResourceNotFoundError -> 404
    mock_api_key_service.get_api_key.side_effect = ResourceNotFoundError("Not found")
    resp_404 = await async_client.get("/api/v1/api-keys/99")
    assert resp_404.status_code == 404

    # 3. PermissionDeniedError -> 403
    mock_api_key_service.get_api_key.side_effect = PermissionDeniedError("Denied")
    resp_403 = await async_client.get("/api/v1/api-keys/1")
    assert resp_403.status_code == 403

    # 4. RuntimeError -> 500
    mock_api_key_service.get_api_key.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.get("/api/v1/api-keys/1")
    assert resp_500.status_code == 500


@pytest.mark.asyncio
async def test_update_api_key_route(async_client, mock_api_key_service, valid_key_read):
    # 1. Success
    mock_api_key_service.update_api_key.return_value = valid_key_read
    resp = await async_client.patch("/api/v1/api-keys/1", json={"name": "New Name"})
    assert resp.status_code == 200

    # 2. ResourceNotFoundError -> 404
    mock_api_key_service.update_api_key.side_effect = ResourceNotFoundError("Not found")
    resp_404 = await async_client.patch("/api/v1/api-keys/99", json={"name": "New Name"})
    assert resp_404.status_code == 404

    # 3. PermissionDeniedError -> 403
    mock_api_key_service.update_api_key.side_effect = PermissionDeniedError("Denied")
    resp_403 = await async_client.patch("/api/v1/api-keys/1", json={"name": "New Name"})
    assert resp_403.status_code == 403

    # 4. RuntimeError -> 500
    mock_api_key_service.update_api_key.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.patch("/api/v1/api-keys/1", json={"name": "New Name"})
    assert resp_500.status_code == 500


@pytest.mark.asyncio
async def test_delete_api_key_route(async_client, mock_api_key_service):
    # 1. Success -> 204
    mock_api_key_service.delete_api_key.return_value = None
    resp = await async_client.delete("/api/v1/api-keys/1")
    assert resp.status_code == 204

    # 2. ResourceNotFoundError -> 404
    mock_api_key_service.delete_api_key.side_effect = ResourceNotFoundError("Not found")
    resp_404 = await async_client.delete("/api/v1/api-keys/99")
    assert resp_404.status_code == 404

    # 3. PermissionDeniedError -> 403
    mock_api_key_service.delete_api_key.side_effect = PermissionDeniedError("Denied")
    resp_403 = await async_client.delete("/api/v1/api-keys/1")
    assert resp_403.status_code == 403

    # 4. RuntimeError -> 500
    mock_api_key_service.delete_api_key.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.delete("/api/v1/api-keys/1")
    assert resp_500.status_code == 500


@pytest.mark.asyncio
async def test_get_key_usage_route(async_client, mock_api_key_service):
    # 1. Success
    mock_api_key_service.get_key_usage.return_value = {"data": [], "total": 0}
    resp = await async_client.get("/api/v1/api-keys/1/usage?page=1&items_per_page=10")
    assert resp.status_code == 200

    # 2. ResourceNotFoundError -> 404
    mock_api_key_service.get_key_usage.side_effect = ResourceNotFoundError("Not found")
    resp_404 = await async_client.get("/api/v1/api-keys/99/usage")
    assert resp_404.status_code == 404

    # 3. PermissionDeniedError -> 403
    mock_api_key_service.get_key_usage.side_effect = PermissionDeniedError("Denied")
    resp_403 = await async_client.get("/api/v1/api-keys/1/usage")
    assert resp_403.status_code == 403

    # 4. RuntimeError -> 500
    mock_api_key_service.get_key_usage.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.get("/api/v1/api-keys/1/usage")
    assert resp_500.status_code == 500


@pytest.mark.asyncio
async def test_get_key_analytics_route(async_client, mock_api_key_service):
    # 1. Success
    mock_api_key_service.get_usage_analytics.return_value = {"total_requests": 5}
    resp = await async_client.get("/api/v1/api-keys/1/analytics?days=30")
    assert resp.status_code == 200

    # 2. ResourceNotFoundError -> 404
    mock_api_key_service.get_usage_analytics.side_effect = ResourceNotFoundError("Not found")
    resp_404 = await async_client.get("/api/v1/api-keys/99/analytics")
    assert resp_404.status_code == 404

    # 3. PermissionDeniedError -> 403
    mock_api_key_service.get_usage_analytics.side_effect = PermissionDeniedError("Denied")
    resp_403 = await async_client.get("/api/v1/api-keys/1/analytics")
    assert resp_403.status_code == 403

    # 4. RuntimeError -> 500
    mock_api_key_service.get_usage_analytics.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.get("/api/v1/api-keys/1/analytics")
    assert resp_500.status_code == 500


@pytest.mark.asyncio
async def test_get_user_summary_route(async_client, mock_api_key_service, valid_key_read):
    # 1. Success
    mock_api_key_service.get_user_summary.return_value = {
        "user_id": 1,
        "total_keys": 1,
        "active_keys": 1,
        "total_requests": 0,
        "total_cost_microcents": 0,
        "keys": [valid_key_read],
    }
    resp = await async_client.get("/api/v1/api-keys/summary/user")
    assert resp.status_code == 200

    # 2. RuntimeError -> 500
    mock_api_key_service.get_user_summary.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.get("/api/v1/api-keys/summary/user")
    assert resp_500.status_code == 500
