"""Add Material Scrap automation execution monitor.

Revision ID: 20260830_05
Revises: 20260827_04
Create Date: 2026-08-30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260830_05"
down_revision: str | None = "20260827_04"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "scrap_automation_executions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("execution_id", sa.Uuid(), nullable=False),
        sa.Column("correlation_id", sa.String(100), nullable=False),
        sa.Column("source_system", sa.String(20), nullable=False),
        sa.Column("report_name", sa.String(120), nullable=False),
        sa.Column("trigger", sa.String(20), nullable=False),
        sa.Column("mode", sa.String(40), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("current_step", sa.String(40), nullable=True),
        sa.Column("organization_parameter", sa.String(80), nullable=False),
        sa.Column("organizations_found", sa.JSON(), nullable=False),
        sa.Column("query_date_from", sa.Date(), nullable=False),
        sa.Column("query_date_to", sa.Date(), nullable=False),
        sa.Column("processing_date", sa.Date(), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False),
        sa.Column("gerp_request_id", sa.String(100), nullable=True),
        sa.Column("source_file_name", sa.String(255), nullable=True),
        sa.Column("source_file_sha256", sa.String(64), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("records_received", sa.Integer(), nullable=False),
        sa.Column("records_accepted", sa.Integer(), nullable=False),
        sa.Column("records_rejected", sa.Integer(), nullable=False),
        sa.Column("snapshot_status", sa.String(30), nullable=False),
        sa.Column("failure_category", sa.String(80), nullable=True),
        sa.Column("failure_code", sa.String(100), nullable=True),
        sa.Column("failure_message", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False),
        sa.Column("ingestion_run_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["ingestion_run_id"], ["scrap_ingestion_runs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("execution_id"),
    )
    op.create_index("ix_scrap_automation_executions_execution_id", "scrap_automation_executions", ["execution_id"])
    op.create_index("ix_scrap_automation_executions_correlation_id", "scrap_automation_executions", ["correlation_id"])
    op.create_index("ix_scrap_automation_executions_status", "scrap_automation_executions", ["status"])
    op.create_index("ix_scrap_automation_executions_gerp_request_id", "scrap_automation_executions", ["gerp_request_id"])
    op.create_index("ix_scrap_automation_executions_failure_category", "scrap_automation_executions", ["failure_category"])
    op.create_index("ix_scrap_automation_executions_ingestion_run_id", "scrap_automation_executions", ["ingestion_run_id"])
    op.create_index("ix_scrap_automation_execution_started", "scrap_automation_executions", ["started_at", "id"])
    op.create_index("ix_scrap_automation_execution_status_started", "scrap_automation_executions", ["status", "started_at"])

    op.create_table(
        "scrap_execution_steps",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("execution_id", sa.Uuid(), nullable=False),
        sa.Column("step_code", sa.String(40), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("attempt", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("message", sa.String(2000), nullable=True),
        sa.Column("error_code", sa.String(100), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["execution_id"], ["scrap_automation_executions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("execution_id", "step_code", "attempt", name="uq_scrap_execution_step_attempt"),
    )
    op.create_index("ix_scrap_execution_steps_execution_id", "scrap_execution_steps", ["execution_id"])
    op.create_index(
        "ix_scrap_execution_step_timeline",
        "scrap_execution_steps",
        ["execution_id", "sequence", "attempt", "started_at"],
    )

    op.create_table(
        "scrap_execution_notifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("execution_id", sa.Uuid(), nullable=False),
        sa.Column("failure_code", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("last_error", sa.String(1000), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["execution_id"], ["scrap_automation_executions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("execution_id", "failure_code", name="uq_scrap_execution_notification"),
    )
    op.create_index("ix_scrap_execution_notifications_execution_id", "scrap_execution_notifications", ["execution_id"])


def downgrade() -> None:
    op.drop_table("scrap_execution_notifications")
    op.drop_table("scrap_execution_steps")
    op.drop_table("scrap_automation_executions")
