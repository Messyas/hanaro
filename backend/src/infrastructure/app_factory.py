import json
import logging
from asyncio import Event
from collections.abc import AsyncGenerator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from typing import Any, cast

import anyio
import fastapi
from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from starlette.middleware.trustedhost import TrustedHostMiddleware

from ..modules.common.utils.error_handler import register_exception_handlers
from .auth.dependencies import get_current_superuser
from .auth.setup import auth
from .cache.initialize import close_cache, initialize_cache
from .config.settings import (
    CacheSettings,
    DatabaseSettings,
    EnvironmentOption,
    EnvironmentSettings,
    RateLimiterSettings,
    Settings,
    get_settings,
)
from .database.session import create_tables
from .middleware import ClientCacheMiddleware, SecurityHeadersMiddleware
from .rate_limit.initialize import close_rate_limiter, initialize_rate_limiter
from .rate_limit.middleware import RateLimiterMiddleware

logger = logging.getLogger(__name__)

OPENAPI_PATH = "/openapi.json"


def _validate_cors_configuration(
    origins: list[str],
    methods: list[str],
    headers: list[str],
    *,
    allow_credentials: bool,
) -> None:
    """Reject wildcard CORS policies when browser credentials are enabled."""
    if allow_credentials and any("*" in values for values in (origins, methods, headers)):
        raise ValueError(
            "Credentialed CORS requires explicit origins, methods, and headers. "
            "Use the same-origin proxy or replace every wildcard with an allowlist."
        )


async def set_threadpool_tokens(number_of_tokens: int = 100) -> None:
    """Configure the number of threadpool tokens for anyio."""
    limiter = anyio.to_thread.current_default_thread_limiter()
    limiter.total_tokens = number_of_tokens


def lifespan_factory(
    settings: Settings,
    create_tables_on_startup: bool = True,
) -> Callable[[FastAPI], AbstractAsyncContextManager[None]]:
    """Factory to create a lifespan async context manager for a FastAPI app."""

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
        initialization_complete = Event()
        app.state.initialization_complete = initialization_complete

        await set_threadpool_tokens()

        try:
            if isinstance(settings, DatabaseSettings) and create_tables_on_startup:
                await create_tables()

            if isinstance(settings, CacheSettings) and settings.CACHE_ENABLED:
                await initialize_cache()

            if isinstance(settings, RateLimiterSettings) and settings.RATE_LIMITER_ENABLED:
                await initialize_rate_limiter()

            await auth.initialize()

            initialization_complete.set()

            yield

        finally:
            await auth.shutdown()

            if isinstance(settings, CacheSettings) and settings.CACHE_ENABLED:
                await close_cache()

            if isinstance(settings, RateLimiterSettings) and settings.RATE_LIMITER_ENABLED:
                await close_rate_limiter()

    return lifespan


def _setting_option(explicit_value: Any, settings: Settings, setting_name: str, default: Any) -> Any:
    """Return an explicit option or its configured fallback."""
    if explicit_value is not None:
        return explicit_value
    return getattr(settings, setting_name, default)


def _first_configured_value(settings: Settings, *setting_names: str) -> Any:
    """Return the first non-empty configured value."""
    for setting_name in setting_names:
        value = getattr(settings, setting_name, None)
        if value:
            return value
    return None


def _build_contact_metadata(settings: Settings) -> dict[str, str]:
    """Build OpenAPI contact metadata from settings."""
    contact = {
        "name": _first_configured_value(settings, "API_CONTACT_NAME", "CONTACT_NAME"),
        "email": _first_configured_value(settings, "API_CONTACT_EMAIL", "CONTACT_EMAIL"),
        "url": _first_configured_value(settings, "API_CONTACT_URL"),
    }
    return {key: value for key, value in contact.items() if value}


def _build_license_metadata(settings: Settings) -> dict[str, str]:
    """Build OpenAPI license metadata from settings."""
    license_metadata = {
        "name": _first_configured_value(settings, "API_LICENSE_NAME", "LICENSE_NAME"),
        "url": _first_configured_value(settings, "API_LICENSE_URL"),
        "identifier": _first_configured_value(settings, "API_LICENSE_IDENTIFIER"),
    }
    return {key: value for key, value in license_metadata.items() if value}


def _configured_openapi_tags(settings: Settings) -> list[dict[str, Any]] | None:
    """Parse configured OpenAPI tag metadata when valid."""
    raw_tags = getattr(settings, "API_TAGS_METADATA", None)
    if not raw_tags:
        return None
    try:
        parsed_tags = json.loads(raw_tags)
    except json.JSONDecodeError:
        return None

    if not isinstance(parsed_tags, list) or not all(
        isinstance(tag, dict) and all(isinstance(key, str) for key in tag) for tag in parsed_tags
    ):
        return None

    return cast(list[dict[str, Any]], parsed_tags)


