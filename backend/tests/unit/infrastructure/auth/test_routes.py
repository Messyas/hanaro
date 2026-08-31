"""Unit tests for Auth routes."""

from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from crudauth import Principal
from httpx import ASGITransport, AsyncClient

from src.infrastructure.auth.dependencies import get_current_principal, get_optional_principal
from src.infrastructure.database.session import async_session
from src.interfaces.main import app


@pytest.fixture
def mock_principal():
    p = MagicMock(spec=Principal)
    p.user_id = 1
    p.metadata = {"session_id": "sess_123"}
    return p


@pytest_asyncio.fixture
async def async_client():
    mock_db = AsyncMock()
    app.dependency_overrides[async_session] = lambda: mock_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_login_route(async_client, monkeypatch):
    mock_auth = MagicMock()
    mock_auth.authenticate_password = AsyncMock(return_value={"id": 1, "username": "alice"})
    mock_auth.repo.user_id.return_value = 1
    mock_auth.repo.get.return_value = "alice"
    mock_auth.sessions.create_session = AsyncMock(return_value=("sess_123", "csrf_abc"))
    mock_auth.sessions.set_session_cookies = MagicMock()

    monkeypatch.setattr("src.infrastructure.auth.routes.crud_auth", mock_auth)

    resp = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "alice", "password": "Password123!"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"csrf_token": "csrf_abc"}


@pytest.mark.asyncio
async def test_logout_route(async_client, mock_principal, monkeypatch):
    mock_auth = MagicMock()
    mock_auth.sessions.revoke = AsyncMock()
    mock_auth.sessions.clear_session_cookies = MagicMock()
    monkeypatch.setattr("src.infrastructure.auth.routes.crud_auth", mock_auth)

    app.dependency_overrides[get_current_principal] = lambda: mock_principal

    resp = await async_client.post("/api/v1/auth/logout")
    assert resp.status_code == 200
    assert resp.json() == {"message": "Logged out successfully"}
    mock_auth.sessions.revoke.assert_awaited_once_with("sess_123", owner_id=1)


@pytest.mark.asyncio
async def test_refresh_csrf_no_cookie(async_client):
    resp = await async_client.post("/api/v1/auth/refresh-csrf")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_csrf_success(async_client, monkeypatch):
    mock_auth = MagicMock()
    mock_sessions = MagicMock()
    mock_sessions.session_cookie_name = "session_id"

    session_obj = MagicMock()
    session_obj.user_id = 1
    session_obj.metadata = {}

    mock_sessions.validate_session = AsyncMock(return_value=session_obj)
    mock_sessions.timeout_seconds_for.return_value = 3600
    mock_sessions.regenerate_csrf_token = AsyncMock(return_value="new_csrf_123")
    mock_sessions.set_csrf_cookie = MagicMock()

    mock_auth.sessions = mock_sessions
    monkeypatch.setattr("src.infrastructure.auth.routes.crud_auth", mock_auth)

    resp = await async_client.post(
        "/api/v1/auth/refresh-csrf",
        cookies={"session_id": "sess_123"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"csrf_token": "new_csrf_123"}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/auth/oauth/google",
        "/api/v1/auth/oauth/callback/google?code=test&state=test",
    ],
)
async def test_external_authentication_routes_are_not_registered(async_client, path):
    resp = await async_client.get(path)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_check_auth_route_anonymous(async_client):
    app.dependency_overrides[get_optional_principal] = lambda: None
    resp = await async_client.get("/api/v1/auth/check-auth")
    assert resp.status_code == 200
    assert resp.json() == {"authenticated": False, "message": "Not authenticated"}


@pytest.mark.asyncio
async def test_check_auth_route_user_not_found(async_client, mock_principal, monkeypatch):
    app.dependency_overrides[get_optional_principal] = lambda: mock_principal

    mock_crud = AsyncMock()
    mock_crud.get.return_value = None
    monkeypatch.setattr("src.infrastructure.auth.routes.crud_users", mock_crud)

    resp = await async_client.get("/api/v1/auth/check-auth")
    assert resp.status_code == 200
    assert resp.json() == {"authenticated": False, "message": "User not found"}


@pytest.mark.asyncio
async def test_check_auth_route_authenticated(async_client, mock_principal, monkeypatch):
    app.dependency_overrides[get_optional_principal] = lambda: mock_principal

    mock_crud = AsyncMock()
    mock_crud.get.return_value = {
        "id": 1,
        "name": "Alice Operator",
        "username": "alice",
        "email": "alice@example.com",
        "notification_email": "alerts@example.com",
        "phone": "+55 92 99999-0000",
        "job_title": "Operadora de produção",
        "profile_image_url": None,
        "is_superuser": False,
    }
    monkeypatch.setattr("src.infrastructure.auth.routes.crud_users", mock_crud)

    mock_auth = MagicMock()
    session_obj = MagicMock()
    session_obj.created_at.isoformat.return_value = "2026-08-10T12:00:00Z"
    session_obj.last_activity.isoformat.return_value = "2026-08-10T12:05:00Z"
    mock_auth.sessions.validate_session = AsyncMock(return_value=session_obj)
    monkeypatch.setattr("src.infrastructure.auth.routes.crud_auth", mock_auth)

    resp = await async_client.get("/api/v1/auth/check-auth")
    assert resp.status_code == 200
    data = resp.json()
    assert data["authenticated"] is True
    assert data["user"]["name"] == "Alice Operator"
    assert data["user"]["username"] == "alice"
    assert data["user"]["notification_email"] == "alerts@example.com"
    assert data["user"]["phone"] == "+55 92 99999-0000"
    assert data["user"]["job_title"] == "Operadora de produção"


@pytest.mark.asyncio
async def test_check_auth_route_exception(async_client, mock_principal, monkeypatch):
    app.dependency_overrides[get_optional_principal] = lambda: mock_principal

    mock_crud = AsyncMock()
    mock_crud.get.side_effect = RuntimeError("DB crash")
    monkeypatch.setattr("src.infrastructure.auth.routes.crud_users", mock_crud)

    resp = await async_client.get("/api/v1/auth/check-auth")
    assert resp.status_code == 200
    assert resp.json() == {
        "authenticated": False,
        "message": "Error checking authentication status",
    }
