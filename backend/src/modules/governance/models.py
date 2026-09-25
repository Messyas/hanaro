"""Additive governance schema; source Scrap identities remain authoritative.

Business commands belong to future services. Database constraints enforce local
invariants, while version columns provide SQLAlchemy optimistic concurrency.
"""

import uuid
from datetime import UTC, date, datetime
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


def now() -> datetime:
    return datetime.now(UTC)


class GovernanceEntity(Base, kw_only=True):
    __abstract__ = True
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default_factory=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default_factory=now)


class Factory(GovernanceEntity):
    __tablename__ = "gov_factories"
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(160))
    timezone: Mapped[str] = mapped_column(String(60), default="America/Manaus")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ProductionLine(GovernanceEntity):
    __tablename__ = "gov_production_lines"
    __table_args__ = (UniqueConstraint("factory_id", "code", name="uq_gov_line_code"),)
    factory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_factories.id", ondelete="RESTRICT"))
    code: Mapped[str] = mapped_column(String(80))
    name: Mapped[str] = mapped_column(String(160))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class LineSourceMapping(GovernanceEntity):
    """A time-bounded translation from an ERP dimension to a production line."""

    __tablename__ = "gov_line_source_mappings"
    __table_args__ = (
        UniqueConstraint(
            "factory_id",
            "source_system",
            "organization_code",
            "receipt_department",
            "valid_from",
            name="uq_gov_line_source_mapping_start",
        ),
        CheckConstraint("valid_to IS NULL OR valid_to > valid_from", name="ck_gov_line_source_mapping_dates"),
        CheckConstraint("version > 0", name="ck_gov_line_source_mapping_version"),
        Index(
            "ix_gov_line_source_mapping_resolve",
            "factory_id",
            "source_system",
            "organization_code",
            "receipt_department",
            "valid_from",
        ),
    )
    factory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_factories.id", ondelete="RESTRICT"))
    line_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_production_lines.id", ondelete="RESTRICT"))
    source_system: Mapped[str] = mapped_column(String(60))
    organization_code: Mapped[str] = mapped_column(String(80))
    receipt_department: Mapped[str] = mapped_column(String(120))
    valid_from: Mapped[date] = mapped_column(Date)
    valid_to: Mapped[date | None] = mapped_column(Date, default=None)
    version: Mapped[int] = mapped_column(Integer, default=1)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)


class SourceCoverage(GovernanceEntity):
    """Append-only evidence that a source was complete, partial, or unknown."""

    __tablename__ = "gov_source_coverage"
    __table_args__ = (
        UniqueConstraint(
            "factory_id",
            "source_system",
            "scope_key",
            "business_date",
            "revision",
            name="uq_gov_source_coverage_revision",
        ),
        CheckConstraint("status IN ('COMPLETE','PARTIAL','UNKNOWN')", name="ck_gov_source_coverage_status"),
        CheckConstraint("revision > 0", name="ck_gov_source_coverage_revision"),
        Index("ix_gov_source_coverage_resolve", "factory_id", "source_system", "scope_key", "business_date", "revision"),
    )
    factory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_factories.id", ondelete="RESTRICT"))
    source_system: Mapped[str] = mapped_column(String(60))
    scope_key: Mapped[str] = mapped_column(String(64))
    business_date: Mapped[date] = mapped_column(Date)
    revision: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20))
    expected_partitions: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE, default_factory=dict)
    received_partitions: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE, default_factory=dict)
    source_revision: Mapped[str] = mapped_column(String(160), default="")
    extracted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    recorded_by_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)
    reason: Mapped[str] = mapped_column(Text, default="")
    sha256: Mapped[str] = mapped_column(String(64), default="")


