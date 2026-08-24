import functools
from collections.abc import Callable
from typing import Any, TypeVar, cast

from fastapi import Request, Response
from fastapi.encoders import jsonable_encoder

from ..logging import get_logger
from .exceptions import CacheException, InvalidRequestError
from .provider import cache_provider
from .utils import format_extra_data, format_prefix, infer_resource_id


class PatternMatchingNotSupportedError(CacheException):
    """Exception raised when pattern-based deletion is not supported by the backend."""

    def __init__(self, pattern: str):
        self.message = f"Pattern-based deletion is not supported. Pattern '{pattern}' cannot be used."
        super().__init__(self.message)


try:
    from .backends.memcached import (
        PatternMatchingNotSupportedError as MemcachedPatternMatchingNotSupportedError,
    )
except (ImportError, AttributeError):
    pass

logger = get_logger()

T = TypeVar("T", bound=Callable[..., Any])


def _get_cache_backend(backend_name: str | None) -> Any | None:
    """Return the configured backend, or disable caching when unavailable."""
    try:
        return cache_provider.get_backend(backend_name)
    except Exception as error:
        logger.warning(f"Cache backend not available: {error}")
        return None


def _resolve_resource_id(
    kwargs: dict[str, Any],
    resource_id_name: Any,
    resource_id_type: type | tuple[type, ...],
) -> tuple[bool, Any]:
    """Resolve the resource identifier without interrupting the endpoint."""
    if resource_id_name:
        return True, kwargs[resource_id_name]
    try:
        return True, infer_resource_id(kwargs=kwargs, resource_id_type=resource_id_type)
    except Exception:
        logger.warning("Could not infer resource ID, skipping cache")
        return False, None


async def _cached_get(
    backend: Any,
    cache_key: str,
    *,
    to_invalidate_extra: dict[str, Any] | None,
    pattern_to_invalidate_extra: list[str] | None,
) -> Any | None:
    """Validate a GET cache policy and return an existing value."""
    if to_invalidate_extra is not None or pattern_to_invalidate_extra is not None:
        raise InvalidRequestError("Cache invalidation not allowed on GET requests")
    return await backend.get(cache_key)


async def _invalidate_extra_keys(
    backend: Any,
    kwargs: dict[str, Any],
    to_invalidate_extra: dict[str, Any] | None,
) -> None:
    """Invalidate explicitly related cache entries."""
    if to_invalidate_extra is None:
        return
    formatted_extra = format_extra_data(to_invalidate_extra, kwargs)
    for prefix, resource_id in formatted_extra.items():
        await backend.delete(f"{prefix}:{resource_id}")


async def _invalidate_patterns(
    backend: Any,
    kwargs: dict[str, Any],
    patterns: list[str] | None,
) -> None:
    """Invalidate supported cache patterns and log unsupported backends."""
    for pattern in patterns or []:
        try:
            await backend.delete_pattern(format_prefix(pattern, kwargs))
        except (
            PatternMatchingNotSupportedError,
            MemcachedPatternMatchingNotSupportedError,
        ) as error:
            logger.error(str(error))


async def _invalidate_after_write(
    backend: Any,
    cache_key: str,
    kwargs: dict[str, Any],
    to_invalidate_extra: dict[str, Any] | None,
    pattern_to_invalidate_extra: list[str] | None,
) -> None:
    """Invalidate the primary and related cache entries after a write."""
    await backend.delete(cache_key)
    await _invalidate_extra_keys(backend, kwargs, to_invalidate_extra)
    await _invalidate_patterns(backend, kwargs, pattern_to_invalidate_extra)


async def _execute_cached_endpoint(
    func: T,
    request: Request,
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
    *,
    key_prefix: str,
    resource_id_name: Any,
    expiration: int,
    resource_id_type: type | tuple[type, ...],
    to_invalidate_extra: dict[str, Any] | None,
    pattern_to_invalidate_extra: list[str] | None,
    backend_name: str | None,
) -> Response:
    """Execute an endpoint with cache lookup, storage, or invalidation."""
    backend = _get_cache_backend(backend_name)
    if backend is None:
        return cast(Response, await func(request, *args, **kwargs))

    resource_found, resource_id = _resolve_resource_id(kwargs, resource_id_name, resource_id_type)
    if not resource_found:
        return cast(Response, await func(request, *args, **kwargs))

    cache_key = f"{format_prefix(key_prefix, kwargs)}:{resource_id}"
    if request.method == "GET":
        cached_data = await _cached_get(
            backend,
            cache_key,
            to_invalidate_extra=to_invalidate_extra,
            pattern_to_invalidate_extra=pattern_to_invalidate_extra,
        )
        if cached_data:
            return cast(Response, cached_data)

    result = await func(request, *args, **kwargs)
    if request.method == "GET":
        await backend.set(cache_key, jsonable_encoder(result), expiration)
    else:
        await _invalidate_after_write(
            backend,
            cache_key,
            kwargs,
            to_invalidate_extra,
            pattern_to_invalidate_extra,
        )
    return cast(Response, result)


def cache(
    key_prefix: str,
    resource_id_name: Any = None,
    expiration: int = 3600,
    resource_id_type: type | tuple[type, ...] = int,
    to_invalidate_extra: dict[str, Any] | None = None,
    pattern_to_invalidate_extra: list[str] | None = None,
    backend_name: str | None = None,
) -> Callable[[T], T]:
    """Cache decorator for FastAPI endpoints.

    Args:
        key_prefix: A unique prefix to identify the cache key.
        resource_id_name: The name of the resource ID argument. If None, it will be inferred.
        expiration: The expiration time for the cached data in seconds. Default is 3600 (1 hour).
        resource_id_type: The expected type of the resource ID. Default is int.
        to_invalidate_extra: Additional cache keys to invalidate.
        pattern_to_invalidate_extra: Patterns for additional cache keys to invalidate.
        backend_name: The name of the cache backend to use. If None, the default is used.

    Returns:
        A decorator function for FastAPI endpoint functions.

    Example:
        @app.get("/users/{user_id}")
        @cache(key_prefix="user", resource_id_name="user_id", expiration=600)
        async def get_user(request: Request, user_id: int):
            # Your logic here
            return {"id": user_id, "name": "John Doe"}
    """

    def wrapper(func: T) -> T:
        @functools.wraps(func)
        async def inner(request: Request, *args: Any, **kwargs: Any) -> Response:
            return await _execute_cached_endpoint(
                func,
                request,
                args,
                kwargs,
                key_prefix=key_prefix,
                resource_id_name=resource_id_name,
                expiration=expiration,
                resource_id_type=resource_id_type,
                to_invalidate_extra=to_invalidate_extra,
                pattern_to_invalidate_extra=pattern_to_invalidate_extra,
                backend_name=backend_name,
            )

        return cast(T, inner)

    return wrapper
