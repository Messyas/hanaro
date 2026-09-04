"""Persist ingestion retries and worker heartbeats.

Revision ID: 20260904_11
Revises: 20260903_10
Create Date: 2026-09-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260904_11"
down_revision: str | None = "20260903_10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The first production deployment created ``task_id`` outside this
    # migration. Inspecting the schema keeps this rollout safe for that
    # database while still applying normally to fresh installations.
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("scrap_automation_executions")}
    if "task_id" not in columns:
        op.add_column("scrap_automation_executions", sa.Column("task_id", sa.String(length=100), nullable=True))
    if "ingestion_payload" not in columns:
        op.add_column("scrap_automation_executions", sa.Column("ingestion_payload", sa.JSON(), nullable=True))
    if "last_heartbeat_at" not in columns:
        op.add_column(
            "scrap_automation_executions",
            sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        )

    indexes = {index["name"] for index in inspector.get_indexes("scrap_automation_executions")}
    if "ix_scrap_automation_executions_task_id" not in indexes:
        op.create_index("ix_scrap_automation_executions_task_id", "scrap_automation_executions", ["task_id"])


def downgrade() -> None:
    op.drop_index("ix_scrap_automation_executions_task_id", table_name="scrap_automation_executions")
    op.drop_column("scrap_automation_executions", "last_heartbeat_at")
    op.drop_column("scrap_automation_executions", "ingestion_payload")
    op.drop_column("scrap_automation_executions", "task_id")
