"""Observed mappings awaiting business homologation."""

MAPPING_VERSION = "1.0.0"

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

DEPARTMENT_CLASSIFICATION: dict[str, str] = {
    "RMA": "RMA",
    "BM1": "FA",
    "BM2": "FA",
    "BMCELL": "FA",
    "TSE": "OSP",
    "SMT": "SMT",
    "IPI": "IPI",
}

# Initial observed matrix. Unknown combinations deliberately remain null.
TO_BE_COUNTED_CLASSIFICATION: dict[tuple[str, str], bool] = {
    ("DEFECT - DIRECT CHARGED", "D-DIRECT"): True,
    ("DEFECT FOR EXCESSIVE QTY OVER QPA(BOM)", "D-EXPENSE"): True,
    ("CONSUMABLE SUPPLIES EXPENSE", "E-CONSM"): False,
    ("MATERIAL REQUEST FOR R&D(INSIDE LAB)", "E-RND-INM"): False,
}

ITEM_TYPE_PATTERNS: tuple[tuple[str, str], ...] = (
    (r"^(?:pcba|pcb assembly|printed circuit)(?:,|\b)", "PCBA"),
    (r"^tape(?:,|\b)", "Tape"),
    (r"^(?:cover assembly)(?:,|\b)", "Cover Assembly"),
    (r"^cover(?:,|\b)", "Cover"),
    (r"^(?:lcd|led assembly|module)(?:,|\b)", "Module"),
    (r"^chassis(?:,|\b)", "Chassis"),
    (r"^box(?:,|\b)", "Box"),
    (r"^packing(?:,|\b)", "Packing"),
    (r"^base(?:,|\b)", "Base"),
    (r"^lens(?:,|\b)", "Lens"),
    (r"^gasket(?:,|\b)", "Gasket"),
    (r"^sheet(?:,|\b)", "Sheet"),
    (r"^part(?:,|\b)", "Part"),
)
