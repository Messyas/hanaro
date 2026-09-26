"""Read-only analytics for a V2 period-close report."""

from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Any, cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.governance.models import Report, ReportScope
from src.app.models.material_scrap.models import ScrapOccurrence, ScrapTransaction
from src.app.services.governance.coverage import coverage_summary
from src.app.services.governance.metric_targets import resolve_approved_target
from src.app.support.governance.reporting.metric_policy import resolve_metric_policy


def _previous_year(value: date) -> date:
    try:
        return value.replace(year=value.year - 1)
    except ValueError:
        return value.replace(year=value.year - 1, day=28)


class ReportAnalyticsService:
    async def _window(
        self,
        db: AsyncSession,
        scope: ReportScope,
        period_from: date,
        period_to: date,
    ) -> dict[str, Any]:
        filters = [
            ScrapOccurrence.status == "ACTIVE",
            ScrapTransaction.transaction_date >= period_from,
            ScrapTransaction.transaction_date <= period_to,
        ]
        dimensions = scope.filters
        for values, column in (
            (dimensions.get("organization_codes"), ScrapTransaction.organization_code),
            (dimensions.get("product_codes"), ScrapTransaction.product),
            (dimensions.get("divisions"), ScrapTransaction.division),
            (dimensions.get("lines"), ScrapTransaction.receipt_department),
        ):
            if values:
                filters.append(column.in_(values))
        rows = (
            await db.execute(
                select(
                    ScrapOccurrence.id.label("occurrence_id"),
                    ScrapOccurrence.status.label("occurrence_status"),
                    ScrapTransaction.id.label("transaction_id"),
                    ScrapTransaction.transaction_date,
                    ScrapTransaction.organization_code,
                    ScrapTransaction.item_code,
                    ScrapTransaction.item_description,
                    ScrapTransaction.product,
                    ScrapTransaction.division,
                    ScrapTransaction.receipt_department,
                    ScrapTransaction.issue_quantity.label("quantity"),
                    ScrapTransaction.issue_amount_brl,
                    ScrapTransaction.amount_usd,
                )
                .join(ScrapTransaction, ScrapTransaction.id == ScrapOccurrence.current_transaction_id)
                .where(*filters)
                .order_by(ScrapTransaction.transaction_date, ScrapOccurrence.id)
            )
        ).all()
        policy = resolve_metric_policy(scope.metric_code, scope.metric_policy_version, scope.currency)
        total = Decimal("0")
        monthly: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
        by_line: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
        financial_rows: list[dict[str, Any]] = []
        for row in rows:
            values = cast(dict[str, Any], row._mapping)
            if not policy.is_eligible(values):
                continue
            amount = policy.measure(values)
            total += amount
            monthly[values["transaction_date"].strftime("%Y-%m")] += amount
            by_line[values["receipt_department"] or "UNMAPPED"] += amount
            financial_rows.append(
                {
                    "occurrence_id": str(values["occurrence_id"]),
                    "transaction_id": str(values["transaction_id"]),
                    "transaction_date": values["transaction_date"].isoformat(),
                    "organization_code": values["organization_code"],
                    "item_code": values["item_code"],
                    "item_description": values["item_description"],
                    "product": values["product"],
                    "division": values["division"],
                    "line": values["receipt_department"],
                    "quantity": format(values["quantity"], "f") if values["quantity"] is not None else None,
                    "issue_amount_brl": (
                        format(values["issue_amount_brl"], "f") if values["issue_amount_brl"] is not None else None
                    ),
                    "amount_usd": format(values["amount_usd"], "f") if values["amount_usd"] is not None else None,
                    "metric_amount": format(amount, "f"),
                }
            )
        ranked = sorted(by_line.items(), key=lambda item: (-item[1], item[0]))
        return {
            "period_from": period_from.isoformat(),
            "period_to": period_to.isoformat(),
            "occurrence_count": len(financial_rows),
            "total": format(policy.round_for_display(total), "f"),
            "monthly": [
                {"period": key, "total": format(policy.round_for_display(value), "f")} for key, value in sorted(monthly.items())
            ],
            "pareto_lines": [
                {"line": line if line != "UNMAPPED" else None, "total": format(policy.round_for_display(value), "f")}
                for line, value in ranked
            ],
            "financial_rows": financial_rows,
        }

    async def build_dataset(self, db: AsyncSession, report: Report, scope: ReportScope) -> dict[str, Any]:
        policy = resolve_metric_policy(scope.metric_code, scope.metric_policy_version, scope.currency)
        current = await self._window(db, scope, scope.period_from, scope.period_to)
        comparison = None
        if scope.comparison_mode == "PREVIOUS_YEAR":
            comparison = await self._window(
                db,
                scope,
                _previous_year(scope.period_from),
                _previous_year(scope.period_to),
            )
        elif scope.comparison_mode == "CUSTOM" and scope.comparison_from and scope.comparison_to:
            comparison = await self._window(db, scope, scope.comparison_from, scope.comparison_to)
        target = await resolve_approved_target(
            db,
            factory_id=report.factory_id,
            metric_code=scope.metric_code,
            currency=scope.currency,
            scope_key=scope.scope_key,
            period_from=scope.period_from,
            period_to=scope.period_to,
        )
        coverage = await coverage_summary(
            db,
            factory_id=report.factory_id,
            source_system="MATERIAL_SCRAP",
            scope_key=scope.scope_key,
            period_from=scope.period_from,
            period_to=scope.period_to,
        )
        return {
            "metric": {"code": policy.code, "version": policy.version, "currency": policy.currency},
            **current,
            "comparison": comparison,
            "target": format(target.amount, "f") if target else None,
            "target_revision": target.revision if target else None,
            "coverage": coverage,
        }
