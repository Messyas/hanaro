import re
from dataclasses import dataclass
from pathlib import Path

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

# Legacy anonymized fixture kept from the first implementation.  It has the
# same positional semantics, but uses the expanded display labels exported by
# an earlier GERP template.  Both layouts are verified in full; no header is
# accepted merely by matching a subset of columns.
COMPATIBLE_HEADER = (
    "Organization",
    "Account",
    "Description",
    "Account Alias",
    "Subinventory Group",
    "Subinventory",
    "Warehouse Market",
    "Receipt Department",
    "Receipt Description",
    "Item",
    "UIT",
    "Description",
    "Item Specification",
    "Transaction Date",
    "Issue Quantity",
    "Issue Price",
    "Issue Amount BRL",
    "Sales Price",
    "Sales Amount BRL",
    "Warehouse Keeper",
    "Planner",
    "Work Order",
    "Reason",
    "REQ Reason",
    "REQ Comment",
    "Reference",
    "Make Item",
    "Created By",
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

NULL_TEXTS = frozenset({"", "-", "nan", "n/a", "null", "none"})
CONTROL_CHARACTERS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class GerpStructureError(ValueError):
    pass


@dataclass(frozen=True)
class ParsedRow:
    source_line: int
    values: dict[str, str | None]
    parser_flags: list[str]


@dataclass(frozen=True)
class ParsedGerpFile:
    encoding: str
    rows: list[ParsedRow]
    expanded_comment_rows: int


def normalize_text(value: str) -> str | None:
    cleaned = CONTROL_CHARACTERS.sub("", value.replace("\u00a0", " ")).strip()
    return None if cleaned.casefold() in NULL_TEXTS else cleaned


def _decode_source(path: Path) -> tuple[str, str]:
    payload = path.read_bytes()
    if not payload:
        raise GerpStructureError("GERP source file is empty")
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return payload.decode(encoding, errors="strict"), encoding
        except UnicodeDecodeError:
            continue
    raise GerpStructureError("GERP source file is neither UTF-8 nor CP1252")


def parse_gerp_tsv(path: Path) -> ParsedGerpFile:
    text, encoding = _decode_source(path)
    lines = text.splitlines()
    while lines and not lines[-1]:
        lines.pop()
    if len(lines) < 2:
        raise GerpStructureError(
            "GERP source must contain a header and at least one data row"
        )
    header = tuple(lines[0].split("\t"))
    if header not in (EXPECTED_HEADER, COMPATIBLE_HEADER):
        raise GerpStructureError(f"Unexpected GERP header/order: {header!r}")

    parsed_rows: list[ParsedRow] = []
    expanded_comment_rows = 0
    for source_line, line in enumerate(lines[1:], start=2):
        if not line:
            raise GerpStructureError(
                f"Unexpected blank physical line at source line {source_line}"
            )
        fields = line.split("\t")
        if len(fields) < len(EXPECTED_HEADER):
            raise GerpStructureError(
                f"Source line {source_line} has {len(fields)} fields; expected at least {len(EXPECTED_HEADER)}"
            )
        if fields[-1] != "":
            raise GerpStructureError(
                f"Source line {source_line} does not contain the expected trailing empty column"
            )

        flags: list[str] = []
        if len(fields) > len(EXPECTED_HEADER):
            comment_fragments = [normalize_text(fragment) for fragment in fields[24:-4]]
            comment = " | ".join(fragment for fragment in comment_fragments if fragment)
            fields = fields[:24] + [comment] + fields[-4:-1]
            flags.append("expanded_req_comment_fields")
            expanded_comment_rows += 1
        else:
            fields = fields[:-1]
        if len(fields) != len(CANONICAL_FIELDS):
            raise GerpStructureError(
                f"Source line {source_line} could not be reconstructed unambiguously"
            )
        values = {
            field_name: normalize_text(value)
            for field_name, value in zip(CANONICAL_FIELDS, fields, strict=True)
        }
        parsed_rows.append(
            ParsedRow(source_line=source_line, values=values, parser_flags=flags)
        )

    return ParsedGerpFile(
        encoding=encoding,
        rows=parsed_rows,
        expanded_comment_rows=expanded_comment_rows,
    )
