import json
from dataclasses import dataclass
from typing import Any

from src.app.models.governance.models import ReportVersion
from src.app.models.governance.schemas import ExportOptions
from src.app.support.governance.exports.templates import LABELS


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
        return self._legacy_sections()

    def _legacy_sections(self) -> list[tuple[str, str]]:
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
            result.append(self._legacy_summary_section(content, labels, options))
        if options.include_occurrences:
            result.extend(self._legacy_occurrence_sections(labels, options))
        result.append(self._legacy_sources_section(content, labels, options))
        return result

    def _legacy_summary_section(
        self, content: dict[str, Any], labels: dict[str, str], options: ExportOptions
    ) -> tuple[str, str]:
        metrics = content.get("metrics", {})
        summary = f"{labels['occurrences']}: {metrics.get('occurrence_count', len(self.items))}"
        if options.include_money:
            summary += f"\nBRL {metrics.get('issue_amount_brl', '0')} · USD {metrics.get('amount_usd', '0')}"
        return labels["summary"], summary

    def _legacy_occurrence_sections(self, labels: dict[str, str], options: ExportOptions) -> list[tuple[str, str]]:
        sections: list[tuple[str, str]] = []
        for item in self.items:
            sections.append(
                (str(item.get("item_code") or item["occurrence_id"]), self._legacy_occurrence_text(item, labels, options))
            )
        return sections

    def _legacy_occurrence_text(self, item: dict[str, Any], labels: dict[str, str], options: ExportOptions) -> str:
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
                    f"{item.get('reviewed_by_name', '')} · {item.get('reviewed_at', '')} · v{item.get('review_version', '')}",
                ]
            )
        if options.include_evidence:
            lines.extend(self._legacy_evidence_lines(item, labels))
        lines.append(f"Occurrence: {item['occurrence_id']} · Transaction: {item.get('transaction_id', '')}")
        return "\n".join(lines)

    def _legacy_evidence_lines(self, item: dict[str, Any], labels: dict[str, str]) -> list[str]:
        lines = [labels["evidence"]]
        lines.extend(
            f"{e['filename']} · SHA256 {e['sha256']} · {e['size_bytes']} bytes · ID {e['id']}" for e in item.get("evidence", [])
        )
        if item.get("attachment_ids") and "evidence" not in item:
            lines.append("Legacy evidence: durable copy unavailable")
        return lines

    def _legacy_sources_section(
        self, content: dict[str, Any], labels: dict[str, str], options: ExportOptions
    ) -> tuple[str, str]:
        lineage = content.get("lineage", {})
        trace = [f"SHA256 {self.version.sha256}", content.get("precedence", "DIRECT_CURRENT_THEN_SOURCE_REPORT_UUID_ASC")]
        for occurrence, sources in lineage.items():
            trace.append(f"{occurrence}: " + "; ".join(str(s) for s in sources))
        # Conflicting full analyses remain visible and frozen, never silently lost.
        for conflict in content.get("conflicts", []):
            trace.append(f"Divergence: {conflict['occurrence_id']} · {conflict['source_version_id']}")
            if options.include_justifications:
                trace.append(str(conflict["alternative"].get("review_description", "")))
        return labels["sources"], "\n".join(trace)

    def _period_close_sections(self) -> list[tuple[str, str]]:
        content, labels, options = self.version.content, self.labels, self.options
        document = content.get("document", {})
        report, scope = document.get("report", {}), document.get("scope", {})

        result: list[tuple[str, str]] = [
            (str(report.get("title", "Report")), str(report.get("description", ""))),
            (
                f"{report.get('code', '')} · {labels['revision']} {self.version.revision}",
                f"{self.version.published_at}\n{labels['author']}: "
                f"{report.get('author') or self.version.published_by_user_id}\n"
                f"{labels['period']}: {scope.get('period_from', '')} — {scope.get('period_to', '')}\n"
                f"{'PROVISÓRIO' if scope.get('is_provisional') else 'FINAL'}",
            ),
        ]

        handlers = {
            "EXECUTIVE_SUMMARY": self._handle_exec_summary,
            "KPI": self._handle_kpi,
            "TREND": self._handle_trend,
            "PARETO": self._handle_pareto,
            "ACTIONS": self._handle_actions,
        }

        for block in document.get("sections", []):
            title = str(block.get("title") or block.get("kind") or labels["summary"])
            kind = block.get("kind")
            data = block.get("data", {})
            payload = block.get("payload", {})

            lines: list[str] = []
            if kind in handlers:
                lines = handlers[kind](report, data, payload, options, labels)
            elif payload:
                lines.append(json.dumps(payload, ensure_ascii=False, sort_keys=True))

            if options.include_evidence:
                lines.extend(self._evidence_lines_from_block(block))

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

    def _handle_exec_summary(self, report: dict, data: dict, payload: dict, options: ExportOptions, labels: dict) -> list[str]:
        return [str(report.get("description", "")), str(payload.get("narrative", ""))]

    def _handle_kpi(self, report: dict, data: dict, payload: dict, options: ExportOptions, labels: dict) -> list[str]:
        lines: list[str] = []
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
        return lines

    def _handle_trend(self, report: dict, data: dict, payload: dict, options: ExportOptions, labels: dict) -> list[str]:
        lines = [f"{row.get('period')}: {row.get('total')}" for row in data.get("monthly", [])]
        comparison = data.get("comparison")
        if comparison:
            lines.append(
                f"Comparação {comparison.get('period_from')} — {comparison.get('period_to')}: {comparison.get('total')}"
            )
        return lines

    def _handle_pareto(self, report: dict, data: dict, payload: dict, options: ExportOptions, labels: dict) -> list[str]:
        return [
            f"{index}. {row.get('line') or 'Não mapeada'}: {row.get('total')}"
            for index, row in enumerate(data.get("lines", []), start=1)
        ]

    def _handle_actions(self, report: dict, data: dict, payload: dict, options: ExportOptions, labels: dict) -> list[str]:
        lines: list[str] = []
        for action in data.get("actions", []):
            lines.append(
                f"{action.get('code')} · {action.get('title')} · {action.get('status')} · "
                f"Prazo: {action.get('due_at') or 'não informado'}"
            )
            if options.include_justifications and action.get("description"):
                lines.append(str(action["description"]))
        return lines

    def _evidence_lines_from_block(self, block: dict) -> list[str]:
        lines: list[str] = []
        for evidence in block.get("evidence", []):
            published = evidence.get("published", {})
            lines.append(
                f"Evidência {evidence.get('role')}: {evidence.get('caption', '')} · "
                f"{published.get('filename', '')} · SHA256 {published.get('sha256', '')}"
            )
        return lines
