import pytest

from src.infrastructure.start_production import MIGRATION_ORDER, _legacy_schema_revision


@pytest.mark.unit
def test_retry_columns_identify_latest_legacy_revision() -> None:
    tables = {
        "scrap_ingestion_runs",
        "scrap_ingestion_source_files",
        "scrap_transactions",
        "scrap_automation_executions",
        "scrap_classification_rules",
    }
    columns = {
        "scrap_automation_executions": {
            "task_id",
            "ingestion_payload",
            "last_heartbeat_at",
        }
    }

    assert _legacy_schema_revision(tables, columns) == "20260904_11"
    assert MIGRATION_ORDER["20260904_11"] == max(MIGRATION_ORDER.values())
