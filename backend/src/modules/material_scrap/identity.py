"""Versioned, deterministic identity for Material Scrap occurrences.

``record_key`` deliberately uses only source-business fields that identify an
occurrence in the GERP daily report.  Presentation and derived fields (such as
classification, descriptions, USD conversion and quality flags) are excluded
so a correction to those fields creates a technical version instead of a new
business occurrence.
"""

import hashlib
import json
import re
import unicodedata
from datetime import date
from decimal import Decimal
from typing import Any

from .schemas import CanonicalScrapRecord

RECORD_KEY_VERSION = "v1"
_SEPARATOR = "\x1f"
_NULL = "<NULL>"
_EMPTY = "<EMPTY>"


def _text(value: str | None) -> str:
    """Canonicalize text while preserving the distinction between null/empty."""
    if value is None:
        return _NULL
    normalized = unicodedata.normalize("NFKC", value)
    normalized = re.sub(r"\s+", " ", normalized.strip())
    return _EMPTY if not normalized else normalized.upper()


def _decimal(value: Decimal) -> str:
    """Return a non-exponent decimal representation without binary floats."""
    normalized = value.normalize()
    rendered = format(normalized, "f")
    return "0" if rendered in {"-0", ""} else rendered


def record_key(record: CanonicalScrapRecord) -> str:
    """Hash the v1 business identity of one canonical source row.

    v1 fields are organization/date/account/item/work order/reference/quantity
    and BRL amount.  They are source fields, are present in the canonical
    contract, and together distinguish the transactions available from GERP.
    Codes retain leading zeros; no ingestion metadata or source-row position is
    part of this key.
    """
    values = (
        RECORD_KEY_VERSION,
        _text(record.organization_code),
        record.transaction_date.isoformat(),
        _text(record.account_code),
        _text(record.item_code),
        _text(record.work_order),
        _text(record.reference),
        _decimal(record.issue_quantity),
        _decimal(record.issue_amount_brl),
    )
    return hashlib.sha256(_SEPARATOR.join(values).encode("utf-8")).hexdigest()


def content_hash(record: CanonicalScrapRecord) -> str:
    """Hash the complete canonical version, independently of ``record_key``."""
    values: dict[str, Any] = record.model_dump(exclude={"content_hash"})
    encoded = json.dumps(
        values,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=lambda value: value.isoformat() if isinstance(value, date) else str(value),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def semantic_content_hash(record: CanonicalScrapRecord) -> str:
    """Hash source business content without the volatile row position.

    This is used only to distinguish a legitimate repeated row from an
    incompatible identity collision inside a single authoritative window.
    """
    values: dict[str, Any] = record.model_dump(exclude={"content_hash", "source_line"})
    encoded = json.dumps(
        values,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=lambda value: value.isoformat() if isinstance(value, date) else str(value),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()
