"""Canonical identity for dimensional report scopes."""

import hashlib
import json
import uuid
from collections.abc import Mapping
from typing import Any


def canonical_scope_key(factory_id: uuid.UUID, filters: Mapping[str, Any]) -> str:
    """Hash the dimensions used to resolve coverage and targets, never dates."""

    normalized = {
        key: sorted({str(value).strip() for value in values if str(value).strip()}) for key, values in sorted(filters.items())
    }
    canonical = json.dumps(
        {"factory_id": str(factory_id), "filters": normalized},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
