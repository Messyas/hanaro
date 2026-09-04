"""Prepare the production database and then replace this process with FastAPI."""

from __future__ import annotations

import asyncio
import os
import subprocess
from pathlib import Path

import sqlalchemy as sa

from scripts.setup_initial_data import setup_initial_data, validate_admin_configuration
from src.infrastructure.database.session import engine, local_session
from src.modules.material_scrap.schemas import MaterialScrapPayload
from src.modules.material_scrap.service import ingest_material_scrap

MIGRATION_ORDER = {
    "20260810_01": 1,
    "20260826_02": 2,
    "20260827_03": 3,
    "20260827_04": 4,
}


def _enabled(name: str, default: bool = False) -> bool:
    value = os.getenv(name, str(default)).strip().lower()
    if value in {"1", "true", "yes"}:
        return True
    if value in {"0", "false", "no"}:
        return False
    raise RuntimeError(f"{name} must be true or false")


def _legacy_schema_revision(tables: set[str], columns: dict[str, set[str]]) -> str | None:
    revision_02_tables = {
        "scrap_ingestion_runs",
        "scrap_ingestion_source_files",
        "scrap_transactions",
    }
    if not revision_02_tables <= tables:
        return None
    if {
        "scrap_dashboard_aggregates",
        "scrap_dashboard_state",
        "scrap_targets",
    } <= tables:
        return "20260827_04"
    if (
        "daily_exchange_rates" in tables
        and "exchange_rate_id" in columns.get("scrap_ingestion_runs", set())
        and "content_hash" in columns.get("scrap_transactions", set())
    ):
        return "20260827_03"
    return "20260826_02"


async def _detect_legacy_schema_revision() -> tuple[str | None, str | None]:
    async with engine.connect() as connection:

        def inspect_schema(sync_connection: sa.Connection) -> tuple[set[str], dict[str, set[str]]]:
            inspector = sa.inspect(sync_connection)
            tables = set(inspector.get_table_names())
            columns = {
                table: {column["name"] for column in inspector.get_columns(table)}
                for table in tables & {"scrap_ingestion_runs", "scrap_transactions"}
            }
            return tables, columns

        tables, columns = await connection.run_sync(inspect_schema)
        current_revision = None
        if "alembic_version" in tables:
            result = await connection.execute(sa.text("SELECT version_num FROM alembic_version LIMIT 1"))
            current_revision = result.scalar_one_or_none()
    return current_revision, _legacy_schema_revision(tables, columns)


def _migration_environment() -> dict[str, str]:
    migration_environment = os.environ.copy()
    migration_environment["CONFIRM_PRODUCTION_MIGRATION"] = "yes"
    return migration_environment


async def _run_migrations() -> None:
    if _enabled("RUN_MIGRATIONS_ON_STARTUP", True):
        migration_environment = _migration_environment()
        current_revision, legacy_revision = await _detect_legacy_schema_revision()
        if legacy_revision and MIGRATION_ORDER.get(current_revision or "", 0) < MIGRATION_ORDER[legacy_revision]:
            print(f"Reconciling legacy create_all schema at Alembic revision {legacy_revision}")
            subprocess.run(  # noqa: S603, S607
                ["alembic", "stamp", legacy_revision],
                check=True,
                env=migration_environment,
            )
        subprocess.run(  # noqa: S603, S607
            ["alembic", "upgrade", "head"],
            check=True,
            env=migration_environment,
        )


async def _prepare_initial_data() -> None:
    if _enabled("BOOTSTRAP_INITIAL_DATA", True):
        print("Bootstrapping initial administrator and tier")
        validate_admin_configuration()
        await setup_initial_data(create_schema=False)
    else:
        print("Initial administrator bootstrap is disabled")

    if _enabled("SEED_DEMO_DATA", True):
        print("Loading idempotent demo Material Scrap data")
        seed_path = Path(os.getenv("DEMO_DATA_PATH", "seed/material_scrap_payload_example.json"))
        payload = MaterialScrapPayload.model_validate_json(seed_path.read_text(encoding="utf-8"))
        async with local_session() as session:
            await ingest_material_scrap(payload, session)
    else:
        print("Demo Material Scrap seed is disabled")


def _serve() -> None:
    port = os.getenv("PORT", "8000")
    os.execvp(
        "fastapi",
        ["fastapi", "run", "src/interfaces/main.py", "--host", "0.0.0.0", "--port", port],
    )


async def _prepare_production() -> None:
    await _run_migrations()
    await _prepare_initial_data()


def main() -> None:
    asyncio.run(_prepare_production())
    _serve()


if __name__ == "__main__":
    main()
