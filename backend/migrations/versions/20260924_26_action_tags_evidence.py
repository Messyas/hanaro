"""Add task tags and auditable evidence metadata."""

import json

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260924_26"
down_revision = "20260924_25"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "tags" not in {column["name"] for column in inspector.get_columns("gov_actions")}:
        op.add_column(
            "gov_actions",
            sa.Column(
                "tags",
                sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
                nullable=False,
                server_default="[]",
            ),
        )
    if "gov_action_evidence" not in inspector.get_table_names():
        op.create_table(
            "gov_action_evidence",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("action_id", sa.Uuid(), sa.ForeignKey("gov_actions.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("storage_key", sa.String(500), nullable=False, unique=True),
            sa.Column("sha256", sa.String(64), nullable=False),
            sa.Column("size_bytes", sa.Integer(), nullable=False),
            sa.Column("filename", sa.String(255), nullable=False),
            sa.Column("content_type", sa.String(100), nullable=False),
            sa.Column("uploaded_by_user_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True)),
            sa.Column("deleted_by_user_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="RESTRICT")),
        )
        op.create_index("ix_gov_action_evidence_action", "gov_action_evidence", ["action_id", "created_at", "id"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    has_evidence = "gov_action_evidence" in inspector.get_table_names()
    has_tags = "tags" in {column["name"] for column in inspector.get_columns("gov_actions")}
    if has_evidence:
        if op.get_bind().execute(sa.text("SELECT 1 FROM gov_action_evidence LIMIT 1")).first():
            raise RuntimeError("Cannot remove action evidence metadata while evidence exists")
    if has_tags:
        rows = op.get_bind().execute(sa.text("SELECT tags FROM gov_actions"))
        if any(json.loads(value) if isinstance(value, str) else value for (value,) in rows):
            raise RuntimeError("Cannot remove action tags while tags are assigned")
    if has_evidence:
        op.drop_index("ix_gov_action_evidence_action", table_name="gov_action_evidence")
        op.drop_table("gov_action_evidence")
    if has_tags:
        op.drop_column("gov_actions", "tags")
