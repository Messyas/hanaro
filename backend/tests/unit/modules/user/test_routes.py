"""Unit tests for user routes."""

import base64
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from src.infrastructure.auth.dependencies import get_current_superuser, get_current_user
from src.infrastructure.database.session import async_session
from src.interfaces.main import app
from src.modules.common.exceptions import PermissionDeniedError, UserExistsError, UserNotFoundError
from src.modules.user.dependencies import (
    get_profile_image_storage,
    get_user_service,
)
from src.modules.user.profile_image import ProfileImageStorage

VALID_PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")


@pytest.fixture
def mock_user_service():
    return AsyncMock()


@pytest.fixture
def valid_user_dict():
    return {
        "id": 1,
        "name": "Test User",
        "username": "johndoe",
        "email": "john@example.com",
        "is_superuser": False,
        "profile_image_url": "https://example.com/pic.jpg",
        "tier_id": 1,
    }


@pytest.fixture
def mock_superuser(valid_user_dict):
    su = dict(valid_user_dict)
    su.update({"id": 99, "username": "admin", "is_superuser": True})
    return su


@pytest_asyncio.fixture
async def async_client(mock_user_service, valid_user_dict, mock_superuser, tmp_path):
    mock_db = AsyncMock()
    image_storage = ProfileImageStorage(
        directory=str(tmp_path / "profile-images"),
        max_bytes=1024,
        max_dimension=4096,
    )

    app.dependency_overrides[async_session] = lambda: mock_db
    app.dependency_overrides[get_user_service] = lambda: mock_user_service
    app.dependency_overrides[get_profile_image_storage] = lambda: image_storage
    app.dependency_overrides[get_current_user] = lambda: valid_user_dict
    app.dependency_overrides[get_current_superuser] = lambda: mock_superuser

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_user_routes(async_client, mock_user_service, valid_user_dict):
    payload = {
        "name": "Alice",
        "username": "alice",
        "email": "alice@example.com",
        "password": "violet canoe glacier lantern 8472",
    }

    # 1. Success
    alice_dict = dict(valid_user_dict)
    alice_dict.update({"id": 2, "name": "Alice", "username": "alice", "email": "alice@example.com"})
    mock_user_service.create.return_value = alice_dict
    resp = await async_client.post("/api/v1/users/", json=payload)
    assert resp.status_code == 201
    assert resp.json()["username"] == "alice"

    # 2. Handled exception (422 DuplicateValueException)
    mock_user_service.create.side_effect = UserExistsError("Email already registered")
    resp_conflict = await async_client.post("/api/v1/users/", json=payload)
    assert resp_conflict.status_code == 422

    # 3. Unexpected exception (500)
    mock_user_service.create.side_effect = RuntimeError("Fatal DB crash")
    resp_500 = await async_client.post("/api/v1/users/", json=payload)
    assert resp_500.status_code == 500
    assert resp_500.json()["detail"] == "An unexpected error occurred"


@pytest.mark.asyncio
async def test_get_users_route(async_client, mock_user_service, valid_user_dict):
    mock_user_service.get_paginated.return_value = {
        "data": [valid_user_dict],
        "total": 1,
    }

    resp = await async_client.get("/api/v1/users/?page=1&items_per_page=10")
    assert resp.status_code == 200
    data = resp.json()
    assert "data" in data
    assert len(data["data"]) == 1


@pytest.mark.asyncio
async def test_admin_status_and_role_do_not_change_superuser(async_client):
    mock_db = app.dependency_overrides[async_session]()
    user = SimpleNamespace(
        id=2, name="Alice", username="alice", email="alice@example.com",
        notification_email=None, phone=None, job_title=None,
        profile_image_url="https://example.com/pic.jpg", is_deleted=False,
        deleted_at=None, tier_id=None, is_superuser=False, role="analista",
    )
    mock_db.get.return_value = user

    role = await async_client.patch(
        "/api/v1/users/admin/2",
        json={"name": "Alice", "username": "alice", "email": "alice@example.com", "role": "gestor"},
    )
    assert role.status_code == 200
    assert user.role == "gestor"
    assert user.is_superuser is False

    inactive = await async_client.patch("/api/v1/users/admin/2/status", json={"is_active": False})
    assert inactive.status_code == 200
    assert user.is_deleted is True
    assert user.deleted_at is None

    active = await async_client.patch("/api/v1/users/admin/2/status", json={"is_active": True})
    assert active.status_code == 200
    assert user.is_deleted is False
    assert user.deleted_at is None

    user.id = 99
    user.is_superuser = True
    assert (await async_client.patch("/api/v1/users/admin/99/status", json={"is_active": False})).status_code == 403
    assert (await async_client.delete("/api/v1/users/admin/99")).status_code == 403