class MetricTargetVersion(GovernanceEntity):
    """An approved target is immutable; corrections create a new revision."""

    __tablename__ = "gov_metric_target_versions"
    __table_args__ = (
        UniqueConstraint(
            "factory_id",
            "metric_code",
            "currency",
            "scope_key",
            "period_start",
            "period_end",
            "revision",
            name="uq_gov_metric_target_revision",
        ),
        CheckConstraint("amount >= 0", name="ck_gov_metric_target_amount"),
        CheckConstraint("period_end >= period_start", name="ck_gov_metric_target_dates"),
        CheckConstraint("revision > 0", name="ck_gov_metric_target_revision"),
        CheckConstraint("status IN ('DRAFT','APPROVED','SUPERSEDED')", name="ck_gov_metric_target_status"),
        Index(
            "ix_gov_metric_target_resolve",
            "factory_id",
            "metric_code",
            "currency",
            "scope_key",
            "period_start",
            "period_end",
            "revision",
        ),
    )
    factory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_factories.id", ondelete="RESTRICT"))
    metric_code: Mapped[str] = mapped_column(String(80))
    currency: Mapped[str] = mapped_column(String(3))
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    scope_key: Mapped[str] = mapped_column(String(64))
    revision: Mapped[int] = mapped_column(Integer)
    amount: Mapped[Decimal] = mapped_column(Numeric(24, 6))
    line_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("gov_production_lines.id", ondelete="RESTRICT"), default=None)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")
    author_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)
    source_legacy_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("scrap_targets.id", ondelete="RESTRICT"), default=None
    )


class LineLayout(GovernanceEntity):
    __tablename__ = "gov_line_layouts"
    __table_args__ = (
        UniqueConstraint("line_id", "revision", name="uq_gov_layout_revision"),
        CheckConstraint("revision > 0", name="ck_gov_layout_revision"),
        CheckConstraint("valid_to IS NULL OR valid_to > valid_from", name="ck_gov_layout_dates"),
    )
    line_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_production_lines.id", ondelete="RESTRICT"))
    revision: Mapped[int] = mapped_column(Integer)
    valid_from: Mapped[date] = mapped_column(Date)
    valid_to: Mapped[date | None] = mapped_column(Date, default=None)


class Workstation(GovernanceEntity):
    __tablename__ = "gov_workstations"
    __table_args__ = (UniqueConstraint("layout_id", "code", name="uq_gov_station_code"),)
    layout_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_line_layouts.id", ondelete="RESTRICT"))
    code: Mapped[str] = mapped_column(String(80))
    name: Mapped[str] = mapped_column(String(160))
    position: Mapped[int] = mapped_column(Integer, default=0)


class ProductionVersion(GovernanceEntity):
    """Daily production revisions; one approved, current version per line/day."""

    __tablename__ = "gov_production_versions"
    __table_args__ = (
        UniqueConstraint("line_id", "production_date", "revision", name="uq_gov_production_revision"),
        CheckConstraint("quantity >= 0 AND revision > 0", name="ck_gov_production_values"),
        CheckConstraint("status IN ('DRAFT','APPROVED','SUPERSEDED')", name="ck_gov_production_status"),
        CheckConstraint("source IN ('MANUAL','IMPORT','ERP','DEMO')", name="ck_gov_production_source"),
        CheckConstraint("status <> 'APPROVED' OR approved_at IS NOT NULL", name="ck_gov_production_approval"),
        Index(
            "uq_gov_production_current",
            "line_id",
            "production_date",
            unique=True,
            postgresql_where=text("status = 'APPROVED'"),
            sqlite_where=text("status = 'APPROVED'"),
        ),
        Index("ix_gov_production_date", "production_date", "line_id"),
    )
    line_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_production_lines.id", ondelete="RESTRICT"))
    production_date: Mapped[date] = mapped_column(Date)
    revision: Mapped[int] = mapped_column(Integer)
    quantity: Mapped[Decimal] = mapped_column(Numeric(24, 6))
    unit: Mapped[str] = mapped_column(String(40), default="FINISHED_UNIT")
    source: Mapped[str] = mapped_column(String(20), default="MANUAL")
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")
    reason: Mapped[str] = mapped_column(Text, default="")
    author_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)
    approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class ProductionMeasurementVersion(GovernanceEntity):
    """Monthly global production denominators entered manually or imported."""

    __tablename__ = "gov_production_measurement_versions"
    __table_args__ = (
        UniqueConstraint(
            "year",
            "month",
            "scope_key",
            "revision",
            name="uq_gov_production_measurement_revision",
        ),
        CheckConstraint("month >= 1 AND month <= 12", name="ck_gov_production_measurement_month"),
        CheckConstraint("revision > 0", name="ck_gov_production_measurement_revision"),
        CheckConstraint(
            "production_value IS NULL OR production_value >= 0",
            name="ck_gov_production_measurement_value",
        ),
        CheckConstraint(
            "production_quantity IS NULL OR production_quantity >= 0",
            name="ck_gov_production_measurement_quantity",
        ),
        CheckConstraint(
            "status IN ('DRAFT','CONFIRMED','SUPERSEDED')",
            name="ck_gov_production_measurement_status",
        ),
        CheckConstraint("source IN ('MANUAL','IMPORT','ERP','MES','FINANCE')", name="ck_gov_production_measurement_source"),
        Index("ix_gov_production_measurement_period", "year", "month", "scope_key", "status"),
    )
    year: Mapped[int] = mapped_column(Integer)
    month: Mapped[int] = mapped_column(Integer)
    scope_key: Mapped[str] = mapped_column(String(64), default="GLOBAL")
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    production_value: Mapped[Decimal | None] = mapped_column(Numeric(24, 6), default=None)
    production_quantity: Mapped[Decimal | None] = mapped_column(Numeric(24, 6), default=None)
    note: Mapped[str] = mapped_column(Text, default="")
    revision: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="CONFIRMED")
    source: Mapped[str] = mapped_column(String(20), default="MANUAL")
    author_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)