def _build_application_metadata(
    settings: Settings,
    *,
    openapi_prefix: str | None,
    title: str | None,
    summary: str | None,
    description: str | None,
    version: str | None,
    terms_of_service: str | None,
    contact: dict[str, str] | None,
    license_info: dict[str, str] | None,
    openapi_tags: list[dict[str, Any]] | None,
    docs_url: str | None,
    redoc_url: str | None,
    openapi_url: str | None,
) -> dict[str, Any]:
    """Resolve FastAPI metadata from explicit values and application settings."""
    metadata: dict[str, Any] = {
        "openapi_prefix": _setting_option(openapi_prefix, settings, "OPENAPI_PREFIX", ""),
        "docs_url": _setting_option(docs_url, settings, "DOCS_URL", "/docs"),
        "redoc_url": _setting_option(redoc_url, settings, "REDOC_URL", "/redoc"),
        "openapi_url": _setting_option(openapi_url, settings, "OPENAPI_URL", OPENAPI_PATH),
    }
    optional_metadata = {
        "title": title if title is not None else _first_configured_value(settings, "API_TITLE", "APP_NAME"),
        "summary": summary if summary is not None else _first_configured_value(settings, "API_SUMMARY"),
        "description": description
        if description is not None
        else _first_configured_value(settings, "API_DESCRIPTION", "APP_DESCRIPTION"),
        "version": version if version is not None else _first_configured_value(settings, "API_VERSION", "VERSION"),
        "terms_of_service": terms_of_service
        if terms_of_service is not None
        else _first_configured_value(settings, "API_TERMS_OF_SERVICE"),
        "contact": contact if contact is not None else _build_contact_metadata(settings),
        "license_info": license_info if license_info is not None else _build_license_metadata(settings),
        "openapi_tags": openapi_tags if openapi_tags is not None else _configured_openapi_tags(settings),
    }
    metadata.update({key: value for key, value in optional_metadata.items() if value is not None})
    return metadata


def _add_standard_middleware(application: FastAPI, settings: Settings, *, enable_gzip: bool) -> None:
    """Register rate limiting, caching, compression, and security middleware."""
    if isinstance(settings, RateLimiterSettings) and settings.RATE_LIMITER_ENABLED:
        application.add_middleware(RateLimiterMiddleware)

    client_cache_enabled = (
        isinstance(settings, CacheSettings) and settings.CACHE_ENABLED and getattr(settings, "CLIENT_CACHE_ENABLED", False)
    )
    if client_cache_enabled:
        application.add_middleware(
            ClientCacheMiddleware,
            max_age=getattr(settings, "CLIENT_CACHE_MAX_AGE", 60),
        )

    if enable_gzip:
        application.add_middleware(GZipMiddleware, minimum_size=getattr(settings, "GZIP_MINIMUM_SIZE", 1000))

    if getattr(settings, "SECURITY_HEADERS_ENABLED", True):
        environment = getattr(
            getattr(settings, "ENVIRONMENT", EnvironmentOption.DEVELOPMENT),
            "value",
            EnvironmentOption.DEVELOPMENT.value,
        )
        application.add_middleware(SecurityHeadersMiddleware, environment=environment)

    trusted_hosts = getattr(
        settings,
        "TRUSTED_HOSTS_LIST",
        ["localhost", "127.0.0.1", "testserver", "backend"],
    )
    if trusted_hosts:
        application.add_middleware(TrustedHostMiddleware, allowed_hosts=trusted_hosts, www_redirect=False)


def _cors_settings(settings: Settings, origins: list[str]) -> dict[str, Any]:
    """Build and validate CORS middleware options."""
    methods = getattr(settings, "CORS_ALLOW_METHODS", ["*"])
    headers = getattr(settings, "CORS_ALLOW_HEADERS", ["*"])
    cors_settings: dict[str, Any] = {
        "allow_origins": origins,
        "allow_credentials": getattr(settings, "CORS_ALLOW_CREDENTIALS", True),
        "allow_methods": (
            [method.strip() for method in methods.split(",") if method.strip()] if isinstance(methods, str) else methods
        ),
        "allow_headers": (
            [header.strip() for header in headers.split(",") if header.strip()] if isinstance(headers, str) else headers
        ),
    }
    _validate_cors_configuration(
        cors_settings["allow_origins"],
        cors_settings["allow_methods"],
        cors_settings["allow_headers"],
        allow_credentials=cors_settings["allow_credentials"],
    )
    return cors_settings


