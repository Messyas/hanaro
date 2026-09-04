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


class ScrapAutomationExecution(Base):
    """Lifecycle of a Smart Office run, including failures before ingestion."""

    __tablename__ = "scrap_automation_executions"
    __table_args__ = (
        Index("ix_scrap_automation_execution_started", "started_at", "id"),
        Index("ix_scrap_automation_execution_status_started", "status", "started_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    execution_id: Mapped[uuid.UUID] = mapped_column(unique=True, index=True)
    correlation_id: Mapped[str] = mapped_column(String(100), index=True)
    report_name: Mapped[str] = mapped_column(String(120))
    mode: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20), index=True)
    query_date_from: Mapped[date] = mapped_column(Date)
    query_date_to: Mapped[date] = mapped_column(Date)
    processing_date: Mapped[date] = mapped_column(Date)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source_system: Mapped[str] = mapped_column(String(20), default="GERP")
    trigger: Mapped[str] = mapped_column(String(20), default="SCHEDULED")
    current_step: Mapped[str | None] = mapped_column(String(40), default=None)
    organization_parameter: Mapped[str] = mapped_column(String(80), default="ALL")
    organizations_found: Mapped[list[str]] = mapped_column(JSON_TYPE, default_factory=list)
    timezone: Mapped[str] = mapped_column(String(64), default="America/Manaus")
    gerp_request_id: Mapped[str | None] = mapped_column(String(100), index=True, default=None)
    source_file_name: Mapped[str | None] = mapped_column(String(255), default=None)
    source_file_sha256: Mapped[str | None] = mapped_column(String(64), default=None)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    records_received: Mapped[int] = mapped_column(Integer, default=0)
    records_accepted: Mapped[int] = mapped_column(Integer, default=0)
    records_rejected: Mapped[int] = mapped_column(Integer, default=0)
    snapshot_status: Mapped[str] = mapped_column(String(30), default="NOT_PUBLISHED")
    failure_category: Mapped[str | None] = mapped_column(String(80), index=True, default=None)
    failure_code: Mapped[str | None] = mapped_column(String(100), default=None)
    failure_message: Mapped[str | None] = mapped_column(Text, default=None)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    ingestion_run_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("scrap_ingestion_runs.id", ondelete="SET NULL"), index=True, default=None
    )


class ScrapExecutionStep(Base):
    __tablename__ = "scrap_execution_steps"
    __table_args__ = (
        UniqueConstraint("execution_id", "step_code", "attempt", name="uq_scrap_execution_step_attempt"),
        Index("ix_scrap_execution_step_timeline", "execution_id", "sequence", "attempt", "started_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    execution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("scrap_automation_executions.id", ondelete="CASCADE"), index=True
    )
    step_code: Mapped[str] = mapped_column(String(40))
    sequence: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempt: Mapped[int] = mapped_column(Integer, default=1)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    duration_ms: Mapped[int | None] = mapped_column(Integer, default=None)
    message: Mapped[str | None] = mapped_column(String(2000), default=None)
    error_code: Mapped[str | None] = mapped_column(String(100), default=None)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSON_TYPE, default_factory=dict)


class ScrapExecutionNotification(Base):
    """Idempotent technical-notification outbox for actionable failures."""

    __tablename__ = "scrap_execution_notifications"
    __table_args__ = (UniqueConstraint("execution_id", "failure_code", name="uq_scrap_execution_notification"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    execution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("scrap_automation_executions.id", ondelete="CASCADE"), index=True
    )
    failure_code: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(String(1000), default=None)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


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
        Index("ix_scrap_transaction_occurrence_content", "occurrence_id", "content_hash"),
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
    occurrence_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("scrap_occurrences.id", ondelete="RESTRICT"), index=True, default=None
    )


class ScrapOccurrence(Base):
    """Stable business identity to which analyst reviews belong."""

    __tablename__ = "scrap_occurrences"
    __table_args__ = (
        UniqueConstraint("record_key_version", "record_key", "identity_slot", name="uq_scrap_occurrence_record_key"),
        Index("ix_scrap_occurrence_partition_status", "organization_code", "transaction_date", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    record_key: Mapped[str] = mapped_column(String(64))
    record_key_version: Mapped[str] = mapped_column(String(20))
    identity_slot: Mapped[int] = mapped_column(Integer)
    organization_code: Mapped[str] = mapped_column(String(40))
    transaction_date: Mapped[date] = mapped_column(Date)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE")
    current_transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(
            "scrap_transactions.id",
            name="fk_scrap_occurrence_current_transaction",
            ondelete="RESTRICT",
            use_alter=True,
        ),
        unique=True,
        default=None,
    )


class ScrapDefectType(Base):
    """Administrator-managed classification used by Scrap reviews."""

    __tablename__ = "scrap_defect_types"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)


