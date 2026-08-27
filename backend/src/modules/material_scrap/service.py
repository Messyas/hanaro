from sqlalchemy.ext.asyncio import AsyncSession

from . import repository
from .schemas import IngestionResult, MaterialScrapPayload
from .transformer import normalize_payload


async def ingest_material_scrap(payload: MaterialScrapPayload, db: AsyncSession) -> IngestionResult:
    """Validate and atomically publish one logical Material Scrap snapshot."""
    replay = await repository.find_completed_replay(payload, db)
    if replay is not None:
        return IngestionResult(
            run_id=replay.id,
            execution_id=replay.execution_id,
            status=replay.status,
            read_count=replay.read_count,
            accepted_count=replay.accepted_count,
            rejected_count=replay.rejected_count,
            is_replay=True,
        )

    run = await repository.create_pending_run(payload, db)
    await repository.mark_processing(run, db)
    try:
        records = normalize_payload(payload)
        await repository.publish_snapshot(run, records, db)
    except Exception as error:
        await db.rollback()
        await repository.mark_failed(
            run.id,
            db,
            read_count=len(payload.records),
            rejected_count=len(payload.records),
            error_message=f"{type(error).__name__}: {error}",
        )
        raise

    return IngestionResult(
        run_id=run.id,
        execution_id=run.execution_id,
        status=run.status,
        read_count=run.read_count,
        accepted_count=run.accepted_count,
        rejected_count=run.rejected_count,
    )