@pytest.mark.asyncio
async def test_admin_user_list_is_paginated(async_client, valid_user_dict):
    mock_db = app.dependency_overrides[async_session]()
    count_result = MagicMock()
    count_result.scalar_one.return_value = 26
    rows_result = MagicMock()
    rows_result.scalars.return_value.all.return_value = [valid_user_dict]
    mock_db.execute.side_effect = [count_result, rows_result]

    response = await async_client.get("/api/v1/users/admin/all?page=2&items_per_page=25")

    assert response.status_code == 200
    assert response.json()["page"] == 2
    assert response.json()["total_items"] == 26
    assert response.json()["total_pages"] == 2
    assert len(response.json()["items"]) == 1
    assert (await async_client.get("/api/v1/users/admin/all?items_per_page=101")).status_code == 422


@pytest.mark.asyncio
async def test_get_current_user_profile_route(async_client):
    resp = await async_client.get("/api/v1/users/me")
    assert resp.status_code == 200
    assert resp.json()["username"] == "johndoe"


@pytest.mark.asyncio
async def test_profile_image_crud_route(async_client, mock_user_service, valid_user_dict):
    mock_user_service.update.return_value = {"id": valid_user_dict["id"]}

    upload = await async_client.put(
        "/api/v1/users/me/profile-image",
        files={"image": ("avatar.png", VALID_PNG, "image/png")},
    )
    assert upload.status_code == 200
    first_url = upload.json()["profile_image_url"]
    assert first_url.startswith("/api/v1/users/me/profile-image?v=")
    valid_user_dict["profile_image_url"] = first_url

    read = await async_client.get("/api/v1/users/me/profile-image")
    assert read.status_code == 200
    assert read.headers["content-type"] == "image/webp"
    assert read.content.startswith(b"RIFF")

    replace = await async_client.put(
        "/api/v1/users/me/profile-image",
        files={"image": ("replacement.png", VALID_PNG, "image/png")},
    )
    assert replace.status_code == 200
    replacement_url = replace.json()["profile_image_url"]
    assert replacement_url != first_url
    valid_user_dict["profile_image_url"] = replacement_url

    remove = await async_client.delete("/api/v1/users/me/profile-image")
    assert remove.status_code == 200
    assert remove.json() == {"profile_image_url": None}
    valid_user_dict["profile_image_url"] = "https://profileimageurl.com"

    missing = await async_client.get("/api/v1/users/me/profile-image")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_profile_image_rejects_unsupported_invalid_and_oversized_files(
    async_client,
):
    unsupported = await async_client.put(
        "/api/v1/users/me/profile-image",
        files={"image": ("avatar.svg", b"<svg></svg>", "image/svg+xml")},
    )
    assert unsupported.status_code == 415

    invalid = await async_client.put(
        "/api/v1/users/me/profile-image",
        files={"image": ("avatar.png", b"not-an-image", "image/png")},
    )
    assert invalid.status_code == 422

    oversized = await async_client.put(
        "/api/v1/users/me/profile-image",
        files={"image": ("avatar.png", b"x" * 1025, "image/png")},
    )
    assert oversized.status_code == 413


@pytest.mark.asyncio
async def test_get_user_by_username_route(async_client, mock_user_service, valid_user_dict):
    # 1. Success
    mock_user_service.get_by_username.return_value = valid_user_dict
    resp = await async_client.get("/api/v1/users/johndoe")
    assert resp.status_code == 200
    mock_user_service.verify_user_permission.assert_awaited_with(valid_user_dict, "johndoe", "view this profile")

    # 2. Return None -> 404
    mock_user_service.get_by_username.return_value = None
    resp_404 = await async_client.get("/api/v1/users/ghost")
    assert resp_404.status_code == 404

    # 3. UserNotFoundError -> 404
    mock_user_service.get_by_username.side_effect = UserNotFoundError("User not found")
    resp_unf = await async_client.get("/api/v1/users/ghost")
    assert resp_unf.status_code == 404

    # 4. RuntimeError -> 500
    mock_user_service.get_by_username.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.get("/api/v1/users/johndoe")
    assert resp_500.status_code == 500


@pytest.mark.asyncio
async def test_get_active_and_inactive_user_by_username_route(async_client, mock_user_service, valid_user_dict):
    # 1. Success
    mock_user_service.get_active_and_inactive_by_username.return_value = valid_user_dict
    resp = await async_client.get("/api/v1/users/active-and-inactive/johndoe")
    assert resp.status_code == 200

    # 2. None -> 404
    mock_user_service.get_active_and_inactive_by_username.return_value = None
    resp_404 = await async_client.get("/api/v1/users/active-and-inactive/ghost")
    assert resp_404.status_code == 404

    # 3. RuntimeError -> 500
    mock_user_service.get_active_and_inactive_by_username.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.get("/api/v1/users/active-and-inactive/johndoe")
    assert resp_500.status_code == 500


