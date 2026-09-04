"""Manual GERP file ingestion without coupling the web API to the RPA project."""

import hashlib
import re
import uuid
from collections import Counter
from datetime import UTC, date, datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation, localcontext

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from .enums import AutomationTrigger
from .identity import content_hash
from .models import DailyExchangeRate
from .schemas import (
    BatchStatistics,
    CanonicalScrapRecord,
    ExchangeRateMetadata,
    ExecutionMetadata,
    MappingMetadata,
    MaterialScrapPayload,
    SourceFileMetadata,
)

EXPECTED_HEADER = (
    "Organization Code",
    "Account",
    "Description",
    "Account Alias",
    "Subinventory Group",
    "Subinventory",
    "W/H Market",
    "Receipt Department",
    "Description",
    "Item",
    "UIT",
    "Item Desc",
    "Item Spec",
    "Transaction Date",
    "Issue Quantity",
    "Issue Price",
    "Issue Amount",
    "Sales Price",
    "Sales Amount",
    "Warehouse Keeper",
    "Planner",
    "Work Order",
    "Reason",
    "REQ Reason",
    "REQ Comment",
    "Reference",
    "Make Item",
    "Created by",
    "",
)
CANONICAL_FIELDS = (
    "organization_code",
    "account_code",
    "account_description",
    "account_alias",
    "subinventory_group",
    "subinventory_code",
    "warehouse_market",
    "receipt_department",
    "receipt_description",
    "item_code",
    "uit",
    "item_description",
    "item_specification",
    "transaction_date",
    "issue_quantity",
    "issue_price",
    "issue_amount_brl",
    "sales_price",
    "sales_amount",
    "warehouse_keeper",
    "planner",
    "work_order",
    "reason",
    "requisition_reason",
    "requisition_comment",
    "reference",
    "make_item",
    "created_by",
)
MAX_MANUAL_UPLOAD_BYTES = 15 * 1024 * 1024
FILE_NAME_PREFIX = "Other_Account_Transaction_Text"
NULL_TEXTS = frozenset({"", "-", "nan", "n/a", "null", "none"})
CONTROL_CHARACTERS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class ManualUploadValidationError(ValueError):
    """Raised when an uploaded file is not the approved GERP report layout."""


def _normalize_text(value: str) -> str | None:
    cleaned = CONTROL_CHARACTERS.sub("", value.replace("\u00a0", " ")).strip()
    return None if cleaned.casefold() in NULL_TEXTS else cleaned


def _decode(raw_bytes: bytes) -> tuple[str, str]:
    if not raw_bytes:
        raise ManualUploadValidationError("O arquivo está vazio.")
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return raw_bytes.decode(encoding, errors="strict"), encoding
        except UnicodeDecodeError:
            continue
    raise ManualUploadValidationError("O arquivo deve estar codificado em UTF-8 ou CP1252.")


def _decimal(value: str | None, *, field_name: str, quantum: Decimal, required: bool = False) -> Decimal | None:
    if value is None or not value.strip():
        if required:
            raise ManualUploadValidationError(f"{field_name} é obrigatório.")
        return None
    raw = value.strip().replace("R$", "").replace("\u00a0", "").replace(" ", "")
    negative_parentheses = raw.startswith("(") and raw.endswith(")")
    if negative_parentheses:
        raw = raw[1:-1]
    if "," in raw:
        raw = raw.replace(".", "").replace(",", ".")
    try:
        result = Decimal(raw)
    except InvalidOperation as error:
        raise ManualUploadValidationError(f"Valor inválido em {field_name}: {value!r}") from error
    return (-result if negative_parentheses else result).quantize(quantum, rounding=ROUND_HALF_UP)


def _date(value: str | None) -> date:
    if value is None:
        raise ManualUploadValidationError("Transaction Date é obrigatório.")
    for pattern in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(value, pattern).date()
        except ValueError:
            continue
    raise ManualUploadValidationError(f"Transaction Date inválido: {value!r}")


def _required(values: dict[str, str | None], field_name: str, source_line: int) -> str:
    value = values[field_name]
    if value is None:
        raise ManualUploadValidationError(f"Linha {source_line}: {field_name} é obrigatório.")
    return value


