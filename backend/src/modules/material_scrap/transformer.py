import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation, localcontext
from pathlib import Path
from typing import Any

from .mappings import (
    DEPARTMENT_CLASSIFICATION,
    ITEM_TYPE_BY_MAKE_ITEM,
    MAPPING_VERSION,
    ORGANIZATION_CLASSIFICATION,
    TO_BE_COUNTED_BY_ACCOUNT_ALIAS,
)
from .schemas import MaterialScrapPayload, NormalizedScrapRecord

MONEY_QUANTUM = Decimal("0.01")
QUANTITY_QUANTUM = Decimal("0.000001")
PRICE_QUANTUM = Decimal("0.00000001")
USD_QUANTUM = Decimal("0.000001")


class ScrapTransformationError(ValueError):
    """Raised when a source row cannot be reconstructed or validated safely."""


@dataclass(frozen=True)
class ParsedScrapFile:
    records: list[dict[str, str | int | None]]
    reconstructed_rows: int


HEADER_ALIASES = {
    "organization": "organization_code",
    "organization code": "organization_code",
    "account": "account_code",
    "account code": "account_code",
    "account alias": "account_alias",
    "subinventory group": "subinventory_group",
    "subinventory": "subinventory",
    "warehouse market": "warehouse_market",
    "receipt department": "receipt_department",
    "receipt description": "receipt_description",
    "item": "item_code",
    "item code": "item_code",
    "uit": "uit",
    "item specification": "item_specification",
    "transaction date": "transaction_date",
    "issue quantity": "issue_quantity",
    "issue price": "issue_price",
    "issue amount brl": "issue_amount_brl",
    "issue amount": "issue_amount_brl",
    "sales price": "sales_price",
    "sales amount brl": "sales_amount_brl",
    "sales amount": "sales_amount_brl",
    "warehouse keeper": "warehouse_keeper",
    "planner": "planner",
    "work order": "work_order",
    "reason": "reason",
    "req reason": "requisition_reason",
    "requisition reason": "requisition_reason",
    "req comment": "requisition_comment",
    "requisition comment": "requisition_comment",
    "reference": "reference",
    "make item": "make_item",
    "created by": "created_by",
}


