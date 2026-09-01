"""Add user-authored Scrap reviews, classifications and evidence.

Revision ID: 20260901_08
Revises: 20260831_07
Create Date: 2026-09-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260901_08"
down_revision: str | None = "20260831_07"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "scrap_defect_types",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scrap_defect_types_code", "scrap_defect_types", ["code"], unique=True)

    op.create_table(
        "scrap_reviews",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("occurrence_id", sa.Uuid(), nullable=False),
        sa.Column("responsible_user_id", sa.Integer(), nullable=False),
        sa.Column("responsible_name", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("defect_type_id", sa.Uuid(), nullable=True),
        sa.Column("source_review_id", sa.Uuid(), nullable=True),
        sa.Column("bulk_operation_id", sa.Uuid(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('DRAFT', 'REVIEWED')", name="ck_scrap_review_status"),
        sa.CheckConstraint("version >= 1", name="ck_scrap_review_version"),
        sa.ForeignKeyConstraint(["occurrence_id"], ["scrap_occurrences.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["responsible_user_id"], ["user.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["defect_type_id"], ["scrap_defect_types.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["source_review_id"], ["scrap_reviews.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scrap_reviews_occurrence_id", "scrap_reviews", ["occurrence_id"], unique=True)
    op.create_index("ix_scrap_reviews_responsible_user_id", "scrap_reviews", ["responsible_user_id"])
    op.create_index("ix_scrap_reviews_defect_type_id", "scrap_reviews", ["defect_type_id"])
    op.create_index("ix_scrap_reviews_source_review_id", "scrap_reviews", ["source_review_id"])
    op.create_index("ix_scrap_reviews_bulk_operation_id", "scrap_reviews", ["bulk_operation_id"])
    op.create_index("ix_scrap_review_status_updated", "scrap_reviews", ["status", "updated_at"])
    op.create_index(
        "ix_scrap_review_responsible_status", "scrap_reviews", ["responsible_user_id", "status"]
    )

    op.create_table(
        "scrap_review_attachments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("review_id", sa.Uuid(), nullable=False),
        sa.Column("storage_key", sa.String(length=64), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=40), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("uploaded_by_user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("size_bytes > 0", name="ck_scrap_review_attachment_size"),
        sa.CheckConstraint("width > 0 AND height > 0", name="ck_scrap_review_attachment_dimensions"),
        sa.ForeignKeyConstraint(["review_id"], ["scrap_reviews.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["user.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key", name="uq_scrap_review_attachment_storage_key"),
        sa.UniqueConstraint("review_id", "position", name="uq_scrap_review_attachment_position"),
    )
    op.create_index("ix_scrap_review_attachments_review_id", "scrap_review_attachments", ["review_id"])
    op.create_index(
        "ix_scrap_review_attachments_uploaded_by_user_id",
        "scrap_review_attachments",
        ["uploaded_by_user_id"],
    )

    op.create_table(
        "scrap_review_bulk_operations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("reference_review_id", sa.Uuid(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("requested_count", sa.Integer(), nullable=False),
        sa.Column("created_count", sa.Integer(), nullable=False),
        sa.Column("skipped_count", sa.Integer(), nullable=False),
        sa.Column("copy_attachments", sa.Boolean(), nullable=False),
        sa.Column("selection_snapshot", sa.JSON().with_variant(postgresql.JSONB(), "postgresql"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status = 'COMPLETED'", name="ck_scrap_review_bulk_status"),
        sa.ForeignKeyConstraint(["reference_review_id"], ["scrap_reviews.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["user.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_scrap_review_bulk_operations_reference_review_id",
        "scrap_review_bulk_operations",
        ["reference_review_id"],
    )
    op.create_index(
        "ix_scrap_review_bulk_operations_created_by_user_id",
        "scrap_review_bulk_operations",
        ["created_by_user_id"],
    )
    op.create_foreign_key(
        "fk_scrap_review_bulk_operation",
        "scrap_reviews",
        "scrap_review_bulk_operations",
        ["bulk_operation_id"],
        ["id"],
        ondelete="RESTRICT",
        use_alter=True,
    )


def downgrade() -> None:
    op.drop_constraint("fk_scrap_review_bulk_operation", "scrap_reviews", type_="foreignkey")
    op.drop_table("scrap_review_bulk_operations")
    op.drop_table("scrap_review_attachments")
    op.drop_table("scrap_reviews")
    op.drop_table("scrap_defect_types")
