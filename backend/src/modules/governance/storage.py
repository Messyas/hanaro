import hashlib
import os
import re
import tempfile
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
        # Publish a fully flushed file with an atomic no-replace hard link.
        # Readers never see partial bytes; competing writers cannot overwrite.
        fd, temporary = tempfile.mkstemp(dir=path.parent, prefix=".pending-")
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(content)
                stream.flush()
                os.fsync(stream.fileno())
            try:
                os.link(temporary, path)
            except FileExistsError:
                if hashlib.sha256(path.read_bytes()).digest() != hashlib.sha256(content).digest():
                    raise FileExistsError("Artifact already exists with different content") from None
        finally:
            os.unlink(temporary)
        return path

    def read(self, key: str) -> bytes:
        path = self._path(key)
        if not path.is_file():
            raise FileNotFoundError("Artifact not found")
        return path.read_bytes()
