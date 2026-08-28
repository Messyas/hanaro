import argparse
import json
import logging
import os
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

from .builder import build_canonical_batch
from .exchange import ManualExchangeRateProvider
from .sender import HttpBatchSender
from .source import LocalFileSource, RunContext

logger = logging.getLogger("hanaro.automation.material_scrap")


def _date(value: str) -> date:
    return date.fromisoformat(value)


def _datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        raise argparse.ArgumentTypeError("timestamp must include timezone")
    return parsed


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Preprocess a GERP Material Scrap export into canonical JSON"
    )
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--reference-date", type=_date, required=True)
    parser.add_argument("--exchange-rate", type=Decimal, required=True)
    parser.add_argument("--exchange-rate-source", required=True)
    parser.add_argument("--query-date-from", type=_date)
    parser.add_argument("--query-date-to", type=_date)
    parser.add_argument("--extracted-at", type=_datetime)
    parser.add_argument("--organization-parameter", default="ALL")
    parser.add_argument("--gerp-request-id")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--backend-url")
    parser.add_argument("--api-key", default=os.getenv("HANARO_API_KEY"))
    return parser


def main() -> None:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
    )
    args = _build_parser().parse_args()
    context = RunContext(
        reference_date=args.reference_date,
        query_date_from=args.query_date_from,
        query_date_to=args.query_date_to,
        organization_parameter=args.organization_parameter,
        gerp_request_id=args.gerp_request_id,
    )
    source = LocalFileSource(args.input).obtain_file(context)
    batch = build_canonical_batch(
        source,
        context,
        ManualExchangeRateProvider(
            rate=args.exchange_rate, source=args.exchange_rate_source
        ),
        extracted_at=args.extracted_at or datetime.now(ZoneInfo("America/Manaus")),
    )

    output = (
        args.output
        or Path("automation/artifacts")
        / f"material_scrap_{batch.execution.execution_id}.json"
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(batch.model_dump_json(indent=2), encoding="utf-8")
    logger.info(
        "execution_id=%s stage=build_json source_rows=%d expanded_comment_rows=%d issue_total=%s output=%s",
        batch.execution.execution_id,
        batch.statistics.source_rows,
        batch.statistics.expanded_comment_rows,
        batch.statistics.issue_amount_brl_total,
        output,
    )

    result: dict[str, object] | None = None
    if args.backend_url:
        if not args.api_key:
            raise SystemExit(
                "--api-key or HANARO_API_KEY is required when --backend-url is supplied"
            )
        result = HttpBatchSender(args.backend_url, args.api_key).send(batch)
        logger.info(
            "execution_id=%s stage=ingest status=%s",
            batch.execution.execution_id,
            result.get("status"),
        )

    print(
        json.dumps(
            {
                "execution_id": str(batch.execution.execution_id),
                "output": str(output.resolve()),
                "statistics": batch.statistics.model_dump(mode="json"),
                "organizations_found": batch.execution.organizations_found,
                "ingestion": result,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
