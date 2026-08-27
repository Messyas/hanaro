import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    gerp_request_id: str | None = None
    organization_parameter: str = "ALL"
    organizations_found: list[str]

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


class SourceFileMetadata(ContractModel):
    name: str
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    encoding: str
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
    brl_per_usd: Decimal
    quote_type: str
    source: str
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
    version: str


class BatchStatistics(ContractModel):
    source_rows: int = Field(ge=0)
    accepted_rows: int = Field(ge=0)
    rejected_rows: int = Field(ge=0)
    expanded_comment_rows: int = Field(ge=0)
    issue_amount_brl_total: Decimal
    sales_amount_total: Decimal
    quality_flag_counts: dict[str, int]

    @field_validator("issue_amount_brl_total", "sales_amount_total", mode="before")
    @classmethod
    def validate_decimal_json(cls, value: object) -> object:
        return _require_decimal_string(value)


class CanonicalScrapRecord(ContractModel):
    source_line: int = Field(ge=2)
    organization_code: str
    account_code: str
    account_description: str | None = None
    account_alias: str
    subinventory_group: str | None = None
    subinventory_code: str | None = None
    warehouse_market: str | None = None
    receipt_department: str | None = None
    receipt_description: str | None = None
    department: str | None = None
    product: str | None = None
    division: str | None = None
    item_code: str
    uit: str | None = None
    item_description: str | None = None
    item_specification: str | None = None
    item_type: str | None = None
    transaction_date: date
    period: str = Field(pattern=r"^\d{4}-\d{2}$")
    period_yy_mm: str = Field(pattern=r"^\d{2}\.\d{2}$")
    issue_quantity: Decimal
    issue_price: Decimal | None = None
    issue_amount_brl: Decimal
    amount_usd: Decimal
    sales_price: Decimal | None = None
    sales_amount: Decimal | None = None
    warehouse_keeper: str | None = None
    planner: str | None = None
    work_order: str | None = None
    reason: str | None = None
    requisition_reason: str | None = None
    requisition_comment: str | None = None
    reference: str | None = None
    make_item: str | None = None
    created_by: str | None = None
    to_be_counted: bool | None = None
    content_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    quality_flags: list[str]
    derivation_provenance: dict[str, Any]

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
    records: list[CanonicalScrapRecord]


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
    organizations: list[str]
    receipt_departments: list[str]
    departments: list[str]
    products: list[str]
    divisions: list[str]
    item_types: list[str]
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