class ReviewPolicy(GovernanceEntity):
    __tablename__ = "gov_review_policies"
    __table_args__ = (
        UniqueConstraint("factory_id", "code", "revision", name="uq_gov_policy_revision"),
        CheckConstraint("revision > 0", name="ck_gov_policy_revision"),
    )
    factory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_factories.id", ondelete="RESTRICT"))
    code: Mapped[str] = mapped_column(String(80))
    revision: Mapped[int] = mapped_column(Integer)
    rules: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)


class ReviewDecision(GovernanceEntity):
    __tablename__ = "gov_review_decisions"
    __table_args__ = (
        CheckConstraint("disposition IN ('REQUIRED','OPTIONAL','EXEMPT','UNDETERMINED')", name="ck_gov_decision_kind"),
        Index("ix_gov_decision_history", "occurrence_id", "created_at"),
    )
    occurrence_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_occurrences.id", ondelete="RESTRICT"))
    policy_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_review_policies.id", ondelete="RESTRICT"))
    disposition: Mapped[str] = mapped_column(String(20))
    reason: Mapped[str] = mapped_column(Text)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)


class ScrapCase(GovernanceEntity):
    __tablename__ = "gov_cases"
    __table_args__ = (
        UniqueConstraint("factory_id", "code", name="uq_gov_case_code"),
        CheckConstraint(
            "status IN ('NEW','TRIAGED','INVESTIGATING','AWAITING_APPROVAL','ANALYZED','CLOSED')", name="ck_gov_case_status"
        ),
        Index("ix_gov_case_queue", "factory_id", "status", "due_at", "id"),
    )
    factory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_factories.id", ondelete="RESTRICT"))
    code: Mapped[str] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(240))
    status: Mapped[str] = mapped_column(String(30), default="NEW")
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    version: Mapped[int] = mapped_column(Integer, default=1)
    __mapper_args__ = {"version_id_col": version}


