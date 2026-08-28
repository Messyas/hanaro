"""Add pre-calculated Material Scrap dashboard read model and targets.

Revision ID: 20260827_04
Revises: 20260827_03
Create Date: 2026-08-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260827_04"
down_revision: str | None = "20260827_03"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "scrap_dashboard_aggregates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("organization_code", sa.String(length=40), nullable=False),
        sa.Column("receipt_department", sa.String(length=120), nullable=False),
        sa.Column("department", sa.String(length=120), nullable=False),
        sa.Column("product", sa.String(length=40), nullable=False),
        sa.Column("division", sa.String(length=40), nullable=False),
        sa.Column("item_type", sa.String(length=40), nullable=False),
        sa.Column("account_code", sa.String(length=80), nullable=False),
        sa.Column("account_alias", sa.String(length=100), nullable=False),
        sa.Column("item_code", sa.String(length=100), nullable=False),
        sa.Column("to_be_counted_key", sa.String(length=10), nullable=False),
        sa.Column("record_count", sa.Integer(), nullable=False),
        sa.Column("issue_quantity", sa.Numeric(24, 6), nullable=False),
        sa.Column("issue_quantity_abs", sa.Numeric(24, 6), nullable=False),
        sa.Column("issue_amount_brl", sa.Numeric(24, 2), nullable=False),
        sa.Column("issue_amount_brl_abs", sa.Numeric(24, 2), nullable=False),
        sa.Column("amount_usd", sa.Numeric(24, 6), nullable=False),
        sa.Column("amount_usd_abs", sa.Numeric(24, 6), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["scrap_ingestion_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "run_id",
            "transaction_date",
            "organization_code",
            "receipt_department",
            "department",
            "product",
            "division",
            "item_type",
            "account_code",
            "account_alias",
            "item_code",
            "to_be_counted_key",
            name="uq_scrap_dashboard_aggregate_grain",
        ),
    )
    op.create_index("ix_scrap_dashboard_aggregates_run_id", "scrap_dashboard_aggregates", ["run_id"])
    op.create_index("ix_scrap_dashboard_run_date", "scrap_dashboard_aggregates", ["run_id", "transaction_date"])
    op.create_index(
        "ix_scrap_dashboard_date_product", "scrap_dashboard_aggregates", ["transaction_date", "product"]
    )
    op.create_index(
        "ix_scrap_dashboard_date_line", "scrap_dashboard_aggregates", ["transaction_date", "receipt_department"]
    )
    op.create_index(
        "ix_scrap_dashboard_date_division", "scrap_dashboard_aggregates", ["transaction_date", "division"]
    )
    op.create_index(
        "ix_scrap_dashboard_date_component", "scrap_dashboard_aggregates", ["transaction_date", "item_type"]
    )
    op.execute(
        """
        INSERT INTO scrap_dashboard_aggregates (
            id, run_id, transaction_date, organization_code,
            receipt_department, department, product, division, item_type,
            account_code, account_alias, item_code, to_be_counted_key,
            record_count, issue_quantity, issue_quantity_abs,
            issue_amount_brl, issue_amount_brl_abs, amount_usd, amount_usd_abs
        )
        SELECT
            gen_random_uuid(), run_id, transaction_date, organization_code,
            COALESCE(NULLIF(receipt_department, ''), '__UNMAPPED__'),
            COALESCE(NULLIF(department, ''), '__UNMAPPED__'),
            COALESCE(NULLIF(product, ''), '__UNMAPPED__'),
            COALESCE(NULLIF(division, ''), '__UNMAPPED__'),
            COALESCE(NULLIF(item_type, ''), '__UNMAPPED__'),
            COALESCE(NULLIF(account_code, ''), '__UNMAPPED__'),
            COALESCE(NULLIF(account_alias, ''), '__UNMAPPED__'),
            COALESCE(NULLIF(item_code, ''), '__UNMAPPED__'),
            CASE WHEN to_be_counted IS NULL THEN 'unmapped'
                 WHEN to_be_counted THEN 'true' ELSE 'false' END,
            COUNT(*), SUM(issue_quantity), SUM(ABS(issue_quantity)),
            SUM(issue_amount_brl), SUM(ABS(issue_amount_brl)),
            SUM(amount_usd), SUM(ABS(amount_usd))
        FROM scrap_transactions
        GROUP BY
            run_id, transaction_date, organization_code,
            COALESCE(NULLIF(receipt_department, ''), '__UNMAPPED__'),
            COALESCE(NULLIF(department, ''), '__UNMAPPED__'),
            COALESCE(NULLIF(product, ''), '__UNMAPPED__'),
            COALESCE(NULLIF(division, ''), '__UNMAPPED__'),
            COALESCE(NULLIF(item_type, ''), '__UNMAPPED__'),
            COALESCE(NULLIF(account_code, ''), '__UNMAPPED__'),
            COALESCE(NULLIF(account_alias, ''), '__UNMAPPED__'),
            COALESCE(NULLIF(item_code, ''), '__UNMAPPED__'),
            CASE WHEN to_be_counted IS NULL THEN 'unmapped'
                 WHEN to_be_counted THEN 'true' ELSE 'false' END
        """
    )

    op.create_table(
        "scrap_dashboard_state",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("revision", sa.Uuid(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        "INSERT INTO scrap_dashboard_state (id, revision, updated_at) "
        "VALUES (1, gen_random_uuid(), CURRENT_TIMESTAMP)"
    )

    op.create_table(
        "scrap_targets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("amount", sa.Numeric(24, 6), nullable=False),
        sa.Column("updated_by_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("year BETWEEN 2000 AND 2100", name="ck_scrap_target_year"),
        sa.CheckConstraint("month BETWEEN 1 AND 12", name="ck_scrap_target_month"),
        sa.CheckConstraint("currency IN ('BRL', 'USD')", name="ck_scrap_target_currency"),
        sa.CheckConstraint("amount >= 0", name="ck_scrap_target_amount"),
        sa.ForeignKeyConstraint(["updated_by_id"], ["user.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("year", "month", "currency", name="uq_scrap_target_period_currency"),
    )
    op.create_index("ix_scrap_targets_updated_by_id", "scrap_targets", ["updated_by_id"])
    op.create_index("ix_scrap_target_year_currency", "scrap_targets", ["year", "currency"])


def downgrade() -> None:
    op.drop_table("scrap_targets")
    op.drop_table("scrap_dashboard_state")
    op.drop_table("scrap_dashboard_aggregates")
