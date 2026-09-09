"""Complete the immutable Scrap reports module.

Additive migration: the governance baseline remains untouched and existing
report rows receive safe draft defaults before constraints are enforced.
"""

import sqlalchemy as sa
from alembic import op

revision = "20260909_13"
down_revision = "20260906_12"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("gov_reports") as batch:
        batch.add_column(sa.Column("description", sa.Text(), nullable=False, server_default=""))
        batch.add_column(sa.Column("status", sa.String(length=20), nullable=False, server_default="DRAFT"))
        batch.add_column(sa.Column("created_by_user_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("updated_by_user_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
        batch.add_column(sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
        batch.add_column(sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
        batch.create_foreign_key("fk_gov_report_created_by", "user", ["created_by_user_id"], ["id"], ondelete="RESTRICT")
        batch.create_foreign_key("fk_gov_report_updated_by", "user", ["updated_by_user_id"], ["id"], ondelete="RESTRICT")
        batch.create_check_constraint("ck_gov_report_status", "status IN ('DRAFT','PUBLISHED','ARCHIVED')")
        batch.create_check_constraint("ck_gov_report_version", "version > 0")
        batch.create_index("ix_gov_report_list", ["factory_id", "status", "updated_at", "id"])

    with op.batch_alter_table("gov_snapshot_items") as batch:
        batch.add_column(sa.Column("review_id", sa.Uuid(), nullable=True))
        batch.add_column(sa.Column("review_version", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_gov_snapshot_item_review", "scrap_reviews", ["review_id"], ["id"], ondelete="RESTRICT")

    with op.batch_alter_table("gov_report_versions") as batch:
        batch.add_column(sa.Column("sha256", sa.String(length=64), nullable=False, server_default=""))
        batch.add_column(sa.Column("published_by_user_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_gov_report_version_publisher", "user", ["published_by_user_id"], ["id"], ondelete="RESTRICT"
        )

    with op.batch_alter_table("gov_export_jobs") as batch:
        batch.add_column(sa.Column("template_version", sa.String(length=80), nullable=False, server_default="1"))
        batch.add_column(sa.Column("requested_by_user_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
        batch.add_column(sa.Column("error_message", sa.String(length=500), nullable=True))
        batch.create_foreign_key("fk_gov_export_requester", "user", ["requested_by_user_id"], ["id"], ondelete="RESTRICT")
        batch.create_check_constraint("ck_gov_export_attempts", "attempts >= 0")

    with op.batch_alter_table("gov_artifacts") as batch:
        batch.add_column(sa.Column("filename", sa.String(length=255), nullable=False, server_default="report"))
        batch.add_column(
            sa.Column("content_type", sa.String(length=100), nullable=False, server_default="application/octet-stream")
        )

    op.create_table(
        "gov_report_occurrence_sources",
        sa.Column("report_id", sa.Uuid(), nullable=False),
        sa.Column("occurrence_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["report_id"], ["gov_reports.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["occurrence_id"], ["scrap_occurrences.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("report_id", "occurrence_id", name="uq_gov_report_occurrence_source"),
    )
    op.create_index("ix_gov_report_occurrence_sources_report_id", "gov_report_occurrence_sources", ["report_id"])
    op.create_index(
        "ix_gov_report_occurrence_source_occurrence", "gov_report_occurrence_sources", ["occurrence_id", "report_id"]
    )

    op.create_table(
        "gov_report_sources",
        sa.Column("report_id", sa.Uuid(), nullable=False),
        sa.Column("source_report_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("report_id <> source_report_id", name="ck_gov_report_no_self_source"),
        sa.ForeignKeyConstraint(["report_id"], ["gov_reports.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_report_id"], ["gov_reports.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("report_id", "source_report_id", name="uq_gov_report_source"),
    )
    op.create_index("ix_gov_report_sources_report_id", "gov_report_sources", ["report_id"])
    op.create_index("ix_gov_report_source_reverse", "gov_report_sources", ["source_report_id", "report_id"])

    op.create_table(
        "gov_report_version_sources",
        sa.Column("report_version_id", sa.Uuid(), nullable=False),
        sa.Column("source_report_id", sa.Uuid(), nullable=False),
        sa.Column("source_report_version_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["report_version_id"], ["gov_report_versions.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["source_report_id"], ["gov_reports.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["source_report_version_id"], ["gov_report_versions.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("report_version_id", "source_report_version_id", name="uq_gov_report_version_source"),
    )
    op.create_index(
        "ix_gov_report_version_source_report",
        "gov_report_version_sources",
        ["source_report_id", "report_version_id"],
    )


def downgrade() -> None:
    op.drop_table("gov_report_version_sources")
    op.drop_table("gov_report_sources")
    op.drop_table("gov_report_occurrence_sources")
    with op.batch_alter_table("gov_artifacts") as batch:
        batch.drop_column("content_type")
        batch.drop_column("filename")
    with op.batch_alter_table("gov_export_jobs") as batch:
        batch.drop_constraint("ck_gov_export_attempts", type_="check")
        batch.drop_constraint("fk_gov_export_requester", type_="foreignkey")
        for column in (
            "error_message",
            "updated_at",
            "finished_at",
            "started_at",
            "attempts",
            "requested_by_user_id",
            "template_version",
        ):
            batch.drop_column(column)
    with op.batch_alter_table("gov_report_versions") as batch:
        batch.drop_constraint("fk_gov_report_version_publisher", type_="foreignkey")
        batch.drop_column("published_by_user_id")
        batch.drop_column("sha256")
    with op.batch_alter_table("gov_snapshot_items") as batch:
        batch.drop_constraint("fk_gov_snapshot_item_review", type_="foreignkey")
        batch.drop_column("review_version")
        batch.drop_column("review_id")
    with op.batch_alter_table("gov_reports") as batch:
        batch.drop_index("ix_gov_report_list")
        batch.drop_constraint("ck_gov_report_version", type_="check")
        batch.drop_constraint("ck_gov_report_status", type_="check")
        batch.drop_constraint("fk_gov_report_updated_by", type_="foreignkey")
        batch.drop_constraint("fk_gov_report_created_by", type_="foreignkey")
        for column in (
            "archived_at",
            "updated_at",
            "version",
            "updated_by_user_id",
            "created_by_user_id",
            "status",
            "description",
        ):
            batch.drop_column(column)
