"""Store canonical Material Scrap batches and reusable daily exchange rates.

Revision ID: 20260827_03
Revises: 20260826_02
Create Date: 2026-08-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260827_03"
down_revision: str | None = "20260826_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # PostgreSQL supplies identifiers only for the legacy data copy below. New
    # records receive UUIDs from SQLAlchemy's application-side default.
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.create_table(
        "daily_exchange_rates",
        sa.Column("id", sa.Uuid(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("rate_date", sa.Date(), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("base_currency", sa.String(length=3), nullable=False),
        sa.Column("quote_currency", sa.String(length=3), nullable=False),
        sa.Column("brl_per_usd", sa.Numeric(18, 6), nullable=False),
        sa.Column("quote_type", sa.String(length=80), nullable=False),
        sa.Column("source", sa.String(length=80), nullable=False),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fallback_used", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "rate_date",
            "base_currency",
            "quote_currency",
            "quote_type",
            "source",
            name="uq_daily_exchange_rate_identity",
        ),
    )
    op.create_index("ix_daily_exchange_rates_rate_date", "daily_exchange_rates", ["rate_date"])
    op.execute(
        """
        INSERT INTO daily_exchange_rates (
            rate_date, effective_date, base_currency, quote_currency,
            brl_per_usd, quote_type, source, fallback_used
        )
        SELECT DISTINCT ON (requested_date, base_currency, quote_currency, source)
            requested_date, effective_date, base_currency, quote_currency,
            brl_per_usd, 'legacy_run_rate', source, fallback_used
        FROM scrap_exchange_rates
        ORDER BY requested_date, base_currency, quote_currency, source, id
        """
    )

    op.add_column("scrap_ingestion_runs", sa.Column("exchange_rate_id", sa.Uuid(), nullable=True))
    op.add_column("scrap_ingestion_runs", sa.Column("mapping_version", sa.String(length=40), nullable=True))
    op.add_column("scrap_ingestion_runs", sa.Column("mode", sa.String(length=40), nullable=True))
    op.add_column("scrap_ingestion_runs", sa.Column("processing_date", sa.Date(), nullable=True))
    op.add_column("scrap_ingestion_runs", sa.Column("query_window_inferred", sa.Boolean(), nullable=True))
    op.add_column("scrap_ingestion_runs", sa.Column("issue_amount_brl_total", sa.Numeric(20, 2), server_default="0", nullable=False))
    op.add_column("scrap_ingestion_runs", sa.Column("sales_amount_total", sa.Numeric(20, 2), server_default="0", nullable=False))
    op.add_column("scrap_ingestion_runs", sa.Column("expanded_comment_rows", sa.Integer(), server_default="0", nullable=False))
    op.add_column(
        "scrap_ingestion_runs",
        sa.Column("quality_flag_counts", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
    )
    op.execute(
        """
        UPDATE scrap_ingestion_runs run
        SET exchange_rate_id = rate.id,
            mapping_version = 'legacy',
            mode = 'LEGACY_BACKEND_SIMULATION',
            processing_date = run.date_to,
            query_window_inferred = false
        FROM scrap_exchange_rates old_rate
        JOIN daily_exchange_rates rate
          ON rate.rate_date = old_rate.requested_date
         AND rate.base_currency = old_rate.base_currency
         AND rate.quote_currency = old_rate.quote_currency
         AND rate.source = old_rate.source
         AND rate.quote_type = 'legacy_run_rate'
        WHERE old_rate.run_id = run.id
        """
    )
    op.alter_column("scrap_ingestion_runs", "exchange_rate_id", nullable=False)
    op.alter_column("scrap_ingestion_runs", "mapping_version", nullable=False)
    op.alter_column("scrap_ingestion_runs", "mode", nullable=False)
    op.alter_column("scrap_ingestion_runs", "processing_date", nullable=False)
    op.alter_column("scrap_ingestion_runs", "query_window_inferred", nullable=False)
    op.create_foreign_key(
        "fk_scrap_ingestion_runs_exchange_rate",
        "scrap_ingestion_runs",
        "daily_exchange_rates",
        ["exchange_rate_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_scrap_ingestion_runs_exchange_rate_id", "scrap_ingestion_runs", ["exchange_rate_id"])

    op.add_column("scrap_ingestion_source_files", sa.Column("size_bytes", sa.Integer(), server_default="0", nullable=False))
    op.add_column("scrap_transactions", sa.Column("content_hash", sa.String(length=64), server_default="", nullable=False))
    op.create_index("ix_scrap_transactions_content_hash", "scrap_transactions", ["content_hash"])
    op.alter_column(
        "scrap_transactions",
        "period",
        existing_type=sa.Date(),
        type_=sa.String(length=7),
        postgresql_using="to_char(period, 'YYYY-MM')",
    )
    op.execute("UPDATE scrap_transactions SET period_yy_mm = replace(period_yy_mm, '-', '.')")
    op.create_index("ix_scrap_transaction_date_organization", "scrap_transactions", ["transaction_date", "organization_code"])
    op.create_index("ix_scrap_transaction_date_division", "scrap_transactions", ["transaction_date", "division"])
    op.drop_table("scrap_exchange_rates")


def downgrade() -> None:
    # Historical per-run rates cannot be reconstructed losslessly when daily
    # rates are shared, so downgrade preserves the canonical tables and only
    # removes indexes introduced by this revision.
    op.drop_index("ix_scrap_transaction_date_division", table_name="scrap_transactions")
    op.drop_index("ix_scrap_transaction_date_organization", table_name="scrap_transactions")
    op.drop_index("ix_scrap_transactions_content_hash", table_name="scrap_transactions")
    op.drop_column("scrap_transactions", "content_hash")
    op.drop_column("scrap_ingestion_source_files", "size_bytes")
    op.drop_index("ix_scrap_ingestion_runs_exchange_rate_id", table_name="scrap_ingestion_runs")
    op.drop_constraint("fk_scrap_ingestion_runs_exchange_rate", "scrap_ingestion_runs", type_="foreignkey")
    for column in (
        "quality_flag_counts",
        "expanded_comment_rows",
        "sales_amount_total",
        "issue_amount_brl_total",
        "query_window_inferred",
        "processing_date",
        "mode",
        "mapping_version",
        "exchange_rate_id",
    ):
        op.drop_column("scrap_ingestion_runs", column)
    op.drop_index("ix_daily_exchange_rates_rate_date", table_name="daily_exchange_rates")
    op.drop_table("daily_exchange_rates")
