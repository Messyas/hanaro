from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Protocol


@dataclass(frozen=True)
class RunContext:
    reference_date: date
    query_date_from: date | None = None
    query_date_to: date | None = None
    organization_parameter: str = "ALL"
    gerp_request_id: str | None = None


class SourceFileProvider(Protocol):
    def obtain_file(self, context: RunContext) -> Path: ...


@dataclass(frozen=True)
class LocalFileSource:
    path: Path

    def obtain_file(self, context: RunContext) -> Path:
        del context
        resolved = self.path.expanduser().resolve()
        if not resolved.is_file():
            raise FileNotFoundError(f"GERP source file not found: {resolved}")
        if resolved.stat().st_size == 0:
            raise ValueError(f"GERP source file is empty: {resolved}")
        return resolved


class GerpSource(Protocol):
    """Future RPA adapter. It must only obtain a file and return its path."""

    def obtain_file(self, context: RunContext) -> Path: ...
