import os
import warnings
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

from PIL import Image, ImageOps, UnidentifiedImageError

ALLOWED_IMAGE_FORMATS = frozenset({"JPEG", "PNG", "WEBP"})
ALLOWED_IMAGE_CONTENT_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})
PROFILE_IMAGE_ENDPOINT = "/api/v1/users/me/profile-image"
DEFAULT_PROFILE_IMAGE_URL = "https://profileimageurl.com"


class ProfileImageValidationError(ValueError):
    """Raised when uploaded bytes are not a safe supported profile image."""


@dataclass(frozen=True, slots=True)
class StoredProfileImage:
    url: str
    path: Path


class ProfileImageStorage:
    """Validate, normalize and persist private user profile images.

    Images are decoded and re-encoded as WebP so filenames, EXIF metadata and
    untrusted original bytes are never served back to clients.
    """

    def __init__(self, directory: str, max_bytes: int, max_dimension: int) -> None:
        self.directory = Path(directory).resolve()
        self.max_bytes = max_bytes
        self.max_dimension = max_dimension

    def store(self, user_id: int, payload: bytes) -> StoredProfileImage:
        if not payload or len(payload) > self.max_bytes:
            raise ProfileImageValidationError("Image size is outside the allowed range")

        normalized = self._normalize(payload)
        token = uuid4().hex
        self.directory.mkdir(parents=True, exist_ok=True)
        destination = self.directory / self._filename(user_id, token)
        temporary = self.directory / f".{destination.name}.tmp"

        try:
            temporary.write_bytes(normalized)
            os.replace(temporary, destination)
        finally:
            temporary.unlink(missing_ok=True)

        return StoredProfileImage(
            url=f"{PROFILE_IMAGE_ENDPOINT}?v={token}",
            path=destination,
        )

    def resolve(self, user_id: int, image_url: str | None) -> Path | None:
        token = self._token_from_url(image_url)
        if token is None:
            return None

        candidate = (self.directory / self._filename(user_id, token)).resolve()
        if candidate.parent != self.directory:
            return None
        return candidate

    def delete(self, user_id: int, image_url: str | None) -> bool:
        path = self.resolve(user_id, image_url)
        if path is None:
            return False

        try:
            path.unlink()
            return True
        except FileNotFoundError:
            return False

    def _normalize(self, payload: bytes) -> bytes:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(BytesIO(payload)) as source:
                    if source.format not in ALLOWED_IMAGE_FORMATS:
                        raise ProfileImageValidationError("Unsupported image format")
                    if getattr(source, "is_animated", False):
                        raise ProfileImageValidationError("Animated images are not supported")

                    width, height = source.size
                    if width < 1 or height < 1 or width > self.max_dimension or height > self.max_dimension:
                        raise ProfileImageValidationError("Image dimensions are outside the allowed range")

                    source.load()
                    image = ImageOps.exif_transpose(source)
                    image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
                    if image.mode not in {"RGB", "RGBA"}:
                        image = image.convert("RGBA" if "transparency" in image.info else "RGB")

                    output = BytesIO()
                    image.save(output, format="WEBP", quality=85, method=6)
                    return output.getvalue()
        except ProfileImageValidationError:
            raise
        except (
            Image.DecompressionBombError,
            Image.DecompressionBombWarning,
            UnidentifiedImageError,
            OSError,
            ValueError,
        ) as error:
            raise ProfileImageValidationError("Invalid or corrupted image") from error

    @staticmethod
    def _filename(user_id: int, token: str) -> str:
        return f"{user_id}-{token}.webp"

    @staticmethod
    def _token_from_url(image_url: str | None) -> str | None:
        if not image_url:
            return None

        parsed = urlparse(image_url)
        if parsed.path != PROFILE_IMAGE_ENDPOINT:
            return None

        values = parse_qs(parsed.query).get("v", [])
        if len(values) != 1:
            return None

        token = values[0]
        if len(token) != 32 or any(character not in "0123456789abcdef" for character in token):
            return None
        return token
