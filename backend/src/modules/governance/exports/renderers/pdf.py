import io
from xml.sax.saxutils import escape

from reportlab.lib import colors  # type: ignore[import-untyped]
from reportlab.lib.styles import getSampleStyleSheet  # type: ignore[import-untyped]
from reportlab.pdfbase import pdfmetrics  # type: ignore[import-untyped]
from reportlab.pdfbase.cidfonts import UnicodeCIDFont  # type: ignore[import-untyped]
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer  # type: ignore[import-untyped]

from ..document import Document


def render(document: Document) -> bytes:
    output = io.BytesIO()
    styles = getSampleStyleSheet()
    # The built-in CID font covers Korean and Latin data without external fetching.
    font = "HYSMyeongJo-Medium"
    pdfmetrics.registerFont(UnicodeCIDFont(font))
    for style in styles.byName.values():
        style.fontName = font
        style.wordWrap = "CJK"
    styles["Heading2"].textColor = colors.HexColor("#a71930")
    styles["BodyText"].leading = 15
    story = []
    for title, body in document.sections():
        story.append(Paragraph(escape(title), styles["Heading2"]))
        # Bounded paragraphs allow long analyses to split across pages.
        for line in body.splitlines():
            for start in range(0, max(1, len(line)), 1800):
                story.append(Paragraph(escape(line[start : start + 1800]), styles["BodyText"]))
        story.append(Spacer(1, 12))

    def decorate_page(canvas, doc):
        canvas.saveState()
        canvas.setFont(font, 8)
        canvas.setFillColor(colors.HexColor("#5f6368"))
        report_title = str(document.version.content.get("report", {}).get("title", "Report"))
        canvas.drawString(42, 806, f"HANARO | {report_title[:72]}")
        canvas.setStrokeColor(colors.HexColor("#d9dde3"))
        canvas.line(42, 798, 553, 798)
        canvas.drawString(42, 24, f"HANARO | {document.version.sha256[:16]}")
        canvas.drawRightString(550, 24, str(doc.page))
        canvas.restoreState()

    SimpleDocTemplate(output, leftMargin=42, rightMargin=42, topMargin=54, bottomMargin=42).build(
        story, onFirstPage=decorate_page, onLaterPages=decorate_page
    )
    return output.getvalue()
