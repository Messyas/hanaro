import hashlib
import json
import re
from collections import Counter
from datetime import date, datetime
from decimal import ROUND_HALF_UP, localcontext
from typing import Any

from .decimal_parser import (
    MONEY_QUANTUM,
    PRICE_QUANTUM,
    QUANTITY_QUANTUM,
    USD_QUANTUM,
    parse_decimal,
)
from .mappings import (
    DEPARTMENT_CLASSIFICATION,
    ITEM_TYPE_PATTERNS,
    MAPPING_VERSION,
    ORGANIZATION_CLASSIFICATION,
    TO_BE_COUNTED_CLASSIFICATION,
)
from .parser import ParsedGerpFile, ParsedRow
from .schemas import CanonicalScrapRecord, ExchangeRateMetadata


class NormalizationError(ValueError):
    pass


def parse_business_date(value: str | None, *, field_name: str) -> date:
    if value is None:
        raise NormalizationError(f"{field_name} is required")
    for pattern in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(value, pattern).date()
        except ValueError:
            continue
    raise NormalizationError(f"Invalid date for {field_name}: {value!r}")


def _required_text(row: ParsedRow, field_name: str) -> str:
    value = row.values.get(field_name)
    if value is None:
        raise NormalizationError(
            f"Source line {row.source_line}: {field_name} is required"
        )
    return value


def _content_hash(values: dict[str, Any]) -> str:
    encoded = json.dumps(
        values,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=lambda value: (
            value.isoformat() if isinstance(value, date) else str(value)
        ),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def canonical_content_hash(record: CanonicalScrapRecord) -> str:
    return _content_hash(record.model_dump(exclude={"content_hash"}))


def _derive_item_type(item_description: str | None) -> str | None:
    if item_description is None:
        return None
    for pattern, item_type in ITEM_TYPE_PATTERNS:
        if re.search(pattern, item_description, flags=re.IGNORECASE):
            return item_type
    return None


def normalize_row(
    row: ParsedRow, exchange_rate: ExchangeRateMetadata
) -> CanonicalScrapRecord:
    organization_code = _required_text(row, "organization_code")
    account_code = _required_text(row, "account_code")
    account_alias = _required_text(row, "account_alias")
    item_code = _required_text(row, "item_code")
    transaction_date = parse_business_date(
        row.values.get("transaction_date"), field_name="transaction_date"
    )
    try:
        issue_quantity = parse_decimal(
            row.values.get("issue_quantity"),
            QUANTITY_QUANTUM,
            field_name="issue_quantity",
            required=True,
        )
        issue_price = parse_decimal(
            row.values.get("issue_price"), PRICE_QUANTUM, field_name="issue_price"
        )
        issue_amount_brl = parse_decimal(
            row.values.get("issue_amount_brl"),
            MONEY_QUANTUM,
            field_name="issue_amount_brl",
            required=True,
        )
        sales_price = parse_decimal(
            row.values.get("sales_price"), PRICE_QUANTUM, field_name="sales_price"
        )
        sales_amount = parse_decimal(
            row.values.get("sales_amount"), MONEY_QUANTUM, field_name="sales_amount"
        )
    except ValueError as error:
        raise NormalizationError(f"Source line {row.source_line}: {error}") from error
    assert issue_quantity is not None and issue_amount_brl is not None

    with localcontext() as context:
        context.prec = 38
        amount_usd = (issue_amount_brl / exchange_rate.brl_per_usd).quantize(
            USD_QUANTUM,
            rounding=ROUND_HALF_UP,
        )

    quality_flags = list(row.parser_flags)
    organization_mapping = ORGANIZATION_CLASSIFICATION.get(organization_code)
    if organization_mapping is None:
        product, division = None, None
        quality_flags.extend(["unmapped_product", "unmapped_division"])
    else:
        product, division = organization_mapping

    receipt_department = row.values.get("receipt_department")
    department = DEPARTMENT_CLASSIFICATION.get(receipt_department or "")
    if department is None:
        quality_flags.append(
            "unmapped_department"
            if receipt_department
            else "missing_receipt_department"
        )

    account_description = row.values.get("account_description")
    counted_key = ((account_description or "").upper(), account_alias.upper())
    to_be_counted = TO_BE_COUNTED_CLASSIFICATION.get(counted_key)
    if to_be_counted is None:
        quality_flags.append("unmapped_to_be_counted")

    item_type = _derive_item_type(row.values.get("item_description"))
    if item_type is None:
        quality_flags.append("unmapped_item_type")

    if issue_price is not None:
        calculated_amount = (issue_quantity * issue_price).quantize(
            MONEY_QUANTUM, rounding=ROUND_HALF_UP
        )
        if calculated_amount != issue_amount_brl:
            quality_flags.append("issue_amount_mismatch")

    values: dict[str, Any] = {
        "source_line": row.source_line,
        "organization_code": organization_code,
        "account_code": account_code,
        "account_description": account_description,
        "account_alias": account_alias,
        "subinventory_group": row.values.get("subinventory_group"),
        "subinventory_code": row.values.get("subinventory_code"),
        "warehouse_market": row.values.get("warehouse_market"),
        "receipt_department": receipt_department,
        "receipt_description": row.values.get("receipt_description"),
        "department": department,
        "product": product,
        "division": division,
        "item_code": item_code,
        "uit": row.values.get("uit"),
        "item_description": row.values.get("item_description"),
        "item_specification": row.values.get("item_specification"),
        "item_type": item_type,
        "transaction_date": transaction_date,
        "period": transaction_date.strftime("%Y-%m"),
        "period_yy_mm": transaction_date.strftime("%y.%m"),
        "issue_quantity": issue_quantity,
        "issue_price": issue_price,
        "issue_amount_brl": issue_amount_brl,
        "amount_usd": amount_usd,
        "sales_price": sales_price,
        "sales_amount": sales_amount,
        "warehouse_keeper": row.values.get("warehouse_keeper"),
        "planner": row.values.get("planner"),
        "work_order": row.values.get("work_order"),
        "reason": row.values.get("reason"),
        "requisition_reason": row.values.get("requisition_reason"),
        "requisition_comment": row.values.get("requisition_comment"),
        "reference": row.values.get("reference"),
        "make_item": row.values.get("make_item"),
        "created_by": row.values.get("created_by"),
        "to_be_counted": to_be_counted,
        "quality_flags": sorted(set(quality_flags)),
        "derivation_provenance": {
            "mapping_version": MAPPING_VERSION,
            "organization_rule": "organization_code",
            "department_rule": "receipt_department",
            "item_type_rule": "item_description_regex",
            "to_be_counted_rule": "account_description+account_alias",
        },
    }
    values["content_hash"] = _content_hash(values)
    return CanonicalScrapRecord.model_validate(values)


def normalize_file(
    parsed: ParsedGerpFile,
    exchange_rate: ExchangeRateMetadata,
) -> tuple[list[CanonicalScrapRecord], Counter[str]]:
    records = [normalize_row(row, exchange_rate) for row in parsed.rows]
    quality_counts: Counter[str] = Counter()
    for record in records:
        quality_counts.update(record.quality_flags)
    return records, quality_counts
