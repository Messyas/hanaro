"""Add versioned Material Scrap ingestion snapshots.

Revision ID: 20260826_02
Revises: 20260810_01
Create Date: 2026-08-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260826_02"
down_revision: str | None = "20260810_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "scrap_ingestion_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("execution_id", sa.Uuid(), nullable=False),
        sa.Column("report_name", sa.String(length=80), nullable=False),
        sa.Column("organization_scope", sa.String(length=80), nullable=False),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("schema_version", sa.String(length=20), nullable=False),
        sa.Column("source_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_finished_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ingestion_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ingestion_finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("accepted_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("rejected_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scrap_ingestion_runs_execution_id", "scrap_ingestion_runs", ["execution_id"], unique=True)
    op.create_index("ix_scrap_ingestion_runs_status", "scrap_ingestion_runs", ["status"])
    op.create_index(
        "ix_scrap_ingestion_active_window",
        "scrap_ingestion_runs",
        ["report_name", "organization_scope", "date_from", "date_to", "is_active"],
    )
    op.create_index(
        "uq_scrap_ingestion_one_active_window",
        "scrap_ingestion_runs",
        ["report_name", "organization_scope", "date_from", "date_to"],
        unique=True,
        postgresql_where=sa.text("is_active"),
    )
    op.create_index(
        "ix_scrap_ingestion_status_finished",
        "scrap_ingestion_runs",
        ["status", "ingestion_finished_at"],
    )

    op.create_table(
        "scrap_ingestion_source_files",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("encoding", sa.String(length=30), nullable=False),
        sa.Column("delimiter", sa.String(length=20), nullable=False),
        sa.Column("reconstructed_rows", sa.Integer(), server_default="0", nullable=False),
        sa.Column("request_id", sa.String(length=100), nullable=True),
        sa.Column("extracted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["run_id"], ["scrap_ingestion_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", name="uq_scrap_source_file_run"),
    )
    op.create_index("ix_scrap_ingestion_source_files_run_id", "scrap_ingestion_source_files", ["run_id"])
    op.create_index("ix_scrap_source_sha256", "scrap_ingestion_source_files", ["sha256"])

    op.create_table(
        "scrap_exchange_rates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("base_currency", sa.String(length=3), nullable=False),
        sa.Column("quote_currency", sa.String(length=3), nullable=False),
        sa.Column("brl_per_usd", sa.Numeric(12, 6), nullable=False),
        sa.Column("source", sa.String(length=80), nullable=False),
        sa.Column("requested_date", sa.Date(), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("fallback_used", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["scrap_ingestion_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", name="uq_scrap_exchange_rate_run"),
    )
    op.create_index("ix_scrap_exchange_rates_run_id", "scrap_exchange_rates", ["run_id"])

    op.create_table(
        "scrap_transactions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("source_row_number", sa.Integer(), nullable=False),
        sa.Column("organization_code", sa.String(length=40), nullable=False),
        sa.Column("account_code", sa.String(length=80), nullable=True),
        sa.Column("account_description", sa.Text(), nullable=True),
        sa.Column("account_alias", sa.String(length=100), nullable=True),
        sa.Column("subinventory_group", sa.String(length=100), nullable=True),
        sa.Column("subinventory", sa.String(length=100), nullable=True),
        sa.Column("warehouse_market", sa.String(length=100), nullable=True),
        sa.Column("receipt_department", sa.String(length=120), nullable=True),
        sa.Column("receipt_description", sa.Text(), nullable=True),
        sa.Column("item_code", sa.String(length=100), nullable=True),
        sa.Column("uit", sa.String(length=100), nullable=True),
        sa.Column("item_description", sa.Text(), nullable=True),
        sa.Column("item_specification", sa.Text(), nullable=True),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("issue_quantity", sa.Numeric(20, 6), nullable=False),
        sa.Column("issue_price", sa.Numeric(20, 8), nullable=True),
        sa.Column("issue_amount_brl", sa.Numeric(20, 2), nullable=False),
        sa.Column("sales_price", sa.Numeric(20, 8), nullable=True),
        sa.Column("sales_amount_brl", sa.Numeric(20, 2), nullable=True),
        sa.Column("warehouse_keeper", sa.String(length=120), nullable=True),
        sa.Column("planner", sa.String(length=120), nullable=True),
        sa.Column("work_order", sa.String(length=120), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("requisition_reason", sa.Text(), nullable=True),
        sa.Column("requisition_comment", sa.Text(), nullable=True),
        sa.Column("reference", sa.String(length=255), nullable=True),
        sa.Column("make_item", sa.String(length=20), nullable=True),
        sa.Column("created_by", sa.String(length=120), nullable=True),
        sa.Column("period", sa.Date(), nullable=False),
        sa.Column("period_yy_mm", sa.String(length=5), nullable=False),
        sa.Column("department", sa.String(length=120), nullable=True),
        sa.Column("product", sa.String(length=40), nullable=True),
        sa.Column("division", sa.String(length=40), nullable=True),
        sa.Column("item_type", sa.String(length=40), nullable=True),
        sa.Column("to_be_counted", sa.Boolean(), nullable=True),
        sa.Column("amount_usd", sa.Numeric(20, 6), nullable=False),
        sa.Column("quality_flags", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("derivation_provenance", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["scrap_ingestion_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", "source_row_number", name="uq_scrap_transaction_source_row"),
    )
    for index_name, columns in (
        ("ix_scrap_transactions_run_id", ["run_id"]),
        ("ix_scrap_transaction_run_date", ["run_id", "transaction_date"]),
        ("ix_scrap_transaction_organization", ["organization_code"]),
        ("ix_scrap_transaction_receipt_department", ["receipt_department"]),
        ("ix_scrap_transaction_department", ["department"]),
        ("ix_scrap_transaction_product", ["product"]),
        ("ix_scrap_transaction_division", ["division"]),
        ("ix_scrap_transaction_item_type", ["item_type"]),
        ("ix_scrap_transaction_account_code", ["account_code"]),
        ("ix_scrap_transaction_account_alias", ["account_alias"]),
        ("ix_scrap_transaction_item_code", ["item_code"]),
        ("ix_scrap_transaction_to_be_counted", ["to_be_counted"]),
    ):
        op.create_index(index_name, "scrap_transactions", columns)


def downgrade() -> None:
    op.drop_table("scrap_transactions")
    op.drop_table("scrap_exchange_rates")
    op.drop_table("scrap_ingestion_source_files")
    op.drop_table("scrap_ingestion_runs")
