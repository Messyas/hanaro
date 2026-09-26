import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.governance.models import ProductionMeasurementVersion
from src.app.models.governance.production_schemas import ProductionMeasurementWrite
from src.app.models.material_scrap.models import ScrapDashboardState


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


async def product_production_denominators(
    db: AsyncSession,
    *,
    year: int,
    months: Sequence[int],
    currency: str,
    use_quantity: bool,
) -> dict[str, Decimal]:
    """Aggregate confirmed production exposure by product for a dashboard slice."""
    if not months:
        return {}
    column = ProductionMeasurementVersion.production_quantity if use_quantity else ProductionMeasurementVersion.production_value
    conditions = [
        ProductionMeasurementVersion.year == year,
        ProductionMeasurementVersion.month.in_(months),
        ProductionMeasurementVersion.scope_key.like("PRODUCT:%"),
        ProductionMeasurementVersion.status == "CONFIRMED",
    ]
    if not use_quantity:
        conditions.append(ProductionMeasurementVersion.currency == currency)
    statement = (
        select(ProductionMeasurementVersion.scope_key, func.sum(column))
        .where(*conditions)
        .group_by(ProductionMeasurementVersion.scope_key)
    )
    return {
        str(row.scope_key).removeprefix("PRODUCT:"): Decimal(str(row[1]))
        for row in (await db.execute(statement)).all()
        if row[1] is not None
    }


async def monthly_product_production_denominators(
    db: AsyncSession,
    *,
    year: int,
    products: Sequence[str],
    currency: str,
    use_quantity: bool,
) -> dict[int, Decimal]:
    """Aggregate monthly exposure for a selected set of products."""
    if not products:
        return {}
    column = ProductionMeasurementVersion.production_quantity if use_quantity else ProductionMeasurementVersion.production_value
    conditions = [
        ProductionMeasurementVersion.year == year,
        ProductionMeasurementVersion.scope_key.in_([f"PRODUCT:{product}" for product in products]),
        ProductionMeasurementVersion.status == "CONFIRMED",
    ]
    if not use_quantity:
        conditions.append(ProductionMeasurementVersion.currency == currency)
    statement = (
        select(ProductionMeasurementVersion.month, func.sum(column))
        .where(*conditions)
        .group_by(ProductionMeasurementVersion.month)
    )
    return {int(row.month): Decimal(str(row[1])) for row in (await db.execute(statement)).all() if row[1] is not None}


async def bump_dashboard_revision(db: AsyncSession) -> None:
    now = datetime.now(UTC)
    state = await db.get(ScrapDashboardState, 1, with_for_update=True)
    if state is None:
        db.add(ScrapDashboardState(updated_at=now))
        return
    state.revision = uuid.uuid4()
    state.updated_at = now


async def list_production_measurements(
    db: AsyncSession, year: int, scope_key: str = "GLOBAL"
) -> list[ProductionMeasurementVersion]:
    latest_revision = (
        select(
            ProductionMeasurementVersion.year,
            ProductionMeasurementVersion.month,
            ProductionMeasurementVersion.scope_key,
            func.max(ProductionMeasurementVersion.revision).label("revision"),
        )
        .where(
            ProductionMeasurementVersion.year == year,
            ProductionMeasurementVersion.scope_key == scope_key,
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
    scope_key: str = "GLOBAL",
) -> list[ProductionMeasurementVersion]:
    if not measurements:
        return await list_production_measurements(db, year, scope_key)

    for item in measurements:
        current = await db.scalar(
            select(ProductionMeasurementVersion)
            .where(
                ProductionMeasurementVersion.year == year,
                ProductionMeasurementVersion.month == item.month,
                ProductionMeasurementVersion.scope_key == scope_key,
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
                scope_key=scope_key,
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
    return await list_production_measurements(db, year, scope_key)


async def clear_production_measurements(
    db: AsyncSession,
    *,
    year: int,
    expected_versions: dict[int, int],
    scope_key: str = "GLOBAL",
) -> None:
    rows = list(
        (
            await db.scalars(
                select(ProductionMeasurementVersion)
                .where(
                    ProductionMeasurementVersion.year == year,
                    ProductionMeasurementVersion.scope_key == scope_key,
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
