"""Remove legacy external-authentication columns from users.

Revision ID: 20260830_06
Revises: 20260830_05
Create Date: 2026-08-30

The application now supports only administrator-provisioned accounts using a
local username and password. The table check keeps this migration compatible
with installations whose initial schema is still created via ``create_all``.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260830_06"
down_revision: str | None = "20260830_05"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LEGACY_COLUMNS = (
    "google_id",
    "github_id",
    "oauth_provider",
    "email_verified",
    "oauth_created_at",
    "oauth_updated_at",
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("user")}
    legacy_columns = set(LEGACY_COLUMNS) & columns

    for index in inspector.get_indexes("user"):
        if legacy_columns.intersection(index.get("column_names") or []):
            op.drop_index(index["name"], table_name="user")

    for constraint in inspector.get_unique_constraints("user"):
        if constraint.get("name") and legacy_columns.intersection(constraint.get("column_names") or []):
            op.drop_constraint(constraint["name"], "user", type_="unique")

    for column_name in LEGACY_COLUMNS:
        if column_name in columns:
            op.drop_column("user", column_name)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("user")}
    if "google_id" not in columns:
        op.add_column("user", sa.Column("google_id", sa.String(50), nullable=True))
        op.create_index("ix_user_google_id", "user", ["google_id"], unique=True)
    if "github_id" not in columns:
        op.add_column("user", sa.Column("github_id", sa.String(50), nullable=True))
        op.create_index("ix_user_github_id", "user", ["github_id"], unique=True)
    if "oauth_provider" not in columns:
        op.add_column("user", sa.Column("oauth_provider", sa.String(20), nullable=True))
    if "email_verified" not in columns:
        op.add_column(
            "user",
            sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
    if "oauth_created_at" not in columns:
        op.add_column("user", sa.Column("oauth_created_at", sa.DateTime(timezone=True), nullable=True))
    if "oauth_updated_at" not in columns:
        op.add_column("user", sa.Column("oauth_updated_at", sa.DateTime(timezone=True), nullable=True))
