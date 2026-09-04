"""Prepare the production database and then replace this process with FastAPI."""

from __future__ import annotations

import asyncio
import os
import subprocess
from pathlib import Path

from scripts.setup_initial_data import setup_initial_data, validate_admin_configuration
from src.infrastructure.database.session import local_session
from src.modules.material_scrap.schemas import MaterialScrapPayload
from src.modules.material_scrap.service import ingest_material_scrap


def _enabled(name: str, default: bool = False) -> bool:
    value = os.getenv(name, str(default)).strip().lower()
    if value in {"1", "true", "yes"}:
        return True
    if value in {"0", "false", "no"}:
        return False
    raise RuntimeError(f"{name} must be true or false")


def _run_migrations() -> None:
    if _enabled("RUN_MIGRATIONS_ON_STARTUP", True):
        migration_environment = os.environ.copy()
        migration_environment["CONFIRM_PRODUCTION_MIGRATION"] = "yes"
        subprocess.run(  # noqa: S603, S607
            ["alembic", "upgrade", "head"],
            check=True,
            env=migration_environment,
        )


async def _prepare_initial_data() -> None:
    if _enabled("BOOTSTRAP_INITIAL_DATA"):
        validate_admin_configuration()
        await setup_initial_data(create_schema=False)

    if _enabled("SEED_DEMO_DATA"):
        seed_path = Path(os.getenv("DEMO_DATA_PATH", "seed/material_scrap_payload_example.json"))
        payload = MaterialScrapPayload.model_validate_json(seed_path.read_text(encoding="utf-8"))
        async with local_session() as session:
            await ingest_material_scrap(payload, session)


def _serve() -> None:
    port = os.getenv("PORT", "8000")
    os.execvp(
        "fastapi",
        ["fastapi", "run", "src/interfaces/main.py", "--host", "0.0.0.0", "--port", port],
    )


def main() -> None:
    _run_migrations()
    asyncio.run(_prepare_initial_data())
    _serve()


if __name__ == "__main__":
    main()
