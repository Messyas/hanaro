from dataclasses import dataclass
from typing import Any

from ...governance.models import ReportVersion
from ...governance.schemas import ExportOptions
from .templates import LABELS


@dataclass(frozen=True)
class Document:
    version: ReportVersion
    items: list[dict[str, Any]]
    options: ExportOptions

    @property
    def labels(self):
        return LABELS[self.options.language]

    def sections(self) -> list[tuple[str, str]]:
        content, labels, options = self.version.content, self.labels, self.options
        report, scope = content.get("report", {}), content.get("scope", {})
        result = [
            (str(report.get("title", "Report")), str(report.get("description", ""))),
            (
                f"{report.get('code', '')} · {labels['revision']} {self.version.revision}",
                f"{self.version.published_at}\n{labels['author']}: "
                f"{report.get('author') or self.version.published_by_user_id}\n"
                f"{labels['period']}: {scope.get('date_from', '')} — {scope.get('date_to', '')}\n{scope.get('factory_id', '')}",
            ),
        ]
        if options.include_summary:
            metrics = content.get("metrics", {})
            summary = f"{labels['occurrences']}: {metrics.get('occurrence_count', len(self.items))}"
            if options.include_money:
                summary += f"\nBRL {metrics.get('issue_amount_brl', '0')} · USD {metrics.get('amount_usd', '0')}"
            result.append((labels["summary"], summary))
        if options.include_occurrences:
            for item in self.items:
                lines = [
                    f"{item.get(k) or ''}"
                    for k in ("transaction_date", "organization_code", "item_description", "product", "division", "line")
                ]
                lines.append(f"Quantity: {item.get('issue_quantity', '')}")
                if options.include_money:
                    lines.append(f"BRL {item.get('issue_amount_brl', '')} · USD {item.get('amount_usd', '')}")
                if options.include_justifications:
                    lines.extend(
                        [
                            labels["review"],
                            str(item.get("review_title") or ""),
                            str(item.get("review_description") or ""),
                            f"{item.get('reviewed_by_name', '')} · {item.get('reviewed_at', '')} "
                            f"· v{item.get('review_version', '')}",
                        ]
                    )
                if options.include_evidence:
                    lines.append(labels["evidence"])
                    lines.extend(
                        f"{e['filename']} · SHA256 {e['sha256']} · {e['size_bytes']} bytes · ID {e['id']}"
                        for e in item.get("evidence", [])
                    )
                    if item.get("attachment_ids") and "evidence" not in item:
                        lines.append("Legacy evidence: durable copy unavailable")
                lines.append(f"Occurrence: {item['occurrence_id']} · Transaction: {item.get('transaction_id', '')}")
                result.append((str(item.get("item_code") or item["occurrence_id"]), "\n".join(lines)))
        lineage = content.get("lineage", {})
        trace = [f"SHA256 {self.version.sha256}", content.get("precedence", "DIRECT_CURRENT_THEN_SOURCE_REPORT_UUID_ASC")]
        for occurrence, sources in lineage.items():
            trace.append(f"{occurrence}: " + "; ".join(str(s) for s in sources))
        # Conflicting full analyses remain visible and frozen, never silently lost.
        for conflict in content.get("conflicts", []):
            trace.append(f"Divergence: {conflict['occurrence_id']} · {conflict['source_version_id']}")
            if options.include_justifications:
                trace.append(str(conflict["alternative"].get("review_description", "")))
        result.append((labels["sources"], "\n".join(trace)))
        return result
