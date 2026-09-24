"""Remove the obsolete unit field from production measurements.

Revision ID: 20260919_22
Revises: 20260918_21
"""

import sqlalchemy as sa
from alembic import op

revision = "20260919_22"
down_revision = "20260918_21"
branch_labels = None
depends_on = None

TABLE_NAME = "gov_production_measurement_versions"


def _has_unit_column() -> bool:
    inspector = sa.inspect(op.get_bind())
    return TABLE_NAME in inspector.get_table_names() and "unit" in {
        column["name"] for column in inspector.get_columns(TABLE_NAME)
    }


def upgrade() -> None:
    # The original revision may already be applied in a local database created
    # before the unit field was removed from the product. Fresh databases do
    # not get the column, so the migration must be safe in both cases.
    if _has_unit_column():
        op.drop_column(TABLE_NAME, "unit")


def downgrade() -> None:
    if not _has_unit_column():
        op.add_column(TABLE_NAME, sa.Column("unit", sa.String(length=40), nullable=True))
