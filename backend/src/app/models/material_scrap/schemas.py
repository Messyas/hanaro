import json
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from src.app.models.material_scrap.enums import (
    AutomationExecutionStatus,
    AutomationMode,
    AutomationSnapshotStatus,
    AutomationTrigger,
    DashboardCurrency,
    ExecutionStepCode,
    ExecutionStepStatus,
    ImpactMode,
    ScrapReviewBulkStatus,
    ScrapReviewStatus,
)


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ExecutionMetadata(ContractModel):
    execution_id: uuid.UUID
    source_system: Literal["GERP"] = "GERP"
    report_name: Literal["Other Account Transaction Text Download"]
    trigger: AutomationTrigger = AutomationTrigger.SCHEDULED
    mode: Literal["LOCAL_FILE_SIMULATION", "GERP_RPA"]
    timezone: Literal["America/Manaus"] = "America/Manaus"
    processing_date: date
    extracted_at: datetime
    query_date_from: date
    query_date_to: date
    query_window_inferred: bool
    gerp_request_id: str | None = Field(default=None, max_length=100)
    organization_parameter: str = Field(default="ALL", min_length=1, max_length=80)
    organizations_found: list[Annotated[str, Field(min_length=1, max_length=40)]] = Field(max_length=1000)

    @field_validator("query_date_to")
    @classmethod
    def validate_window(cls, value: date, info: Any) -> date:
        date_from = info.data.get("query_date_from")
        if date_from and value < date_from:
            raise ValueError("query_date_to must not be before query_date_from")
        return value

    @field_validator("extracted_at")
    @classmethod
    def validate_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("extracted_at must include timezone information")
        return value

    @model_validator(mode="after")
    def validate_query_window_size(self) -> "ExecutionMetadata":
        if (self.query_date_to - self.query_date_from).days > 366:
            raise ValueError("query window cannot exceed 366 days")
        return self


class SourceFileMetadata(ContractModel):
    name: str = Field(min_length=1, max_length=255)
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    encoding: str = Field(min_length=1, max_length=30)
    delimiter: Literal["TAB"] = "TAB"
    size_bytes: int = Field(ge=1)


def _require_decimal_string(value: object) -> object:
    if not isinstance(value, (str, Decimal)):
        raise ValueError("decimal values must be JSON strings")
    return value


class ExchangeRateMetadata(ContractModel):
    rate_date: date
    effective_date: date
    base_currency: Literal["BRL"] = "BRL"
    quote_currency: Literal["USD"] = "USD"
    brl_per_usd: Decimal = Field(max_digits=18, decimal_places=6)
    quote_type: str = Field(min_length=1, max_length=80)
    source: str = Field(min_length=1, max_length=80)
    retrieved_at: datetime | None = None
    fallback_used: bool = False

    @field_validator("brl_per_usd", mode="before")
    @classmethod
    def validate_decimal_json(cls, value: object) -> object:
        return _require_decimal_string(value)

    @field_validator("brl_per_usd")
    @classmethod
    def validate_rate(cls, value: Decimal) -> Decimal:
        if value <= 0:
            raise ValueError("brl_per_usd must be greater than zero")
        return value.quantize(Decimal("0.000001"))


class MappingMetadata(ContractModel):
    version: str = Field(min_length=1, max_length=40)


class BatchStatistics(ContractModel):
    source_rows: int = Field(ge=0, le=50_000)
    accepted_rows: int = Field(ge=0, le=50_000)
    rejected_rows: int = Field(ge=0, le=50_000)
    expanded_comment_rows: int = Field(ge=0, le=50_000)
    issue_amount_brl_total: Decimal = Field(max_digits=20, decimal_places=2)
    sales_amount_total: Decimal = Field(max_digits=20, decimal_places=2)
    quality_flag_counts: dict[str, int] = Field(max_length=100)

    @field_validator("issue_amount_brl_total", "sales_amount_total", mode="before")
    @classmethod
    def validate_decimal_json(cls, value: object) -> object:
        return _require_decimal_string(value)


