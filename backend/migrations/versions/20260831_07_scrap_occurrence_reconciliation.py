"""Add stable Scrap occurrences and current-occurrence dashboard facts.

Revision ID: 20260831_07
Revises: 20260830_06
Create Date: 2026-08-31
"""

import hashlib
import json
import re
import unicodedata
import uuid
from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import sqlalchemy as sa
from alembic import op

revision: str = "20260831_07"
down_revision: str | None = "20260830_06"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

RECORD_KEY_VERSION = "v1"


def _text(value: str | None) -> str:
    if value is None:
        return "<NULL>"
    normalized = re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value).strip())
    return "<EMPTY>" if not normalized else normalized.upper()


def _decimal(value: Decimal) -> str:
    rendered = format(value.normalize(), "f")
    return "0" if rendered in {"", "-0"} else rendered


def _record_key(row: Mapping[str, Any]) -> str:
    values = (
        RECORD_KEY_VERSION,
        _text(row["organization_code"]),
        row["transaction_date"].isoformat(),
        _text(row["account_code"]),
        _text(row["item_code"]),
        _text(row["work_order"]),
        _text(row["reference"]),
        _decimal(Decimal(str(row["issue_quantity"]))),
        _decimal(Decimal(str(row["issue_amount_brl"]))),
    )
    return hashlib.sha256("\x1f".join(values).encode("utf-8")).hexdigest()


