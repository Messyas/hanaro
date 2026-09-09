import hashlib
import re
from pathlib import Path

from ...infrastructure.config.settings import get_settings

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def safe_filename(value: str) -> str:
    cleaned = _SAFE_NAME.sub("-", value).strip(".-")[:180]
    return cleaned or "report"


class ReportArtifactStorage:
    def __init__(self, root: str | Path | None = None) -> None:
        configured = root or get_settings().REPORT_ARTIFACT_DIR
        self.root = Path(configured).resolve()

    def _path(self, key: str) -> Path:
        if not key or Path(key).is_absolute() or ".." in Path(key).parts:
            raise ValueError("Invalid artifact key")
        path = (self.root / key).resolve()
        if self.root not in path.parents:
            raise ValueError("Invalid artifact key")
        return path

    def write_once(self, key: str, content: bytes) -> Path:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            existing = path.read_bytes()
            if hashlib.sha256(existing).digest() == hashlib.sha256(content).digest():
                return path
            raise FileExistsError("Artifact already exists with different content")
        path.write_bytes(content)
        return path

    def read(self, key: str) -> bytes:
        path = self._path(key)
        if not path.is_file():
            raise FileNotFoundError("Artifact not found")
        return path.read_bytes()
