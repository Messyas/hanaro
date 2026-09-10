import asyncio
import hashlib
import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ....infrastructure.config.settings import get_settings
from ..exceptions import ReportNotFoundError, ReportValidationError
from ..models import Artifact, AuditEvent, ExportJob, OutboxEvent, ReportVersion, SnapshotItem, now
from ..schemas import ExportOptions
from ..service import canonical_json
from ..storage import ReportArtifactStorage, safe_filename
from .document import Document
from .renderers import MIME_TYPES, RENDERERS


def _emit(
    db: AsyncSession, job: ExportJob, event_type: str, actor_id: int | None, detail: dict[str, Any] | None = None
) -> None:
    notify_requester = event_type != "REPORT_EXPORT_COMPLETED" or bool((job.options or {}).get("notify_on_completion", False))
    body = {
        "report_version_id": str(job.report_version_id),
        "export_job_id": str(job.id),
        "actor_id": actor_id,
        "format": job.format,
        "occurred_at": now().isoformat(),
        "recipient_ids": [actor_id] if actor_id and notify_requester else [],
        "link": "/relatorios",
        **(detail or {}),
    }
    db.add(
        AuditEvent(
            event_type=event_type,
            entity_type="EXPORT_JOB",
            entity_id=job.id,
            payload=body,
            correlation_id=str(job.id),
            actor_id=actor_id,
        )
    )
    db.add(OutboxEvent(event_type=event_type, aggregate_id=job.id, payload=body, available_at=now()))


async def request_export(
    db: AsyncSession,
    *,
    report_version_id: uuid.UUID,
    format_: str,
    options: dict[str, Any],
    template_version: str,
    actor_id: int,
    retry_failed: bool,
) -> tuple[ExportJob, bool]:
    version = await db.get(ReportVersion, report_version_id)
    if version is None or version.published_at is None:
        raise ReportNotFoundError("Published report version not found")
    if format_ not in RENDERERS or template_version != "1":
        raise ReportValidationError("Unknown export format or template")
    options = ExportOptions.model_validate(options).model_dump()
    if format_ == "CSV":
        if not options["include_occurrences"]:
            raise ReportValidationError("CSV requires occurrence detail")
        # CSV has no narrative summary; canonicalize this documented no-op.
        options["include_summary"] = False
    identity = {
        "report_version_id": str(report_version_id),
        "format": format_,
        "options": options,
        "template_version": template_version,
    }
    key = hashlib.sha256(canonical_json(identity).encode("utf-8")).hexdigest()
    existing = (await db.scalars(select(ExportJob).where(ExportJob.idempotency_key == key))).one_or_none()
    if existing:
        _emit(db, existing, "REPORT_EXPORT_ACCESSED", actor_id)
        if existing.status == "FAILED" and retry_failed:
            artifact = await db.scalar(select(Artifact).where(Artifact.export_job_id == existing.id))
            if artifact is not None:
                await db.delete(artifact)
            existing.status = "QUEUED"
            existing.error_message = None
            existing.finished_at = None
            existing.updated_at = now()
            existing.attempts = 0
            existing.lease_token = None
            _emit(db, existing, "REPORT_EXPORT_REQUESTED", actor_id, {"retry": True})
            await db.commit()
            return existing, True
        await db.commit()
        return existing, False
    job = ExportJob(
        report_version_id=report_version_id,
        idempotency_key=key,
        format=format_,
        status="QUEUED",
        options=options,
        template_version=template_version,
        requested_by_user_id=actor_id,
    )
    db.add(job)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raced = (await db.scalars(select(ExportJob).where(ExportJob.idempotency_key == key))).one()
        _emit(db, raced, "REPORT_EXPORT_ACCESSED", actor_id)
        await db.commit()
        return raced, False
    _emit(db, job, "REPORT_EXPORT_REQUESTED", actor_id)
    await db.commit()
    await db.refresh(job)
    return job, True


def job_dict(job: ExportJob, artifact: Artifact | None = None) -> dict[str, Any]:
    return {
        "id": str(job.id),
        "report_version_id": str(job.report_version_id),
        "format": job.format,
        "status": job.status,
        "attempts": job.attempts,
        "options": job.options,
        "created_at": job.created_at.isoformat(),
        "updated_at": job.updated_at.isoformat(),
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        "error_message": job.error_message,
        "artifact": (
            {
                "filename": artifact.filename,
                "content_type": artifact.content_type,
                "size_bytes": artifact.size_bytes,
                "sha256": artifact.sha256,
                "download_url": f"/api/v1/exports/{job.id}/download",
            }
            if artifact
            else None
        ),
    }


