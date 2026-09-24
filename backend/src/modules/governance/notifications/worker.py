import asyncio
import logging

from ....infrastructure.database.session import local_session
from ..tasks import enqueue_report_export
from .monitor import monitor
from .rules import evaluate
from .service import dispatch, recover_exports

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
