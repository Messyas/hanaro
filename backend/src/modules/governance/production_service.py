import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..material_scrap.models import ScrapDashboardState
from .models import ProductionMeasurementVersion
from .production_schemas import ProductionMeasurementWrite


class ProductionMeasurementConflictError(Exception):
    """Raised when a user submits a stale revision of a production measurement."""


async def monthly_production_denominators(
    db: AsyncSession,
    *,
    year: int,
    currency: str,
    use_quantity: bool,
) -> dict[int, Decimal | None]:
    """Resolve latest global production denominators by month.

    Quantity is a physical denominator and therefore intentionally independent
    from the dashboard currency. Monetary production values must match it.
    """
    column = ProductionMeasurementVersion.production_quantity if use_quantity else ProductionMeasurementVersion.production_value
    conditions = [
        ProductionMeasurementVersion.year == year,
        ProductionMeasurementVersion.scope_key == "GLOBAL",
        ProductionMeasurementVersion.status == "CONFIRMED",
    ]
    if not use_quantity:
        conditions.append(ProductionMeasurementVersion.currency == currency)
    statement = select(ProductionMeasurementVersion.month, column).where(*conditions)
    return {int(row.month): Decimal(str(row[1])) if row[1] is not None else None for row in (await db.execute(statement)).all()}


async def bump_dashboard_revision(db: AsyncSession) -> None:
    now = datetime.now(UTC)
    state = await db.get(ScrapDashboardState, 1, with_for_update=True)
    if state is None:
        db.add(ScrapDashboardState(updated_at=now))
        return
    state.revision = uuid.uuid4()
    state.updated_at = now


async def list_production_measurements(db: AsyncSession, year: int) -> list[ProductionMeasurementVersion]:
    latest_revision = (
        select(
            ProductionMeasurementVersion.year,
            ProductionMeasurementVersion.month,
            ProductionMeasurementVersion.scope_key,
            func.max(ProductionMeasurementVersion.revision).label("revision"),
        )
        .where(
            ProductionMeasurementVersion.year == year,
            ProductionMeasurementVersion.scope_key == "GLOBAL",
            ProductionMeasurementVersion.status != "SUPERSEDED",
        )
        .group_by(
            ProductionMeasurementVersion.year,
            ProductionMeasurementVersion.month,
            ProductionMeasurementVersion.scope_key,
        )
        .subquery()
    )
    result = await db.scalars(
        select(ProductionMeasurementVersion)
        .join(
            latest_revision,
            (ProductionMeasurementVersion.year == latest_revision.c.year)
            & (ProductionMeasurementVersion.month == latest_revision.c.month)
            & (ProductionMeasurementVersion.scope_key == latest_revision.c.scope_key)
            & (ProductionMeasurementVersion.revision == latest_revision.c.revision),
        )
        .where(ProductionMeasurementVersion.status != "SUPERSEDED")
        .order_by(ProductionMeasurementVersion.month)
    )
    return list(result.all())


async def save_production_measurements(
    db: AsyncSession,
    *,
    year: int,
    currency: str,
    measurements: Sequence[ProductionMeasurementWrite],
    author_id: int,
) -> list[ProductionMeasurementVersion]:
    if not measurements:
        return await list_production_measurements(db, year)

    for item in measurements:
        current = await db.scalar(
            select(ProductionMeasurementVersion)
            .where(
                ProductionMeasurementVersion.year == year,
                ProductionMeasurementVersion.month == item.month,
                ProductionMeasurementVersion.scope_key == "GLOBAL",
                ProductionMeasurementVersion.status != "SUPERSEDED",
            )
            .order_by(ProductionMeasurementVersion.revision.desc())
            .limit(1)
            .with_for_update()
        )
        current_revision = current.revision if current is not None else 0
        if item.expected_version != current_revision:
            raise ProductionMeasurementConflictError(f"Month {item.month} was changed by another user; reload before saving")
        if current is not None:
            current.status = "SUPERSEDED"
            revision = current.revision + 1
        else:
            revision = 1

        db.add(
            ProductionMeasurementVersion(
                year=year,
                month=item.month,
                scope_key="GLOBAL",
                currency=currency,
                production_value=item.production_value,
                production_quantity=item.production_quantity,
                note=item.note.strip(),
                revision=revision,
                status="CONFIRMED",
                source="MANUAL",
                author_id=author_id,
            )
        )

    await bump_dashboard_revision(db)
    try:
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        raise ProductionMeasurementConflictError("Production data changed concurrently; reload before saving") from error
    return await list_production_measurements(db, year)


async def clear_production_measurements(
    db: AsyncSession,
    *,
    year: int,
    expected_versions: dict[int, int],
) -> None:
    rows = list(
        (
            await db.scalars(
                select(ProductionMeasurementVersion)
                .where(
                    ProductionMeasurementVersion.year == year,
                    ProductionMeasurementVersion.scope_key == "GLOBAL",
                    ProductionMeasurementVersion.status == "CONFIRMED",
                )
                .with_for_update()
            )
        ).all()
    )
    for row in rows:
        expected = expected_versions.get(row.month, 0)
        if expected != row.revision:
            raise ProductionMeasurementConflictError(f"Month {row.month} was changed by another user; reload before clearing")
        row.status = "SUPERSEDED"
    if rows:
        await bump_dashboard_revision(db)
        await db.commit()
