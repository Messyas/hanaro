"""Apply pending migrations before starting the local development API."""

from __future__ import annotations

import asyncio
import os

from .start_production import _run_migrations


def main() -> None:
    asyncio.run(_run_migrations())
    os.execvp(
        "fastapi",
        ["fastapi", "dev", "src/interfaces/main.py", "--host", "0.0.0.0", "--port", "8000"],
    )


if __name__ == "__main__":
    main()
