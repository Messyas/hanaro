"""Unit tests for UserService."""

from unittest.mock import AsyncMock

import pytest
from sqlalchemy.exc import MultipleResultsFound, NoResultFound

from src.modules.common.exceptions import (
    PermissionDeniedError,
    TierNotFoundError,
    UserExistsError,
    UserNotFoundError,
    ValidationError,
)
from src.modules.user.schemas import UserCreate, UserTierUpdate, UserUpdate
from src.modules.user.service import UserService


@pytest.fixture
def user_service():
    return UserService()


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.mark.asyncio
async def test_create_email_exists(user_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.exists.side_effect = lambda db, **kwargs: (
        True if "email" in kwargs else False
    )
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    user_data = UserCreate(
        name="Test User",
        email="existing@example.com",
        username="newuser",
        password="violet canoe glacier lantern 8472",
    )
    with pytest.raises(UserExistsError, match="Email already registered"):
        await user_service.create(user_data, mock_db)


@pytest.mark.asyncio
async def test_create_username_exists(user_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.exists.side_effect = lambda db, **kwargs: (
        True if "username" in kwargs else False
    )
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    user_data = UserCreate(
        name="Test User",
        email="new@example.com",
        username="existinguser",
        password="violet canoe glacier lantern 8472",
    )
    with pytest.raises(UserExistsError, match="Username already taken"):
        await user_service.create(user_data, mock_db)


@pytest.mark.asyncio
async def test_create_failure(user_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.exists.return_value = False
    mock_crud.create.return_value = None
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    user_data = UserCreate(
        name="Test User",
        email="new@example.com",
        username="newuser",
        password="violet canoe glacier lantern 8472",
    )
    with pytest.raises(UserExistsError, match="Failed to create user"):
        await user_service.create(user_data, mock_db)


@pytest.mark.asyncio
async def test_create_success(user_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.exists.return_value = False
    mock_crud.create.return_value = {"id": 1, "username": "newuser"}
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    user_data = UserCreate(
        name="Test User",
        email="new@example.com",
        username="newuser",
        password="violet canoe glacier lantern 8472",
    )
    res = await user_service.create(user_data, mock_db)
    assert res["id"] == 1


@pytest.mark.asyncio
async def test_get_paginated_no_db(user_service):
    with pytest.raises(ValueError, match="Database session cannot be None"):
        await user_service.get_paginated(db=None)


@pytest.mark.asyncio
async def test_get_paginated_success(user_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get_multi.return_value = {"data": [{"id": 1}], "count": 1}
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    res = await user_service.get_paginated(db=mock_db, skip=0, limit=10)
    assert res["count"] == 1


@pytest.mark.asyncio
async def test_get_by_username_not_found(user_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = None
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    with pytest.raises(UserNotFoundError):
        await user_service.get_by_username("ghost", mock_db)


@pytest.mark.asyncio
async def test_get_active_and_inactive_by_username_not_found(
    user_service, mock_db, monkeypatch
):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = None
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    with pytest.raises(UserNotFoundError):
        await user_service.get_active_and_inactive_by_username("ghost", mock_db)


@pytest.mark.asyncio
async def test_get_by_email_not_found(user_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = None
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    with pytest.raises(UserNotFoundError):
        await user_service.get_by_email("ghost@example.com", mock_db)


@pytest.mark.asyncio
async def test_update_user_not_found(user_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = None
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    with pytest.raises(UserNotFoundError):
        await user_service.update(99, UserUpdate(name="New"), mock_db)


@pytest.mark.asyncio
async def test_update_email_conflict(user_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = {"id": 1, "email": "old@example.com", "username": "u1"}
    mock_crud.exists.side_effect = lambda db, **kwargs: (
        True if "email" in kwargs else False
    )
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    with pytest.raises(UserExistsError, match="Email already registered"):
        await user_service.update(
            1, UserUpdate(email="taken@example.com"), mock_db
        )


@pytest.mark.asyncio
async def test_update_username_conflict(user_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = {"id": 1, "email": "u@example.com", "username": "old"}
    mock_crud.exists.side_effect = lambda db, **kwargs: (
        True if "username" in kwargs else False
    )
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    with pytest.raises(UserExistsError, match="Username already taken"):
        await user_service.update(1, UserUpdate(username="taken"), mock_db)


@pytest.mark.asyncio
async def test_update_returns_none(user_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = {"id": 1, "email": "u@example.com", "username": "u1"}
    mock_crud.update.return_value = None
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    with pytest.raises(UserNotFoundError):
        await user_service.update(1, UserUpdate(name="New"), mock_db)


@pytest.mark.asyncio
async def test_update_profile_contact_fields_and_reverify_changed_email(
    user_service, mock_db, monkeypatch
):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = {
        "id": 1,
        "email": "old@example.com",
        "username": "operator",
    }
    mock_crud.exists.return_value = False
    mock_crud.update.return_value = {"id": 1}
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    await user_service.update(
        1,
        UserUpdate(
            email="new@example.com",
            notification_email="alerts@example.com",
            phone="+55 92 99999-0000",
            job_title="Operador de produção",
        ),
        mock_db,
    )

    updated = mock_crud.update.await_args.kwargs["object"]
    assert updated.email_verified is False
    assert updated.notification_email == "alerts@example.com"
    assert updated.phone == "+55 92 99999-0000"
    assert updated.job_title == "Operador de produção"


@pytest.mark.asyncio
async def test_permission_checks(user_service):
    admin = {"is_superuser": True, "username": "admin"}
    user_a = {"is_superuser": False, "username": "alice"}

    assert await user_service.check_update_permission(admin, "bob") is True
    assert await user_service.check_update_permission(user_a, "alice") is True
    assert await user_service.check_update_permission(user_a, "bob") is False

    with pytest.raises(PermissionDeniedError):
        await user_service.verify_user_permission(user_a, "bob", "edit")


@pytest.mark.asyncio
async def test_delete_exceptions(user_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.delete.side_effect = NoResultFound
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    with pytest.raises(UserNotFoundError):
        await user_service.delete(1, mock_db)

    mock_crud.delete.side_effect = MultipleResultsFound
    with pytest.raises(ValidationError):
        await user_service.delete(1, mock_db)


@pytest.mark.asyncio
async def test_permanent_delete_exceptions(user_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.db_delete.side_effect = NoResultFound
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    with pytest.raises(UserNotFoundError):
        await user_service.permanent_delete(1, mock_db)

    mock_crud.db_delete.side_effect = MultipleResultsFound
    with pytest.raises(ValidationError):
        await user_service.permanent_delete(1, mock_db)


@pytest.mark.asyncio
async def test_anonymize_user_not_found(user_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = None
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    with pytest.raises(UserNotFoundError):
        await user_service.anonymize_user(1, mock_db)


@pytest.mark.asyncio
async def test_anonymize_user_no_result_found_exception(
    user_service, mock_db, monkeypatch
):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = {"id": 1, "email": "test@example.com"}
    mock_crud.update.side_effect = NoResultFound
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    with pytest.raises(UserNotFoundError):
        await user_service.anonymize_user(1, mock_db)


@pytest.mark.asyncio
async def test_anonymize_user_success(user_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = {"id": 1, "email": "test@example.com"}
    mock_crud.update.return_value = True
    mock_crud.delete.return_value = True
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    await user_service.anonymize_user(1, mock_db)
    mock_crud.update.assert_called_once()
    mock_crud.delete.assert_called_once()


@pytest.mark.asyncio
async def test_update_tier_user_not_found(user_service, mock_db, monkeypatch):
    mock_crud_u = AsyncMock()
    mock_crud_u.get.return_value = None
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud_u)

    with pytest.raises(UserNotFoundError):
        await user_service.update_tier(1, UserTierUpdate(tier_id=2), mock_db)


@pytest.mark.asyncio
async def test_update_tier_tier_not_found(user_service, mock_db, monkeypatch):
    mock_crud_u = AsyncMock()
    mock_crud_u.get.return_value = {"id": 1}
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud_u)

    mock_crud_t = AsyncMock()
    mock_crud_t.exists.return_value = False
    monkeypatch.setattr("src.modules.user.service.crud_tiers", mock_crud_t)

    with pytest.raises(TierNotFoundError):
        await user_service.update_tier(1, UserTierUpdate(tier_id=99), mock_db)


@pytest.mark.asyncio
async def test_update_tier_returns_none(user_service, mock_db, monkeypatch):
    mock_crud_u = AsyncMock()
    mock_crud_u.get.return_value = {"id": 1}
    mock_crud_u.update.return_value = None
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud_u)

    mock_crud_t = AsyncMock()
    mock_crud_t.exists.return_value = True
    monkeypatch.setattr("src.modules.user.service.crud_tiers", mock_crud_t)

    with pytest.raises(UserNotFoundError):
        await user_service.update_tier(1, UserTierUpdate(tier_id=2), mock_db)


@pytest.mark.asyncio
async def test_get_rate_limits_no_user(user_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = None
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    with pytest.raises(UserNotFoundError):
        await user_service.get_rate_limits(1, mock_db)


@pytest.mark.asyncio
async def test_get_rate_limits_no_tier(user_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = {"id": 1, "tier_id": None}
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    res = await user_service.get_rate_limits(1, mock_db)
    assert res["rate_limits"] == []


@pytest.mark.asyncio
async def test_get_rate_limits_joined_none(user_service, mock_db, monkeypatch):
    mock_crud = AsyncMock()
    mock_crud.get.return_value = {"id": 1, "tier_id": 2}
    mock_crud.get_joined.return_value = None
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud)

    with pytest.raises(UserNotFoundError):
        await user_service.get_rate_limits(1, mock_db)


@pytest.mark.asyncio
async def test_get_user_with_tier_variations(user_service, mock_db, monkeypatch):
    mock_crud_u = AsyncMock()
    mock_crud_u.get.return_value = None
    monkeypatch.setattr("src.modules.user.service.crud_users", mock_crud_u)

    # 1. User not found
    with pytest.raises(UserNotFoundError):
        await user_service.get_user_with_tier(1, mock_db)

    # 2. tier_id is None
    mock_crud_u.get.return_value = {"id": 1, "tier_id": None}
    res2 = await user_service.get_user_with_tier(1, mock_db)
    assert res2["tier"] is None

    # 3. Tier doesn't exist in DB
    mock_crud_u.get.return_value = {"id": 1, "tier_id": 99}
    mock_crud_t = AsyncMock()
    mock_crud_t.exists.return_value = False
    monkeypatch.setattr("src.modules.user.service.crud_tiers", mock_crud_t)

    res3 = await user_service.get_user_with_tier(1, mock_db)
    assert res3["tier"] is None

    # 4. Success
    mock_crud_t.exists.return_value = True
    mock_crud_u.get_joined.return_value = {"id": 1, "tier": {"id": 99, "name": "pro"}}
    res4 = await user_service.get_user_with_tier(1, mock_db)
    assert res4["tier"]["name"] == "pro"
