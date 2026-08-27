"""Compose-friendly one-shot runner for the Material Scrap simulation."""

import json
import logging
import os
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

from .material_scrap.builder import build_canonical_batch
from .material_scrap.exchange import ManualExchangeRateProvider
from .material_scrap.sender import HttpBatchSender
from .material_scrap.source import LocalFileSource, RunContext

logger = logging.getLogger("hanaro.automation.material_scrap.simulation")


def _environment(name: str, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if value is None or not value.strip():
        raise ValueError(f"{name} is required")
    return value


def _enabled(name: str, default: bool) -> bool:
    value = os.getenv(name, str(default)).strip().lower()
    if value in {"1", "true", "yes"}:
        return True
    if value in {"0", "false", "no"}:
        return False
    raise ValueError(f"{name} must be true or false")


def main() -> None:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
    )
    reference_date = date.fromisoformat(
        _environment("HANARO_SIMULATION_REFERENCE_DATE", "2026-08-26")
    )
    context = RunContext(
        reference_date=reference_date,
        organization_parameter=_environment("HANARO_SIMULATION_ORGANIZATION", "ALL"),
    )
    source = LocalFileSource(
        Path(
            _environment(
                "HANARO_SIMULATION_INPUT",
                "/app/automation/fixtures/Other_Account_Transaction_Text_anonymized",
            )
        )
    ).obtain_file(context)
    batch = build_canonical_batch(
        source,
        context,
        ManualExchangeRateProvider(
            rate=Decimal(_environment("HANARO_SIMULATION_EXCHANGE_RATE", "5.15")),
            source=_environment("HANARO_SIMULATION_RATE_SOURCE", "manual_fixture"),
        ),
        extracted_at=datetime.now(ZoneInfo("America/Manaus")),
    )
    artifact_directory = Path(
        _environment("HANARO_SIMULATION_ARTIFACT_DIR", "/app/automation/artifacts")
    )
    artifact_directory.mkdir(parents=True, exist_ok=True)
    artifact = (
        artifact_directory / f"material_scrap_{batch.execution.execution_id}.json"
    )
    artifact.write_text(batch.model_dump_json(indent=2), encoding="utf-8")

    ingestion: dict[str, object] | None = None
    if _enabled("HANARO_SIMULATION_SEND", True):
        ingestion = HttpBatchSender(
            _environment("HANARO_SIMULATION_BACKEND_URL", "http://backend:8000"),
            _environment("HANARO_API_KEY"),
        ).send(batch)

    logger.info(
        "execution_id=%s stage=completed source_rows=%d accepted_rows=%d artifact=%s sent=%s",
        batch.execution.execution_id,
        batch.statistics.source_rows,
        batch.statistics.accepted_rows,
        artifact,
        ingestion is not None,
    )
    print(
        json.dumps(
            {
                "execution_id": str(batch.execution.execution_id),
                "artifact": str(artifact),
                "statistics": batch.statistics.model_dump(mode="json"),
                "ingestion": ingestion,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
