"""Read-side target resolution for report scopes."""

import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import MetricTargetVersion


async def resolve_approved_target(
    db: AsyncSession,
    *,
    factory_id: uuid.UUID,
    metric_code: str,
    currency: str,
    scope_key: str,
    period_from: date,
    period_to: date,
) -> MetricTargetVersion | None:
    """Return an approved target only for the exact report period and scope."""

    filters = (
        MetricTargetVersion.factory_id == factory_id,
        MetricTargetVersion.metric_code == metric_code,
        MetricTargetVersion.currency == currency,
        MetricTargetVersion.scope_key == scope_key,
        MetricTargetVersion.period_start == period_from,
        MetricTargetVersion.period_end == period_to,
        MetricTargetVersion.status == "APPROVED",
    )
    revision = await db.scalar(select(func.max(MetricTargetVersion.revision)).where(*filters))
    if revision is None:
        return None
    return (await db.scalars(select(MetricTargetVersion).where(*filters, MetricTargetVersion.revision == revision))).one()
