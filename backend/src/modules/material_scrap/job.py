"""Local entry point for the simulated Material Scrap ingestion job."""

import argparse
import asyncio
from decimal import Decimal
from pathlib import Path

from ...infrastructure.database.session import local_session
from .service import ingest_material_scrap
from .simulator import simulate_smart_office_output


async def run_job(source: Path, exchange_rate: Decimal, organization_scope: str = "ALL") -> str:
    payload = simulate_smart_office_output(
        source,
        exchange_rate,
        organization_scope=organization_scope,
    )
    async with local_session() as db:
        result = await ingest_material_scrap(payload, db)
    return result.model_dump_json(indent=2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest a simulated GERP Material Scrap snapshot")
    parser.add_argument("--source", type=Path, required=True, help="Extensionless CP1252 TSV source")
    parser.add_argument("--exchange-rate", type=Decimal, required=True, help="BRL per USD, e.g. 5.15")
    parser.add_argument("--organization-scope", default="ALL")
    args = parser.parse_args()
    print(asyncio.run(run_job(args.source, args.exchange_rate, args.organization_scope)))


if __name__ == "__main__":
    main()
