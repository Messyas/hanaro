import asyncio
import logging
import os
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.append(str(backend_dir))

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

REQUIRED_ADMIN_VARIABLES = (
    "ADMIN_NAME",
    "ADMIN_EMAIL",
    "ADMIN_USERNAME",
    "ADMIN_PASSWORD",
)


def validate_admin_configuration() -> None:
    """Fail before loading the application when setup credentials are absent."""
    missing = [name for name in REQUIRED_ADMIN_VARIABLES if not os.getenv(name, "").strip()]
    if missing:
        joined = ", ".join(missing)
        raise RuntimeError(
            f"Missing required admin configuration: {joined}. Set the values in the root .env file and run the command again."
        )


async def setup_initial_data(*, create_schema: bool = True) -> None:
    """Create the database schema, default tier and configured administrator."""
    validate_admin_configuration()
    logger.info("Admin configuration found. Loading backend modules...")

    # Imports are intentionally deferred until after the inexpensive validation.
    # A missing .env now produces an immediate, actionable error instead of making
    # the user wait for the complete FastAPI/SQLAlchemy dependency graph to load.
    from scripts.create_first_superuser import create_first_superuser  # noqa: PLC0415
    from scripts.create_first_tier import create_first_tier  # noqa: PLC0415
    from src.infrastructure.database.session import create_tables  # noqa: PLC0415

    logger.info("Setting up initial data...")

    if create_schema:
        logger.info("Creating database tables...")
        await create_tables()
        logger.info("Database tables created successfully")

    logger.info("Creating first tier...")
    await create_first_tier()

    logger.info("Creating superuser...")
    await create_first_superuser()

    logger.info("Initial data setup complete")


if __name__ == "__main__":
    try:
        asyncio.run(setup_initial_data())
    except Exception as error:
        logger.critical("Initial data setup failed: %s", error)
        raise SystemExit(1) from error