class ScrapClassificationRule(Base):
    """Business-owned mapping used to classify immutable GERP source fields.

    The source columns are never changed.  A rule only controls the derived
    dimensions consumed by the Scrap views (product, department, counting and
    item type) or the friendly product alias shown to analysts.
    """

    __tablename__ = "scrap_classification_rules"
    __table_args__ = (
        UniqueConstraint("kind", "source_value", "source_context", name="uq_scrap_classification_rule_source"),
        Index("ix_scrap_classification_rule_kind_active", "kind", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    kind: Mapped[str] = mapped_column(String(30))
    source_value: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source_context: Mapped[str | None] = mapped_column(String(120), default=None)
    target_value: Mapped[str | None] = mapped_column(String(120), default=None)
    target_secondary: Mapped[str | None] = mapped_column(String(120), default=None)
    boolean_value: Mapped[bool | None] = mapped_column(Boolean, default=None)
    match_mode: Mapped[str] = mapped_column(String(20), default="EXACT")
    priority: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="SET NULL"), default=None)
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="SET NULL"), default=None)


class ScrapReview(Base):
    """One user-authored analysis for one stable Scrap occurrence."""

    __tablename__ = "scrap_reviews"
    __table_args__ = (
        CheckConstraint("status IN ('DRAFT', 'REVIEWED')", name="ck_scrap_review_status"),
        CheckConstraint("version >= 1", name="ck_scrap_review_version"),
        Index("ix_scrap_review_status_updated", "status", "updated_at"),
        Index("ix_scrap_review_responsible_status", "responsible_user_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    occurrence_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("scrap_occurrences.id", ondelete="RESTRICT"), unique=True, index=True
    )
    responsible_user_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), index=True)
    responsible_name: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    defect_type_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("scrap_defect_types.id", ondelete="RESTRICT"), index=True, default=None
    )
    source_review_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("scrap_reviews.id", ondelete="RESTRICT"), index=True, default=None
    )
    bulk_operation_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(
            "scrap_review_bulk_operations.id",
            name="fk_scrap_review_bulk_operation",
            ondelete="RESTRICT",
            use_alter=True,
        ),
        index=True,
        default=None,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class ScrapReviewAttachment(Base):
    """Metadata for one private, normalized image attached to a review."""

    __tablename__ = "scrap_review_attachments"
    __table_args__ = (
        UniqueConstraint("storage_key", name="uq_scrap_review_attachment_storage_key"),
        UniqueConstraint("review_id", "position", name="uq_scrap_review_attachment_position"),
        CheckConstraint("size_bytes > 0", name="ck_scrap_review_attachment_size"),
        CheckConstraint("width > 0 AND height > 0", name="ck_scrap_review_attachment_dimensions"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    review_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_reviews.id", ondelete="CASCADE"), index=True)
    storage_key: Mapped[str] = mapped_column(String(64))
    original_filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(40))
    size_bytes: Mapped[int] = mapped_column(Integer)
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    position: Mapped[int] = mapped_column(Integer)
    uploaded_by_user_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ScrapReviewBulkOperation(Base):
    """Audit record for reviews cloned from one finalized reference."""

    __tablename__ = "scrap_review_bulk_operations"
    __table_args__ = (CheckConstraint("status = 'COMPLETED'", name="ck_scrap_review_bulk_status"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    reference_review_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_reviews.id", ondelete="RESTRICT"), index=True)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), index=True)
    status: Mapped[str] = mapped_column(String(20))
    requested_count: Mapped[int] = mapped_column(Integer)
    created_count: Mapped[int] = mapped_column(Integer)
    skipped_count: Mapped[int] = mapped_column(Integer)
    copy_attachments: Mapped[bool] = mapped_column(Boolean)
    selection_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ScrapOccurrenceObservation(Base):
    """One authoritative observation of an occurrence in one ingestion run."""

    __tablename__ = "scrap_occurrence_observations"
    __table_args__ = (
        UniqueConstraint("run_id", "occurrence_id", name="uq_scrap_occurrence_observation_run"),
        UniqueConstraint("run_id", "source_row_number", name="uq_scrap_occurrence_observation_source_row"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_ingestion_runs.id", ondelete="CASCADE"), index=True)
    occurrence_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_occurrences.id", ondelete="RESTRICT"), index=True)
    transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_transactions.id", ondelete="RESTRICT"), index=True)
    source_line: Mapped[int] = mapped_column("source_row_number", Integer)
    content_hash: Mapped[str] = mapped_column(String(64))
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ScrapReconciliationPartition(Base):
    """Lockable authoritative partition used to serialize concurrent snapshots."""

    __tablename__ = "scrap_reconciliation_partitions"
    __table_args__ = (UniqueConstraint("organization_code", "transaction_date", name="uq_scrap_reconciliation_partition"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    organization_code: Mapped[str] = mapped_column(String(40))
    transaction_date: Mapped[date] = mapped_column(Date)


class ScrapDashboardAggregate(Base):
    """Pre-calculated dashboard fact at the smallest supported filter grain."""

    __tablename__ = "scrap_dashboard_aggregates"
    __table_args__ = (
        UniqueConstraint("occurrence_id", name="uq_scrap_dashboard_aggregate_occurrence"),
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
    occurrence_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_occurrences.id", ondelete="CASCADE"), index=True)


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


class ScrapReviewTemplate(Base):
    """Reusable review template (favorited pattern) created by an analyst."""

    __tablename__ = "scrap_review_templates"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4, init=False)
    name: Mapped[str] = mapped_column(String(150), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    defect_type_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("scrap_defect_types.id", ondelete="SET NULL"), default=None, index=True
    )
    source_review_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("scrap_reviews.id", ondelete="SET NULL"), default=None, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
