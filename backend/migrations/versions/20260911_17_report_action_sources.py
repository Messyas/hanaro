"""Add selectable actions and evidence to V2 report composition."""

import sqlalchemy as sa
from alembic import op

revision = "20260911_17"
down_revision = "20260911_16"
branch_labels = None
depends_on = None


def upgrade() -> None:
    existing_tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "gov_report_action_sources" not in existing_tables:
        op.create_table(
            "gov_report_action_sources",
            sa.Column("report_id", sa.Uuid(), nullable=False),
            sa.Column("action_id", sa.Uuid(), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False),
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint("position >= 0", name="ck_gov_report_action_position"),
            sa.ForeignKeyConstraint(["report_id"], ["gov_reports.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["action_id"], ["gov_actions.id"], ondelete="RESTRICT"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("report_id", "action_id", name="uq_gov_report_action_source"),
        )
        op.create_index("ix_gov_report_action_sources_report_id", "gov_report_action_sources", ["report_id"])
        op.create_index("ix_gov_report_action_order", "gov_report_action_sources", ["report_id", "position", "id"])
    if "gov_report_evidence_sources" not in existing_tables:
        op.create_table(
            "gov_report_evidence_sources",
            sa.Column("report_id", sa.Uuid(), nullable=False),
            sa.Column("section_id", sa.Uuid(), nullable=False),
            sa.Column("review_attachment_id", sa.Uuid(), nullable=True),
            sa.Column("published_evidence_id", sa.Uuid(), nullable=True),
            sa.Column("caption", sa.Text(), nullable=False, server_default=""),
            sa.Column("role", sa.String(length=20), nullable=False, server_default="CONTEXT"),
            sa.Column("captured_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("position", sa.Integer(), nullable=False),
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint(
                "(review_attachment_id IS NOT NULL AND published_evidence_id IS NULL) OR "
                "(review_attachment_id IS NULL AND published_evidence_id IS NOT NULL)",
                name="ck_gov_report_evidence_one_source",
            ),
            sa.CheckConstraint("position >= 0", name="ck_gov_report_evidence_position"),
            sa.CheckConstraint(
                "role IN ('CONTEXT','BEFORE','AFTER','IMPLEMENTATION','MEASUREMENT')",
                name="ck_gov_report_evidence_role",
            ),
            sa.ForeignKeyConstraint(["report_id"], ["gov_reports.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["section_id"], ["gov_report_sections.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(
                ["review_attachment_id"], ["scrap_review_attachments.id"], ondelete="RESTRICT"
            ),
            sa.ForeignKeyConstraint(
                ["published_evidence_id"], ["gov_published_evidence.id"], ondelete="RESTRICT"
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_gov_report_evidence_sources_report_id", "gov_report_evidence_sources", ["report_id"])
        op.create_index(
            "ix_gov_report_evidence_order",
            "gov_report_evidence_sources",
            ["report_id", "section_id", "position", "id"],
        )


def downgrade() -> None:
    op.drop_table("gov_report_evidence_sources")
    op.drop_table("gov_report_action_sources")
