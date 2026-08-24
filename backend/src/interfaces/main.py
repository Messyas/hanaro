from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response, status
from sqlalchemy import text
from starlette.middleware.sessions import SessionMiddleware

from ..infrastructure.app_factory import create_application, lifespan_factory
from ..infrastructure.cache import cache_provider
from ..infrastructure.config.settings import get_settings
from ..infrastructure.database.session import engine
from ..infrastructure.logging import get_logger
from ..infrastructure.security import validate_production_security
from ..interfaces.api import router
from .admin.initialize import create_admin_interface

settings = get_settings()
logger = get_logger()


@asynccontextmanager
async def lifespan_with_security(app: FastAPI) -> AsyncGenerator[None, None]:
    """Custom lifespan that includes security validation."""
    if settings.PRODUCTION_SECURITY_VALIDATION_ENABLED:
        validate_production_security(settings)

    default_lifespan = lifespan_factory(settings)

    async with default_lifespan(app):
        yield


app = create_application(
    router=router,
    settings=settings,
    lifespan=lifespan_with_security,
    create_tables_on_startup=None,
    enable_cors=None,
    cors_origins=None,
    enable_docs_in_production=None,
    docs_production_dependency=None,
    enable_gzip=None,
    openapi_prefix=None,
    title="FastAPI Boilerplate",
    summary="A modular FastAPI starter with a plugin system",
    description="""
    # FastAPI Boilerplate

    A modern FastAPI starter with:

    * Vertical-slice modules and a clean infrastructure layer
    * Session-based auth with OAuth providers
    * Swappable cache, queue, and rate-limit backends
    * SQLAdmin admin UI
    """,
    version="0.19.0",
    contact={
        "name": "Benav Labs",
        "url": "https://github.com/benavlabs/FastAPI-boilerplate",
        "email": "contact@benav.io",
    },
    license_info={
        "name": "MIT",
        "identifier": "MIT",
    },
    openapi_tags=None,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SECRET_KEY,
    same_site="lax",
    https_only=settings.SESSION_SECURE_COOKIES,
)
create_admin_interface(app)


@app.get("/health/live", tags=["System"])
async def liveness_check() -> dict[str, str]:
    """Confirm that the API process can receive requests."""
    return {"status": "healthy"}


@app.get("/health", tags=["System"])
async def readiness_check(response: Response) -> dict[str, str]:
    """Confirm that required database and cache dependencies are available."""
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))

        if settings.CACHE_ENABLED:
            cache_results = await cache_provider.ping_all()
            if not cache_results or not all(cache_results.values()):
                raise RuntimeError("Cache readiness check failed")
    except Exception:
        logger.exception("Readiness check failed")
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "unavailable"}

    return {"status": "healthy"}