class CaseOccurrence(GovernanceEntity):
    __tablename__ = "gov_case_occurrences"
    __table_args__ = (
        UniqueConstraint("case_id", "occurrence_id", name="uq_gov_case_occurrence"),
        Index(
            "uq_gov_occurrence_primary_case",
            "occurrence_id",
            unique=True,
            postgresql_where=text("is_primary AND unlinked_at IS NULL"),
            sqlite_where=text("is_primary AND unlinked_at IS NULL"),
        ),
    )
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_cases.id", ondelete="RESTRICT"))
    occurrence_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_occurrences.id", ondelete="RESTRICT"))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True)
    reason: Mapped[str] = mapped_column(Text, default="")
    unlinked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class AnalysisVersion(GovernanceEntity):
    __tablename__ = "gov_analysis_versions"
    __table_args__ = (
        UniqueConstraint("case_id", "revision", name="uq_gov_analysis_revision"),
        CheckConstraint("revision > 0", name="ck_gov_analysis_revision"),
        CheckConstraint("decision IN ('ACTION_REQUIRED','MONITOR_ONLY','NO_ACTION_REQUIRED')", name="ck_gov_analysis_decision"),
    )
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_cases.id", ondelete="RESTRICT"))
    revision: Mapped[int] = mapped_column(Integer)
    decision: Mapped[str] = mapped_column(String(30))
    content: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class ImprovementAction(GovernanceEntity):
    __tablename__ = "gov_actions"
    __table_args__ = (
        UniqueConstraint("factory_id", "code", name="uq_gov_action_code"),
        CheckConstraint(
            "status IN ('PLANNED','IN_PROGRESS','UNDER_VERIFICATION','COMPLETED')",
            name="ck_gov_action_status",
        ),
        Index("ix_gov_action_board", "factory_id", "status", "due_at", "id"),
        Index("ix_gov_action_owner", "owner_id", "status", "due_at"),
    )
    factory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_factories.id", ondelete="RESTRICT"))
    code: Mapped[str] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(240))
    status: Mapped[str] = mapped_column(String(30), default="PLANNED")
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    blocked_reason: Mapped[str | None] = mapped_column(Text, default=None)
    plan_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("gov_action_plans.id", ondelete="RESTRICT"), default=None)
    description: Mapped[str] = mapped_column(Text, default="")
    priority: Mapped[str] = mapped_column(String(10), default="MEDIUM")
    tags: Mapped[list[str]] = mapped_column(JSON_TYPE, default_factory=list, server_default=text("'[]'"))
    position: Mapped[int] = mapped_column(Integer, default=0)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default_factory=now)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    validated_by_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)
    version: Mapped[int] = mapped_column(Integer, default=1)
    __mapper_args__ = {"version_id_col": version}


class ActionCase(GovernanceEntity):
    __tablename__ = "gov_action_cases"
    __table_args__ = (UniqueConstraint("action_id", "case_id", name="uq_gov_action_case"),)
    action_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_actions.id", ondelete="RESTRICT"))
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_cases.id", ondelete="RESTRICT"))


class EffectivenessCheck(GovernanceEntity):
    __tablename__ = "gov_effectiveness_checks"
    __table_args__ = (
        CheckConstraint("result IN ('EFFECTIVE','INEFFECTIVE','INCONCLUSIVE')", name="ck_gov_effectiveness_result"),
        Index("ix_gov_effectiveness_action", "action_id", "created_at"),
    )
    action_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_actions.id", ondelete="RESTRICT"))
    result: Mapped[str] = mapped_column(String(20))
    measurement: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)
    evaluator_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)


class DatasetSnapshot(GovernanceEntity):
    __tablename__ = "gov_dataset_snapshots"
    __table_args__ = (CheckConstraint("schema_version > 0", name="ck_gov_dataset_snapshot_schema_version"),)
    scope: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)
    sha256: Mapped[str] = mapped_column(String(64))
    factory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_factories.id", ondelete="RESTRICT"), index=True)
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    manifest: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE, default_factory=dict)
    sealed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class SnapshotItem(GovernanceEntity):
    __tablename__ = "gov_snapshot_items"
    __table_args__ = (UniqueConstraint("snapshot_id", "occurrence_id", name="uq_gov_snapshot_occurrence"),)
    snapshot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_dataset_snapshots.id", ondelete="RESTRICT"))
    occurrence_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_occurrences.id", ondelete="RESTRICT"))
    transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_transactions.id", ondelete="RESTRICT"))
    frozen_values: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)
    review_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("scrap_reviews.id", ondelete="RESTRICT"), default=None)
    review_version: Mapped[int | None] = mapped_column(Integer, default=None)


class SnapshotFinancialRow(GovernanceEntity):
    """One immutable financial observation used by a V2 period close."""

    __tablename__ = "gov_snapshot_financial_rows"
    __table_args__ = (
        UniqueConstraint("snapshot_id", "window_key", "occurrence_id", name="uq_gov_snapshot_financial_row"),
        CheckConstraint("window_key IN ('CURRENT','COMPARISON')", name="ck_gov_snapshot_financial_window"),
        Index("ix_gov_snapshot_financial_rows_snapshot", "snapshot_id", "window_key", "occurrence_id"),
    )
    snapshot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_dataset_snapshots.id", ondelete="RESTRICT"))
    occurrence_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_occurrences.id", ondelete="RESTRICT"))
    transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_transactions.id", ondelete="RESTRICT"))
    frozen_values: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)
    window_key: Mapped[str] = mapped_column(String(20), default="CURRENT")


