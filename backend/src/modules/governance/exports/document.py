import json
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

    @property
    def report_title(self) -> str:
        content = self.version.content
        report = (
            content.get("document", {}).get("report", {})
            if self.version.content_schema_version >= 2
            else content.get("report", {})
        )
        return str(report.get("title", "Report"))

    def sections(self) -> list[tuple[str, str]]:
        if self.version.content_schema_version >= 2:
            return self._period_close_sections()
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

    def _period_close_sections(self) -> list[tuple[str, str]]:
        content, labels, options = self.version.content, self.labels, self.options
        document = content.get("document", {})
        report, scope = document.get("report", {}), document.get("scope", {})
        result = [
            (str(report.get("title", "Report")), str(report.get("description", ""))),
            (
                f"{report.get('code', '')} · {labels['revision']} {self.version.revision}",
                f"{self.version.published_at}\n{labels['author']}: "
                f"{report.get('author') or self.version.published_by_user_id}\n"
                f"{labels['period']}: {scope.get('period_from', '')} — {scope.get('period_to', '')}\n"
                f"{'PROVISÓRIO' if scope.get('is_provisional') else 'FINAL'}",
            ),
        ]
        for block in document.get("sections", []):
            title = str(block.get("title") or block.get("kind") or labels["summary"])
            kind = block.get("kind")
            data = block.get("data", {})
            payload = block.get("payload", {})
            lines: list[str] = []
            if kind == "EXECUTIVE_SUMMARY":
                lines.extend([str(report.get("description", "")), str(payload.get("narrative", ""))])
            elif kind == "KPI":
                lines.append(f"{labels['occurrences']}: {data.get('occurrence_count', 0)}")
                if options.include_money:
                    currency = data.get("metric", {}).get("currency", "")
                    lines.append(f"{currency} {data.get('total', '0')}")
                    lines.append(f"Meta: {data.get('target') if data.get('target') is not None else 'indisponível'}")
                coverage = data.get("coverage", {})
                lines.append(
                    f"Cobertura: {coverage.get('status', 'UNKNOWN')} · "
                    f"{coverage.get('complete_days', 0)}/{coverage.get('expected_days', 0)} dias"
                )
            elif kind == "TREND":
                lines.extend(f"{row.get('period')}: {row.get('total')}" for row in data.get("monthly", []))
                comparison = data.get("comparison")
                if comparison:
                    lines.append(
                        f"Comparação {comparison.get('period_from')} — {comparison.get('period_to')}: {comparison.get('total')}"
                    )
            elif kind == "PARETO":
                lines.extend(
                    f"{index}. {row.get('line') or 'Não mapeada'}: {row.get('total')}"
                    for index, row in enumerate(data.get("lines", []), start=1)
                )
            elif kind == "ACTIONS":
                for action in data.get("actions", []):
                    lines.append(
                        f"{action.get('code')} · {action.get('title')} · {action.get('status')} · "
                        f"Prazo: {action.get('due_at') or 'não informado'}"
                    )
                    if options.include_justifications and action.get("description"):
                        lines.append(str(action["description"]))
            elif payload:
                lines.append(json.dumps(payload, ensure_ascii=False, sort_keys=True))
            if options.include_evidence:
                for evidence in block.get("evidence", []):
                    published = evidence.get("published", {})
                    lines.append(
                        f"Evidência {evidence.get('role')}: {evidence.get('caption', '')} · "
                        f"{published.get('filename', '')} · SHA256 {published.get('sha256', '')}"
                    )
            result.append((title, "\n".join(line for line in lines if line)))
        manifest = content.get("manifest", {})
        result.append(
            (
                labels["sources"],
                f"SHA256 {self.version.sha256}\n"
                f"Política: {manifest.get('metric_policy', '')}\n"
                f"Escopo: {manifest.get('scope_key', '')}\n"
                f"Fontes financeiras: {len(manifest.get('financial_sources', []))}\n"
                f"Ações: {len(manifest.get('action_sources', []))}\n"
                f"Evidências: {len(manifest.get('evidence_sources', []))}",
            )
        )
        return result
