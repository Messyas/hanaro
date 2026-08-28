import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
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
    exchange_rate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("daily_exchange_rates.id", ondelete="RESTRICT"), index=True)
    report_name: Mapped[str] = mapped_column(String(80))
    organization_scope: Mapped[str] = mapped_column(String(80))
    date_from: Mapped[date] = mapped_column(Date)
    date_to: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), index=True)
    schema_version: Mapped[str] = mapped_column(String(20))
    mapping_version: Mapped[str] = mapped_column(String(40))
    mode: Mapped[str] = mapped_column(String(40))
    processing_date: Mapped[date] = mapped_column(Date)
    query_window_inferred: Mapped[bool] = mapped_column(Boolean)
    source_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source_finished_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ingestion_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    ingestion_finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    read_count: Mapped[int] = mapped_column(Integer, default=0)
    accepted_count: Mapped[int] = mapped_column(Integer, default=0)
    rejected_count: Mapped[int] = mapped_column(Integer, default=0)
    issue_amount_brl_total: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=Decimal("0.00"))
    sales_amount_total: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=Decimal("0.00"))
    expanded_comment_rows: Mapped[int] = mapped_column(Integer, default=0)
    quality_flag_counts: Mapped[dict[str, int]] = mapped_column(JSON_TYPE, default_factory=dict)
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
    size_bytes: Mapped[int] = mapped_column(Integer)
    request_id: Mapped[str | None] = mapped_column(String(100), default=None)
    extracted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class DailyExchangeRate(Base):
    __tablename__ = "daily_exchange_rates"
    __table_args__ = (
        UniqueConstraint(
            "rate_date",
            "base_currency",
            "quote_currency",
            "quote_type",
            "source",
            name="uq_daily_exchange_rate_identity",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    rate_date: Mapped[date] = mapped_column(Date, index=True)
    effective_date: Mapped[date] = mapped_column(Date)
    base_currency: Mapped[str] = mapped_column(String(3))
    quote_currency: Mapped[str] = mapped_column(String(3))
    brl_per_usd: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    quote_type: Mapped[str] = mapped_column(String(80))
    source: Mapped[str] = mapped_column(String(80))
    fallback_used: Mapped[bool] = mapped_column(Boolean)
    retrieved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


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
        Index("ix_scrap_transaction_date_organization", "transaction_date", "organization_code"),
        Index("ix_scrap_transaction_date_division", "transaction_date", "division"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_ingestion_runs.id", ondelete="CASCADE"), index=True)
    source_line: Mapped[int] = mapped_column("source_row_number", Integer)
    organization_code: Mapped[str] = mapped_column(String(40))
    transaction_date: Mapped[date] = mapped_column(Date)
    issue_quantity: Mapped[Decimal] = mapped_column(Numeric(20, 6))
    issue_amount_brl: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    amount_usd: Mapped[Decimal] = mapped_column(Numeric(20, 6))
    period: Mapped[str] = mapped_column(String(7))
    period_yy_mm: Mapped[str] = mapped_column(String(5))
    quality_flags: Mapped[list[str]] = mapped_column(JSON_TYPE)
    derivation_provenance: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)
    account_code: Mapped[str | None] = mapped_column(String(80), default=None)
    account_description: Mapped[str | None] = mapped_column(Text, default=None)
    account_alias: Mapped[str | None] = mapped_column(String(100), default=None)
    subinventory_group: Mapped[str | None] = mapped_column(String(100), default=None)
    subinventory_code: Mapped[str | None] = mapped_column("subinventory", String(100), default=None)
    warehouse_market: Mapped[str | None] = mapped_column(String(100), default=None)
    receipt_department: Mapped[str | None] = mapped_column(String(120), default=None)
    receipt_description: Mapped[str | None] = mapped_column(Text, default=None)
    item_code: Mapped[str | None] = mapped_column(String(100), default=None)
    uit: Mapped[str | None] = mapped_column(String(100), default=None)
    item_description: Mapped[str | None] = mapped_column(Text, default=None)
    item_specification: Mapped[str | None] = mapped_column(Text, default=None)
    issue_price: Mapped[Decimal | None] = mapped_column(Numeric(20, 8), default=None)
    sales_price: Mapped[Decimal | None] = mapped_column(Numeric(20, 8), default=None)
    sales_amount: Mapped[Decimal | None] = mapped_column("sales_amount_brl", Numeric(20, 2), default=None)
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
    content_hash: Mapped[str] = mapped_column(String(64), index=True, default="")


class ScrapDashboardAggregate(Base):
    """Pre-calculated dashboard fact at the smallest supported filter grain."""

    __tablename__ = "scrap_dashboard_aggregates"
    __table_args__ = (
        UniqueConstraint(
            "run_id",
            "transaction_date",
            "organization_code",
            "receipt_department",
            "department",
            "product",
            "division",
            "item_type",
            "account_code",
            "account_alias",
            "item_code",
            "to_be_counted_key",
            name="uq_scrap_dashboard_aggregate_grain",
        ),
        Index("ix_scrap_dashboard_run_date", "run_id", "transaction_date"),
        Index("ix_scrap_dashboard_date_product", "transaction_date", "product"),
        Index("ix_scrap_dashboard_date_line", "transaction_date", "receipt_department"),
        Index("ix_scrap_dashboard_date_division", "transaction_date", "division"),
        Index("ix_scrap_dashboard_date_component", "transaction_date", "item_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_ingestion_runs.id", ondelete="CASCADE"), index=True)
    transaction_date: Mapped[date] = mapped_column(Date)
    organization_code: Mapped[str] = mapped_column(String(40))
    receipt_department: Mapped[str] = mapped_column(String(120))
    department: Mapped[str] = mapped_column(String(120))
    product: Mapped[str] = mapped_column(String(40))
    division: Mapped[str] = mapped_column(String(40))
    item_type: Mapped[str] = mapped_column(String(40))
    account_code: Mapped[str] = mapped_column(String(80))
    account_alias: Mapped[str] = mapped_column(String(100))
    item_code: Mapped[str] = mapped_column(String(100))
    to_be_counted_key: Mapped[str] = mapped_column(String(10))
    record_count: Mapped[int] = mapped_column(Integer)
    issue_quantity: Mapped[Decimal] = mapped_column(Numeric(24, 6))
    issue_quantity_abs: Mapped[Decimal] = mapped_column(Numeric(24, 6))
    issue_amount_brl: Mapped[Decimal] = mapped_column(Numeric(24, 2))
    issue_amount_brl_abs: Mapped[Decimal] = mapped_column(Numeric(24, 2))
    amount_usd: Mapped[Decimal] = mapped_column(Numeric(24, 6))
    amount_usd_abs: Mapped[Decimal] = mapped_column(Numeric(24, 6))


class ScrapDashboardState(Base):
    """Singleton revision used to version response-cache keys."""

    __tablename__ = "scrap_dashboard_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1, init=False)
    revision: Mapped[uuid.UUID] = mapped_column(default_factory=uuid.uuid4, init=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ScrapTarget(Base):
    """Administrator-managed global monthly IF Cost target."""

    __tablename__ = "scrap_targets"
    __table_args__ = (
        UniqueConstraint("year", "month", "currency", name="uq_scrap_target_period_currency"),
        Index("ix_scrap_target_year_currency", "year", "currency"),
        CheckConstraint("year BETWEEN 2000 AND 2100", name="ck_scrap_target_year"),
        CheckConstraint("month BETWEEN 1 AND 12", name="ck_scrap_target_month"),
        CheckConstraint("currency IN ('BRL', 'USD')", name="ck_scrap_target_currency"),
        CheckConstraint("amount >= 0", name="ck_scrap_target_amount"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    year: Mapped[int] = mapped_column(Integer)
    month: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3))
    amount: Mapped[Decimal] = mapped_column(Numeric(24, 6))
    updated_by_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
