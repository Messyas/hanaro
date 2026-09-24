#!/usr/bin/env python3
"""Taskiq worker entry point."""

# Import task modules so Taskiq registers them in worker processes.
from src.modules.governance import tasks as governance_tasks  # noqa: F401
from src.modules.material_scrap import tasks as material_scrap_tasks  # noqa: F401

from . import app as taskiq_app  # noqa: F401  # Registers broker lifecycle hooks.
from .brokers import default_broker

__all__ = ["default_broker"]

if __name__ == "__main__":
    # Run with: python -m taskiq worker infrastructure.taskiq.worker:default_broker
    pass
