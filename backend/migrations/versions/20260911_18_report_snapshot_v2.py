"""Version report snapshots for period-close publications."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260911_18"
down_revision = "20260911_17"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    snapshot_columns = {column["name"] for column in inspector.get_columns("gov_dataset_snapshots")}
    if "schema_version" not in snapshot_columns:
        op.add_column(
            "gov_dataset_snapshots",
            sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
        )
    if "manifest" not in snapshot_columns:
        op.add_column(
            "gov_dataset_snapshots",
            sa.Column(
                "manifest",
                sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
                nullable=False,
                server_default=sa.text("'{}'"),
            ),
        )
    snapshot_checks = {constraint["name"] for constraint in inspector.get_check_constraints("gov_dataset_snapshots")}
    if "ck_gov_dataset_snapshot_schema_version" not in snapshot_checks:
        with op.batch_alter_table("gov_dataset_snapshots") as batch:
            batch.create_check_constraint("ck_gov_dataset_snapshot_schema_version", "schema_version > 0")

    version_columns = {column["name"] for column in inspector.get_columns("gov_report_versions")}
    if "content_schema_version" not in version_columns:
        op.add_column(
            "gov_report_versions",
            sa.Column("content_schema_version", sa.Integer(), nullable=False, server_default="1"),
        )
    version_checks = {constraint["name"] for constraint in inspector.get_check_constraints("gov_report_versions")}
    if "ck_gov_report_version_content_schema" not in version_checks:
        with op.batch_alter_table("gov_report_versions") as batch:
            batch.create_check_constraint("ck_gov_report_version_content_schema", "content_schema_version > 0")

    existing_tables = set(inspector.get_table_names())
    if "gov_snapshot_financial_rows" not in existing_tables:
        op.create_table(
            "gov_snapshot_financial_rows",
            sa.Column("snapshot_id", sa.Uuid(), nullable=False),
            sa.Column("window_key", sa.String(length=20), nullable=False, server_default="CURRENT"),
            sa.Column("occurrence_id", sa.Uuid(), nullable=False),
            sa.Column("transaction_id", sa.Uuid(), nullable=False),
            sa.Column(
                "frozen_values",
                sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
                nullable=False,
            ),
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint(
                "window_key IN ('CURRENT','COMPARISON')",
                name="ck_gov_snapshot_financial_window",
            ),
            sa.ForeignKeyConstraint(["snapshot_id"], ["gov_dataset_snapshots.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["occurrence_id"], ["scrap_occurrences.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["transaction_id"], ["scrap_transactions.id"], ondelete="RESTRICT"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "snapshot_id",
                "window_key",
                "occurrence_id",
                name="uq_gov_snapshot_financial_row",
            ),
        )
        op.create_index(
            "ix_gov_snapshot_financial_rows_snapshot",
            "gov_snapshot_financial_rows",
            ["snapshot_id", "window_key", "occurrence_id"],
        )
    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            """
            CREATE OR REPLACE FUNCTION gov_guard_snapshot_financial_row() RETURNS trigger AS $$
            DECLARE parent_id uuid;
            BEGIN
              IF TG_OP <> 'INSERT' THEN
                PERFORM 1 FROM gov_dataset_snapshots WHERE id = OLD.snapshot_id FOR UPDATE;
                IF EXISTS (
                  SELECT 1 FROM gov_dataset_snapshots
                  WHERE id = OLD.snapshot_id AND sealed_at IS NOT NULL
                ) THEN
                  RAISE EXCEPTION 'Snapshot is sealed';
                END IF;
              END IF;
              IF TG_OP <> 'DELETE' THEN
                parent_id := NEW.snapshot_id;
                PERFORM 1 FROM gov_dataset_snapshots WHERE id = parent_id FOR UPDATE;
                IF EXISTS (
                  SELECT 1 FROM gov_dataset_snapshots
                  WHERE id = parent_id AND sealed_at IS NOT NULL
                ) THEN
                  RAISE EXCEPTION 'Snapshot is sealed';
                END IF;
                IF NOT EXISTS (
                  SELECT 1 FROM scrap_transactions
                  WHERE id = NEW.transaction_id AND occurrence_id = NEW.occurrence_id
                ) THEN
                  RAISE EXCEPTION 'Transaction does not belong to snapshot occurrence';
                END IF;
                RETURN NEW;
              END IF;
              RETURN OLD;
            END;
            $$ LANGUAGE plpgsql;
            """
        )
        op.execute("DROP TRIGGER IF EXISTS guard_snapshot_item ON gov_snapshot_financial_rows")
        op.execute(
            "CREATE TRIGGER guard_snapshot_item BEFORE INSERT OR UPDATE OR DELETE "
            "ON gov_snapshot_financial_rows FOR EACH ROW "
            "EXECUTE FUNCTION gov_guard_snapshot_financial_row()"
        )


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS guard_snapshot_item ON gov_snapshot_financial_rows")
        op.execute("DROP FUNCTION IF EXISTS gov_guard_snapshot_financial_row()")
    op.drop_table("gov_snapshot_financial_rows")
    with op.batch_alter_table("gov_report_versions") as batch:
        batch.drop_constraint("ck_gov_report_version_content_schema", type_="check")
        batch.drop_column("content_schema_version")
    with op.batch_alter_table("gov_dataset_snapshots") as batch:
        batch.drop_constraint("ck_gov_dataset_snapshot_schema_version", type_="check")
        batch.drop_column("manifest")
        batch.drop_column("schema_version")
