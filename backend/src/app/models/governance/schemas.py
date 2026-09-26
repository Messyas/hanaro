import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ReportStatus = Literal["DRAFT", "PUBLISHED", "ARCHIVED"]
ReportKind = Literal["DOSSIER", "PERIOD_CLOSE"]
ComparisonMode = Literal["NONE", "PREVIOUS_YEAR", "CUSTOM"]
ExportFormat = Literal["CSV", "PDF", "PPTX", "MARKDOWN"]


class Page(BaseModel):
    items: list[Any]
    page: int
    page_size: int
    total: int
    total_pages: int
    has_next: bool
    has_previous: bool


class ReportScopeFilters(BaseModel):
    """Typed filters intentionally limited to the dimensions available today."""

    model_config = ConfigDict(extra="forbid")

    organization_codes: list[str] = Field(default_factory=list, max_length=100)
    product_codes: list[str] = Field(default_factory=list, max_length=100)
    divisions: list[str] = Field(default_factory=list, max_length=100)
    lines: list[str] = Field(default_factory=list, max_length=100)


class ReportScopeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    period_from: date
    period_to: date
    cutoff_at: datetime | None = None
    timezone: str = Field(default="America/Manaus", min_length=1, max_length=60)
    metric_code: Literal["MATERIAL_SCRAP_COST"] = "MATERIAL_SCRAP_COST"
    metric_policy_version: Literal["scrap-cost-v1"] = "scrap-cost-v1"
    currency: Literal["BRL", "USD"] = "USD"
    comparison_mode: ComparisonMode = "NONE"
    comparison_from: date | None = None
    comparison_to: date | None = None
    is_provisional: bool = False
    filters: ReportScopeFilters = Field(default_factory=ReportScopeFilters)

    @model_validator(mode="after")
    def validate_period(self) -> "ReportScopeInput":
        if self.period_to < self.period_from:
            raise ValueError("period_to must be on or after period_from")
        if self.comparison_mode == "CUSTOM":
            if self.comparison_from is None or self.comparison_to is None:
                raise ValueError("CUSTOM comparison requires comparison_from and comparison_to")
            if self.comparison_to < self.comparison_from:
                raise ValueError("comparison_to must be on or after comparison_from")
        elif self.comparison_from is not None or self.comparison_to is not None:
            raise ValueError("comparison dates are allowed only for CUSTOM comparison")
        return self


class ReportCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    description: str = Field(default="", max_length=10_000)
    factory_id: uuid.UUID | None = None
    report_kind: ReportKind = "DOSSIER"
    content_schema_version: int = Field(default=1, ge=1)
    scope: ReportScopeInput | None = None

    @model_validator(mode="after")
    def validate_kind_and_scope(self) -> "ReportCreate":
        if self.report_kind == "PERIOD_CLOSE" and self.scope is None:
            raise ValueError("PERIOD_CLOSE reports require a scope")
        if self.report_kind == "PERIOD_CLOSE" and self.content_schema_version < 2:
            raise ValueError("PERIOD_CLOSE reports require content_schema_version 2 or later")
        if self.report_kind == "DOSSIER" and self.scope is not None:
            raise ValueError("DOSSIER reports do not accept a period scope")
        return self


class ReportUpdate(BaseModel):
    expected_version: int = Field(ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=240)
    description: str | None = Field(default=None, max_length=10_000)

    @model_validator(mode="after")
    def require_change(self) -> "ReportUpdate":
        if self.title is None and self.description is None:
            raise ValueError("At least one editable field is required")
        return self


class SourceMutation(BaseModel):
    expected_version: int = Field(ge=1)
    ids: list[uuid.UUID] = Field(max_length=500)


class ReportScopeUpdate(BaseModel):
    expected_version: int = Field(ge=1)
    scope: ReportScopeInput


ReportSectionKind = Literal[
    "CONTEXT",
    "EXECUTIVE_SUMMARY",
    "KPI",
    "TREND",
    "PARETO",
    "ACTIONS",
    "CASE",
    "EVIDENCE",
    "CONCLUSIONS",
    "APPENDIX",
]


class ReportSectionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    section_key: str = Field(min_length=1, max_length=80, pattern=r"^[a-z][a-z0-9_]*$")
    kind: ReportSectionKind
    enabled: bool = True
    title: str = Field(default="", max_length=240)
    payload_schema_version: int = Field(default=1, ge=1)
    payload: dict[str, Any] = Field(default_factory=dict)


class ReportSectionsUpdate(BaseModel):
    expected_version: int = Field(ge=1)
    sections: list[ReportSectionInput] = Field(max_length=20)

    @model_validator(mode="after")
    def require_unique_section_keys(self) -> "ReportSectionsUpdate":
        keys = [section.section_key for section in self.sections]
        if len(keys) != len(set(keys)):
            raise ValueError("section_key values must be unique")
        return self


class ReportActionSourcesUpdate(BaseModel):
    expected_version: int = Field(ge=1)
    action_ids: list[uuid.UUID] = Field(max_length=100)


class ReportEvidenceSourceInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    section_key: str = Field(min_length=1, max_length=80)
    review_attachment_id: uuid.UUID | None = None
    published_evidence_id: uuid.UUID | None = None
    caption: str = Field(default="", max_length=2_000)
    role: Literal["CONTEXT", "BEFORE", "AFTER", "IMPLEMENTATION", "MEASUREMENT"] = "CONTEXT"
    captured_at: datetime | None = None

    @model_validator(mode="after")
    def require_one_source(self) -> "ReportEvidenceSourceInput":
        if (self.review_attachment_id is None) == (self.published_evidence_id is None):
            raise ValueError("Exactly one evidence source is required")
        return self


class ReportEvidenceSourcesUpdate(BaseModel):
    expected_version: int = Field(ge=1)
    evidence: list[ReportEvidenceSourceInput] = Field(max_length=100)


class PublishRequest(BaseModel):
    expected_version: int = Field(ge=1)
    template_version: Literal["1", "2"] = "1"
    content_schema_version: int = Field(default=1, ge=1)
    preview_fingerprint: str | None = Field(default=None, min_length=1, max_length=64)
    acknowledged_warning_codes: list[str] = Field(default_factory=list, max_length=50)
    idempotency_key: str | None = Field(default=None, min_length=1, max_length=160)


class ExportOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    language: Literal["pt", "en", "ko"] = "pt"
    include_money: bool = True
    include_summary: bool = True
    include_occurrences: bool = True
    include_justifications: bool = True
    include_evidence: bool = True
    notify_on_completion: bool = False


class ExportRequest(BaseModel):
    format: ExportFormat
    options: ExportOptions = Field(default_factory=ExportOptions)
    template_version: Literal["1", "2"] = "1"
    retry_failed: bool = False


class EligibleOccurrenceFilters(BaseModel):
    search: str | None = None
    organization: str | None = None
    product: str | None = None
    division: str | None = None
    line: str | None = None
    date_from: date | None = None
    date_to: date | None = None


class ReportView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    factory_id: uuid.UUID
    code: str
    title: str
    description: str
    status: ReportStatus
    report_kind: ReportKind
    content_schema_version: int
    created_by_user_id: int | None
    updated_by_user_id: int | None
    version: int
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None
