"""Auth dependencies: resolve the crudauth ``Principal`` and the dict-compat user.

Routes depend on these; they wrap the crudauth ``auth`` singleton so the session
engine (validation, CSRF, lockout) lives in crudauth while handlers keep their
existing dict/Principal contracts. ``get_current_user`` returns the same user
dict the rest of the app (and the API-key module) already consumes, so the public
contract is unchanged.
"""

from typing import Annotated, Any

from crudauth import Principal
from crudauth.exceptions import ForbiddenException, UnauthorizedException
from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.repository.user.crud import crud_users

from ..database.session import async_session
from .setup import auth

_ADMIN_ALLOWED_API_PREFIXES = (
    "/api/v1/scrap/executions",
    "/api/v1/scrap/manual-ingestions",
    "/api/v1/users/admin/",
)
_ADMIN_ALLOWED_USER_COLLECTION = "/api/v1/users/"


def _assert_admin_scope(user: dict[str, Any], request: Request) -> None:
    """Restrict developer administrators to users, executions and their own profile APIs."""
    if user.get("role") != "admin":
        return

    path = request.url.path
    if path.startswith(_ADMIN_ALLOWED_API_PREFIXES):
        return
    if path == _ADMIN_ALLOWED_USER_COLLECTION and request.method in {"GET", "POST"}:
        return
    if path == "/api/v1/users/me" and request.method == "GET":
        return
    if path == "/api/v1/users/me/profile-image" and request.method in {"GET", "PUT", "DELETE"}:
        return
    if path == f"/api/v1/users/{user['username']}" and request.method == "PATCH":
        return
    raise ForbiddenException("Developer administrators can only access users, executions and their own profile")


def get_current_principal(
    principal: Annotated[Principal, Depends(auth.current_user())],
) -> Principal:
    """The authenticated crudauth ``Principal`` (session-validated, CSRF-enforced).

    A single named dependency so routes that need the session id
    (``principal.metadata["session_id"]``) or the transport can depend on it and
    tests can override it. Raises 401 when there is no valid session.
    """
    return principal


def get_optional_principal(
    principal: Annotated[Principal | None, Depends(auth.current_user(optional=True))],
) -> Principal | None:
    """The crudauth ``Principal`` if authenticated, else ``None`` (never raises on absence).

    Still enforces CSRF on unsafe methods when a session is present.
    """
    return principal


async def get_current_user(
    principal: Annotated[Principal | None, Depends(get_optional_principal)],
    db: Annotated[AsyncSession, Depends(async_session)],
    request: Request,
) -> dict[str, Any]:
    """Get the current authenticated user as a dict (resolved by crudauth).

    crudauth validates the cookie and enforces CSRF on unsafe methods; we re-load
    the full row (filtering soft-deleted users) so the return value stays the dict
    the handlers expect.

    Raises:
        UnauthorizedException: If not authenticated or the user doesn't exist.
    """
    credentials_exception = UnauthorizedException("Not authenticated")

    if principal is None:
        raise credentials_exception

    user = await crud_users.get(db=db, id=principal.user_id, is_deleted=False)

    if user is None:
        raise credentials_exception

    _assert_admin_scope(user, request)
    return user


async def get_optional_user(
    principal: Annotated[Principal | None, Depends(get_optional_principal)],
    db: Annotated[AsyncSession, Depends(async_session)],
    request: Request,
) -> dict[str, Any] | None:
    """Get the current user as a dict if authenticated, None otherwise."""
    if principal is None:
        return None

    user = await crud_users.get(db=db, id=principal.user_id, is_deleted=False)
    if user is not None:
        _assert_admin_scope(user, request)
    return user


def get_current_superuser(
    current_user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    """Get the current user as a dict, requiring superuser privileges (403 otherwise)."""
    if not current_user.get("is_superuser", False):
        raise ForbiddenException("Insufficient privileges")

    return current_user
