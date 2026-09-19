import pytest
from httpx import AsyncClient

from src.infrastructure.auth.dependencies import get_current_superuser, get_current_user
from src.interfaces.main import app

pytestmark = pytest.mark.asyncio


async def test_admin_can_manage_regular_account(
    client: AsyncClient,
    test_user: dict,
    test_superuser: dict,
):
    user_id = test_user["id"]
    base = f"/api/v1/users/admin/{user_id}"

    async def regular_user():
        return test_user

    async def superuser():
        return test_superuser

    app.dependency_overrides[get_current_user] = regular_user
    app.dependency_overrides[get_current_superuser] = regular_user
    assert (await client.get("/api/v1/users/admin/all")).status_code == 403

    app.dependency_overrides[get_current_user] = superuser
    app.dependency_overrides[get_current_superuser] = superuser
    listed = await client.get("/api/v1/users/admin/all")
    assert listed.status_code == 200
    assert any(user["id"] == user_id for user in listed.json()["items"])

    updated = await client.patch(
        base,
        json={
            "name": test_user["name"],
            "username": test_user["username"],
            "email": test_user["email"],
            "role": "gestor",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["role"] == "gestor"

    inactive = await client.patch(f"{base}/status", json={"is_active": False})
    assert inactive.status_code == 200
    assert inactive.json()["is_deleted"] is True
    active = await client.patch(f"{base}/status", json={"is_active": True})
    assert active.status_code == 200
    assert active.json()["is_deleted"] is False

    deleted = await client.delete(base)
    assert deleted.status_code == 204
    listed = await client.get("/api/v1/users/admin/all")
    assert all(user["id"] != user_id for user in listed.json()["items"])
    assert (await client.patch(f"{base}/status", json={"is_active": True})).status_code == 404
