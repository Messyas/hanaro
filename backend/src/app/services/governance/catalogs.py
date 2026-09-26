"""Time-aware resolution of shared governance catalog data."""

import uuid
from datetime import date

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.governance.models import LineSourceMapping


async def resolve_line_source_mapping(
    db: AsyncSession,
    *,
    factory_id: uuid.UUID,
    source_system: str,
    organization_code: str,
    receipt_department: str,
    business_date: date,
) -> LineSourceMapping | None:
    """Resolve one valid mapping; ambiguous data is rejected instead of guessed."""

    matches = list(
        await db.scalars(
            select(LineSourceMapping)
            .where(
                LineSourceMapping.factory_id == factory_id,
                LineSourceMapping.source_system == source_system,
                LineSourceMapping.organization_code == organization_code,
                LineSourceMapping.receipt_department == receipt_department,
                LineSourceMapping.valid_from <= business_date,
                or_(LineSourceMapping.valid_to.is_(None), LineSourceMapping.valid_to > business_date),
            )
            .order_by(LineSourceMapping.valid_from.desc(), LineSourceMapping.id)
        )
    )
    if len(matches) > 1:
        raise ValueError("Overlapping line source mappings must be corrected before reporting")
    return matches[0] if matches else None
