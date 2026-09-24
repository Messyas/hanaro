"""Add versioned monthly production measurements for the relative KPI."""

import sqlalchemy as sa
from alembic import op

revision = "20260918_21"
down_revision = "20260915_20"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Development startup may have created this table through SQLAlchemy
    # metadata before Alembic recorded this revision. Preserve that data and
    # let the follow-up migration reconcile its legacy columns.
    if "gov_production_measurement_versions" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "gov_production_measurement_versions",
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("scope_key", sa.String(length=64), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("production_value", sa.Numeric(precision=24, scale=6), nullable=True),
        sa.Column("production_quantity", sa.Numeric(precision=24, scale=6), nullable=True),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("month >= 1 AND month <= 12", name="ck_gov_production_measurement_month"),
        sa.CheckConstraint(
            "production_value IS NULL OR production_value >= 0",
            name="ck_gov_production_measurement_value",
        ),
        sa.CheckConstraint(
            "production_quantity IS NULL OR production_quantity >= 0",
            name="ck_gov_production_measurement_quantity",
        ),
        sa.CheckConstraint("revision > 0", name="ck_gov_production_measurement_revision"),
        sa.CheckConstraint(
            "status IN ('DRAFT','CONFIRMED','SUPERSEDED')",
            name="ck_gov_production_measurement_status",
        ),
        sa.CheckConstraint(
            "source IN ('MANUAL','IMPORT','ERP','MES','FINANCE')",
            name="ck_gov_production_measurement_source",
        ),
        sa.ForeignKeyConstraint(["author_id"], ["user.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "year",
            "month",
            "scope_key",
            "revision",
            name="uq_gov_production_measurement_revision",
        ),
    )
    op.create_index(
        "ix_gov_production_measurement_period",
        "gov_production_measurement_versions",
        ["year", "month", "scope_key", "status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_gov_production_measurement_period",
        table_name="gov_production_measurement_versions",
    )
    op.drop_table("gov_production_measurement_versions")
