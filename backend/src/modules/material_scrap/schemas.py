import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ExecutionMetadata(ContractModel):
    execution_id: uuid.UUID
    source: str
    request_id: str
    started_at: datetime
    finished_at: datetime


class QueryWindow(ContractModel):
    organization_scope: str = "ALL"
    date_from: date
    date_to: date
    timezone: str = "America/Manaus"

    @field_validator("date_to")
    @classmethod
    def validate_window(cls, value: date, info: Any) -> date:
        date_from = info.data.get("date_from")
        if date_from and value < date_from:
            raise ValueError("date_to must be greater than or equal to date_from")
        return value


class SourceFileMetadata(ContractModel):
    name: str
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    encoding: str = "cp1252"
    delimiter: str = "TAB"
    reconstructed_rows: int = 0


class ExchangeRateInput(ContractModel):
    base_currency: str = "BRL"
    quote_currency: str = "USD"
    brl_per_usd: Decimal
    source: str = "MANUAL_SIMULATION"
    requested_date: date
    effective_date: date
    fallback_used: bool = False

    @field_validator("brl_per_usd")
    @classmethod
    def validate_rate(cls, value: Decimal) -> Decimal:
        if value <= 0:
            raise ValueError("brl_per_usd must be greater than zero")
        return value.quantize(Decimal("0.000001"))


class MaterialScrapPayload(ContractModel):
    schema_version: str = "1.0"
    execution: ExecutionMetadata
    query: QueryWindow
    source_file: SourceFileMetadata
    exchange_rate: ExchangeRateInput
    records: list[dict[str, str | int | None]]


class NormalizedScrapRecord(BaseModel):
    source_row_number: int
    organization_code: str
    transaction_date: date
    issue_quantity: Decimal
    issue_amount_brl: Decimal
    amount_usd: Decimal
    period: date
    period_yy_mm: str
    quality_flags: list[str]
    derivation_provenance: dict[str, Any]
    account_code: str | None = None
    account_description: str | None = None
    account_alias: str | None = None
    subinventory_group: str | None = None
    subinventory: str | None = None
    warehouse_market: str | None = None
    receipt_department: str | None = None
    receipt_description: str | None = None
    item_code: str | None = None
    uit: str | None = None
    item_description: str | None = None
    item_specification: str | None = None
    issue_price: Decimal | None = None
    sales_price: Decimal | None = None
    sales_amount_brl: Decimal | None = None
    warehouse_keeper: str | None = None
    planner: str | None = None
    work_order: str | None = None
    reason: str | None = None
    requisition_reason: str | None = None
    requisition_comment: str | None = None
    reference: str | None = None
    make_item: str | None = None
    created_by: str | None = None
    department: str | None = None
    product: str | None = None
    division: str | None = None
    item_type: str | None = None
    to_be_counted: bool | None = None


class IngestionResult(BaseModel):
    run_id: uuid.UUID
    execution_id: uuid.UUID
    status: str
    read_count: int
    accepted_count: int
    rejected_count: int
    is_replay: bool = False


class ScrapItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_row_number: int
    organization_code: str
    account_code: str | None
    account_description: str | None
    account_alias: str | None
    subinventory_group: str | None
    subinventory: str | None
    warehouse_market: str | None
    receipt_department: str | None
    receipt_description: str | None
    item_code: str | None
    uit: str | None
    item_description: str | None
    item_specification: str | None
    transaction_date: date
    issue_quantity: Decimal
    issue_price: Decimal | None
    issue_amount_brl: Decimal
    sales_price: Decimal | None
    sales_amount_brl: Decimal | None
    warehouse_keeper: str | None
    planner: str | None
    work_order: str | None
    reason: str | None
    requisition_reason: str | None
    requisition_comment: str | None
    reference: str | None
    make_item: str | None
    created_by: str | None
    period: date
    period_yy_mm: str
    department: str | None
    product: str | None
    division: str | None
    item_type: str | None
    to_be_counted: bool | None
    amount_usd: Decimal
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
