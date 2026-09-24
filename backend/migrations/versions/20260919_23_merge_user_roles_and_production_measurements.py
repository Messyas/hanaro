"""Merge the user-role and production-measurement migration branches."""

from collections.abc import Sequence

revision: str = "20260919_23"
down_revision: str | Sequence[str] | None = ("20260919_21", "20260919_22")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Record that both independent schema changes are applied."""


def downgrade() -> None:
    """Branch-specific downgrades are handled by their respective revisions."""
