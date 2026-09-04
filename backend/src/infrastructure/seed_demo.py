"""Run the optional demo history loader outside the web-service startup path."""

from __future__ import annotations

import asyncio

from .start_production import seed_demo_data


def main() -> None:
    asyncio.run(seed_demo_data())


if __name__ == "__main__":
    main()
