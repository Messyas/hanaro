"""Application service for administrator-managed monthly scrap targets."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ...infrastructure.logging import get_logger
from .models import ScrapDashboardState, ScrapTarget
from .schemas import ScrapTargetRead, ScrapTargetUpsert

logger = get_logger(__name__)


class ScrapTargetService:
    @staticmethod
    async def _bump_revision(db: AsyncSession, now: datetime) -> None:
        state = await db.get(ScrapDashboardState, 1, with_for_update=True)
        if state is None:
            db.add(ScrapDashboardState(updated_at=now))
        else:
            state.revision = uuid.uuid4()
            state.updated_at = now

    async def list(self, db: AsyncSession, *, year: int | None = None) -> list[ScrapTargetRead]:
        statement = select(ScrapTarget)
        if year is not None:
            statement = statement.where(ScrapTarget.year == year)
        statement = statement.order_by(ScrapTarget.year, ScrapTarget.month, ScrapTarget.currency)
        return [ScrapTargetRead.model_validate(target) for target in (await db.execute(statement)).scalars()]

    async def upsert(
        self,
        db: AsyncSession,
        *,
        year: int,
        month: int,
        command: ScrapTargetUpsert,
        actor_id: int,
    ) -> ScrapTargetRead:
        now = datetime.now(UTC)
        statement = select(ScrapTarget).where(
            ScrapTarget.year == year,
            ScrapTarget.month == month,
            ScrapTarget.currency == command.currency.value,
        )
        target = (await db.execute(statement)).scalar_one_or_none()
        if target is None:
            target = ScrapTarget(
                year=year,
                month=month,
                currency=command.currency.value,
                amount=command.amount,
                updated_by_id=actor_id,
                created_at=now,
                updated_at=now,
            )
            db.add(target)
        else:
            target.amount = command.amount
            target.updated_by_id = actor_id
            target.updated_at = now

        await self._bump_revision(db, now)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            target = (await db.execute(statement)).scalar_one_or_none()
            if target is None:
                raise
            target.amount = command.amount
            target.updated_by_id = actor_id
            target.updated_at = now
            await self._bump_revision(db, now)
            try:
                await db.commit()
            except Exception:
                await db.rollback()
                raise
        except Exception:
            await db.rollback()
            raise
        await db.refresh(target)
        logger.info(
            "scrap_target_upserted",
            extra={"year": year, "month": month, "currency": command.currency.value, "actor_id": actor_id},
        )
        return ScrapTargetRead.model_validate(target)
