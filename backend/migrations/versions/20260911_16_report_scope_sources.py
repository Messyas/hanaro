"""Add source-to-line mappings and append-only coverage evidence."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260911_16"
down_revision = "20260910_15"
branch_labels = None
depends_on = None


def _json_column(name: str) -> sa.Column:
    return sa.Column(name, sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"), nullable=False)


def upgrade() -> None:
    existing_tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "gov_line_source_mappings" not in existing_tables:
        op.create_table(
            "gov_line_source_mappings",
            sa.Column("factory_id", sa.Uuid(), nullable=False),
            sa.Column("line_id", sa.Uuid(), nullable=False),
            sa.Column("source_system", sa.String(length=60), nullable=False),
            sa.Column("organization_code", sa.String(length=80), nullable=False),
            sa.Column("receipt_department", sa.String(length=120), nullable=False),
            sa.Column("valid_from", sa.Date(), nullable=False),
            sa.Column("valid_to", sa.Date(), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("author_id", sa.Integer(), nullable=True),
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint("valid_to IS NULL OR valid_to > valid_from", name="ck_gov_line_source_mapping_dates"),
            sa.CheckConstraint("version > 0", name="ck_gov_line_source_mapping_version"),
            sa.ForeignKeyConstraint(["factory_id"], ["gov_factories.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["line_id"], ["gov_production_lines.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["author_id"], ["user.id"], ondelete="RESTRICT"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("factory_id", "source_system", "organization_code", "receipt_department", "valid_from", name="uq_gov_line_source_mapping_start"),
        )
        op.create_index("ix_gov_line_source_mappings_factory_id", "gov_line_source_mappings", ["factory_id"])
        op.create_index("ix_gov_line_source_mapping_resolve", "gov_line_source_mappings", ["factory_id", "source_system", "organization_code", "receipt_department", "valid_from"])
    if "gov_source_coverage" not in existing_tables:
        op.create_table(
            "gov_source_coverage",
            sa.Column("factory_id", sa.Uuid(), nullable=False),
            sa.Column("source_system", sa.String(length=60), nullable=False),
            sa.Column("scope_key", sa.String(length=64), nullable=False),
            sa.Column("business_date", sa.Date(), nullable=False),
            sa.Column("revision", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            _json_column("expected_partitions"),
            _json_column("received_partitions"),
            sa.Column("source_revision", sa.String(length=160), nullable=False, server_default=""),
            sa.Column("extracted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("recorded_by_id", sa.Integer(), nullable=True),
            sa.Column("reason", sa.Text(), nullable=False, server_default=""),
            sa.Column("sha256", sa.String(length=64), nullable=False, server_default=""),
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint("status IN ('COMPLETE','PARTIAL','UNKNOWN')", name="ck_gov_source_coverage_status"),
            sa.CheckConstraint("revision > 0", name="ck_gov_source_coverage_revision"),
            sa.ForeignKeyConstraint(["factory_id"], ["gov_factories.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["recorded_by_id"], ["user.id"], ondelete="RESTRICT"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("factory_id", "source_system", "scope_key", "business_date", "revision", name="uq_gov_source_coverage_revision"),
        )
        op.create_index("ix_gov_source_coverage_factory_id", "gov_source_coverage", ["factory_id"])
        op.create_index("ix_gov_source_coverage_resolve", "gov_source_coverage", ["factory_id", "source_system", "scope_key", "business_date", "revision"])
    if "gov_metric_target_versions" not in existing_tables:
        op.create_table(
            "gov_metric_target_versions",
            sa.Column("factory_id", sa.Uuid(), nullable=False),
            sa.Column("line_id", sa.Uuid(), nullable=True),
            sa.Column("metric_code", sa.String(length=80), nullable=False),
            sa.Column("currency", sa.String(length=3), nullable=False),
            sa.Column("period_start", sa.Date(), nullable=False),
            sa.Column("period_end", sa.Date(), nullable=False),
            sa.Column("scope_key", sa.String(length=64), nullable=False),
            sa.Column("revision", sa.Integer(), nullable=False),
            sa.Column("amount", sa.Numeric(precision=24, scale=6), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="DRAFT"),
            sa.Column("author_id", sa.Integer(), nullable=True),
            sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("approved_by_id", sa.Integer(), nullable=True),
            sa.Column("source_legacy_id", sa.Uuid(), nullable=True),
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint("amount >= 0", name="ck_gov_metric_target_amount"),
            sa.CheckConstraint("period_end >= period_start", name="ck_gov_metric_target_dates"),
            sa.CheckConstraint("revision > 0", name="ck_gov_metric_target_revision"),
            sa.CheckConstraint("status IN ('DRAFT','APPROVED','SUPERSEDED')", name="ck_gov_metric_target_status"),
            sa.ForeignKeyConstraint(["factory_id"], ["gov_factories.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["line_id"], ["gov_production_lines.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["author_id"], ["user.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["approved_by_id"], ["user.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["source_legacy_id"], ["scrap_targets.id"], ondelete="RESTRICT"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("factory_id", "metric_code", "currency", "scope_key", "period_start", "period_end", "revision", name="uq_gov_metric_target_revision"),
        )
        op.create_index("ix_gov_metric_target_versions_factory_id", "gov_metric_target_versions", ["factory_id"])
        op.create_index("ix_gov_metric_target_resolve", "gov_metric_target_versions", ["factory_id", "metric_code", "currency", "scope_key", "period_start", "period_end", "revision"])


def downgrade() -> None:
    op.drop_table("gov_metric_target_versions")
    op.drop_table("gov_source_coverage")
    op.drop_table("gov_line_source_mappings")
