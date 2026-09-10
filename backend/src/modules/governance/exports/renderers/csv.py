import csv
import io
from decimal import Decimal

from ..document import Document


def csv_text(value) -> str:
    text = "" if value is None else str(value)
    probe = text.lstrip(" \t\r\n\x00\x0b\x0c\ufeff")
    return "'" + text if probe.startswith(("=", "+", "-", "@")) else text


def render(document: Document) -> bytes:
    # UTF-8 BOM; comma separator; CRLF. Numeric columns are exact Decimals.
    options = document.options
    fields = [
        "occurrence_id",
        "transaction_id",
        "transaction_date",
        "organization_code",
        "item_code",
        "item_description",
        "product",
        "division",
        "line",
        "issue_quantity",
    ]
    if options.include_money:
        fields += ["issue_amount_brl", "amount_usd", "exchange_rate", "exchange_rate_effective_date"]
    if options.include_justifications:
        fields += ["review_title", "review_description", "review_version", "reviewed_by_name", "reviewed_at"]
    if options.include_evidence:
        fields += ["evidence"]
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=fields, lineterminator="\r\n")
    writer.writeheader()
    for item in document.items:
        writer.writerow(
            {
                field: str(Decimal(str(item[field])))
                if field in {"issue_quantity", "issue_amount_brl", "amount_usd", "exchange_rate"}
                and item.get(field) is not None
                else csv_text(item.get(field))
                for field in fields
            }
        )
    return ("\ufeff" + stream.getvalue()).encode("utf-8")
