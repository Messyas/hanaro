"""Persist the business classifications previously maintained in spreadsheets.

Revision ID: 20260903_10
Revises: 20260902_09
Create Date: 2026-09-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260903_10"
down_revision: str | None = "20260902_09"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.create_table(
        "scrap_classification_rules",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("source_value", sa.String(length=500), nullable=False),
        sa.Column("source_context", sa.String(length=120), nullable=True),
        sa.Column("target_value", sa.String(length=120), nullable=True),
        sa.Column("target_secondary", sa.String(length=120), nullable=True),
        sa.Column("boolean_value", sa.Boolean(), nullable=True),
        sa.Column("match_mode", sa.String(length=20), server_default="EXACT", nullable=False),
        sa.Column("priority", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["user.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by_id"], ["user.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("kind", "source_value", "source_context", name="uq_scrap_classification_rule_source"),
    )
    op.create_index("ix_scrap_classification_rule_kind_active", "scrap_classification_rules", ["kind", "is_active"])

    classification_rules = sa.table(
        "scrap_classification_rules",
        sa.column("kind", sa.String),
        sa.column("source_value", sa.String),
        sa.column("source_context", sa.String),
        sa.column("target_value", sa.String),
        sa.column("target_secondary", sa.String),
        sa.column("boolean_value", sa.Boolean),
        sa.column("match_mode", sa.String),
        sa.column("priority", sa.Integer),
    )
    op.bulk_insert(
        classification_rules,
        [
            *[
                {
                    "kind": "ORGANIZATION",
                    "source_value": code,
                    "source_context": None,
                    "target_value": product,
                    "target_secondary": division,
                    "boolean_value": None,
                    "match_mode": "EXACT",
                    "priority": 0,
                }
                for code, product, division in (
                    ("NWK", "BM", "BM"),
                    ("NW1", "TV", "HE"),
                    ("NW4", "AV", "HE"),
                    ("NWH", "MNT", "MNT"),
                    ("NWX", "AV", "HE"),
                    ("NWU", "AV", "HE"),
                    ("NWD", "TV", "HE"),
                    ("NWE", "TV", "HE"),
                    ("NWW", "MNT", "MNT"),
                    ("NWZ", "TV", "HE"),
                )
            ],
            *[
                {
                    "kind": "DEPARTMENT",
                    "source_value": source,
                    "source_context": None,
                    "target_value": target,
                    "target_secondary": None,
                    "boolean_value": None,
                    "match_mode": "EXACT",
                    "priority": 0,
                }
                for source, target in (
                    ("RMA", "RMA"),
                    ("BM1", "FA"),
                    ("BM2", "FA"),
                    ("BMCELL", "FA"),
                    ("TSE", "OSP"),
                    ("SMT", "SMT"),
                    ("IPI", "IPI"),
                )
            ],
            *[
                {
                    "kind": "COUNTING",
                    "source_value": description,
                    "source_context": alias,
                    "target_value": None,
                    "target_secondary": None,
                    "boolean_value": counted,
                    "match_mode": "EXACT",
                    "priority": 0,
                }
                for description, alias, counted in (
                    ("DEFECT - DIRECT CHARGED", "D-DIRECT", True),
                    ("DEFECT FOR EXCESSIVE QTY OVER QPA(BOM)", "D-EXPENSE", True),
                    ("CONSUMABLE SUPPLIES EXPENSE", "E-CONSM", False),
                    ("MATERIAL REQUEST FOR R&D(INSIDE LAB)", "E-RND-INM", False),
                )
            ],
            *[
                {
                    "kind": "ITEM_TYPE",
                    "source_value": pattern,
                    "source_context": None,
                    "target_value": target,
                    "target_secondary": None,
                    "boolean_value": None,
                    "match_mode": "REGEX",
                    "priority": index,
                }
                for index, (pattern, target) in enumerate(
                    (
                        (r"^(?:pcba|pcb assembly|printed circuit)(?:,|\b)", "PCBA"),
                        (r"^tape(?:,|\b)", "Tape"),
                        (r"^(?:cover assembly)(?:,|\b)", "Cover Assembly"),
                        (r"^cover(?:,|\b)", "Cover"),
                        (r"^(?:lcd|led assembly|module)(?:,|\b)", "Module"),
                        (r"^chassis(?:,|\b)", "Chassis"),
                        (r"^box(?:,|\b)", "Box"),
                        (r"^packing(?:,|\b)", "Packing"),
                        (r"^base(?:,|\b)", "Base"),
                        (r"^lens(?:,|\b)", "Lens"),
                        (r"^gasket(?:,|\b)", "Gasket"),
                        (r"^sheet(?:,|\b)", "Sheet"),
                        (r"^part(?:,|\b)", "Part"),
                    )
                )
            ],
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_scrap_classification_rule_kind_active", table_name="scrap_classification_rules")
    op.drop_table("scrap_classification_rules")
