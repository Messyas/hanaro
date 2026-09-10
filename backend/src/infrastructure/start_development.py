"""Apply pending migrations before starting the local development API."""

from __future__ import annotations

import asyncio
import os

from .database.session import create_tables
from .start_production import _run_migrations


async def _prepare_development() -> None:
    # A local Docker database may start completely empty.  The historical
    # baseline schema is created first so Alembic can safely reconcile it.
    await create_tables()
    await _run_migrations()


def main() -> None:
    asyncio.run(_prepare_development())
    os.execvp(
        "fastapi",
        ["fastapi", "dev", "src/interfaces/main.py", "--host", "0.0.0.0", "--port", "8000"],
    )


if __name__ == "__main__":
    main()
