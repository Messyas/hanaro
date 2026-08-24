"""Add optional contact and job fields to user profiles.

Revision ID: 20260810_01
Revises:
Create Date: 2026-08-10

The project historically created its initial schema with ``metadata.create_all``.
The table check keeps this first migration safe for both an existing development
database and a new database whose tables will be created from current models.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260810_01"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("user")}
    if "notification_email" not in columns:
        op.add_column("user", sa.Column("notification_email", sa.String(50), nullable=True))
    if "phone" not in columns:
        op.add_column("user", sa.Column("phone", sa.String(24), nullable=True))
    if "job_title" not in columns:
        op.add_column("user", sa.Column("job_title", sa.String(80), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("user")}
    for column_name in ("job_title", "phone", "notification_email"):
        if column_name in columns:
            op.drop_column("user", column_name)
