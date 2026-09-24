"""Small serialization primitives shared by governance services."""

import hashlib
import json
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any


def _json_default(value: Any) -> str:
    if isinstance(value, (date, datetime, Decimal, uuid.UUID)):
        return str(value)
    raise TypeError(f"Unsupported canonical value: {type(value).__name__}")


def canonical_sha256(value: Any) -> str:
    encoded = json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=_json_default,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()
