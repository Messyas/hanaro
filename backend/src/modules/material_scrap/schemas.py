import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .enums import DashboardCurrency, ImpactMode


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ExecutionMetadata(ContractModel):
    execution_id: uuid.UUID
    source_system: Literal["GERP"] = "GERP"
    report_name: Literal["Other Account Transaction Text Download"]
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
    size_bytes: int = Field(ge=1, le=100_000_000)


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


class ScrapItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
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
        return _require_decimal_string(value)


class ScrapTargetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    year: int
    month: int
    currency: DashboardCurrency
    amount: Decimal
    updated_at: datetime


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
    actual: Decimal
    previous_year: Decimal | None = None
    target: Decimal | None = None


class DashboardRankingItem(BaseModel):
    key: str | None
    amount: Decimal
    record_count: int


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
