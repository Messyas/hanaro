import io
import textwrap

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.util import Inches, Pt

from src.app.support.governance.exports.document import Document


def render(document: Document) -> bytes:
    presentation = Presentation()
    presentation.slide_width, presentation.slide_height = Inches(13.333), Inches(7.5)
    for title, body in document.sections():
        # Explicit wrapping and conservative line capacity keep all text editable.
        lines = [part for line in body.splitlines() for part in (textwrap.wrap(line, width=64) or [""])]
        for offset in range(0, max(1, len(lines)), 12):
            slide = presentation.slides.add_slide(presentation.slide_layouts[6])
            heading = slide.shapes.add_textbox(Inches(0.6), Inches(0.35), Inches(12), Inches(1.1)).text_frame
            heading.word_wrap = True
            heading.text = title
            heading.paragraphs[0].font.size = Pt(24)
            heading.paragraphs[0].font.color.rgb = RGBColor(167, 25, 48)
            frame = slide.shapes.add_textbox(Inches(0.6), Inches(1.6), Inches(12), Inches(5.2)).text_frame
            frame.word_wrap = True
            frame.text = "\n".join(lines[offset : offset + 12])
            for paragraph in frame.paragraphs:
                paragraph.font.size = Pt(18)
                paragraph.font.name = "Malgun Gothic" if document.options.language == "ko" else "Arial"
                paragraph.space_after = Pt(6)
            footer = slide.shapes.add_textbox(Inches(0.6), Inches(7), Inches(12), Inches(0.3)).text_frame
            footer.text = f"HANARO · {document.version.sha256[:16]} · {len(presentation.slides)}"
            footer.paragraphs[0].font.size = Pt(9)
    output = io.BytesIO()
    presentation.save(output)
    return output.getvalue()
