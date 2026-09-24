"""Add the versioned scope required by V2 period-close reports.

Existing reports remain DOSSIER/V1 and retain their manual-source workflow.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260910_15"
down_revision = "20260909_14"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing_tables = set(inspector.get_table_names())
    report_columns = {column["name"] for column in inspector.get_columns("gov_reports")}
    report_checks = {constraint["name"] for constraint in inspector.get_check_constraints("gov_reports")}
    with op.batch_alter_table("gov_reports") as batch:
        if "report_kind" not in report_columns:
            batch.add_column(sa.Column("report_kind", sa.String(length=20), nullable=False, server_default="DOSSIER"))
        if "content_schema_version" not in report_columns:
            batch.add_column(sa.Column("content_schema_version", sa.Integer(), nullable=False, server_default="1"))
        if "ck_gov_report_kind" not in report_checks:
            batch.create_check_constraint("ck_gov_report_kind", "report_kind IN ('DOSSIER','PERIOD_CLOSE')")
        if "ck_gov_report_content_schema_version" not in report_checks:
            batch.create_check_constraint("ck_gov_report_content_schema_version", "content_schema_version > 0")
    if "gov_report_scopes" not in existing_tables:
        op.create_table(
            "gov_report_scopes",
            sa.Column("report_id", sa.Uuid(), nullable=False),
            sa.Column("period_from", sa.Date(), nullable=False),
            sa.Column("period_to", sa.Date(), nullable=False),
            sa.Column("cutoff_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("timezone", sa.String(length=60), nullable=False, server_default="America/Manaus"),
            sa.Column("metric_code", sa.String(length=80), nullable=False, server_default="MATERIAL_SCRAP_COST"),
            sa.Column("metric_policy_version", sa.String(length=40), nullable=False, server_default="scrap-cost-v1"),
            sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
            sa.Column("comparison_mode", sa.String(length=20), nullable=False, server_default="NONE"),
            sa.Column("comparison_from", sa.Date(), nullable=True),
            sa.Column("comparison_to", sa.Date(), nullable=True),
            sa.Column("is_provisional", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("scope_key", sa.String(length=64), nullable=False, server_default=""),
            sa.Column(
                "filters",
                sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
                nullable=False,
                server_default="{}",
            ),
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["report_id"], ["gov_reports.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("report_id", name="uq_gov_report_scope"),
        )
        op.create_index("ix_gov_report_scopes_report_id", "gov_report_scopes", ["report_id"])

    if "gov_report_sections" not in existing_tables:
        op.create_table(
            "gov_report_sections",
            sa.Column("report_id", sa.Uuid(), nullable=False),
            sa.Column("section_key", sa.String(length=80), nullable=False),
            sa.Column("kind", sa.String(length=40), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("title", sa.String(length=240), nullable=False, server_default=""),
            sa.Column("payload_schema_version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column(
                "payload",
                sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
                nullable=False,
                server_default="{}",
            ),
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint("position >= 0", name="ck_gov_report_section_position"),
            sa.ForeignKeyConstraint(["report_id"], ["gov_reports.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("report_id", "section_key", name="uq_gov_report_section_key"),
        )
        op.create_index("ix_gov_report_sections_report_id", "gov_report_sections", ["report_id"])
        op.create_index("ix_gov_report_section_order", "gov_report_sections", ["report_id", "position", "id"])


def downgrade() -> None:
    op.drop_table("gov_report_sections")
    op.drop_table("gov_report_scopes")
    with op.batch_alter_table("gov_reports") as batch:
        batch.drop_constraint("ck_gov_report_content_schema_version", type_="check")
        batch.drop_constraint("ck_gov_report_kind", type_="check")
        batch.drop_column("content_schema_version")
        batch.drop_column("report_kind")
