import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_admin_can_manage_regular_account(
    superuser_auth_client: AsyncClient, auth_client: AsyncClient, test_user: dict,
):
    user_id = test_user["id"]
    base = f"/api/v1/users/admin/{user_id}"

    assert (await auth_client.get("/api/v1/users/admin/all")).status_code == 403
    listed = await superuser_auth_client.get("/api/v1/users/admin/all")
    assert listed.status_code == 200
    assert any(user["id"] == user_id for user in listed.json()["items"])

    role = await superuser_auth_client.patch(f"{base}/role", json={"job_title": "Analista"})
    assert role.status_code == 200
    assert role.json()["job_title"] == "Analista"

    inactive = await superuser_auth_client.patch(f"{base}/status", json={"is_active": False})
    assert inactive.status_code == 200
    assert inactive.json()["is_deleted"] is True
    active = await superuser_auth_client.patch(f"{base}/status", json={"is_active": True})
    assert active.status_code == 200
    assert active.json()["is_deleted"] is False

    deleted = await superuser_auth_client.delete(base)
    assert deleted.status_code == 204
    listed = await superuser_auth_client.get("/api/v1/users/admin/all")
    assert all(user["id"] != user_id for user in listed.json()["items"])
    assert (await superuser_auth_client.patch(f"{base}/status", json={"is_active": True})).status_code == 404
