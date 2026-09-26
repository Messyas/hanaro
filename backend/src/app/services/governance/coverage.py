"""Resolution of source coverage without treating absent data as zero."""

import uuid
from datetime import date, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.governance.models import SourceCoverage


async def latest_coverage_for_day(
    db: AsyncSession,
    *,
    factory_id: uuid.UUID,
    source_system: str,
    scope_key: str,
    business_date: date,
) -> SourceCoverage | None:
    """Return the latest recorded revision, or None when coverage is unknown."""

    latest_revision = await db.scalar(
        select(func.max(SourceCoverage.revision)).where(
            SourceCoverage.factory_id == factory_id,
            SourceCoverage.source_system == source_system,
            SourceCoverage.scope_key == scope_key,
            SourceCoverage.business_date == business_date,
        )
    )
    if latest_revision is None:
        return None
    return (
        await db.scalars(
            select(SourceCoverage).where(
                SourceCoverage.factory_id == factory_id,
                SourceCoverage.source_system == source_system,
                SourceCoverage.scope_key == scope_key,
                SourceCoverage.business_date == business_date,
                SourceCoverage.revision == latest_revision,
            )
        )
    ).one()


async def coverage_summary(
    db: AsyncSession,
    *,
    factory_id: uuid.UUID,
    source_system: str,
    scope_key: str,
    period_from: date,
    period_to: date,
) -> dict[str, Any]:
    """Summarize the latest daily revisions across an inclusive period."""

    records = list(
        await db.scalars(
            select(SourceCoverage)
            .where(
                SourceCoverage.factory_id == factory_id,
                SourceCoverage.source_system == source_system,
                SourceCoverage.scope_key == scope_key,
                SourceCoverage.business_date >= period_from,
                SourceCoverage.business_date <= period_to,
            )
            .order_by(SourceCoverage.business_date, SourceCoverage.revision.desc())
        )
    )
    latest: dict[date, SourceCoverage] = {}
    for record in records:
        latest.setdefault(record.business_date, record)
    expected_days = (period_to - period_from).days + 1
    complete_days = sum(record.status == "COMPLETE" for record in latest.values())
    partial_days = sum(record.status == "PARTIAL" for record in latest.values())
    unknown_days = expected_days - complete_days - partial_days
    if complete_days == expected_days:
        status = "COMPLETE"
    elif not latest or unknown_days > 0:
        status = "UNKNOWN"
    else:
        status = "PARTIAL"
    missing_dates = []
    cursor = period_from
    while cursor <= period_to:
        if cursor not in latest:
            missing_dates.append(cursor.isoformat())
        cursor += timedelta(days=1)
    return {
        "status": status,
        "expected_days": expected_days,
        "complete_days": complete_days,
        "partial_days": partial_days,
        "unknown_days": unknown_days,
        "missing_dates": missing_dates,
        "source_revisions": sorted({record.source_revision for record in latest.values() if record.source_revision}),
    }
