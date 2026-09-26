"""Apply pending migrations before starting the local development API."""

from __future__ import annotations

import asyncio
import os

from .database.session import create_tables
from .start_production import _prepare_initial_data, _run_migrations, _start_demo_seed_process


def _has_admin_configuration() -> bool:
    """Return whether local bootstrap credentials were configured explicitly."""
    required = ("ADMIN_NAME", "ADMIN_EMAIL", "ADMIN_USERNAME", "ADMIN_PASSWORD")
    return all(os.getenv(name, "").strip() for name in required)


async def _prepare_development() -> None:
    # A local Docker database may start completely empty.  The historical
    # baseline schema is created first so Alembic can safely reconcile it.
    await create_tables()
    await _run_migrations()
    if _has_admin_configuration():
        await _prepare_initial_data()
    else:
        print("Initial administrator bootstrap skipped: configure ADMIN_* in the root .env to enable it")
    _start_demo_seed_process()


def main() -> None:
    asyncio.run(_prepare_development())
    os.execvp(
        "fastapi",
        ["fastapi", "dev", "src/app/main.py", "--host", "0.0.0.0", "--port", "8000"],
    )


if __name__ == "__main__":
    main()