class Report(GovernanceEntity):
    __tablename__ = "gov_reports"
    __table_args__ = (
        UniqueConstraint("factory_id", "code", name="uq_gov_report_code"),
        CheckConstraint("status IN ('DRAFT','PUBLISHED','ARCHIVED')", name="ck_gov_report_status"),
        CheckConstraint("report_kind IN ('DOSSIER','PERIOD_CLOSE')", name="ck_gov_report_kind"),
        CheckConstraint("content_schema_version > 0", name="ck_gov_report_content_schema_version"),
        CheckConstraint("version > 0", name="ck_gov_report_version"),
        Index("ix_gov_report_list", "factory_id", "status", "updated_at", "id"),
    )
    factory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_factories.id", ondelete="RESTRICT"))
    code: Mapped[str] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(240))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")
    report_kind: Mapped[str] = mapped_column(String(20), default="DOSSIER")
    content_schema_version: Mapped[int] = mapped_column(Integer, default=1)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)
    updated_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)
    version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default_factory=now)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    __mapper_args__ = {"version_id_col": version}


class ReportScope(GovernanceEntity):
    """The saved window and filters that define a period-close report."""

    __tablename__ = "gov_report_scopes"
    __table_args__ = (UniqueConstraint("report_id", name="uq_gov_report_scope"),)
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_reports.id", ondelete="CASCADE"), index=True)
    period_from: Mapped[date] = mapped_column(Date)
    period_to: Mapped[date] = mapped_column(Date)
    scope_key: Mapped[str] = mapped_column(String(64))
    cutoff_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    timezone: Mapped[str] = mapped_column(String(60), default="America/Manaus")
    metric_code: Mapped[str] = mapped_column(String(80), default="MATERIAL_SCRAP_COST")
    metric_policy_version: Mapped[str] = mapped_column(String(40), default="scrap-cost-v1")
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    comparison_mode: Mapped[str] = mapped_column(String(20), default="NONE")
    comparison_from: Mapped[date | None] = mapped_column(Date, default=None)
    comparison_to: Mapped[date | None] = mapped_column(Date, default=None)
    is_provisional: Mapped[bool] = mapped_column(Boolean, default=False)
    filters: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE, default_factory=dict)


class ReportSection(GovernanceEntity):
    """An ordered editorial block in a V2 period-close draft."""

    __tablename__ = "gov_report_sections"
    __table_args__ = (
        UniqueConstraint("report_id", "section_key", name="uq_gov_report_section_key"),
        CheckConstraint("position >= 0", name="ck_gov_report_section_position"),
        Index("ix_gov_report_section_order", "report_id", "position", "id"),
    )
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_reports.id", ondelete="CASCADE"), index=True)
    section_key: Mapped[str] = mapped_column(String(80))
    kind: Mapped[str] = mapped_column(String(40))
    position: Mapped[int] = mapped_column(Integer)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    title: Mapped[str] = mapped_column(String(240), default="")
    payload_schema_version: Mapped[int] = mapped_column(Integer, default=1)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE, default_factory=dict)


class ReportActionSource(GovernanceEntity):
    __tablename__ = "gov_report_action_sources"
    __table_args__ = (
        UniqueConstraint("report_id", "action_id", name="uq_gov_report_action_source"),
        CheckConstraint("position >= 0", name="ck_gov_report_action_position"),
        Index("ix_gov_report_action_order", "report_id", "position", "id"),
    )
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_reports.id", ondelete="CASCADE"), index=True)
    action_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_actions.id", ondelete="RESTRICT"))
    position: Mapped[int] = mapped_column(Integer)


