"""Track task blocking independently from its optional reason."""

import sqlalchemy as sa
from alembic import op

revision = "20260924_25"
down_revision = "20260919_23"
branch_labels = None
depends_on = None


def _has_block_flag() -> bool:
    inspector = sa.inspect(op.get_bind())
    return "gov_actions" in inspector.get_table_names() and "is_blocked" in {
        column["name"] for column in inspector.get_columns("gov_actions")
    }


def upgrade() -> None:
    if not _has_block_flag():
        op.add_column("gov_actions", sa.Column("is_blocked", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.execute(
        sa.text("UPDATE gov_actions SET is_blocked = true WHERE blocked_reason IS NOT NULL AND trim(blocked_reason) <> ''")
    )


def downgrade() -> None:
    if _has_block_flag():
        op.execute(
            sa.text(
                "UPDATE gov_actions SET blocked_reason = 'Bloqueada sem motivo informado.' "
                "WHERE is_blocked = true AND (blocked_reason IS NULL OR trim(blocked_reason) = '')"
            )
        )
        op.drop_column("gov_actions", "is_blocked")