class CanonicalScrapRecord(ContractModel):
    source_line: int = Field(ge=2)
    organization_code: str = Field(min_length=1, max_length=40)
    account_code: str = Field(min_length=1, max_length=80)
    account_description: str | None = Field(default=None, max_length=4000)
    account_alias: str = Field(min_length=1, max_length=100)
    subinventory_group: str | None = Field(default=None, max_length=100)
    subinventory_code: str | None = Field(default=None, max_length=100)
    warehouse_market: str | None = Field(default=None, max_length=100)
    receipt_department: str | None = Field(default=None, max_length=120)
    receipt_description: str | None = Field(default=None, max_length=4000)
    department: str | None = Field(default=None, max_length=120)
    product: str | None = Field(default=None, max_length=40)
    division: str | None = Field(default=None, max_length=40)
    item_code: str = Field(min_length=1, max_length=100)
    uit: str | None = Field(default=None, max_length=100)
    item_description: str | None = Field(default=None, max_length=4000)
    item_specification: str | None = Field(default=None, max_length=4000)
    item_type: str | None = Field(default=None, max_length=40)
    transaction_date: date
    period: str = Field(pattern=r"^\d{4}-\d{2}$")
    period_yy_mm: str = Field(pattern=r"^\d{2}\.\d{2}$")
    issue_quantity: Decimal = Field(max_digits=20, decimal_places=6)
    issue_price: Decimal | None = Field(default=None, max_digits=20, decimal_places=8)
    issue_amount_brl: Decimal = Field(max_digits=20, decimal_places=2)
    amount_usd: Decimal = Field(max_digits=20, decimal_places=6)
    sales_price: Decimal | None = Field(default=None, max_digits=20, decimal_places=8)
    sales_amount: Decimal | None = Field(default=None, max_digits=20, decimal_places=2)
    warehouse_keeper: str | None = Field(default=None, max_length=120)
    planner: str | None = Field(default=None, max_length=120)
    work_order: str | None = Field(default=None, max_length=120)
    reason: str | None = Field(default=None, max_length=4000)
    requisition_reason: str | None = Field(default=None, max_length=4000)
    requisition_comment: str | None = Field(default=None, max_length=4000)
    reference: str | None = Field(default=None, max_length=255)
    make_item: str | None = Field(default=None, max_length=20)
    created_by: str | None = Field(default=None, max_length=120)
    to_be_counted: bool | None = None
    content_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    quality_flags: list[Annotated[str, Field(min_length=1, max_length=100)]] = Field(max_length=50)
    derivation_provenance: dict[str, Any] = Field(max_length=50)

    @field_validator(
        "issue_quantity",
        "issue_price",
        "issue_amount_brl",
        "amount_usd",
        "sales_price",
        "sales_amount",
        mode="before",
    )
    @classmethod
    def validate_decimal_json(cls, value: object) -> object:
        if value is None:
            return value
        return _require_decimal_string(value)


class MaterialScrapPayload(ContractModel):
    schema_version: Literal["1.0.0"] = "1.0.0"
    execution: ExecutionMetadata
    source_file: SourceFileMetadata
    exchange_rate: ExchangeRateMetadata
    mapping: MappingMetadata
    statistics: BatchStatistics
    records: list[CanonicalScrapRecord] = Field(max_length=50_000)


class IngestionResult(BaseModel):
    run_id: uuid.UUID
    execution_id: uuid.UUID
    status: str
    read_count: int
    accepted_count: int
    rejected_count: int
    is_replay: bool = False


class IngestionAccepted(BaseModel):
    task_id: str
    execution_id: uuid.UUID
    status: Literal["QUEUED"] = "QUEUED"