def _records(text: str, rate: Decimal) -> tuple[list[CanonicalScrapRecord], int]:
    lines = text.splitlines()
    while lines and not lines[-1]:
        lines.pop()
    if len(lines) < 2:
        raise ManualUploadValidationError("O relatório deve conter cabeçalho e pelo menos uma linha de dados.")
    if tuple(lines[0].split("\t")) != EXPECTED_HEADER:
        raise ManualUploadValidationError("O arquivo não corresponde ao layout Other Account Transaction Text do GERP.")

    records: list[CanonicalScrapRecord] = []
    expanded_comments = 0
    for source_line, line in enumerate(lines[1:], start=2):
        if not line:
            raise ManualUploadValidationError(f"Linha física vazia na linha {source_line}.")
        fields = line.split("\t")
        if len(fields) < len(EXPECTED_HEADER) or fields[-1] != "":
            raise ManualUploadValidationError(f"Linha {source_line} não contém as 29 colunas esperadas.")
        flags: list[str] = []
        if len(fields) > len(EXPECTED_HEADER):
            comment_parts = [_normalize_text(value) for value in fields[24:-4]]
            fields = fields[:24] + [" | ".join(value for value in comment_parts if value)] + fields[-4:-1]
            flags.append("expanded_req_comment_fields")
            expanded_comments += 1
        else:
            fields = fields[:-1]
        if len(fields) != len(CANONICAL_FIELDS):
            raise ManualUploadValidationError(f"Linha {source_line} não pode ser interpretada com segurança.")
        values = {name: _normalize_text(value) for name, value in zip(CANONICAL_FIELDS, fields, strict=True)}
        transaction_date = _date(values["transaction_date"])
        issue_quantity = _decimal(
            values["issue_quantity"], field_name="Issue Quantity", quantum=Decimal("0.000001"), required=True
        )
        issue_price = _decimal(values["issue_price"], field_name="Issue Price", quantum=Decimal("0.00000001"))
        issue_amount = _decimal(values["issue_amount_brl"], field_name="Issue Amount", quantum=Decimal("0.01"), required=True)
        sales_price = _decimal(values["sales_price"], field_name="Sales Price", quantum=Decimal("0.00000001"))
        sales_amount = _decimal(values["sales_amount"], field_name="Sales Amount", quantum=Decimal("0.01"))
        assert issue_quantity is not None and issue_amount is not None
        if (
            issue_price is not None
            and (issue_quantity * issue_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) != issue_amount
        ):
            flags.append("issue_amount_mismatch")
        with localcontext() as context:
            context.prec = 38
            amount_usd = (issue_amount / rate).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
        record = CanonicalScrapRecord(
            source_line=source_line,
            organization_code=_required(values, "organization_code", source_line),
            account_code=_required(values, "account_code", source_line),
            account_description=values["account_description"],
            account_alias=_required(values, "account_alias", source_line),
            subinventory_group=values["subinventory_group"],
            subinventory_code=values["subinventory_code"],
            warehouse_market=values["warehouse_market"],
            receipt_department=values["receipt_department"],
            receipt_description=values["receipt_description"],
            department=None,
            product=None,
            division=None,
            item_code=_required(values, "item_code", source_line),
            uit=values["uit"],
            item_description=values["item_description"],
            item_specification=values["item_specification"],
            item_type=None,
            transaction_date=transaction_date,
            period=transaction_date.strftime("%Y-%m"),
            period_yy_mm=transaction_date.strftime("%y.%m"),
            issue_quantity=issue_quantity,
            issue_price=issue_price,
            issue_amount_brl=issue_amount,
            amount_usd=amount_usd,
            sales_price=sales_price,
            sales_amount=sales_amount,
            warehouse_keeper=values["warehouse_keeper"],
            planner=values["planner"],
            work_order=values["work_order"],
            reason=values["reason"],
            requisition_reason=values["requisition_reason"],
            requisition_comment=values["requisition_comment"],
            reference=values["reference"],
            make_item=values["make_item"],
            created_by=values["created_by"],
            to_be_counted=None,
            content_hash="0" * 64,
            quality_flags=sorted(set(flags)),
            derivation_provenance={"normalization_source": "manual_upload", "mapping_version": "manual-upload-v1"},
        )
        records.append(record.model_copy(update={"content_hash": content_hash(record)}))
    return records, expanded_comments


async def build_manual_upload_payload(*, filename: str | None, raw_bytes: bytes, db: AsyncSession) -> MaterialScrapPayload:
    """Validate an approved GERP TSV and convert it into the canonical ingestion contract."""
    if not filename or not filename.startswith(FILE_NAME_PREFIX):
        raise ManualUploadValidationError(f"Envie um arquivo iniciado por {FILE_NAME_PREFIX}.")
    if len(raw_bytes) > MAX_MANUAL_UPLOAD_BYTES:
        raise ManualUploadValidationError("O arquivo excede o limite de 15 MB para upload manual.")
    text, encoding = _decode(raw_bytes)
    daily_rate = (
        await db.execute(select(DailyExchangeRate).order_by(desc(DailyExchangeRate.rate_date)).limit(1))
    ).scalar_one_or_none()
    if daily_rate is None:
        raise ManualUploadValidationError("Não há cotação cadastrada para converter o arquivo para USD.")
    records, expanded_comments = _records(text, daily_rate.brl_per_usd)
    if not records:
        raise ManualUploadValidationError("O arquivo não contém registros de transação.")
    dates = [record.transaction_date for record in records]
    processing_date = max(dates)
    now = datetime.now(UTC)
    quality_counts: Counter[str] = Counter(flag for record in records for flag in record.quality_flags)
    issue_total = sum((record.issue_amount_brl for record in records), Decimal("0.00")).quantize(Decimal("0.01"))
    sales_total = sum((record.sales_amount or Decimal("0.00") for record in records), Decimal("0.00")).quantize(Decimal("0.01"))
    return MaterialScrapPayload(
        execution=ExecutionMetadata(
            execution_id=uuid.uuid4(),
            report_name="Other Account Transaction Text Download",
            trigger=AutomationTrigger.MANUAL,
            mode="LOCAL_FILE_SIMULATION",
            processing_date=processing_date,
            extracted_at=now,
            query_date_from=min(dates),
            query_date_to=max(dates),
            query_window_inferred=True,
            organization_parameter="ALL",
            organizations_found=sorted({record.organization_code for record in records}),
        ),
        source_file=SourceFileMetadata(
            name=filename,
            sha256=hashlib.sha256(raw_bytes).hexdigest(),
            encoding=encoding,
            size_bytes=len(raw_bytes),
        ),
        exchange_rate=ExchangeRateMetadata(
            rate_date=processing_date,
            effective_date=daily_rate.effective_date,
            brl_per_usd=daily_rate.brl_per_usd,
            quote_type="manual_upload",
            source="hanaro_manual_upload",
            retrieved_at=now,
            fallback_used=True,
        ),
        mapping=MappingMetadata(version="manual-upload-v1"),
        statistics=BatchStatistics(
            source_rows=len(records),
            accepted_rows=len(records),
            rejected_rows=0,
            expanded_comment_rows=expanded_comments,
            issue_amount_brl_total=issue_total,
            sales_amount_total=sales_total,
            quality_flag_counts=dict(sorted(quality_counts.items())),
        ),
        records=records,
    )
