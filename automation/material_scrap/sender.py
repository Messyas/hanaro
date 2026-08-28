import json
from dataclasses import dataclass
from typing import Any, Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .schemas import CanonicalMaterialScrapBatch


class BatchSender(Protocol):
    def send(self, batch: CanonicalMaterialScrapBatch) -> dict[str, Any]: ...


@dataclass(frozen=True)
class HttpBatchSender:
    backend_url: str
    api_key: str
    timeout_seconds: float = 30.0

    def send(self, batch: CanonicalMaterialScrapBatch) -> dict[str, Any]:
        endpoint = f"{self.backend_url.rstrip('/')}/api/v1/scrap/ingestions"
        request = Request(
            endpoint,
            data=batch.model_dump_json().encode("utf-8"),
            method="POST",
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "X-API-Key": self.api_key,
            },
        )
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:  # noqa: S310
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")[:1000]
            raise RuntimeError(
                f"Backend rejected Material Scrap batch ({error.code}): {detail}"
            ) from error
        except URLError as error:
            raise RuntimeError(
                f"Unable to send Material Scrap batch: {error.reason}"
            ) from error
