"""Unit tests for TierService."""

from unittest.mock import AsyncMock

import pytest

from src.modules.common.exceptions import (
    PermissionDeniedError,
    ResourceExistsError,
    TierNotFoundError,
)
from src.modules.tier.schemas import TierCreate, TierUpdate
from src.modules.tier.service import TierService


@pytest.fixture
def tier_service():
    return TierService()


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.mark.asyncio
async def test_create_tier_exists(tier_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.exists.return_value = True
    monkeypatch.setattr("src.modules.tier.service.crud_tiers", mock_crud)

    with pytest.raises(ResourceExistsError, match="already exists"):
        await tier_service.create(TierCreate(name="pro"), mock_db)


@pytest.mark.asyncio
async def test_create_tier_returns_none(tier_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.exists.return_value = False
    mock_crud.create.return_value = None
    monkeypatch.setattr("src.modules.tier.service.crud_tiers", mock_crud)

    with pytest.raises(ResourceExistsError, match="Failed to create tier"):
        await tier_service.create(TierCreate(name="pro"), mock_db)


@pytest.mark.asyncio
async def test_create_tier_success(tier_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.exists.return_value = False
    mock_crud.create.return_value = {"id": 1, "name": "pro"}
    monkeypatch.setattr("src.modules.tier.service.crud_tiers", mock_crud)

    res = await tier_service.create(TierCreate(name="pro"), mock_db)
    assert res["id"] == 1


@pytest.mark.asyncio
async def test_get_all(tier_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get_multi.return_value = {"data": [{"id": 1, "name": "free"}], "total": 1}
    monkeypatch.setattr("src.modules.tier.service.crud_tiers", mock_crud)

    res = await tier_service.get_all(mock_db, skip=0, limit=10)
    assert res["total"] == 1


@pytest.mark.asyncio
async def test_get_by_id(tier_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = None
    monkeypatch.setattr("src.modules.tier.service.crud_tiers", mock_crud)

    with pytest.raises(TierNotFoundError):
        await tier_service.get_by_id(99, mock_db)

    mock_crud.get.return_value = {"id": 1, "name": "free"}
    res = await tier_service.get_by_id(1, mock_db)
    assert res["name"] == "free"


@pytest.mark.asyncio
async def test_get_by_name(tier_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = None
    monkeypatch.setattr("src.modules.tier.service.crud_tiers", mock_crud)

    with pytest.raises(TierNotFoundError):
        await tier_service.get_by_name("ghost", mock_db)

    mock_crud.get.return_value = {"id": 1, "name": "free"}
    res = await tier_service.get_by_name("free", mock_db)
    assert res["name"] == "free"


@pytest.mark.asyncio
async def test_update_tier(tier_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = None
    monkeypatch.setattr("src.modules.tier.service.crud_tiers", mock_crud)

    # 1. Not found
    with pytest.raises(TierNotFoundError):
        await tier_service.update("free", TierUpdate(name="new_free"), mock_db)

    # 2. Duplicate name conflict
    mock_crud.get.return_value = {"id": 1, "name": "free"}
    mock_crud.exists.return_value = True
    with pytest.raises(ResourceExistsError, match="already exists"):
        await tier_service.update("free", TierUpdate(name="taken_name"), mock_db)

    # 3. Success
    mock_crud.exists.return_value = False
    mock_crud.update.return_value = {"id": 1, "name": "new_free"}
    await tier_service.update("free", TierUpdate(name="new_free"), mock_db)
    mock_crud.update.assert_called_once()


@pytest.mark.asyncio
async def test_delete_tier(tier_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = None
    monkeypatch.setattr("src.modules.tier.service.crud_tiers", mock_crud)

    with pytest.raises(TierNotFoundError):
        await tier_service.delete("ghost", mock_db)

    mock_crud.get.return_value = {"id": 1, "name": "free"}
    await tier_service.delete("free", mock_db)
    mock_crud.delete.assert_called_once()


@pytest.mark.asyncio
async def test_permanent_delete_tier(tier_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = None
    monkeypatch.setattr("src.modules.tier.service.crud_tiers", mock_crud)

    with pytest.raises(TierNotFoundError):
        await tier_service.permanent_delete("ghost", mock_db)

    mock_crud.get.return_value = {"id": 1, "name": "free"}
    await tier_service.permanent_delete("free", mock_db)
    mock_crud.db_delete.assert_called_once()


@pytest.mark.asyncio
async def test_verify_superuser(tier_service):
    with pytest.raises(PermissionDeniedError):
        await tier_service.verify_superuser({"is_superuser": False})

    await tier_service.verify_superuser({"is_superuser": True})
