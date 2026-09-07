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
            "status IN ('PLANNED','IN_PROGRESS','IMPLEMENTED','UNDER_VERIFICATION','EFFECTIVE','CANCELLED')",
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
    blocked_reason: Mapped[str | None] = mapped_column(Text, default=None)
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
    scope: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)
    sha256: Mapped[str] = mapped_column(String(64))
    factory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_factories.id", ondelete="RESTRICT"), index=True)
    sealed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class SnapshotItem(GovernanceEntity):
    __tablename__ = "gov_snapshot_items"
    __table_args__ = (UniqueConstraint("snapshot_id", "occurrence_id", name="uq_gov_snapshot_occurrence"),)
    snapshot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_dataset_snapshots.id", ondelete="RESTRICT"))
    occurrence_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_occurrences.id", ondelete="RESTRICT"))
    transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scrap_transactions.id", ondelete="RESTRICT"))
    frozen_values: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)


class Report(GovernanceEntity):
    __tablename__ = "gov_reports"
    __table_args__ = (UniqueConstraint("factory_id", "code", name="uq_gov_report_code"),)
    factory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_factories.id", ondelete="RESTRICT"))
    code: Mapped[str] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(240))


class ReportVersion(GovernanceEntity):
    __tablename__ = "gov_report_versions"
    __table_args__ = (
        UniqueConstraint("report_id", "revision", name="uq_gov_report_revision"),
        CheckConstraint("revision > 0", name="ck_gov_report_revision"),
    )
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_reports.id", ondelete="RESTRICT"))
    snapshot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_dataset_snapshots.id", ondelete="RESTRICT"))
    revision: Mapped[int] = mapped_column(Integer)
    content: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE)
    template_version: Mapped[str] = mapped_column(String(80))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class ReportAnalysis(GovernanceEntity):
    __tablename__ = "gov_report_analyses"
    __table_args__ = (UniqueConstraint("report_version_id", "analysis_id", name="uq_gov_report_analysis"),)
    report_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_report_versions.id", ondelete="RESTRICT"))
    analysis_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_analysis_versions.id", ondelete="RESTRICT"))


class ExportJob(GovernanceEntity):
    __tablename__ = "gov_export_jobs"
    __table_args__ = (
        CheckConstraint("format IN ('PDF','PPTX','CSV','XLSX')", name="ck_gov_export_format"),
        CheckConstraint("status IN ('QUEUED','RUNNING','COMPLETED','FAILED')", name="ck_gov_export_status"),
        Index("ix_gov_export_queue", "status", "created_at"),
    )
    report_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_report_versions.id", ondelete="RESTRICT"))
    idempotency_key: Mapped[str] = mapped_column(String(160), unique=True)
    format: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(20), default="QUEUED")
    options: Mapped[dict[str, Any]] = mapped_column(JSON_TYPE, default_factory=dict)


class Artifact(GovernanceEntity):
    __tablename__ = "gov_artifacts"
    export_job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gov_export_jobs.id", ondelete="RESTRICT"), unique=True)
    storage_key: Mapped[str] = mapped_column(String(500), unique=True)
    sha256: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(Integer)
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