@pytest.mark.asyncio
async def test_update_user_profile_route(async_client, mock_user_service, valid_user_dict):
    # 1. Success
    mock_user_service.get_by_username.return_value = valid_user_dict
    mock_user_service.update.return_value = {"id": 1}
    mock_user_service.verify_user_permission.side_effect = None

    resp = await async_client.patch("/api/v1/users/johndoe", json={"name": "New Name"})
    assert resp.status_code == 200
    assert resp.json() == {"message": "User updated successfully"}

    # 2. User not found -> 404
    mock_user_service.get_by_username.return_value = None
    resp_404 = await async_client.patch("/api/v1/users/ghost", json={"name": "New Name"})
    assert resp_404.status_code == 404

    # 3. Permission denied -> 403
    mock_user_service.get_by_username.return_value = valid_user_dict
    mock_user_service.verify_user_permission.side_effect = PermissionDeniedError("Forbidden")
    resp_403 = await async_client.patch("/api/v1/users/johndoe", json={"name": "New Name"})
    assert resp_403.status_code == 403

    # 4. Unexpected error -> 500
    mock_user_service.verify_user_permission.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.patch("/api/v1/users/johndoe", json={"name": "New Name"})
    assert resp_500.status_code == 500


@pytest.mark.asyncio
async def test_delete_user_account_route(async_client, mock_user_service, valid_user_dict):
    # 1. Success
    mock_user_service.get_by_username.return_value = valid_user_dict
    mock_user_service.verify_user_permission.side_effect = None
    mock_user_service.delete.return_value = None

    resp = await async_client.delete("/api/v1/users/johndoe")
    assert resp.status_code == 200
    assert resp.json() == {"message": "User account deactivated"}

    # 2. User not found -> 404
    mock_user_service.get_by_username.return_value = None
    resp_404 = await async_client.delete("/api/v1/users/ghost")
    assert resp_404.status_code == 404

    # 3. Unexpected error -> 500
    mock_user_service.get_by_username.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.delete("/api/v1/users/johndoe")
    assert resp_500.status_code == 500


@pytest.mark.asyncio
async def test_gdpr_delete_user_route(async_client, mock_user_service, valid_user_dict):
    # 1. Success
    mock_user_service.get_active_and_inactive_by_username.return_value = valid_user_dict
    resp = await async_client.delete("/api/v1/users/db/johndoe")
    assert resp.status_code == 200
    assert resp.json() == {"message": "User data anonymized in compliance with GDPR"}

    # 2. User not found -> 404
    mock_user_service.get_active_and_inactive_by_username.return_value = None
    resp_404 = await async_client.delete("/api/v1/users/db/ghost")
    assert resp_404.status_code == 404

    # 3. Unexpected error -> 500
    mock_user_service.get_active_and_inactive_by_username.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.delete("/api/v1/users/db/johndoe")
    assert resp_500.status_code == 500


@pytest.mark.asyncio
async def test_get_user_rate_limits_route(async_client, mock_user_service, valid_user_dict):
    # 1. Success
    mock_user_service.get_by_username.return_value = valid_user_dict
    mock_user_service.get_rate_limits.return_value = {"rate_limits": []}
    mock_user_service.verify_user_permission.side_effect = None

    resp = await async_client.get("/api/v1/users/johndoe/rate-limits")
    assert resp.status_code == 200

    # 2. Not found -> 404
    mock_user_service.get_by_username.return_value = None
    resp_404 = await async_client.get("/api/v1/users/ghost/rate-limits")
    assert resp_404.status_code == 404

    # 3. Error -> 500
    mock_user_service.get_by_username.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.get("/api/v1/users/johndoe/rate-limits")
    assert resp_500.status_code == 500


@pytest.mark.asyncio
async def test_get_user_tier_route(async_client, mock_user_service, valid_user_dict):
    # 1. Success
    mock_user_service.get_by_username.return_value = valid_user_dict
    mock_user_service.get_user_with_tier.return_value = {"id": 1, "tier": None}
    mock_user_service.verify_user_permission.side_effect = None

    resp = await async_client.get("/api/v1/users/johndoe/tier")
    assert resp.status_code == 200

    # 2. Not found -> 404
    mock_user_service.get_by_username.return_value = None
    resp_404 = await async_client.get("/api/v1/users/ghost/tier")
    assert resp_404.status_code == 404

    # 3. Error -> 500
    mock_user_service.get_by_username.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.get("/api/v1/users/johndoe/tier")
    assert resp_500.status_code == 500


@pytest.mark.asyncio
async def test_update_user_tier_route(async_client, mock_user_service, valid_user_dict):
    # 1. Success
    mock_user_service.get_by_username.return_value = valid_user_dict
    mock_user_service.update_tier.return_value = {"id": 1}

    resp = await async_client.patch("/api/v1/users/johndoe/tier", json={"tier_id": 2})
    assert resp.status_code == 200
    assert resp.json() == {"message": "User tier updated successfully"}

    # 2. Not found -> 404
    mock_user_service.get_by_username.return_value = None
    resp_404 = await async_client.patch("/api/v1/users/ghost/tier", json={"tier_id": 2})
    assert resp_404.status_code == 404

    # 3. Error -> 500
    mock_user_service.get_by_username.side_effect = RuntimeError("Crash")
    resp_500 = await async_client.patch("/api/v1/users/johndoe/tier", json={"tier_id": 2})
    assert resp_500.status_code == 500