class ReportEvidenceSource(GovernanceEntity):
    __tablename__ = "gov_report_evidence_sources"
    __table_args__ = (
        CheckConstraint(
            "(review_attachment_id IS NOT NULL AND published_evidence_id IS NULL) OR "
            "(review_attachment_id IS NULL AND published_evidence_id IS NOT NULL)",
            name="ck_gov_report_evidence_one_source",
        ),
        CheckConstraint("position >= 0", name="ck_gov_report_evidence_position"),
        CheckConstraint(
            "role IN ('CONTEXT','BEFORE','AFTER','IMPLEMENTATION','MEASUREMENT')",
            name="ck_gov_report_evidence_role",
        ),
        Index("ix_gov_report_evidence_order", "report_id", "section_id", "position", "id"),
    )
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_reports.id", ondelete="CASCADE"), index=True)
    section_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_report_sections.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer)
    review_attachment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("scrap_review_attachments.id", ondelete="RESTRICT"), default=None
    )
    published_evidence_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("gov_published_evidence.id", ondelete="RESTRICT"), default=None
    )
    caption: Mapped[str] = mapped_column(Text, default="")
    role: Mapped[str] = mapped_column(String(20), default="CONTEXT")
    captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class ReportOccurrenceSource(GovernanceEntity):
    __tablename__ = "gov_report_occurrence_sources"
    __table_args__ = (
        UniqueConstraint("report_id", "occurrence_id", name="uq_gov_report_occurrence_source"),
        Index("ix_gov_report_occurrence_source_occurrence", "occurrence_id", "report_id"),
    )
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_reports.id", ondelete="CASCADE"), index=True)
    occurrence_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_occurrences.id", ondelete="RESTRICT"))


class ReportSource(GovernanceEntity):
    __tablename__ = "gov_report_sources"
    __table_args__ = (
        UniqueConstraint("report_id", "source_report_id", name="uq_gov_report_source"),
        CheckConstraint("report_id <> source_report_id", name="ck_gov_report_no_self_source"),
        Index("ix_gov_report_source_reverse", "source_report_id", "report_id"),
    )
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_reports.id", ondelete="CASCADE"), index=True)
    source_report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_reports.id", ondelete="RESTRICT"))


class ReportVersion(GovernanceEntity):
    __tablename__ = "gov_report_versions"
    __table_args__ = (
        UniqueConstraint("report_id", "revision", name="uq_gov_report_revision"),
        CheckConstraint("revision > 0", name="ck_gov_report_revision"),
        CheckConstraint("content_schema_version > 0", name="ck_gov_report_version_content_schema"),
    )
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_reports.id", ondelete="RESTRICT"))
    snapshot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_dataset_snapshots.id", ondelete="RESTRICT"))
    revision: Mapped[int] = mapped_column(Integer)
    content: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)
    template_version: Mapped[str] = mapped_column(String(80))
    content_schema_version: Mapped[int] = mapped_column(Integer, default=1)
    sha256: Mapped[str] = mapped_column(String(64), default="")
    published_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class ReportPublishReceipt(GovernanceEntity):
    """Durable receipt for an idempotent V2 publication command."""

    __tablename__ = "gov_report_publish_receipts"
    __table_args__ = (
        UniqueConstraint("report_id", "requested_by_user_id", "idempotency_key", name="uq_gov_report_publish_receipt"),
        Index("ix_gov_report_publish_receipt_lookup", "report_id", "requested_by_user_id", "idempotency_key"),
    )
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_reports.id", ondelete="RESTRICT"))
    report_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_report_versions.id", ondelete="RESTRICT"))
    requested_by_user_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"))
    idempotency_key: Mapped[str] = mapped_column(String(160))
    request_hash: Mapped[str] = mapped_column(String(64))


class ReportVersionSource(GovernanceEntity):
    __tablename__ = "gov_report_version_sources"
    __table_args__ = (
        UniqueConstraint("report_version_id", "source_report_version_id", name="uq_gov_report_version_source"),
        Index("ix_gov_report_version_source_report", "source_report_id", "report_version_id"),
    )
    report_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_report_versions.id", ondelete="RESTRICT"))
    source_report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_reports.id", ondelete="RESTRICT"))
    source_report_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_report_versions.id", ondelete="RESTRICT"))


class ReportAnalysis(GovernanceEntity):
    __tablename__ = "gov_report_analyses"
    __table_args__ = (UniqueConstraint("report_version_id", "analysis_id", name="uq_gov_report_analysis"),)
    report_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_report_versions.id", ondelete="RESTRICT"))
    analysis_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_analysis_versions.id", ondelete="RESTRICT"))


