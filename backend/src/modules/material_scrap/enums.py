from enum import StrEnum


class IngestionStatus(StrEnum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


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


class BreakdownMetric(StrEnum):
    AMOUNT_BRL = "amount_brl"
    AMOUNT_USD = "amount_usd"
    QUANTITY = "quantity"
    RECORDS = "records"
