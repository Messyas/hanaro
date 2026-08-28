from typing import Any, cast

from ...infrastructure.taskiq.brokers import default_broker
from ...infrastructure.taskiq.deps import DBSession
from ...infrastructure.taskiq.registry import register_task
from .schemas import IngestionResult, MaterialScrapPayload
from .service import ingest_material_scrap


@default_broker.task(task_name="material_scrap.ingest")
async def ingest_material_scrap_task(payload: dict[str, Any], db: DBSession) -> dict[str, Any]:
    """Worker-ready entry point for the future Smart Office payload."""
    result: IngestionResult = await ingest_material_scrap(MaterialScrapPayload.model_validate(payload), db)
    return result.model_dump(mode="json")


register_task("material_scrap.ingest", "default", ingest_material_scrap_task)


async def enqueue_material_scrap(payload: MaterialScrapPayload) -> str:
    """Publish a canonical batch and return its Taskiq identifier."""
    # Taskiq injects the DBSession dependency in the worker; its type overload
    # still exposes that injected argument to producers, so narrow it here.
    task = await ingest_material_scrap_task.kiq(  # type: ignore[call-overload]
        payload.model_dump(mode="json")
    )
    return cast(str, task.task_id)
