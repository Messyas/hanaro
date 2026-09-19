"""Persist the managed user role separately from self-edited profile job titles."""

import sqlalchemy as sa
from alembic import op

revision = "20260919_21"
down_revision = "20260915_20"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "user" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("user")}
    if "role" not in columns:
        op.add_column(
            "user",
            sa.Column("role", sa.String(length=16), nullable=False, server_default="analista"),
        )
    op.execute(
        sa.text(
            'UPDATE "user" SET role = CASE '
            "WHEN is_superuser THEN 'admin' "
            "WHEN lower(trim(coalesce(job_title, ''))) = 'gestor' THEN 'gestor' "
            "ELSE 'analista' END"
        )
    )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "user" in inspector.get_table_names() and "role" in {
        column["name"] for column in inspector.get_columns("user")
    }:
        op.drop_column("user", "role")
