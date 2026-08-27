from typing import Any

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
