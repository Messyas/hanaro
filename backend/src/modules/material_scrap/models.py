import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ...infrastructure.database.session import Base

JSON_TYPE = JSON().with_variant(JSONB(), "postgresql")


class IngestionRun(Base):
    __tablename__ = "scrap_ingestion_runs"
    __table_args__ = (
        Index(
            "ix_scrap_ingestion_active_window",
            "report_name",
            "organization_scope",
            "date_from",
            "date_to",
            "is_active",
        ),
        Index("ix_scrap_ingestion_status_finished", "status", "ingestion_finished_at"),
        Index(
            "uq_scrap_ingestion_one_active_window",
            "report_name",
            "organization_scope",
            "date_from",
            "date_to",
            unique=True,
            postgresql_where=text("is_active"),
            sqlite_where=text("is_active"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    execution_id: Mapped[uuid.UUID] = mapped_column(unique=True, index=True)
    report_name: Mapped[str] = mapped_column(String(80))
    organization_scope: Mapped[str] = mapped_column(String(80))
    date_from: Mapped[date] = mapped_column(Date)
    date_to: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), index=True)
    schema_version: Mapped[str] = mapped_column(String(20))
    source_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source_finished_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ingestion_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    ingestion_finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    read_count: Mapped[int] = mapped_column(Integer, default=0)
    accepted_count: Mapped[int] = mapped_column(Integer, default=0)
    rejected_count: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, default=None)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)


class IngestionSourceFile(Base):
    __tablename__ = "scrap_ingestion_source_files"
    __table_args__ = (
        UniqueConstraint("run_id", name="uq_scrap_source_file_run"),
        Index("ix_scrap_source_sha256", "sha256"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_ingestion_runs.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    sha256: Mapped[str] = mapped_column(String(64))
    encoding: Mapped[str] = mapped_column(String(30))
    delimiter: Mapped[str] = mapped_column(String(20))
    reconstructed_rows: Mapped[int] = mapped_column(Integer)
    request_id: Mapped[str | None] = mapped_column(String(100), default=None)
    extracted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class ExchangeRate(Base):
    __tablename__ = "scrap_exchange_rates"
    __table_args__ = (UniqueConstraint("run_id", name="uq_scrap_exchange_rate_run"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_ingestion_runs.id", ondelete="CASCADE"), index=True)
    base_currency: Mapped[str] = mapped_column(String(3))
    quote_currency: Mapped[str] = mapped_column(String(3))
    brl_per_usd: Mapped[Decimal] = mapped_column(Numeric(12, 6))
    source: Mapped[str] = mapped_column(String(80))
    requested_date: Mapped[date] = mapped_column(Date)
    effective_date: Mapped[date] = mapped_column(Date)
    fallback_used: Mapped[bool] = mapped_column(Boolean)


class ScrapTransaction(Base):
    __tablename__ = "scrap_transactions"
    __table_args__ = (
        UniqueConstraint("run_id", "source_row_number", name="uq_scrap_transaction_source_row"),
        Index("ix_scrap_transaction_run_date", "run_id", "transaction_date"),
        Index("ix_scrap_transaction_organization", "organization_code"),
        Index("ix_scrap_transaction_receipt_department", "receipt_department"),
        Index("ix_scrap_transaction_department", "department"),
        Index("ix_scrap_transaction_product", "product"),
        Index("ix_scrap_transaction_division", "division"),
        Index("ix_scrap_transaction_item_type", "item_type"),
        Index("ix_scrap_transaction_account_code", "account_code"),
        Index("ix_scrap_transaction_account_alias", "account_alias"),
        Index("ix_scrap_transaction_item_code", "item_code"),
        Index("ix_scrap_transaction_to_be_counted", "to_be_counted"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_ingestion_runs.id", ondelete="CASCADE"), index=True)
    source_row_number: Mapped[int] = mapped_column(Integer)
    organization_code: Mapped[str] = mapped_column(String(40))
    transaction_date: Mapped[date] = mapped_column(Date)
    issue_quantity: Mapped[Decimal] = mapped_column(Numeric(20, 6))
    issue_amount_brl: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    amount_usd: Mapped[Decimal] = mapped_column(Numeric(20, 6))
    period: Mapped[date] = mapped_column(Date)
    period_yy_mm: Mapped[str] = mapped_column(String(5))
    quality_flags: Mapped[list[str]] = mapped_column(JSON_TYPE)
    derivation_provenance: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)
    account_code: Mapped[str | None] = mapped_column(String(80), default=None)
    account_description: Mapped[str | None] = mapped_column(Text, default=None)
    account_alias: Mapped[str | None] = mapped_column(String(100), default=None)
    subinventory_group: Mapped[str | None] = mapped_column(String(100), default=None)
    subinventory: Mapped[str | None] = mapped_column(String(100), default=None)
    warehouse_market: Mapped[str | None] = mapped_column(String(100), default=None)
    receipt_department: Mapped[str | None] = mapped_column(String(120), default=None)
    receipt_description: Mapped[str | None] = mapped_column(Text, default=None)
    item_code: Mapped[str | None] = mapped_column(String(100), default=None)
    uit: Mapped[str | None] = mapped_column(String(100), default=None)
    item_description: Mapped[str | None] = mapped_column(Text, default=None)
    item_specification: Mapped[str | None] = mapped_column(Text, default=None)
    issue_price: Mapped[Decimal | None] = mapped_column(Numeric(20, 8), default=None)
    sales_price: Mapped[Decimal | None] = mapped_column(Numeric(20, 8), default=None)
    sales_amount_brl: Mapped[Decimal | None] = mapped_column(Numeric(20, 2), default=None)
    warehouse_keeper: Mapped[str | None] = mapped_column(String(120), default=None)
    planner: Mapped[str | None] = mapped_column(String(120), default=None)
    work_order: Mapped[str | None] = mapped_column(String(120), default=None)
    reason: Mapped[str | None] = mapped_column(Text, default=None)
    requisition_reason: Mapped[str | None] = mapped_column(Text, default=None)
    requisition_comment: Mapped[str | None] = mapped_column(Text, default=None)
    reference: Mapped[str | None] = mapped_column(String(255), default=None)
    make_item: Mapped[str | None] = mapped_column(String(20), default=None)
    created_by: Mapped[str | None] = mapped_column(String(120), default=None)
    department: Mapped[str | None] = mapped_column(String(120), default=None)
    product: Mapped[str | None] = mapped_column(String(40), default=None)
    division: Mapped[str | None] = mapped_column(String(40), default=None)
    item_type: Mapped[str | None] = mapped_column(String(40), default=None)
    to_be_counted: Mapped[bool | None] = mapped_column(Boolean, default=None)
