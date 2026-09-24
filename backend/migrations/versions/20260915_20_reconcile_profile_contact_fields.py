"""Ensure profile contact fields exist in databases stamped from the legacy schema.

The original profile migration predates the legacy-schema reconciliation logic.
Some existing databases were therefore stamped at a later revision without
ever receiving these columns.  Keep this migration idempotent so it repairs
those databases without affecting fresh installs or already-correct schemas.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260915_20"
down_revision: str | None = "20260911_19"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


PROFILE_COLUMNS = {
    "notification_email": sa.String(50),
    "phone": sa.String(24),
    "job_title": sa.String(80),
}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("user")}
    for name, column_type in PROFILE_COLUMNS.items():
        if name not in existing_columns:
            op.add_column("user", sa.Column(name, column_type, nullable=True))


def downgrade() -> None:
    # These columns belong to the original profile migration.  This repair
    # migration may have found them already present, so dropping them here
    # would make a downgrade destructive for otherwise-correct databases.
    pass
