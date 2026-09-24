"""Prepare the production database and then replace this process with FastAPI."""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

import sqlalchemy as sa

from scripts.seed_demo_classifications import seed_demo_classifications
from scripts.seed_demo_governance import seed_demo_governance
from scripts.seed_relative_efficiency import run_seed as seed_relative_efficiency
from scripts.setup_initial_data import setup_initial_data, validate_admin_configuration
from src.infrastructure.database.session import engine, local_session
from src.modules.material_scrap.classification_service import ScrapClassificationService
from src.modules.material_scrap.schemas import MaterialScrapPayload
from src.modules.material_scrap.service import ingest_material_scrap

MIGRATION_ORDER = {
    "20260810_01": 1,
    "20260826_02": 2,
    "20260827_03": 3,
    "20260827_04": 4,
    "20260830_05": 5,
    "20260830_06": 6,
    "20260831_07": 7,
    "20260901_08": 8,
    "20260902_09": 9,
    "20260903_10": 10,
    "20260904_11": 11,
    "20260906_12": 12,
    "20260909_13": 13,
    "20260909_14": 14,
    "20260910_15": 15,
    "20260911_16": 16,
    "20260911_17": 17,
    "20260911_18": 18,
    "20260911_19": 19,
    "20260915_20": 20,
    "20260918_21": 21,
    "20260919_21": 22,
    "20260919_22": 23,
    "20260919_23": 24,
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
    reports_module_tables = {
        "gov_report_occurrence_sources",
        "gov_report_sources",
        "gov_report_version_sources",
    }
    reports_module_columns = {
        "description",
        "status",
        "created_by_user_id",
        "updated_by_user_id",
        "version",
        "updated_at",
        "archived_at",
    }
    if reports_module_tables <= tables and reports_module_columns <= columns.get("gov_reports", set()):
        return "20260909_13"
    automation_columns = columns.get("scrap_automation_executions", set())
    if (
        "scrap_classification_rules" in tables
        and {
            "task_id",
            "ingestion_payload",
            "last_heartbeat_at",
        }
        <= automation_columns
    ):
        return "20260904_11"
    if "scrap_classification_rules" in tables:
        return "20260903_10"
    if "scrap_review_templates" in tables:
        return "20260902_09"
    if {
        "scrap_defect_types",
        "scrap_reviews",
        "scrap_review_attachments",
        "scrap_review_bulk_operations",
    } <= tables:
        return "20260901_08"
    if {
        "scrap_occurrences",
        "scrap_occurrence_observations",
        "scrap_reconciliation_partitions",
    } <= tables:
        return "20260831_07"
    if {
        "scrap_automation_executions",
        "scrap_execution_steps",
        "scrap_execution_notifications",
    } <= tables:
        return "20260830_05"
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
                for table in tables
                & {
                    "scrap_ingestion_runs",
                    "scrap_transactions",
                    "scrap_automation_executions",
                    "gov_reports",
                }
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


async def seed_demo_data() -> None:
    """Load the optional demo history after the web process is available."""
    if _enabled("SEED_DEMO_DATA", True):
        seed_path = Path(os.getenv("DEMO_DATA_PATH", "seed/synthetic"))
        payloads = _load_demo_payloads(seed_path)
        print(f"Loading {len(payloads)} idempotent demo Material Scrap batch(es) from {seed_path}")
        classification_count = await seed_demo_classifications()
        print(f"Loaded {classification_count} demo classification rule(s)")
        async with local_session() as session:
            # Existing snapshots may have been ingested before the rules were
            # present. Reapply once so their dashboard dimensions are rebuilt.
            await ScrapClassificationService().reapply(session)
            for payload in payloads:
                result = await ingest_material_scrap(payload, session)
                replay = " (already loaded)" if result.is_replay else ""
                print(
                    f"Loaded {result.accepted_count} Material Scrap records "
                    f"for {payload.execution.query_date_from}..{payload.execution.query_date_to}{replay}"
                )
        governance_counts = await seed_demo_governance()
        print(f"Loaded governance demo records: {governance_counts}")
        reference_year = date.fromisoformat(os.getenv("DEMO_DATA_REFERENCE_DATE", "2026-09-03")).year
        production_counts = await seed_relative_efficiency(
            year=reference_year,
            reference_year=reference_year - 1,
            currency="USD",
            replace=False,
        )
        print(f"Loaded relative-efficiency production denominators: {production_counts}")
    else:
        print("Demo Material Scrap seed is disabled")


def _start_demo_seed_process() -> None:
    if not _enabled("SEED_DEMO_DATA", True):
        return
    print("Starting demo Material Scrap seed in the background")
    subprocess.Popen(  # noqa: S603
        [sys.executable, "-m", "src.infrastructure.seed_demo"],
        close_fds=True,
    )


def _load_demo_payloads(seed_path: Path) -> list[MaterialScrapPayload]:
    """Load one canonical JSON seed or build batches from synthetic GERP files."""
    if seed_path.is_file():
        return [MaterialScrapPayload.model_validate_json(seed_path.read_text(encoding="utf-8"))]
    if not seed_path.is_dir():
        raise FileNotFoundError(f"Demo data path does not exist: {seed_path}")

    source_files = sorted(path for path in seed_path.iterdir() if path.is_file())
    if not source_files:
        raise RuntimeError(f"Demo data directory is empty: {seed_path}")

    # Import the automation pipeline only for raw multi-file seeds. This keeps
    # the canonical JSON path usable by maintenance commands and small tests.
    from automation.material_scrap.builder import build_canonical_batch  # noqa: PLC0415
    from automation.material_scrap.exchange import ManualExchangeRateProvider  # noqa: PLC0415
    from automation.material_scrap.source import RunContext  # noqa: PLC0415

    reference_date = date.fromisoformat(os.getenv("DEMO_DATA_REFERENCE_DATE", "2026-09-03"))
    exchange_rate = Decimal(os.getenv("DEMO_DATA_EXCHANGE_RATE", "5.15"))
    rate_source = os.getenv("DEMO_DATA_EXCHANGE_RATE_SOURCE", "synthetic_seed")
    payloads: list[MaterialScrapPayload] = []
    for source_file in source_files:
        batch = build_canonical_batch(
            source_file,
            RunContext(reference_date=reference_date, organization_parameter="ALL"),
            ManualExchangeRateProvider(rate=exchange_rate, source=rate_source),
            mode="LOCAL_FILE_SIMULATION",
        )
        payloads.append(MaterialScrapPayload.model_validate_json(batch.model_dump_json()))
    return payloads


def _serve() -> None:
    port = os.getenv("PORT", "8000")
    os.execvp(
        "fastapi",
        ["fastapi", "run", "src/interfaces/main.py", "--host", "0.0.0.0", "--port", port],
    )


async def _prepare_production() -> None:
    await _run_migrations()
    await _prepare_initial_data()
    _start_demo_seed_process()


def main() -> None:
    asyncio.run(_prepare_production())
    _serve()


if __name__ == "__main__":
    main()