async def run_export(db: AsyncSession, job_id: uuid.UUID, storage: ReportArtifactStorage | None = None) -> ExportJob:
    storage = storage or ReportArtifactStorage()
    token, timestamp = uuid.uuid4(), now()
    # Compare-and-swap claim, including expired leases. Duplicates do no work.
    claimed = await db.scalar(
        update(ExportJob)
        .where(
            ExportJob.id == job_id,
            or_(ExportJob.status == "QUEUED", (ExportJob.status == "RUNNING") & (ExportJob.lease_until < timestamp)),
        )
        .values(
            status="RUNNING",
            lease_token=token,
            lease_until=timestamp + timedelta(minutes=15),
            attempts=ExportJob.attempts + 1,
            started_at=timestamp,
            updated_at=timestamp,
        )
        .returning(ExportJob.id)
    )
    await db.commit()
    job = await db.get(ExportJob, job_id, populate_existing=True)
    if job is None:
        raise ReportNotFoundError("Export job not found")
    if claimed is None:
        return job
    try:
        version = await db.get(ReportVersion, job.report_version_id)
        if version is None or version.published_at is None:
            raise ReportNotFoundError("Published version not found")
        items = [
            item.frozen_values
            for item in await db.scalars(
                select(SnapshotItem).where(SnapshotItem.snapshot_id == version.snapshot_id).order_by(SnapshotItem.occurrence_id)
            )
        ]
        if len(items) > get_settings().REPORT_EXPORT_MAX_ITEMS:
            raise ReportValidationError("Export item limit exceeded")
        existing = await db.scalar(select(Artifact).where(Artifact.export_job_id == job.id))
        await db.commit()  # No database transaction during rendering or storage I/O.
        if existing:
            content = storage.read(existing.storage_key)
            if hashlib.sha256(content).hexdigest() != existing.sha256:
                raise ReportValidationError("Artifact integrity verification failed")
        else:
            content = await asyncio.to_thread(
                RENDERERS[job.format], Document(version, items, ExportOptions.model_validate(job.options))
            )
        digest = hashlib.sha256(content).hexdigest()
        extension = "md" if job.format == "MARKDOWN" else job.format.lower()
        key = f"{version.report_id}/{version.id}/{job.id}/{token}.{extension}"
        if not existing:
            storage.write_once(key, content)
        # Fence stale workers BEFORE attaching their output to the job.
        owned = await db.scalar(
            update(ExportJob)
            .where(ExportJob.id == job_id, ExportJob.lease_token == token, ExportJob.status == "RUNNING")
            .values(status="COMPLETED", finished_at=now(), updated_at=now(), lease_until=None, error_message=None)
            .returning(ExportJob.id)
        )
        if owned:
            if not existing:
                db.add(
                    Artifact(
                        export_job_id=job.id,
                        storage_key=key,
                        sha256=digest,
                        size_bytes=len(content),
                        filename=safe_filename(f"report-{version.report_id}-rev-{version.revision}.{extension}"),
                        content_type=MIME_TYPES[job.format],
                    )
                )
            _emit(db, job, "REPORT_EXPORT_COMPLETED", job.requested_by_user_id, {"sha256": digest})
        await db.commit()
    except Exception:
        await db.rollback()
        failed_job = await db.get(ExportJob, job_id, populate_existing=True)
        if failed_job is None:
            raise ReportNotFoundError("Export job not found")
        terminal = failed_job.attempts >= 3
        owned = await db.scalar(
            update(ExportJob)
            .where(ExportJob.id == job_id, ExportJob.lease_token == token)
            .values(
                status="FAILED" if terminal else "QUEUED",
                error_message="The report export could not be generated",
                finished_at=now() if terminal else None,
                updated_at=now(),
                lease_until=None,
            )
            .returning(ExportJob.id)
        )
        if owned:
            job = await db.get(ExportJob, job_id, populate_existing=True)
            if job is None:
                raise ReportNotFoundError("Export job not found")
            _emit(db, job, "REPORT_EXPORT_FAILED" if terminal else "REPORT_EXPORT_REQUESTED", job.requested_by_user_id)
            if not terminal:
                for event in db.new:
                    if isinstance(event, OutboxEvent):
                        event.available_at = now() + timedelta(seconds=30 * 2**job.attempts)
        await db.commit()
        raise
    result = await db.get(ExportJob, job_id, populate_existing=True)
    if result is None:
        raise ReportNotFoundError("Export job not found")
    return result