def _semantic_hash(row: Mapping[str, Any]) -> str:
    """Compare legacy rows without technical ingestion/row-position metadata."""
    ignored = {"id", "run_id", "source_row_number", "content_hash", "ingestion_finished_at"}
    values = {key: value for key, value in row.items() if key not in ignored}
    encoded = json.dumps(values, sort_keys=True, default=str, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _dimension(value: str | None) -> str:
    return "__UNMAPPED__" if value is None or value == "" else value


def _counted(value: bool | None) -> str:
    return "unmapped" if value is None else ("true" if value else "false")


def upgrade() -> None:
    op.create_table(
        "scrap_occurrences",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("record_key", sa.String(64), nullable=False),
        sa.Column("record_key_version", sa.String(20), nullable=False),
        sa.Column("identity_slot", sa.Integer(), nullable=False),
        sa.Column("organization_code", sa.String(40), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("current_transaction_id", sa.Uuid(), nullable=True),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["current_transaction_id"],
            ["scrap_transactions.id"],
            name="fk_scrap_occurrence_current_transaction",
            ondelete="RESTRICT",
            use_alter=True,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("record_key_version", "record_key", "identity_slot", name="uq_scrap_occurrence_record_key"),
        sa.UniqueConstraint("current_transaction_id", name="uq_scrap_occurrence_current_transaction"),
    )
    op.create_index(
        "ix_scrap_occurrence_partition_status",
        "scrap_occurrences",
        ["organization_code", "transaction_date", "status"],
    )
    op.add_column("scrap_transactions", sa.Column("occurrence_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_scrap_transaction_occurrence",
        "scrap_transactions",
        "scrap_occurrences",
        ["occurrence_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_scrap_transactions_occurrence_id", "scrap_transactions", ["occurrence_id"])
    op.create_index(
        "ix_scrap_transaction_occurrence_content", "scrap_transactions", ["occurrence_id", "content_hash"]
    )
    op.create_table(
        "scrap_occurrence_observations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("occurrence_id", sa.Uuid(), nullable=False),
        sa.Column("transaction_id", sa.Uuid(), nullable=False),
        sa.Column("source_row_number", sa.Integer(), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["scrap_ingestion_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["occurrence_id"], ["scrap_occurrences.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["transaction_id"], ["scrap_transactions.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", "occurrence_id", name="uq_scrap_occurrence_observation_run"),
        sa.UniqueConstraint("run_id", "source_row_number", name="uq_scrap_occurrence_observation_source_row"),
    )
    for name, columns in (
        ("ix_scrap_occurrence_observations_run_id", ["run_id"]),
        ("ix_scrap_occurrence_observations_occurrence_id", ["occurrence_id"]),
        ("ix_scrap_occurrence_observations_transaction_id", ["transaction_id"]),
    ):
        op.create_index(name, "scrap_occurrence_observations", columns)
    op.create_table(
        "scrap_reconciliation_partitions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_code", sa.String(40), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_code", "transaction_date", name="uq_scrap_reconciliation_partition"),
    )

    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT transaction.*, run.ingestion_finished_at
            FROM scrap_transactions AS transaction
            JOIN scrap_ingestion_runs AS run ON run.id = transaction.run_id
            ORDER BY run.ingestion_finished_at NULLS LAST, transaction.id
            """
        )
    ).mappings().all()
    grouped: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[_record_key(row)].append(row)

    occurrence_rows: list[dict[str, object]] = []
    transaction_to_occurrence: dict[uuid.UUID, uuid.UUID] = {}
    observation_rows: list[dict[str, object]] = []
    dashboard_rows: list[dict[str, object]] = []
    now = datetime.now(UTC)
    for key, transactions in grouped.items():
        by_run: dict[uuid.UUID, list[Mapping[str, Any]]] = defaultdict(list)
        for transaction in transactions:
            by_run[transaction["run_id"]].append(transaction)
        for run_transactions in by_run.values():
            run_transactions.sort(key=lambda row: row["source_row_number"])
        incompatible = any(
            len({_semantic_hash(transaction) for transaction in run_transactions}) > 1
            for run_transactions in by_run.values()
        )
        slots = max((len(run_transactions) for run_transactions in by_run.values()), default=0)
        for slot in range(1, slots + 1):
            slot_transactions = [
                run_transactions[slot - 1] for run_transactions in by_run.values() if len(run_transactions) >= slot
            ]
            slot_transactions.sort(key=lambda row: (row["ingestion_finished_at"] or now, str(row["id"])))
            first = slot_transactions[0]
            current = slot_transactions[-1]
            occurrence_id = uuid.uuid4()
            first_seen = first["ingestion_finished_at"] or now
            last_seen = current["ingestion_finished_at"] or now
            occurrence_rows.append(
                {
                    "id": occurrence_id,
                    "record_key": key,
                    "record_key_version": RECORD_KEY_VERSION,
                    "identity_slot": slot,
                    "organization_code": first["organization_code"],
                    "transaction_date": first["transaction_date"],
                    "current_transaction_id": current["id"],
                    "first_seen_at": first_seen,
                    "last_seen_at": last_seen,
                    "status": "IDENTITY_CONFLICT" if incompatible else "ACTIVE",
                    "created_at": first_seen,
                    "updated_at": last_seen,
                }
            )
            for transaction in slot_transactions:
                transaction_to_occurrence[transaction["id"]] = occurrence_id
                observation_rows.append(
                    {
                        "id": uuid.uuid4(),
                        "run_id": transaction["run_id"],
                        "occurrence_id": occurrence_id,
                        "transaction_id": transaction["id"],
                        "source_row_number": transaction["source_row_number"],
                        "content_hash": transaction["content_hash"],
                        "observed_at": transaction["ingestion_finished_at"] or now,
                    }
                )
            if not incompatible:
                dashboard_rows.append(
                    {
                    "id": uuid.uuid4(),
                    "run_id": current["run_id"],
                    "occurrence_id": occurrence_id,
                    "transaction_date": current["transaction_date"],
                    "organization_code": current["organization_code"],
                    "receipt_department": _dimension(current["receipt_department"]),
                    "department": _dimension(current["department"]),
                    "product": _dimension(current["product"]),
                    "division": _dimension(current["division"]),
                    "item_type": _dimension(current["item_type"]),
                    "account_code": _dimension(current["account_code"]),
                    "account_alias": _dimension(current["account_alias"]),
                    "item_code": _dimension(current["item_code"]),
                    "to_be_counted_key": _counted(current["to_be_counted"]),
                    "record_count": 1,
                    "issue_quantity": current["issue_quantity"],
                    "issue_quantity_abs": abs(Decimal(str(current["issue_quantity"]))),
                    "issue_amount_brl": current["issue_amount_brl"],
                    "issue_amount_brl_abs": abs(Decimal(str(current["issue_amount_brl"]))),
                    "amount_usd": current["amount_usd"],
                    "amount_usd_abs": abs(Decimal(str(current["amount_usd"]))),
                    }
                )

    occurrences = sa.table("scrap_occurrences", *[sa.column(name) for name in occurrence_rows[0]]) if occurrence_rows else None
    transactions_table = sa.table("scrap_transactions", sa.column("id"), sa.column("occurrence_id"))
    observations = (
        sa.table("scrap_occurrence_observations", *[sa.column(name) for name in observation_rows[0]])
        if observation_rows
        else None
    )
    if occurrence_rows:
        bind.execute(sa.insert(occurrences), occurrence_rows)
        for transaction_id, occurrence_id in transaction_to_occurrence.items():
            bind.execute(
                sa.update(transactions_table)
                .where(transactions_table.c.id == transaction_id)
                .values(occurrence_id=occurrence_id)
            )
    if observation_rows:
        bind.execute(sa.insert(observations), observation_rows)

    op.drop_constraint("uq_scrap_dashboard_aggregate_grain", "scrap_dashboard_aggregates", type_="unique")
    op.add_column("scrap_dashboard_aggregates", sa.Column("occurrence_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_scrap_dashboard_aggregate_occurrence",
        "scrap_dashboard_aggregates",
        "scrap_occurrences",
        ["occurrence_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_scrap_dashboard_aggregates_occurrence_id", "scrap_dashboard_aggregates", ["occurrence_id"])
    bind.execute(sa.text("DELETE FROM scrap_dashboard_aggregates"))
    if dashboard_rows:
        dashboard = sa.table("scrap_dashboard_aggregates", *[sa.column(name) for name in dashboard_rows[0]])
        bind.execute(sa.insert(dashboard), dashboard_rows)
    op.alter_column("scrap_dashboard_aggregates", "occurrence_id", nullable=False)
    op.create_unique_constraint(
        "uq_scrap_dashboard_aggregate_occurrence", "scrap_dashboard_aggregates", ["occurrence_id"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_scrap_dashboard_aggregate_occurrence", "scrap_dashboard_aggregates", type_="unique")
    op.drop_index("ix_scrap_dashboard_aggregates_occurrence_id", table_name="scrap_dashboard_aggregates")
    op.drop_constraint("fk_scrap_dashboard_aggregate_occurrence", "scrap_dashboard_aggregates", type_="foreignkey")
    op.execute(
        """
        CREATE TEMPORARY TABLE scrap_dashboard_aggregate_downgrade AS
        SELECT
            gen_random_uuid() AS id,
            run_id, transaction_date, organization_code,
            receipt_department, department, product, division, item_type,
            account_code, account_alias, item_code, to_be_counted_key,
            SUM(record_count) AS record_count,
            SUM(issue_quantity) AS issue_quantity,
            SUM(issue_quantity_abs) AS issue_quantity_abs,
            SUM(issue_amount_brl) AS issue_amount_brl,
            SUM(issue_amount_brl_abs) AS issue_amount_brl_abs,
            SUM(amount_usd) AS amount_usd,
            SUM(amount_usd_abs) AS amount_usd_abs
        FROM scrap_dashboard_aggregates
        GROUP BY
            run_id, transaction_date, organization_code,
            receipt_department, department, product, division, item_type,
            account_code, account_alias, item_code, to_be_counted_key
        """
    )
    op.execute("DELETE FROM scrap_dashboard_aggregates")
    op.drop_column("scrap_dashboard_aggregates", "occurrence_id")
    op.create_unique_constraint(
        "uq_scrap_dashboard_aggregate_grain",
        "scrap_dashboard_aggregates",
        [
            "run_id", "transaction_date", "organization_code", "receipt_department", "department", "product",
            "division", "item_type", "account_code", "account_alias", "item_code", "to_be_counted_key",
        ],
    )
    op.execute(
        """
        INSERT INTO scrap_dashboard_aggregates (
            id, run_id, transaction_date, organization_code,
            receipt_department, department, product, division, item_type,
            account_code, account_alias, item_code, to_be_counted_key,
            record_count, issue_quantity, issue_quantity_abs,
            issue_amount_brl, issue_amount_brl_abs, amount_usd, amount_usd_abs
        )
        SELECT
            id, run_id, transaction_date, organization_code,
            receipt_department, department, product, division, item_type,
            account_code, account_alias, item_code, to_be_counted_key,
            record_count, issue_quantity, issue_quantity_abs,
            issue_amount_brl, issue_amount_brl_abs, amount_usd, amount_usd_abs
        FROM scrap_dashboard_aggregate_downgrade
        """
    )
    op.drop_table("scrap_reconciliation_partitions")
    op.drop_table("scrap_occurrence_observations")
    op.drop_index("ix_scrap_transaction_occurrence_content", table_name="scrap_transactions")
    op.drop_index("ix_scrap_transactions_occurrence_id", table_name="scrap_transactions")
    op.drop_constraint("fk_scrap_transaction_occurrence", "scrap_transactions", type_="foreignkey")
    op.drop_column("scrap_transactions", "occurrence_id")
    op.drop_index("ix_scrap_occurrence_partition_status", table_name="scrap_occurrences")
    op.drop_table("scrap_occurrences")