class ExportJob(GovernanceEntity):
    __tablename__ = "gov_export_jobs"
    __table_args__ = (
        CheckConstraint("format IN ('PDF','PPTX','CSV','MARKDOWN','XLSX')", name="ck_gov_export_format"),
        CheckConstraint("status IN ('QUEUED','RUNNING','COMPLETED','FAILED')", name="ck_gov_export_status"),
        Index("ix_gov_export_queue", "status", "created_at"),
    )
    report_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_report_versions.id", ondelete="RESTRICT"))
    idempotency_key: Mapped[str] = mapped_column(String(160), unique=True)
    format: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(20), default="QUEUED")
    options: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE, default_factory=dict)
    template_version: Mapped[str] = mapped_column(String(80), default="1")
    requested_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default_factory=now)
    error_message: Mapped[str | None] = mapped_column(String(500), default=None)
    lease_token: Mapped[uuid.UUID | None] = mapped_column(default=None)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class Artifact(GovernanceEntity):
    __tablename__ = "gov_artifacts"
    export_job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_export_jobs.id", ondelete="RESTRICT"), unique=True)
    storage_key: Mapped[str] = mapped_column(String(500), unique=True)
    sha256: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(Integer)
    filename: Mapped[str] = mapped_column(String(255), default="report")
    content_type: Mapped[str] = mapped_column(String(100), default="application/octet-stream")
    __table_args__ = (CheckConstraint("size_bytes > 0", name="ck_gov_artifact_size"),)


class AuditCycle(GovernanceEntity):
    __tablename__ = "gov_audit_cycles"
    __table_args__ = (
        UniqueConstraint("factory_id", "code", name="uq_gov_audit_code"),
        CheckConstraint("date_to >= date_from", name="ck_gov_audit_dates"),
        CheckConstraint(
            "status IN ('PLANNED','OPEN','FIELDWORK','IN_REVIEW','CLOSED','CANCELLED')", name="ck_gov_audit_status"
        ),
    )
    factory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_factories.id", ondelete="RESTRICT"))
    code: Mapped[str] = mapped_column(String(80))
    date_from: Mapped[date] = mapped_column(Date)
    date_to: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="PLANNED")
    population: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE, default_factory=dict)
    conclusion: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE, default_factory=dict)


class AuditFinding(GovernanceEntity):
    __tablename__ = "gov_audit_findings"
    __table_args__ = (Index("ix_gov_finding_cycle", "cycle_id", "status"),)
    cycle_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_audit_cycles.id", ondelete="RESTRICT"))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="OPEN")
    action_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("gov_actions.id", ondelete="RESTRICT"), default=None)


class AuditEvent(GovernanceEntity):
    __tablename__ = "gov_audit_events"
    __table_args__ = (Index("ix_gov_event_entity", "entity_type", "entity_id", "created_at"),)
    event_type: Mapped[str] = mapped_column(String(100))
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[uuid.UUID] = mapped_column()
    payload: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)
    correlation_id: Mapped[str] = mapped_column(String(160), index=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)


class OutboxEvent(GovernanceEntity):
    __tablename__ = "gov_outbox_events"
    __table_args__ = (
        CheckConstraint("attempts >= 0", name="ck_gov_outbox_attempts"),
        Index(
            "ix_gov_outbox_pending",
            "available_at",
            "id",
            postgresql_where=text("published_at IS NULL"),
            sqlite_where=text("published_at IS NULL"),
        ),
    )
    event_type: Mapped[str] = mapped_column(String(100))
    aggregate_id: Mapped[uuid.UUID] = mapped_column()
    payload: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default_factory=now)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class ConsumerReceipt(GovernanceEntity):
    __tablename__ = "gov_consumer_receipts"
    __table_args__ = (UniqueConstraint("consumer", "event_id", name="uq_gov_consumer_event"),)
    consumer: Mapped[str] = mapped_column(String(100))
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_outbox_events.id", ondelete="RESTRICT"))


