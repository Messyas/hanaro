from src.app.support.governance.exports.renderers import csv, markdown, pdf, pptx

RENDERERS = {"CSV": csv.render, "PDF": pdf.render, "PPTX": pptx.render, "MARKDOWN": markdown.render}
MIME_TYPES = {
    "CSV": "text/csv; charset=utf-8",
    "PDF": "application/pdf",
    "PPTX": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "MARKDOWN": "text/markdown; charset=utf-8",
}
