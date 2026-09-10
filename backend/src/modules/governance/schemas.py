import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ReportStatus = Literal["DRAFT", "PUBLISHED", "ARCHIVED"]
ExportFormat = Literal["CSV", "PDF", "PPTX", "MARKDOWN"]


class Page(BaseModel):
    items: list[Any]
    page: int
    page_size: int
    total: int
    total_pages: int
    has_next: bool
    has_previous: bool


class ReportCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    description: str = Field(default="", max_length=10_000)
    factory_id: uuid.UUID | None = None


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


class PublishRequest(BaseModel):
    expected_version: int = Field(ge=1)
    template_version: Literal["1"] = "1"


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
    template_version: Literal["1"] = "1"
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
    created_by_user_id: int | None
    updated_by_user_id: int | None
    version: int
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None
