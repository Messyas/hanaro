from enum import StrEnum


class IngestionStatus(StrEnum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class AutomationExecutionStatus(StrEnum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class AutomationSnapshotStatus(StrEnum):
    NOT_PUBLISHED = "NOT_PUBLISHED"
    PUBLISHED = "PUBLISHED"
    UNCHANGED_REPLAY = "UNCHANGED_REPLAY"
    PRESERVED_PREVIOUS = "PRESERVED_PREVIOUS"


class ExecutionStepCode(StrEnum):
    GERP_REQUEST = "GERP_REQUEST"
    GERP_REPORT_GENERATION = "GERP_REPORT_GENERATION"
    FILE_DOWNLOAD = "FILE_DOWNLOAD"
    FILE_VALIDATION = "FILE_VALIDATION"
    DATA_NORMALIZATION = "DATA_NORMALIZATION"
    EXCHANGE_RATE = "EXCHANGE_RATE"
    JSON_VALIDATION = "JSON_VALIDATION"
    SNAPSHOT_PUBLICATION = "SNAPSHOT_PUBLICATION"


class ExecutionStepStatus(StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class AutomationMode(StrEnum):
    LOCAL_FILE_SIMULATION = "LOCAL_FILE_SIMULATION"
    GERP_RPA = "GERP_RPA"


class AutomationTrigger(StrEnum):
    SCHEDULED = "SCHEDULED"


class ExecutionSortField(StrEnum):
    STARTED_AT = "started_at"
    FINISHED_AT = "finished_at"
    STATUS = "status"


class SortOrder(StrEnum):
    ASC = "asc"
    DESC = "desc"


class ToBeCountedFilter(StrEnum):
    TRUE = "true"
    FALSE = "false"
    UNMAPPED = "unmapped"


class ScrapSortField(StrEnum):
    TRANSACTION_DATE = "transaction_date"
    ORGANIZATION_CODE = "organization_code"
    RECEIPT_DEPARTMENT = "receipt_department"
    ITEM_CODE = "item_code"
    ISSUE_QUANTITY = "issue_quantity"
    ISSUE_AMOUNT_BRL = "issue_amount_brl"
    AMOUNT_USD = "amount_usd"


class ScrapReviewStatus(StrEnum):
    DRAFT = "DRAFT"
    REVIEWED = "REVIEWED"


class ScrapReviewFilterStatus(StrEnum):
    UNREVIEWED = "UNREVIEWED"
    DRAFT = "DRAFT"
    REVIEWED = "REVIEWED"


class ScrapReviewBulkStatus(StrEnum):
    COMPLETED = "COMPLETED"


class TrendGroupBy(StrEnum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


class BreakdownGroupBy(StrEnum):
    ORGANIZATION = "organization"
    RECEIPT_DEPARTMENT = "receipt_department"
    DEPARTMENT = "department"
    PRODUCT = "product"
    DIVISION = "division"
    ITEM_TYPE = "item_type"
    MODEL = "model"
    OFFENDER = "offender"


class BreakdownMetric(StrEnum):
    AMOUNT_BRL = "amount_brl"
    AMOUNT_USD = "amount_usd"
    QUANTITY = "quantity"
    RECORDS = "records"


class DashboardCurrency(StrEnum):
    BRL = "BRL"
    USD = "USD"


class DashboardMetric(StrEnum):
    IF_COST = "if_cost"
    QUANTITY = "quantity"


class ImpactMode(StrEnum):
    ABSOLUTE = "absolute"
    SIGNED = "signed"