class AutomationExecutionStart(ContractModel):
    execution_id: uuid.UUID
    correlation_id: str | None = Field(default=None, min_length=1, max_length=100)
    source_system: Literal["GERP"] = "GERP"
    report_name: Literal["Other Account Transaction Text Download"]
    trigger: AutomationTrigger = AutomationTrigger.SCHEDULED
    mode: AutomationMode
    organization_parameter: str = Field(default="ALL", min_length=1, max_length=80)
    query_date_from: date
    query_date_to: date
    processing_date: date
    timezone: Literal["America/Manaus"] = "America/Manaus"
    gerp_request_id: str | None = Field(default=None, max_length=100)
    started_at: datetime | None = None

    @field_validator("query_date_to")
    @classmethod
    def validate_window(cls, value: date, info: Any) -> date:
        if (date_from := info.data.get("query_date_from")) and value < date_from:
            raise ValueError("query_date_to must not be before query_date_from")
        return value

    @field_validator("started_at")
    @classmethod
    def validate_started_at(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("started_at must include timezone information")
        return value


class ExecutionStepUpdate(ContractModel):
    attempt: int = Field(default=1, ge=1, le=100)
    status: ExecutionStepStatus
    started_at: datetime | None = None
    finished_at: datetime | None = None
    message: str | None = Field(default=None, max_length=2000)
    error_code: str | None = Field(default=None, max_length=100)
    metadata: dict[str, Any] = Field(default_factory=dict, max_length=50)

    @field_validator("started_at", "finished_at")
    @classmethod
    def validate_timestamp(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("step timestamps must include timezone information")
        return value

    @model_validator(mode="after")
    def validate_metadata(self) -> "ExecutionStepUpdate":
        encoded = json.dumps(self.metadata, default=str)
        forbidden = {"password", "secret", "token", "cookie", "authorization"}
        if len(encoded) > 10_000 or any(key.lower() in forbidden for key in self.metadata):
            raise ValueError("metadata contains forbidden data or exceeds 10 KB")
        return self


class ExecutionFailure(ContractModel):
    failure_category: str = Field(min_length=1, max_length=80)
    failure_code: str = Field(min_length=1, max_length=100)
    failure_message: str = Field(min_length=1, max_length=2000)
    step_code: ExecutionStepCode
    notify_developers: bool = True


class ExecutionStepRead(BaseModel):
    step_code: ExecutionStepCode
    sequence: int
    attempt: int
    status: ExecutionStepStatus
    started_at: datetime
    finished_at: datetime | None
    duration_ms: int | None
    message: str | None
    error_code: str | None
    metadata: dict[str, Any]


class ExecutionListItem(BaseModel):
    id: uuid.UUID
    execution_id: uuid.UUID
    correlation_id: str
    source_system: str
    report_name: str
    trigger: AutomationTrigger
    mode: AutomationMode
    status: AutomationExecutionStatus
    current_step: ExecutionStepCode | None
    query_date_from: date
    query_date_to: date
    organization_parameter: str
    organizations_found: list[str]
    gerp_request_id: str | None
    started_at: datetime
    finished_at: datetime | None
    duration_ms: int | None
    records_received: int
    records_accepted: int
    records_rejected: int
    snapshot_status: AutomationSnapshotStatus
    failure_category: str | None


class ExecutionDetail(ExecutionListItem):
    processing_date: date
    timezone: str
    source_file_name: str | None
    source_file_sha256: str | None
    failure_code: str | None
    failure_message: str | None
    retry_count: int
    ingestion_run_id: uuid.UUID | None
    steps: list[ExecutionStepRead]


class ExecutionPage(BaseModel):
    items: list[ExecutionListItem]
    page: int
    page_size: int
    total_items: int
    total_pages: int


class ScrapItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    occurrence_id: uuid.UUID | None = None
    current_transaction_id: uuid.UUID | None = None
    source_line: int
    organization_code: str
    account_code: str
    account_description: str | None
    account_alias: str
    subinventory_group: str | None
    subinventory_code: str | None
    warehouse_market: str | None
    receipt_department: str | None
    receipt_description: str | None
    item_code: str
    product_alias: str | None = None
    uit: str | None
    item_description: str | None
    item_specification: str | None
    transaction_date: date
    issue_quantity: Decimal
    issue_price: Decimal | None
    issue_amount_brl: Decimal
    sales_price: Decimal | None
    sales_amount: Decimal | None
    warehouse_keeper: str | None
    planner: str | None
    work_order: str | None
    reason: str | None
    requisition_reason: str | None
    requisition_comment: str | None
    reference: str | None
    make_item: str | None
    created_by: str | None
    period: str
    period_yy_mm: str
    department: str | None
    product: str | None
    division: str | None
    item_type: str | None
    to_be_counted: bool | None
    amount_usd: Decimal
    content_hash: str
    quality_flags: list[str]
    derivation_provenance: dict[str, Any]
    occurrence_status: str = "ACTIVE"
    review_id: uuid.UUID | None = None
    review_status: ScrapReviewStatus | None = None
    defect_type_id: uuid.UUID | None = None
    defect_type_name: str | None = None
    responsible_user_id: int | None = None
    responsible_name: str | None = None
    reviewed_at: datetime | None = None
    review_updated_at: datetime | None = None
    attachment_count: int = 0


class ScrapPage(BaseModel):
    items: list[ScrapItem]
    page: int
    page_size: int
    total_items: int
    total_pages: int


class ScrapFilterOptions(BaseModel):
    years: list[int]
    weeks: list[int]
    organizations: list[str]
    receipt_departments: list[str]
    departments: list[str]
    products: list[str]
    divisions: list[str]
    item_types: list[str]
    item_codes: list[str]
    account_aliases: list[str]
    periods: list[str]


class ScrapDefectTypeCreate(ContractModel):
    code: str = Field(min_length=1, max_length=50, pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]*$")
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    display_order: int = Field(default=0, ge=0, le=10_000)


class ScrapDefectTypeUpdate(ContractModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    display_order: int | None = Field(default=None, ge=0, le=10_000)
    is_active: bool | None = None

    @model_validator(mode="after")
    def require_change(self) -> "ScrapDefectTypeUpdate":
        if not self.model_fields_set:
            raise ValueError("at least one field must be provided")
        return self


class ScrapDefectTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    description: str | None
    display_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ScrapReviewWrite(ContractModel):
    defect_type_id: uuid.UUID | None = None
    title: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=20_000)
    expected_version: int | None = Field(default=None, ge=1)


class ScrapReviewAttachmentRead(BaseModel):
    id: uuid.UUID
    original_filename: str
    content_type: str
    size_bytes: int
    width: int
    height: int
    position: int
    created_at: datetime
    url: str


class ScrapReviewRead(BaseModel):
    id: uuid.UUID
    occurrence_id: uuid.UUID
    status: ScrapReviewStatus
    defect_type: ScrapDefectTypeRead | None
    responsible_user_id: int
    responsible_name: str
    title: str
    description: str
    version: int
    source_review_id: uuid.UUID | None
    bulk_operation_id: uuid.UUID | None
    reviewed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    attachments: list[ScrapReviewAttachmentRead]


class ScrapReviewTemplateCreate(ContractModel):
    name: str = Field(min_length=1, max_length=150)
    title: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=20_000)
    defect_type_id: uuid.UUID | None = None
    source_review_id: uuid.UUID | None = None


class ScrapReviewTemplateUpdate(ContractModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=20_000)
    defect_type_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def require_change(self) -> "ScrapReviewTemplateUpdate":
        if not self.model_fields_set:
            raise ValueError("at least one field must be provided")
        return self


class ScrapReviewTemplateRead(BaseModel):
    id: uuid.UUID
    name: str
    title: str
    description: str
    defect_type_id: uuid.UUID | None
    defect_type: ScrapDefectTypeRead | None = None
    created_by_user_id: int
    source_review_id: uuid.UUID | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ScrapReviewBulkCreate(ContractModel):
    reference_review_id: uuid.UUID | None = None
    template_id: uuid.UUID | None = None
    occurrence_ids: list[uuid.UUID] = Field(min_length=1, max_length=500)
    copy_attachments: bool = False

    @model_validator(mode="after")
    def require_single_source(self) -> "ScrapReviewBulkCreate":
        if (self.reference_review_id is None) == (self.template_id is None):
            raise ValueError("provide exactly one of reference_review_id or template_id")
        return self

    @field_validator("occurrence_ids")
    @classmethod
    def unique_occurrences(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(set(value)) != len(value):
            raise ValueError("occurrence_ids must be unique")
        return value


class ScrapReviewBulkSkipped(BaseModel):
    occurrence_id: uuid.UUID
    reason: Literal["NOT_ACTIVE", "ALREADY_REVIEWED"]


class ScrapReviewBulkResult(BaseModel):
    operation_id: uuid.UUID
    status: ScrapReviewBulkStatus
    requested_count: int
    created_count: int
    skipped_count: int
    created_occurrence_ids: list[uuid.UUID]
    skipped: list[ScrapReviewBulkSkipped]


class ScrapSummary(BaseModel):
    total_records: int
    total_issue_quantity: Decimal
    total_issue_amount_brl: Decimal
    total_amount_usd: Decimal
    counted_records: int
    counted_amount_brl: Decimal
    counted_amount_usd: Decimal
    exchange_rate_used: Decimal | None
    last_successful_ingestion_at: datetime | None


class ScrapTrendPoint(BaseModel):
    period: str
    record_count: int
    total_issue_quantity: Decimal
    total_issue_amount_brl: Decimal
    total_amount_usd: Decimal


class ScrapBreakdownItem(BaseModel):
    key: str | None
    metric: Decimal
    record_count: int


class ScrapTargetUpsert(ContractModel):
    currency: DashboardCurrency
    amount: Decimal = Field(ge=0, max_digits=24, decimal_places=6)

    @field_validator("amount", mode="before")
    @classmethod
    def validate_decimal_json(cls, value: object) -> object:
        if isinstance(value, (int, float)):
            return str(value)
        return _require_decimal_string(value)


class ScrapTargetMonthItem(ContractModel):
    month: int = Field(ge=1, le=12)
    amount: Decimal = Field(ge=0, max_digits=24, decimal_places=6)

    @field_validator("amount", mode="before")
    @classmethod
    def validate_amount(cls, value: object) -> object:
        if isinstance(value, (int, float)):
            return str(value)
        return _require_decimal_string(value)


class ScrapTargetBatchUpsert(ContractModel):
    currency: DashboardCurrency = DashboardCurrency.USD
    targets: list[ScrapTargetMonthItem] = Field(min_length=1, max_length=12)


class ScrapTargetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    year: int
    month: int
    currency: DashboardCurrency
    amount: Decimal
    updated_at: datetime


ClassificationKind = Literal["PRODUCT_ALIAS", "ORGANIZATION", "DEPARTMENT", "COUNTING", "ITEM_TYPE"]
ClassificationMatchMode = Literal["EXACT", "REGEX"]


class ScrapClassificationRuleWrite(ContractModel):
    kind: ClassificationKind
    source_value: str = Field(min_length=1, max_length=500)
    source_context: str | None = Field(default=None, max_length=120)
    target_value: str | None = Field(default=None, max_length=120)
    target_secondary: str | None = Field(default=None, max_length=120)
    boolean_value: bool | None = None
    match_mode: ClassificationMatchMode = "EXACT"
    priority: int = Field(default=0, ge=0, le=10_000)
    is_active: bool = True

    @model_validator(mode="after")
    def validate_shape(self) -> "ScrapClassificationRuleWrite":
        required = {
            "PRODUCT_ALIAS": ("target_value",),
            "ORGANIZATION": ("target_value", "target_secondary"),
            "DEPARTMENT": ("target_value",),
            "ITEM_TYPE": ("target_value",),
        }
        if self.kind in required and any(not getattr(self, field) for field in required[self.kind]):
            raise ValueError(f"{self.kind} requires its target fields")
        if self.kind == "COUNTING" and (not self.source_context or self.boolean_value is None):
            raise ValueError("COUNTING requires account alias and boolean_value")
        if self.kind != "ITEM_TYPE" and self.match_mode != "EXACT":
            raise ValueError("only ITEM_TYPE rules can use REGEX")
        return self


class ScrapClassificationRuleRead(ScrapClassificationRuleWrite):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ScrapClassificationReapplyResult(ContractModel):
    reclassified_records: int
    dashboard_revision: uuid.UUID


class DashboardMetadata(BaseModel):
    revision: uuid.UUID
    generated_at: datetime
    data_through: date | None
    currency: DashboardCurrency
    impact_mode: ImpactMode
    target_scope: Literal["global"] = "global"


class DashboardKpis(BaseModel):
    actual: Decimal
    target: Decimal | None
    target_attainment_percent: Decimal | None
    previous_year_actual: Decimal
    previous_year_variation_percent: Decimal | None


class DashboardSeriesPoint(BaseModel):
    period: str
    actual: Decimal | None = None
    previous_year: Decimal | None = None
    target: Decimal | None = None
    denominator: Decimal | None = None
    previous_year_denominator: Decimal | None = None
    relative_rate: Decimal | None = None
    previous_year_relative_rate: Decimal | None = None
    relative_status: Literal[
        "AVAILABLE",
        "MISSING_DENOMINATOR",
        "ZERO_DENOMINATOR",
        "UNSUPPORTED_DENOMINATOR_GRAIN",
    ] = "MISSING_DENOMINATOR"
    previous_year_relative_status: Literal[
        "AVAILABLE",
        "MISSING_DENOMINATOR",
        "ZERO_DENOMINATOR",
        "UNSUPPORTED_DENOMINATOR_GRAIN",
    ] = "MISSING_DENOMINATOR"


class DashboardRankingItem(BaseModel):
    key: str | None
    amount: Decimal
    record_count: int


class DashboardRelativeRankingItem(BaseModel):
    key: str | None
    numerator: Decimal
    denominator: Decimal | None = None
    rate: Decimal | None = None
    record_count: int
    denominator_status: Literal["AVAILABLE", "MISSING_DENOMINATOR", "ZERO_DENOMINATOR"]


class DashboardRankings(BaseModel):
    products: list[DashboardRankingItem]
    components: list[DashboardRankingItem]
    lines: list[DashboardRankingItem]
    models: list[DashboardRankingItem]
    offenders: list[DashboardRankingItem]


class DashboardResponse(BaseModel):
    metadata: DashboardMetadata
    kpis: DashboardKpis
    monthly: list[DashboardSeriesPoint]
    weekly: list[DashboardSeriesPoint]
    rankings: DashboardRankings
    priority_occurrences: list[DashboardRankingItem]
    relative_product_ranking: list[DashboardRelativeRankingItem] = Field(default_factory=list)