def _normalize_header(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[_\s]+", " ", ascii_value.strip().lower())


def _canonical_headers(raw_headers: list[str]) -> list[str]:
    description_count = 0
    canonical: list[str] = []
    for raw_header in raw_headers:
        normalized = _normalize_header(raw_header)
        if normalized == "description":
            description_count += 1
            canonical.append("account_description" if description_count == 1 else "item_description")
            continue
        field_name = HEADER_ALIASES.get(normalized)
        if field_name is None:
            raise ScrapTransformationError(f"Unsupported source column: {raw_header!r}")
        canonical.append(field_name)
    required = {"organization_code", "transaction_date", "issue_quantity", "issue_amount_brl"}
    missing = required.difference(canonical)
    if missing:
        raise ScrapTransformationError(f"Missing required columns: {', '.join(sorted(missing))}")
    if len(canonical) != len(set(canonical)):
        raise ScrapTransformationError("Source contains ambiguous duplicate columns")
    return canonical


def parse_scrap_tsv(path: Path, encoding: str = "cp1252") -> ParsedScrapFile:
    """Parse the extensionless GERP TSV and reconstruct extra tabs in REQ Comment."""
    try:
        text = path.read_bytes().decode(encoding, errors="strict")
    except UnicodeDecodeError as error:
        raise ScrapTransformationError(f"Unable to decode {path.name} as {encoding}") from error
    lines = text.splitlines()
    if not lines:
        raise ScrapTransformationError("Source file is empty")

    raw_headers = lines[0].split("\t")
    has_trailing_empty_column = bool(raw_headers and raw_headers[-1] == "")
    if has_trailing_empty_column:
        raw_headers.pop()
    headers = _canonical_headers(raw_headers)
    comment_index = headers.index("requisition_comment") if "requisition_comment" in headers else None

    records: list[dict[str, str | int | None]] = []
    reconstructed_rows = 0
    for source_row_number, line in enumerate(lines[1:], start=2):
        if not line.strip("\t\r\n"):
            continue
        values = line.split("\t")
        if has_trailing_empty_column and values and values[-1] == "":
            values.pop()
        if len(values) > len(headers):
            if comment_index is None:
                raise ScrapTransformationError(f"Row {source_row_number} has extra TAB fields and no REQ Comment column")
            extra_count = len(values) - len(headers)
            comment_end = comment_index + extra_count + 1
            values = values[:comment_index] + ["\t".join(values[comment_index:comment_end])] + values[comment_end:]
            reconstructed_rows += 1
        if len(values) != len(headers):
            raise ScrapTransformationError(f"Row {source_row_number} has {len(values)} fields; expected {len(headers)}")
        record: dict[str, str | int | None] = {
            header: (value.strip() if value.strip() else None) for header, value in zip(headers, values, strict=True)
        }
        record["source_row_number"] = source_row_number
        records.append(record)
    return ParsedScrapFile(records=records, reconstructed_rows=reconstructed_rows)


def parse_decimal(value: Any, quantum: Decimal, *, field_name: str, required: bool = False) -> Decimal | None:
    if value is None or str(value).strip() == "":
        if required:
            raise ScrapTransformationError(f"{field_name} is required")
        return None
    raw = str(value).strip().replace("R$", "").replace(" ", "")
    negative_parentheses = raw.startswith("(") and raw.endswith(")")
    if negative_parentheses:
        raw = raw[1:-1]
    if "," in raw:
        raw = raw.replace(".", "").replace(",", ".")
    try:
        number = Decimal(raw)
    except InvalidOperation as error:
        raise ScrapTransformationError(f"Invalid decimal for {field_name}: {value!r}") from error
    if negative_parentheses:
        number = -number
    return number.quantize(quantum, rounding=ROUND_HALF_UP)


def parse_date(value: Any, *, field_name: str = "transaction_date") -> date:
    if value is None:
        raise ScrapTransformationError(f"{field_name} is required")
    raw = str(value).strip()
    for pattern in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(raw, pattern).date()
        except ValueError:
            pass
    raise ScrapTransformationError(f"Invalid date for {field_name}: {value!r}")


def _optional_text(record: dict[str, Any], field_name: str) -> str | None:
    value = record.get(field_name)
    return str(value).strip() if value is not None and str(value).strip() else None


def normalize_record(record: dict[str, Any], exchange_rate: Decimal) -> NormalizedScrapRecord:
    source_row_number = int(record.get("source_row_number") or 0)
    if source_row_number <= 0:
        raise ScrapTransformationError("source_row_number must be greater than zero")
    organization_code = (_optional_text(record, "organization_code") or "").upper()
    if not organization_code:
        raise ScrapTransformationError("organization_code is required")
    transaction_date = parse_date(record.get("transaction_date"))
    issue_quantity = parse_decimal(record.get("issue_quantity"), QUANTITY_QUANTUM, field_name="issue_quantity", required=True)
    issue_amount_brl = parse_decimal(
        record.get("issue_amount_brl"), MONEY_QUANTUM, field_name="issue_amount_brl", required=True
    )
    assert issue_quantity is not None and issue_amount_brl is not None
    with localcontext() as context:
        context.prec = 38
        amount_usd = (issue_amount_brl / exchange_rate).quantize(USD_QUANTUM, rounding=ROUND_HALF_UP)

    receipt_department = _optional_text(record, "receipt_department")
    normalized_department = receipt_department.upper() if receipt_department else None
    account_alias = _optional_text(record, "account_alias")
    normalized_alias = account_alias.upper() if account_alias else None
    make_item = _optional_text(record, "make_item")
    normalized_make_item = make_item.upper() if make_item else None

    organization_mapping = ORGANIZATION_CLASSIFICATION.get(organization_code)
    department = DEPARTMENT_CLASSIFICATION.get(normalized_department or "")
    item_type = ITEM_TYPE_BY_MAKE_ITEM.get(normalized_make_item or "")
    to_be_counted = TO_BE_COUNTED_BY_ACCOUNT_ALIAS.get(normalized_alias or "")
    quality_flags: list[str] = []
    if organization_mapping is None:
        quality_flags.extend(["unmapped_organization", "unmapped_product", "unmapped_division"])
    if department is None:
        quality_flags.append("unmapped_department" if receipt_department else "missing_receipt_department")
    if item_type is None:
        quality_flags.append("unmapped_item_type")
    if to_be_counted is None:
        quality_flags.append("unmapped_to_be_counted")

    product, division = organization_mapping if organization_mapping else (None, None)
    period = transaction_date.replace(day=1)
    return NormalizedScrapRecord(
        source_row_number=source_row_number,
        organization_code=organization_code,
        account_code=_optional_text(record, "account_code"),
        account_description=_optional_text(record, "account_description"),
        account_alias=account_alias,
        subinventory_group=_optional_text(record, "subinventory_group"),
        subinventory=_optional_text(record, "subinventory"),
        warehouse_market=_optional_text(record, "warehouse_market"),
        receipt_department=receipt_department,
        receipt_description=_optional_text(record, "receipt_description"),
        item_code=_optional_text(record, "item_code"),
        uit=_optional_text(record, "uit"),
        item_description=_optional_text(record, "item_description"),
        item_specification=_optional_text(record, "item_specification"),
        transaction_date=transaction_date,
        issue_quantity=issue_quantity,
        issue_price=parse_decimal(record.get("issue_price"), PRICE_QUANTUM, field_name="issue_price"),
        issue_amount_brl=issue_amount_brl,
        sales_price=parse_decimal(record.get("sales_price"), PRICE_QUANTUM, field_name="sales_price"),
        sales_amount_brl=parse_decimal(record.get("sales_amount_brl"), MONEY_QUANTUM, field_name="sales_amount_brl"),
        warehouse_keeper=_optional_text(record, "warehouse_keeper"),
        planner=_optional_text(record, "planner"),
        work_order=_optional_text(record, "work_order"),
        reason=_optional_text(record, "reason"),
        requisition_reason=_optional_text(record, "requisition_reason"),
        requisition_comment=_optional_text(record, "requisition_comment"),
        reference=_optional_text(record, "reference"),
        make_item=make_item,
        created_by=_optional_text(record, "created_by"),
        period=period,
        period_yy_mm=transaction_date.strftime("%y-%m"),
        department=department,
        product=product,
        division=division,
        item_type=item_type,
        to_be_counted=to_be_counted,
        amount_usd=amount_usd,
        quality_flags=quality_flags,
        derivation_provenance={
            "mapping_version": MAPPING_VERSION,
            "mapping_status": "OBSERVED_PENDING_HOMOLOGATION",
            "product_division_source": "organization_code",
            "department_source": "receipt_department",
            "item_type_source": "make_item",
            "to_be_counted_source": "account_alias",
        },
    )


def normalize_payload(payload: MaterialScrapPayload) -> list[NormalizedScrapRecord]:
    normalized: list[NormalizedScrapRecord] = []
    for record_index, source_record in enumerate(payload.records, start=1):
        record = dict(source_record)
        record.setdefault("source_row_number", record_index)
        try:
            normalized.append(normalize_record(record, payload.exchange_rate.brl_per_usd))
        except ScrapTransformationError as error:
            row_number = record.get("source_row_number", "unknown")
            raise ScrapTransformationError(f"Source row {row_number}: {error}") from error
    return normalized
