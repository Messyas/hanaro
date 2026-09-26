"""Module for initializing the rate limiter backends."""

import importlib.util

from ..config import CacheBackend, get_settings
from .provider import rate_limiter_provider

MEMCACHED_INSTALLED = importlib.util.find_spec("aiomcache") is not None
REDIS_INSTALLED = importlib.util.find_spec("redis") is not None
MemcachedBackend: type | None
MemcachedSettings: type | None
RedisBackend: type | None
RedisSettings: type | None

if MEMCACHED_INSTALLED:
    from .backends import MemcachedBackend as _MemcachedBackend
    from .backends import MemcachedSettings as _MemcachedSettings

    MemcachedBackend = _MemcachedBackend
    MemcachedSettings = _MemcachedSettings
else:
    MemcachedBackend = None
    MemcachedSettings = None

if REDIS_INSTALLED:
    from .backends import RedisBackend as _RedisBackend
    from .backends import RedisSettings as _RedisSettings

    RedisBackend = _RedisBackend
    RedisSettings = _RedisSettings
else:
    RedisBackend = None
    RedisSettings = None


def initialize_rate_limiter() -> None:
    """Initialize the rate limiter backends.

    This function initializes the rate limiter backends based on the application settings.
    It is called during application startup.
    """
    settings = get_settings()

    if not settings.RATE_LIMITER_ENABLED:
        return

    if settings.RATE_LIMITER_BACKEND == CacheBackend.MEMCACHED.value:
        if not MEMCACHED_INSTALLED or MemcachedSettings is None or MemcachedBackend is None:
            raise ImportError("The aiomcache package is not installed. Please install it with 'pip install aiomcache'.")

        memcached_settings = MemcachedSettings(
            host=settings.RATE_LIMITER_MEMCACHED_HOST,
            port=settings.RATE_LIMITER_MEMCACHED_PORT,
            pool_size=settings.RATE_LIMITER_MEMCACHED_POOL_SIZE,
        )
        memcached_backend = MemcachedBackend(settings=memcached_settings, fail_open=settings.RATE_LIMITER_FAIL_OPEN)
        rate_limiter_provider.register_backend(CacheBackend.MEMCACHED.value, memcached_backend, default=True)

    elif settings.RATE_LIMITER_BACKEND == CacheBackend.REDIS.value:
        if not REDIS_INSTALLED or RedisSettings is None or RedisBackend is None:
            raise ImportError("The redis package is not installed. Please install it with 'pip install redis'.")

        redis_settings = RedisSettings(
            url=settings.REDIS_URL or settings.RATE_LIMITER_REDIS_URL or None,
            host=settings.RATE_LIMITER_REDIS_HOST,
            port=settings.RATE_LIMITER_REDIS_PORT,
            db=settings.RATE_LIMITER_REDIS_DB,
            password=settings.RATE_LIMITER_REDIS_PASSWORD,
            connect_timeout=settings.RATE_LIMITER_REDIS_CONNECT_TIMEOUT,
            pool_size=settings.RATE_LIMITER_REDIS_POOL_SIZE,
        )
        redis_backend = RedisBackend(settings=redis_settings, fail_open=settings.RATE_LIMITER_FAIL_OPEN)
        rate_limiter_provider.register_backend(CacheBackend.REDIS.value, redis_backend, default=True)


async def close_rate_limiter() -> None:
    """Close all rate limiter connections.

    This function should be called during application shutdown to clean up resources.
    """
    settings = get_settings()

    if not settings.RATE_LIMITER_ENABLED:
        return

    if settings.RATE_LIMITER_BACKEND == CacheBackend.MEMCACHED.value and MEMCACHED_INSTALLED:
        backend = rate_limiter_provider.get_backend(CacheBackend.MEMCACHED.value)
        client = getattr(backend, "client", None)
        if client is not None and hasattr(client, "close"):
            await client.close()

    elif settings.RATE_LIMITER_BACKEND == CacheBackend.REDIS.value and REDIS_INSTALLED:
        backend = rate_limiter_provider.get_backend(CacheBackend.REDIS.value)
        client = getattr(backend, "client", None)
        if client is not None and hasattr(client, "close"):
            await client.close()
