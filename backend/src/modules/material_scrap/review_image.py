import os
import warnings
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4

from PIL import Image, ImageOps, UnidentifiedImageError

ALLOWED_IMAGE_FORMATS = frozenset({"JPEG", "PNG", "WEBP"})
ALLOWED_IMAGE_CONTENT_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})


class ScrapReviewImageValidationError(ValueError):
    """Raised when evidence bytes are not a safe supported image."""


@dataclass(frozen=True, slots=True)
class StoredScrapReviewImage:
    storage_key: str
    path: Path
    size_bytes: int
    width: int
    height: int


class ScrapReviewImageStorage:
    """Normalize review evidence to private WebP files with opaque names."""

    def __init__(self, directory: str, max_bytes: int, max_dimension: int, max_attachments: int = 8) -> None:
        self.directory = Path(directory).resolve()
        self.max_bytes = max_bytes
        self.max_dimension = max_dimension
        self.max_attachments = max_attachments

    def store(self, review_id: UUID, payload: bytes) -> StoredScrapReviewImage:
        normalized, width, height = self._normalize(payload)
        storage_key = uuid4().hex
        review_directory = (self.directory / str(review_id)).resolve()
        if review_directory.parent != self.directory:
            raise ScrapReviewImageValidationError("Invalid review identifier")
        review_directory.mkdir(parents=True, exist_ok=True)
        destination = review_directory / f"{storage_key}.webp"
        temporary = review_directory / f".{storage_key}.tmp"
        try:
            temporary.write_bytes(normalized)
            os.replace(temporary, destination)
        finally:
            temporary.unlink(missing_ok=True)
        return StoredScrapReviewImage(
            storage_key=storage_key,
            path=destination,
            size_bytes=len(normalized),
            width=width,
            height=height,
        )

    def copy(self, source_review_id: UUID, target_review_id: UUID, storage_key: str) -> StoredScrapReviewImage:
        source = self.resolve(source_review_id, storage_key)
        if source is None or not source.is_file():
            raise FileNotFoundError("Review attachment file not found")
        return self.store(target_review_id, source.read_bytes())

    def resolve(self, review_id: UUID, storage_key: str) -> Path | None:
        if len(storage_key) != 32 or any(character not in "0123456789abcdef" for character in storage_key):
            return None
        review_directory = (self.directory / str(review_id)).resolve()
        candidate = (review_directory / f"{storage_key}.webp").resolve()
        if review_directory.parent != self.directory or candidate.parent != review_directory:
            return None
        return candidate

    def delete(self, review_id: UUID, storage_key: str) -> bool:
        path = self.resolve(review_id, storage_key)
        if path is None:
            return False
        try:
            path.unlink()
            return True
        except FileNotFoundError:
            return False

    def _normalize(self, payload: bytes) -> tuple[bytes, int, int]:
        if not payload or len(payload) > self.max_bytes:
            raise ScrapReviewImageValidationError("Image size is outside the allowed range")
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(BytesIO(payload)) as source:
                    if source.format not in ALLOWED_IMAGE_FORMATS:
                        raise ScrapReviewImageValidationError("Unsupported image format")
                    if getattr(source, "is_animated", False):
                        raise ScrapReviewImageValidationError("Animated images are not supported")
                    width, height = source.size
                    if width < 1 or height < 1 or width > self.max_dimension or height > self.max_dimension:
                        raise ScrapReviewImageValidationError("Image dimensions are outside the allowed range")
                    source.load()
                    image = ImageOps.exif_transpose(source)
                    image.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
                    if image.mode not in {"RGB", "RGBA"}:
                        image = image.convert("RGBA" if "transparency" in image.info else "RGB")
                    output = BytesIO()
                    image.save(output, format="WEBP", quality=88, method=6)
                    normalized = output.getvalue()
                    return normalized, image.width, image.height
        except ScrapReviewImageValidationError:
            raise
        except (
            Image.DecompressionBombError,
            Image.DecompressionBombWarning,
            UnidentifiedImageError,
            OSError,
            ValueError,
        ) as error:
            raise ScrapReviewImageValidationError("Invalid or corrupted image") from error
