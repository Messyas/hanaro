"""Private, auditable evidence files attached to action-plan tasks."""

import hashlib
import uuid
import warnings
from io import BytesIO
from pathlib import Path

from PIL import Image, UnidentifiedImageError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from .actions import get_plan, record, task_detail
from .exceptions import ReportConflictError, ReportNotFoundError, ReportValidationError
from .models import ActionEvidence, ImprovementAction, now
from .storage import ReportArtifactStorage, safe_filename

MAX_EVIDENCE_BYTES = 10_000_000
MAX_EVIDENCE_PER_TASK = 20
IMAGE_FORMATS = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}
EXTENSIONS = {
    "application/pdf": {".pdf"},
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
}


def validate_file(content: bytes, filename: str, content_type: str) -> str:
    if not content or len(content) > MAX_EVIDENCE_BYTES:
        raise ReportValidationError("Evidence must contain 1 to 10000000 bytes")
    if content_type not in EXTENSIONS:
        raise ReportValidationError("Only PDF, JPEG, PNG and WebP evidence is supported")
    if content_type == "application/pdf":
        if not content.startswith(b"%PDF-") or b"%%EOF" not in content[-2048:]:
            raise ReportValidationError("Invalid PDF evidence")
    else:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(BytesIO(content)) as image:
                    if image.format != IMAGE_FORMATS[content_type] or getattr(image, "is_animated", False):
                        raise ReportValidationError("Evidence content does not match its media type")
                    if not 1 <= image.width <= 10000 or not 1 <= image.height <= 10000:
                        raise ReportValidationError("Evidence image dimensions are outside the allowed range")
                    image.verify()
        except (
            UnidentifiedImageError,
            OSError,
            ValueError,
            Image.DecompressionBombWarning,
            Image.DecompressionBombError,
        ) as error:
            raise ReportValidationError("Invalid image evidence") from error
    cleaned = safe_filename(filename or "evidence")
    if Path(cleaned).suffix.lower() not in EXTENSIONS[content_type]:
        cleaned = f"{Path(cleaned).stem or 'evidence'}{sorted(EXTENSIONS[content_type])[0]}"
    return cleaned


async def _editable_task(db: AsyncSession, task_id: uuid.UUID, expected_version: int) -> ImprovementAction:
    plan_id = await db.scalar(select(ImprovementAction.plan_id).where(ImprovementAction.id == task_id))
    if plan_id is None:
        raise ReportNotFoundError("Task not found")
    plan = await get_plan(db, plan_id, True)
    if plan.status != "OPEN":
        raise ReportConflictError("Reopen the plan before changing evidence")
    task = await db.get(ImprovementAction, task_id, with_for_update=True, populate_existing=True)
    if task is None:
        raise ReportNotFoundError("Task not found")
    if task.version != expected_version:
        raise ReportConflictError("Task changed; refresh before changing evidence")
    if task.status == "COMPLETED":
        raise ReportConflictError("Reopen the task before changing evidence")
    return task


async def add_evidence(
    db: AsyncSession,
    task_id: uuid.UUID,
    *,
    content: bytes,
    filename: str,
    content_type: str,
    expected_version: int,
    actor_id: int,
    storage: ReportArtifactStorage | None = None,
) -> dict:
    cleaned = validate_file(content, filename, content_type)
    task = await _editable_task(db, task_id, expected_version)
    count = await db.scalar(
        select(func.count())
        .select_from(ActionEvidence)
        .where(ActionEvidence.action_id == task.id, ActionEvidence.deleted_at.is_(None))
    )
    if (count or 0) >= MAX_EVIDENCE_PER_TASK:
        raise ReportValidationError("Task evidence limit reached")
    evidence_id = uuid.uuid4()
    digest = hashlib.sha256(content).hexdigest()
    key = f"action-evidence/{task.id}/{evidence_id}/{digest}"
    await run_in_threadpool((storage or ReportArtifactStorage()).write_once, key, content)
    db.add(
        ActionEvidence(
            id=evidence_id,
            action_id=task.id,
            storage_key=key,
            sha256=digest,
            size_bytes=len(content),
            filename=cleaned,
            content_type=content_type,
            uploaded_by_user_id=actor_id,
        )
    )
    task.version += 1
    task.updated_at = now()
    record(db, task, actor_id, "TASK_EVIDENCE_ADDED", {"evidence_id": str(evidence_id), "sha256": digest, "filename": cleaned})
    await db.commit()
    return await task_detail(db, task.id)


async def remove_evidence(
    db: AsyncSession, task_id: uuid.UUID, evidence_id: uuid.UUID, expected_version: int, actor_id: int
) -> dict:
    task = await _editable_task(db, task_id, expected_version)
    evidence = await db.scalar(
        select(ActionEvidence)
        .where(ActionEvidence.id == evidence_id, ActionEvidence.action_id == task.id, ActionEvidence.deleted_at.is_(None))
        .with_for_update()
    )
    if evidence is None:
        raise ReportNotFoundError("Evidence not found")
    evidence.deleted_at = now()
    evidence.deleted_by_user_id = actor_id
    task.version += 1
    task.updated_at = now()
    record(db, task, actor_id, "TASK_EVIDENCE_REMOVED", {"evidence_id": str(evidence.id), "sha256": evidence.sha256})
    await db.commit()
    return await task_detail(db, task.id)


async def read_evidence(
    db: AsyncSession, task_id: uuid.UUID, evidence_id: uuid.UUID, storage: ReportArtifactStorage | None = None
) -> tuple[ActionEvidence, bytes]:
    evidence = await db.scalar(
        select(ActionEvidence).where(
            ActionEvidence.id == evidence_id, ActionEvidence.action_id == task_id, ActionEvidence.deleted_at.is_(None)
        )
    )
    if evidence is None:
        raise ReportNotFoundError("Evidence not found")
    try:
        content = await run_in_threadpool((storage or ReportArtifactStorage()).read, evidence.storage_key)
    except FileNotFoundError as error:
        raise ReportNotFoundError("Evidence file not found") from error
    if len(content) != evidence.size_bytes or hashlib.sha256(content).hexdigest() != evidence.sha256:
        raise ReportValidationError("Evidence integrity verification failed")
    return evidence, content
