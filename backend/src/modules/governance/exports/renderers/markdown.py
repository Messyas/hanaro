import html
import re

from ..document import Document


def escape(value: str) -> str:
    # Escape markup, raw HTML and autolinks; no generated links or storage paths.
    value = html.escape(value, quote=False)
    return re.sub(r"([\\`*_{}\[\]()#+.!|>-])", r"\\\1", value)


def render(document: Document) -> bytes:
    return ("\n\n".join(f"## {escape(title)}\n\n{escape(body)}" for title, body in document.sections()) + "\n").encode("utf-8")
