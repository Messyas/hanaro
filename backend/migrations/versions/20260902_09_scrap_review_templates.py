"""Add reusable Scrap review templates.

Revision ID: 20260902_09
Revises: 20260901_08
Create Date: 2026-09-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260902_09"
down_revision: str | None = "20260901_08"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "scrap_review_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("defect_type_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("source_review_id", sa.Uuid(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["defect_type_id"], ["scrap_defect_types.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["user.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["source_review_id"], ["scrap_reviews.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scrap_review_templates_name", "scrap_review_templates", ["name"])
    op.create_index("ix_scrap_review_templates_created_by", "scrap_review_templates", ["created_by_user_id"])
    op.create_index("ix_scrap_review_templates_defect_type", "scrap_review_templates", ["defect_type_id"])


def downgrade() -> None:
    op.drop_index("ix_scrap_review_templates_defect_type", table_name="scrap_review_templates")
    op.drop_index("ix_scrap_review_templates_created_by", table_name="scrap_review_templates")
    op.drop_index("ix_scrap_review_templates_name", table_name="scrap_review_templates")
    op.drop_table("scrap_review_templates")
