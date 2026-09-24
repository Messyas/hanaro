"""Evidence is copied before publication commits; failed transactions leave safe orphans."""

import hashlib
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...infrastructure.config.settings import get_settings
from ..material_scrap.models import ScrapReviewAttachment
from ..material_scrap.review_image import ScrapReviewImageStorage
from .exceptions import ReportValidationError
from .models import PublishedEvidence
from .storage import ReportArtifactStorage, safe_filename


async def preserve_evidence(db: AsyncSession, items: list[dict]) -> None:
    ids = {uuid.UUID(value) for item in items if "evidence" not in item for value in item.get("attachment_ids", [])}
    attachments = {
        str(a.id): a for a in await db.scalars(select(ScrapReviewAttachment).where(ScrapReviewAttachment.id.in_(ids)))
    }
    source = ScrapReviewImageStorage(get_settings().SCRAP_REVIEW_IMAGE_DIR, 20_000_000, 4096)
    storage = ReportArtifactStorage()
    for item in items:
        if "evidence" in item:
            continue
        item["evidence"] = []
        for attachment_id in item.get("attachment_ids", []):
            attachment = attachments.get(attachment_id)
            if attachment is None:
                raise ReportValidationError("Historical evidence is unavailable; publication was not completed")
            path = source.resolve(attachment.review_id, attachment.storage_key)
            if path is None or not path.is_file():
                raise ReportValidationError("Evidence file is unavailable; publication was not completed")
            content = path.read_bytes()
            digest = hashlib.sha256(content).hexdigest()
            evidence_id = uuid.uuid4()
            key = f"evidence/{evidence_id}/{digest}"
            storage.write_once(key, content)
            evidence = PublishedEvidence(
                id=evidence_id,
                source_attachment_id=attachment.id,
                storage_key=key,
                sha256=digest,
                size_bytes=len(content),
                filename=safe_filename(attachment.original_filename),
                content_type=attachment.content_type,
            )
            db.add(evidence)
            item["evidence"].append(
                {
                    "id": str(evidence.id),
                    "sha256": digest,
                    "size_bytes": len(content),
                    "filename": evidence.filename,
                    "content_type": evidence.content_type,
                    "download_url": f"/api/v1/report-evidence/{evidence.id}",
                    "requires_authentication": True,
                }
            )
