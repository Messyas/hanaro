"""Add idempotency receipts for V2 report publication."""

import sqlalchemy as sa
from alembic import op

revision = "20260911_19"
down_revision = "20260911_18"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "gov_report_publish_receipts" in inspector.get_table_names():
        return
    op.create_table(
        "gov_report_publish_receipts",
        sa.Column("report_id", sa.Uuid(), nullable=False),
        sa.Column("report_version_id", sa.Uuid(), nullable=False),
        sa.Column("requested_by_user_id", sa.Integer(), nullable=False),
        sa.Column("idempotency_key", sa.String(length=160), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["report_id"], ["gov_reports.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["report_version_id"], ["gov_report_versions.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["requested_by_user_id"], ["user.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "report_id", "requested_by_user_id", "idempotency_key", name="uq_gov_report_publish_receipt"
        ),
    )
    op.create_index(
        "ix_gov_report_publish_receipt_lookup",
        "gov_report_publish_receipts",
        ["report_id", "requested_by_user_id", "idempotency_key"],
    )


def downgrade() -> None:
    op.drop_index("ix_gov_report_publish_receipt_lookup", table_name="gov_report_publish_receipts")
    op.drop_table("gov_report_publish_receipts")
