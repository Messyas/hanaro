from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

MONEY_QUANTUM = Decimal("0.01")
QUANTITY_QUANTUM = Decimal("0.000001")
PRICE_QUANTUM = Decimal("0.00000001")
RATE_QUANTUM = Decimal("0.000001")
USD_QUANTUM = Decimal("0.000001")


class DecimalParseError(ValueError):
    pass


def parse_decimal(
    value: str | None,
    quantum: Decimal,
    *,
    field_name: str,
    required: bool = False,
) -> Decimal | None:
    if value is None or not value.strip():
        if required:
            raise DecimalParseError(f"{field_name} is required")
        return None
    raw = value.strip().replace("R$", "").replace("\u00a0", "").replace(" ", "")
    negative_parentheses = raw.startswith("(") and raw.endswith(")")
    if negative_parentheses:
        raw = raw[1:-1]
    if "," in raw:
        raw = raw.replace(".", "").replace(",", ".")
    try:
        parsed = Decimal(raw)
    except InvalidOperation as error:
        raise DecimalParseError(
            f"Invalid decimal for {field_name}: {value!r}"
        ) from error
    if negative_parentheses:
        parsed = -parsed
    return parsed.quantize(quantum, rounding=ROUND_HALF_UP)
