import uuid

from src.app.support.governance.exports import run_export
from src.infrastructure.database.session import local_session
from src.infrastructure.taskiq.brokers import default_broker
from src.infrastructure.taskiq.registry import register_task


@default_broker.task(task_name="governance.export_report")
async def export_report_task(job_id: str) -> None:
    async with local_session() as db:
        await run_export(db, uuid.UUID(job_id))


register_task("governance.export_report", "default", export_report_task)


async def enqueue_report_export(job_id: uuid.UUID) -> str:
    task = await export_report_task.kiq(str(job_id))
    return task.task_id