def _documentation_dependency(
    settings: Settings,
    enable_docs_in_production: bool,
    docs_production_dependency: Callable[..., Any] | None,
) -> Callable[..., Any] | None:
    """Resolve authentication required by custom documentation routes."""
    if settings.ENVIRONMENT == EnvironmentOption.LOCAL:
        return None
    if settings.ENVIRONMENT == EnvironmentOption.PRODUCTION:
        if not enable_docs_in_production:
            return None
        return docs_production_dependency or get_current_superuser
    return get_current_superuser


def _include_documentation_routes(
    application: FastAPI,
    settings: Settings,
    metadata: dict[str, Any],
    *,
    enable_docs_in_production: bool,
    docs_production_dependency: Callable[..., Any] | None,
) -> None:
    """Register custom documentation routes when enabled for the environment."""
    show_docs = isinstance(settings, EnvironmentSettings) and (
        settings.ENVIRONMENT != EnvironmentOption.PRODUCTION or enable_docs_in_production
    )
    if not show_docs:
        return

    dependency = _documentation_dependency(settings, enable_docs_in_production, docs_production_dependency)
    docs_router = APIRouter(dependencies=[Depends(dependency)] if dependency is not None else [])

    @docs_router.get("/docs", include_in_schema=False)
    async def get_swagger_documentation() -> fastapi.responses.HTMLResponse:
        return get_swagger_ui_html(openapi_url=OPENAPI_PATH, title="docs")

    @docs_router.get("/redoc", include_in_schema=False)
    async def get_redoc_documentation() -> fastapi.responses.HTMLResponse:
        return get_redoc_html(openapi_url=OPENAPI_PATH, title="redoc")

    @docs_router.get(OPENAPI_PATH, include_in_schema=False)
    async def openapi() -> dict[str, Any]:
        return get_openapi(
            title=metadata.get("title", "API"),
            version=metadata.get("version", "0.1.0"),
            description=metadata.get("description", ""),
            routes=application.routes,
        )

    application.include_router(docs_router)


def create_application(
    router: APIRouter,
    settings: Settings | None = None,
    lifespan: Callable[[FastAPI], AbstractAsyncContextManager[None]] | None = None,
    create_tables_on_startup: bool | None = None,
    enable_cors: bool | None = None,
    cors_origins: list[str] | None = None,
    enable_docs_in_production: bool | None = None,
    docs_production_dependency: Callable[..., Any] | None = None,
    enable_gzip: bool | None = None,
    openapi_prefix: str | None = None,
    title: str | None = None,
    summary: str | None = None,
    description: str | None = None,
    version: str | None = None,
    terms_of_service: str | None = None,
    contact: dict[str, str] | None = None,
    license_info: dict[str, str] | None = None,
    openapi_tags: list[dict[str, Any]] | None = None,
    docs_url: str | None = None,
    redoc_url: str | None = None,
    openapi_url: str | None = None,
    **kwargs: Any,
) -> FastAPI:
    """Create and configure a FastAPI application."""
    settings = settings or get_settings()
    create_tables = _setting_option(create_tables_on_startup, settings, "CREATE_TABLES_ON_STARTUP", True)
    cors_enabled = _setting_option(enable_cors, settings, "CORS_ENABLED", False)
    configured_origins = _setting_option(cors_origins, settings, "CORS_ORIGINS_LIST", [])
    production_docs_enabled = _setting_option(
        enable_docs_in_production,
        settings,
        "ENABLE_DOCS_IN_PRODUCTION",
        False,
    )
    gzip_enabled = _setting_option(enable_gzip, settings, "GZIP_ENABLED", True)

    metadata = _build_application_metadata(
        settings,
        openapi_prefix=openapi_prefix,
        title=title,
        summary=summary,
        description=description,
        version=version,
        terms_of_service=terms_of_service,
        contact=contact,
        license_info=license_info,
        openapi_tags=openapi_tags,
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url,
    )
    app_options = {**kwargs, **metadata}
    hide_docs = (
        isinstance(settings, EnvironmentSettings)
        and settings.ENVIRONMENT == EnvironmentOption.PRODUCTION
        and not production_docs_enabled
    )
    if hide_docs:
        app_options.update({"docs_url": None, "redoc_url": None, "openapi_url": None})

    application = FastAPI(
        lifespan=lifespan or lifespan_factory(settings, create_tables_on_startup=create_tables),
        **app_options,
    )
    register_exception_handlers(application)
    application.include_router(router)
    _add_standard_middleware(application, settings, enable_gzip=gzip_enabled)
    _include_documentation_routes(
        application,
        settings,
        metadata,
        enable_docs_in_production=production_docs_enabled,
        docs_production_dependency=docs_production_dependency,
    )

    # Starlette applies the most recently registered middleware first. Keep CORS
    # outermost so it adds headers to responses produced by every middleware.
    if cors_enabled:
        application.add_middleware(CORSMiddleware, **_cors_settings(settings, configured_origins))
    return application