class PublishedEvidence(GovernanceEntity):
    __tablename__ = "gov_published_evidence"
    source_attachment_id: Mapped[uuid.UUID] = mapped_column()
    storage_key: Mapped[str] = mapped_column(String(500), unique=True)
    sha256: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(Integer)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))


class ActionPlan(GovernanceEntity):
    __tablename__ = "gov_action_plans"
    __table_args__ = (CheckConstraint("status IN ('OPEN','COMPLETED')", name="ck_gov_plan_status"),)
    factory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_factories.id", ondelete="RESTRICT"))
    title: Mapped[str] = mapped_column(String(240))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="OPEN")
    author_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)
    version: Mapped[int] = mapped_column(Integer, default=1)
    __mapper_args__ = {"version_id_col": version}


class PlanReport(GovernanceEntity):
    __tablename__ = "gov_plan_reports"
    __table_args__ = (UniqueConstraint("plan_id", "report_version_id", name="uq_gov_plan_report"),)
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_action_plans.id", ondelete="RESTRICT"))
    report_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_report_versions.id", ondelete="RESTRICT"))


class ActionParticipant(GovernanceEntity):
    __tablename__ = "gov_action_participants"
    __table_args__ = (UniqueConstraint("action_id", "user_id", name="uq_gov_action_participant"),)
    action_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_actions.id", ondelete="RESTRICT"))
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"))


class ActionOccurrence(GovernanceEntity):
    __tablename__ = "gov_action_occurrences"
    __table_args__ = (UniqueConstraint("action_id", "occurrence_id", name="uq_gov_action_occurrence"),)
    action_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_actions.id", ondelete="RESTRICT"))
    occurrence_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_occurrences.id", ondelete="RESTRICT"))


class ActionEvidence(GovernanceEntity):
    __tablename__ = "gov_action_evidence"
    __table_args__ = (Index("ix_gov_action_evidence_action", "action_id", "created_at", "id"),)
    action_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_actions.id", ondelete="RESTRICT"))
    storage_key: Mapped[str] = mapped_column(String(500), unique=True)
    sha256: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(Integer)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    uploaded_by_user_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    deleted_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), default=None)


class NotificationRule(GovernanceEntity):
    __tablename__ = "gov_notification_rules"
    name: Mapped[str] = mapped_column(String(160))
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    config: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    __mapper_args__ = {"version_id_col": version}


class RuleEvaluation(GovernanceEntity):
    __tablename__ = "gov_rule_evaluations"
    __table_args__ = (UniqueConstraint("rule_id", "window_key", "subject", name="uq_gov_rule_window"),)
    rule_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_notification_rules.id", ondelete="RESTRICT"))
    window_key: Mapped[str] = mapped_column(String(80))
    subject: Mapped[str] = mapped_column(String(240))
    observed: Mapped[Decimal] = mapped_column(Numeric(24, 6))
    last_fired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    sequence: Mapped[int] = mapped_column(Integer, default=0)


class Alert(GovernanceEntity):
    __tablename__ = "gov_alerts"
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_outbox_events.id", ondelete="RESTRICT"), unique=True)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    severity: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(240))
    body: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)
    entity_id: Mapped[uuid.UUID] = mapped_column()
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class AlertRecipient(GovernanceEntity):
    __tablename__ = "gov_alert_recipients"
    __table_args__ = (UniqueConstraint("alert_id", "user_id", name="uq_gov_alert_recipient"),)
    alert_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_alerts.id", ondelete="RESTRICT"))
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class EmailDelivery(GovernanceEntity):
    __tablename__ = "gov_email_deliveries"
    __table_args__ = (UniqueConstraint("event_id", "user_id", name="uq_gov_email_recipient"),)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_outbox_events.id", ondelete="RESTRICT"))
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), index=True)
    recipient: Mapped[str] = mapped_column(String(100))
    subject: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="SIMULATED")
    provider: Mapped[str] = mapped_column(String(40), default="simulation")


class EventAttempt(GovernanceEntity):
    __tablename__ = "gov_event_attempts"
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_outbox_events.id", ondelete="RESTRICT"), index=True)
    attempt: Mapped[int] = mapped_column(Integer)
    outcome: Mapped[str] = mapped_column(String(20))
    error: Mapped[str | None] = mapped_column(String(200), default=None)
