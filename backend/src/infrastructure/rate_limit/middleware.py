from collections.abc import Callable
from typing import Any, cast

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from ...modules.rate_limit.crud import crud_rate_limits
from ...modules.rate_limit.schemas import RateLimitSelect
from ...modules.tier.crud import crud_tiers
from ...modules.tier.schemas import TierSelect
from ..config import get_settings
from ..database import async_session
from ..database.session import local_session
from ..logging import get_logger
from .exceptions import RateLimitException
from .provider import increment_and_check
from .utils import sanitize_path

logger = get_logger(__name__)

settings = get_settings()
DEFAULT_LIMIT = settings.DEFAULT_RATE_LIMIT_LIMIT
DEFAULT_PERIOD = settings.DEFAULT_RATE_LIMIT_PERIOD


async def get_optional_user(request: Request) -> dict[str, Any] | None:
    """Get the current user from the request, or None if not authenticated.

    This is a simplified version that assumes the user is stored in request.state.user.
    In a real application, you would need to implement proper user extraction from
    authentication tokens.
    """
    if hasattr(request.state, "user"):
        return cast(dict[str, Any], request.state.user)
    return None


def _client_identifier(request: Request) -> str:
    """Return a stable identifier for an anonymous client."""
    if request.client and hasattr(request.client, "host"):
        return request.client.host
    return "unknown"


async def _find_tier_rate_limit(
    db: AsyncSession,
    tier_id: Any,
    sanitized_path: str,
    original_path: str,
) -> dict[str, Any] | None:
    """Find the most specific configured rate limit for a tier and path."""
    rate_limit = await crud_rate_limits.get(
        db=db,
        tier_id=tier_id,
        path=sanitized_path,
        schema_to_select=RateLimitSelect,
    )
    if rate_limit:
        return rate_limit
    return await crud_rate_limits.get(
        db=db,
        tier_id=tier_id,
        path=original_path,
        schema_to_select=RateLimitSelect,
    )


async def _authenticated_rate_policy(
    db: AsyncSession,
    user: dict[str, Any],
    original_path: str,
    sanitized_path: str,
) -> tuple[Any, int, int]:
    """Resolve the policy assigned to an authenticated user's tier."""
    user_id = user["id"]
    tier = await crud_tiers.get(db=db, id=user["tier_id"], schema_to_select=TierSelect)
    if not tier:
        logger.warning(f"User {user_id} has no assigned tier. Applying default rate limit.")
        return user_id, DEFAULT_LIMIT, DEFAULT_PERIOD

    rate_limit = await _find_tier_rate_limit(db, tier["id"], sanitized_path, original_path)
    if rate_limit:
        return user_id, rate_limit["limit"], rate_limit["period"]

    logger.warning(
        f"User {user_id} with tier '{tier['name']}' has no specific rate limit "
        f"for path '{original_path}'. Applying default rate limit."
    )
    return user_id, DEFAULT_LIMIT, DEFAULT_PERIOD


async def _resolve_rate_policy(
    request: Request,
    db: AsyncSession,
    user: dict[str, Any] | None,
    original_path: str,
    sanitized_path: str,
) -> tuple[Any, int, int]:
    """Resolve the client identifier, limit, and period for a request."""
    if user:
        return await _authenticated_rate_policy(db, user, original_path, sanitized_path)
    return _client_identifier(request), DEFAULT_LIMIT, DEFAULT_PERIOD


def _set_rate_limit_headers(request: Request, *, limit: int, period: int, count: int) -> None:
    """Store rate-limit response headers on the request state."""
    request.state.rate_limit_headers = {
        "X-RateLimit-Limit": str(limit),
        "X-RateLimit-Remaining": str(max(0, limit - count)),
        "X-RateLimit-Reset": str(period),
    }


async def _enforce_rate_limit(
    request: Request,
    *,
    user_id: Any,
    sanitized_path: str,
    limit: int,
    period: int,
) -> None:
    """Increment the counter and enforce the configured failure policy."""
    key = f"ratelimit:{user_id}:{sanitized_path}"
    try:
        count, is_limited = await increment_and_check(
            key=key,
            limit=limit,
            period=period,
            fail_open=settings.RATE_LIMITER_FAIL_OPEN,
        )
        _set_rate_limit_headers(request, limit=limit, period=period, count=count)
        if is_limited:
            logger.warning(f"Rate limit exceeded for {user_id} on path {sanitized_path}. Count: {count}, Limit: {limit}")
            raise RateLimitException(f"Rate limit exceeded. Try again in {period} seconds.")
    except RateLimitException:
        raise
    except Exception as error:
        logger.error(f"Error checking rate limit for {user_id} on path {sanitized_path}: {error}")
        if not settings.RATE_LIMITER_FAIL_OPEN:
            logger.warning("Blocking request due to fail-closed policy")
            raise RateLimitException("Error checking rate limit. Access denied as a precaution.") from error


async def _check_rate_limit(request: Request, db: AsyncSession, user: dict[str, Any] | None = None) -> None:
    """Apply the configured rate limit to a request."""
    if not settings.RATE_LIMITER_ENABLED:
        return

    if hasattr(request.app.state, "initialization_complete"):
        await request.app.state.initialization_complete.wait()

    original_path = request.url.path
    sanitized_path = sanitize_path(original_path)
    user_id, limit, period = await _resolve_rate_policy(request, db, user, original_path, sanitized_path)
    await _enforce_rate_limit(
        request,
        user_id=user_id,
        sanitized_path=sanitized_path,
        limit=limit,
        period=period,
    )


async def check_rate_limit(
    request: Request,
    db: AsyncSession = Depends(async_session),
    user: dict[str, Any] | None = Depends(get_optional_user),
) -> None:
    """Check if the current request exceeds rate limits.

    Args:
        request: The current request.
        db: The database session.
        user: The authenticated user, or None if not authenticated.

    Raises:
        RateLimitException: If the rate limit is exceeded.
    """
    await _check_rate_limit(request, db, user)


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """Apply the default per-client rate limit before every request.

    Route dependencies can still request tier-specific policies through
    :func:`check_rate_limit`. Middleware runs before route dependencies, so its
    global safeguard deliberately uses the client IP rather than attempting to
    infer an authenticated user from a session cookie.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process a request through the middleware.

        Args:
            request: The incoming request.
            call_next: The next middleware or handler in the chain.

        Returns:
            The response from the next middleware or handler.
        """
        try:
            async with local_session() as db:
                await _check_rate_limit(request, db)
        except RateLimitException as error:
            response = JSONResponse(
                status_code=error.status_code,
                content={"detail": error.detail},
                headers=error.headers,
            )
        else:
            response = await call_next(request)

        if hasattr(request.state, "rate_limit_headers"):
            for key, value in request.state.rate_limit_headers.items():
                response.headers[key] = value

        return cast(Response, response)
