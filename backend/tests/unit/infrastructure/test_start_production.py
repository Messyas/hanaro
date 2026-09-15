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
    assert MIGRATION_ORDER["20260904_11"] < max(MIGRATION_ORDER.values())


def test_legacy_schema_detects_the_complete_reports_module() -> None:
    tables = {
        "scrap_ingestion_runs",
        "scrap_ingestion_source_files",
        "scrap_transactions",
        "gov_report_occurrence_sources",
        "gov_report_sources",
        "gov_report_version_sources",
    }
    columns = {
        "gov_reports": {
            "description",
            "status",
            "created_by_user_id",
            "updated_by_user_id",
            "version",
            "updated_at",
            "archived_at",
        }
    }

    assert _legacy_schema_revision(tables, columns) == "20260909_13"


def test_migration_order_includes_profile_repair_head() -> None:
    assert MIGRATION_ORDER["20260911_19"] < MIGRATION_ORDER["20260915_20"]
