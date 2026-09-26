"""Compatibility facade for existing callers; renderers share a frozen document."""

from src.app.models.governance.schemas import ExportOptions
from src.app.services.governance.exports.service import job_dict, request_export, run_export
from src.app.support.governance.exports.document import Document
from src.app.support.governance.exports.renderers import RENDERERS


def render_csv(version, items):
    return RENDERERS["CSV"](Document(version, items, ExportOptions()))


def render_pdf(version, items):
    return RENDERERS["PDF"](Document(version, items, ExportOptions()))


def render_pptx(version, items):
    return RENDERERS["PPTX"](Document(version, items, ExportOptions()))


__all__ = ["job_dict", "request_export", "run_export", "render_csv", "render_pdf", "render_pptx"]
