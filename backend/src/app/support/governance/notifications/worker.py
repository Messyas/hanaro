import asyncio
import logging

from src.app.services.governance.notifications.service import dispatch, recover_exports
from src.app.support.governance.notifications.monitor import monitor
from src.app.support.governance.notifications.rules import evaluate
from src.app.support.governance.tasks import enqueue_report_export
from src.infrastructure.database.session import local_session

logger = logging.getLogger(__name__)


async def tick():
    async with local_session() as db:
        await recover_exports(db)
        await evaluate(db)
        await monitor(db)
        await dispatch(db, enqueue_report_export)


async def loop():
    while True:
        try:
            await tick()
        except Exception:
            logger.exception("Governance dispatcher failed; will retry")
        await asyncio.sleep(30)


if __name__ == "__main__":
    asyncio.run(tick())
