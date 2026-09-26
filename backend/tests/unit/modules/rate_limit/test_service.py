"""Unit tests for RateLimitService."""

from unittest.mock import AsyncMock

import pytest

from src.app.models.rate_limit.schemas import RateLimitCreate, RateLimitUpdate
from src.app.services.rate_limit.service import RateLimitService
from src.app.support.common.exceptions import (
    PermissionDeniedError,
    ResourceExistsError,
    ResourceNotFoundError,
    TierNotFoundError,
)


@pytest.fixture
def rate_limit_service():
    return RateLimitService()


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.mark.asyncio
async def test_create_rate_limit_tier_not_found(rate_limit_service, mock_db, monkeypatch):
    mock_tiers = AsyncMock()
    mock_tiers.exists.return_value = False
    monkeypatch.setattr("src.app.services.rate_limit.service.crud_tiers", mock_tiers)

    with pytest.raises(TierNotFoundError):
        await rate_limit_service.create(RateLimitCreate(path="/api/v1/test", limit=10, period=60), 1, mock_db)


@pytest.mark.asyncio
async def test_create_rate_limit_name_exists(rate_limit_service, mock_db, monkeypatch):
    mock_tiers = AsyncMock()
    mock_tiers.exists.return_value = True
    monkeypatch.setattr("src.app.services.rate_limit.service.crud_tiers", mock_tiers)

    mock_crud = AsyncMock()
    mock_crud.exists.return_value = True
    monkeypatch.setattr("src.app.services.rate_limit.service.crud_rate_limits", mock_crud)

    with pytest.raises(ResourceExistsError, match="already exists"):
        await rate_limit_service.create(
            RateLimitCreate(name="custom_name", path="/api/v1/test", limit=10, period=60),
            1,
            mock_db,
        )


@pytest.mark.asyncio
async def test_create_rate_limit_auto_name_and_creation_failure(rate_limit_service, mock_db, monkeypatch):
    mock_tiers = AsyncMock()
    mock_tiers.exists.return_value = True
    monkeypatch.setattr("src.app.services.rate_limit.service.crud_tiers", mock_tiers)

    mock_crud = AsyncMock()
    mock_crud.exists.return_value = False
    mock_crud.create.return_value = None
    monkeypatch.setattr("src.app.services.rate_limit.service.crud_rate_limits", mock_crud)

    with pytest.raises(ResourceExistsError, match="Failed to create"):
        await rate_limit_service.create(RateLimitCreate(path="/api/v1/test", limit=10, period=60), 1, mock_db)


@pytest.mark.asyncio
async def test_create_rate_limit_success(rate_limit_service, mock_db, monkeypatch):
    mock_tiers = AsyncMock()
    mock_tiers.exists.return_value = True
    monkeypatch.setattr("src.app.services.rate_limit.service.crud_tiers", mock_tiers)

    mock_crud = AsyncMock()
    mock_crud.exists.return_value = False
    mock_crud.create.return_value = {"id": 1, "name": "custom_name"}
    monkeypatch.setattr("src.app.services.rate_limit.service.crud_rate_limits", mock_crud)

    res = await rate_limit_service.create(
        RateLimitCreate(name="custom_name", path="/api/v1/test", limit=10, period=60),
        1,
        mock_db,
    )
    assert res["id"] == 1


@pytest.mark.asyncio
async def test_get_all_rate_limits(rate_limit_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get_multi.return_value = {"data": [], "total": 0}
    monkeypatch.setattr("src.app.services.rate_limit.service.crud_rate_limits", mock_crud)

    res = await rate_limit_service.get_all(mock_db, skip=0, limit=10)
    assert res["total"] == 0


@pytest.mark.asyncio
async def test_get_by_id(rate_limit_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = None
    monkeypatch.setattr("src.app.services.rate_limit.service.crud_rate_limits", mock_crud)

    with pytest.raises(ResourceNotFoundError):
        await rate_limit_service.get_by_id(99, mock_db)

    mock_crud.get.return_value = {"id": 1, "name": "rl1"}
    res = await rate_limit_service.get_by_id(1, mock_db)
    assert res["name"] == "rl1"


@pytest.mark.asyncio
async def test_get_by_name(rate_limit_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = None
    monkeypatch.setattr("src.app.services.rate_limit.service.crud_rate_limits", mock_crud)

    with pytest.raises(ResourceNotFoundError):
        await rate_limit_service.get_by_name("rl1", mock_db)

    mock_crud.get.return_value = {"id": 1, "name": "rl1"}
    res = await rate_limit_service.get_by_name("rl1", mock_db)
    assert res["name"] == "rl1"


@pytest.mark.asyncio
async def test_get_active_and_inactive_by_name(rate_limit_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = None
    monkeypatch.setattr("src.app.services.rate_limit.service.crud_rate_limits", mock_crud)

    with pytest.raises(ResourceNotFoundError):
        await rate_limit_service.get_active_and_inactive_by_name("rl1", mock_db)

    mock_crud.get.return_value = {"id": 1, "name": "rl1"}
    res = await rate_limit_service.get_active_and_inactive_by_name("rl1", mock_db)
    assert res["name"] == "rl1"


@pytest.mark.asyncio
async def test_update_rate_limit(rate_limit_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = None
    monkeypatch.setattr("src.app.services.rate_limit.service.crud_rate_limits", mock_crud)

    # 1. Not found
    with pytest.raises(ResourceNotFoundError):
        await rate_limit_service.update("rl1", RateLimitUpdate(limit=20), mock_db)

    # 2. Duplicate name error
    mock_crud.get.return_value = {"id": 1, "name": "rl1"}
    mock_crud.exists.return_value = True
    with pytest.raises(ResourceExistsError, match="already exists"):
        await rate_limit_service.update("rl1", RateLimitUpdate(name="rl2"), mock_db)

    # 3. Success
    mock_crud.exists.return_value = False
    await rate_limit_service.update("rl1", RateLimitUpdate(limit=20), mock_db)
    mock_crud.update.assert_called_once()


@pytest.mark.asyncio
async def test_delete_rate_limit(rate_limit_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = None
    monkeypatch.setattr("src.app.services.rate_limit.service.crud_rate_limits", mock_crud)

    with pytest.raises(ResourceNotFoundError):
        await rate_limit_service.delete("rl1", mock_db)

    mock_crud.get.return_value = {"id": 1, "name": "rl1"}
    await rate_limit_service.delete("rl1", mock_db)
    mock_crud.db_delete.assert_called_once()


@pytest.mark.asyncio
async def test_verify_superuser(rate_limit_service):
    with pytest.raises(PermissionDeniedError):
        await rate_limit_service.verify_superuser({"is_superuser": False})

    await rate_limit_service.verify_superuser({"is_superuser": True})
