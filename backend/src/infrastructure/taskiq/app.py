"""Taskiq app configuration and worker lifecycle management."""

import logging
from datetime import timedelta

from taskiq import AsyncBroker
from taskiq.events import TaskiqEvents
from taskiq.state import TaskiqState

from ...modules.material_scrap.execution_service import recover_stale_executions
from ..config import get_settings
from ..database.session import local_session
from .brokers import default_broker

logger = logging.getLogger(__name__)


async def startup_taskiq_worker(state: TaskiqState) -> None:
    """Initialize worker startup procedures.

    Args:
        state: The taskiq state instance
    """
    logger.info("Starting taskiq worker...")
    settings = get_settings()
    async with local_session() as db:
        recovered = await recover_stale_executions(
            db,
            stale_after=timedelta(minutes=settings.TASKIQ_EXECUTION_STALE_AFTER_MINUTES),
        )
    if recovered:
        logger.warning("Recovered %s stale Material Scrap execution(s)", recovered)
    logger.info("Taskiq worker startup complete")


async def shutdown_taskiq_worker(state: TaskiqState) -> None:
    """Cleanup worker shutdown procedures.

    Args:
        state: The taskiq state instance
    """
    logger.info("Shutting down taskiq worker...")
    logger.info("Taskiq worker shutdown complete")


def configure_broker_lifecycle(broker: AsyncBroker) -> None:
    """Configure broker with startup and shutdown handlers.

    Args:
        broker: The broker to configure
    """
    broker.add_middlewares()
    broker.add_event_handler(TaskiqEvents.WORKER_STARTUP, startup_taskiq_worker)
    broker.add_event_handler(TaskiqEvents.WORKER_SHUTDOWN, shutdown_taskiq_worker)


configure_broker_lifecycle(default_broker)
