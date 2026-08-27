"""Versioned initial mappings observed in the analyst workbook.

These rules are deliberately centralized and marked as unapproved so they can be
replaced by governed database dimensions without changing the transformer.
"""

MAPPING_VERSION = "2026-08-26-observed-v1"

ORGANIZATION_CLASSIFICATION: dict[str, tuple[str, str]] = {
    "NWK": ("BM", "BM"),
    "NW1": ("TV", "HE"),
    "NW4": ("AV", "HE"),
    "NWH": ("MNT", "MNT"),
    "NWX": ("AV", "HE"),
    "NWU": ("AV", "HE"),
    "NWD": ("TV", "HE"),
    "NWE": ("TV", "HE"),
    "NWW": ("MNT", "MNT"),
    "NWZ": ("TV", "HE"),
}

# Representative rules for the anonymized fixture. Business homologation is pending.
DEPARTMENT_CLASSIFICATION = {
    "ASSEMBLY": "Manufacturing",
    "QUALITY": "Quality",
    "MAINTENANCE": "Maintenance",
}

ITEM_TYPE_BY_MAKE_ITEM = {"Y": "MAKE", "N": "BUY"}
TO_BE_COUNTED_BY_ACCOUNT_ALIAS = {"SCRAP": True, "ADJUSTMENT": False}
