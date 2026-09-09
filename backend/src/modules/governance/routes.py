import uuid
from typing import Annotated, Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...infrastructure.auth.dependencies import get_current_user
from ...infrastructure.config.settings import get_settings
from ...infrastructure.database.session import async_session
from ...infrastructure.logging.config import generate_correlation_id, get_correlation_id
from .exceptions import ReportConflictError, ReportNotFoundError, ReportValidationError
from .exports import job_dict, request_export
from .models import Artifact, ExportJob
from .schemas import ExportRequest, PublishRequest, ReportCreate, ReportUpdate, SourceMutation
from .service import (
    archive_report,
    create_report,
    get_report_detail,
    get_version,
    list_eligible_occurrences,
    list_reports,
    list_source_reports,
    list_versions,
    mutate_sources,
    preview_report,
    publish_report,
    report_dict,
    update_report,
    version_dict,
)
from .storage import ReportArtifactStorage
from .tasks import enqueue_report_export

router = APIRouter(tags=["Scrap Reports"])
exports_router = APIRouter(tags=["Scrap Report Exports"])
DbDep = Annotated[AsyncSession, Depends(async_session)]
CurrentUserDep = Annotated[dict, Depends(get_current_user)]


def _actor(user: dict) -> int:
    return int(user["id"])


def _correlation() -> str:
    return get_correlation_id() or generate_correlation_id()


def _translate(error: Exception) -> HTTPException:
    if isinstance(error, ReportNotFoundError):
        return HTTPException(status_code=404, detail=str(error))
    if isinstance(error, ReportConflictError):
        return HTTPException(status_code=409, detail=str(error))
    if isinstance(error, ReportValidationError):
        return HTTPException(status_code=422, detail=str(error))
    return HTTPException(status_code=500, detail="Unable to process report")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create(payload: ReportCreate, db: DbDep, current_user: CurrentUserDep) -> dict:
    try:
        report = await create_report(
            db,
            title=payload.title,
            description=payload.description,
            factory_id=payload.factory_id,
            actor_id=_actor(current_user),
            correlation_id=_correlation(),
        )
        return report_dict(report)
    except (ReportNotFoundError, ReportConflictError, ReportValidationError) as error:
        raise _translate(error) from error


@router.get("")
async def list_all(
    db: DbDep,
    current_user: CurrentUserDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    search: Annotated[str | None, Query(max_length=240)] = None,
    report_status: Annotated[Literal["DRAFT", "PUBLISHED", "ARCHIVED"] | None, Query(alias="status")] = None,
    author_id: Annotated[int | None, Query(ge=1)] = None,
) -> dict:
    return await list_reports(db, page=page, page_size=page_size, search=search, status=report_status, author_id=author_id)


@router.get("/eligible-occurrences")
async def eligible_occurrences(
    db: DbDep,
    current_user: CurrentUserDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    search: Annotated[str | None, Query(max_length=240)] = None,
    organization: Annotated[str | None, Query(max_length=40)] = None,
    product: Annotated[str | None, Query(max_length=40)] = None,
    division: Annotated[str | None, Query(max_length=40)] = None,
    line: Annotated[str | None, Query(max_length=120)] = None,
) -> dict:
    return await list_eligible_occurrences(
        db,
        page=page,
        page_size=page_size,
        search=search,
        organization=organization,
        product=product,
        division=division,
        line=line,
    )


@router.get("/{report_id}")
async def detail(report_id: Annotated[uuid.UUID, Path()], db: DbDep, current_user: CurrentUserDep) -> dict:
    try:
        return await get_report_detail(db, report_id)
    except ReportNotFoundError as error:
        raise _translate(error) from error


@router.patch("/{report_id}")
async def update(
    report_id: Annotated[uuid.UUID, Path()], payload: ReportUpdate, db: DbDep, current_user: CurrentUserDep
) -> dict:
    try:
        report = await update_report(
            db,
            report_id,
            expected_version=payload.expected_version,
            actor_id=_actor(current_user),
            correlation_id=_correlation(),
            title=payload.title,
            description=payload.description,
        )
        return report_dict(report)
    except (ReportNotFoundError, ReportConflictError, ReportValidationError) as error:
        raise _translate(error) from error


@router.delete("/{report_id}")
async def archive(report_id: Annotated[uuid.UUID, Path()], db: DbDep, current_user: CurrentUserDep) -> dict:
    try:
        return report_dict(await archive_report(db, report_id, actor_id=_actor(current_user), correlation_id=_correlation()))
    except (ReportNotFoundError, ReportConflictError) as error:
        raise _translate(error) from error


@router.put("/{report_id}/{kind}-sources/{operation}")
async def sources(
    report_id: Annotated[uuid.UUID, Path()],
    kind: Annotated[Literal["occurrence", "report"], Path()],
    operation: Annotated[Literal["replace", "add", "remove"], Path()],
    payload: SourceMutation,
    db: DbDep,
    current_user: CurrentUserDep,
) -> dict:
    try:
        report = await mutate_sources(
            db,
            report_id,
            kind=kind,
            operation=operation,
            ids=payload.ids,
            expected_version=payload.expected_version,
            actor_id=_actor(current_user),
            correlation_id=_correlation(),
        )
        return await get_report_detail(db, report.id)
    except (ReportNotFoundError, ReportConflictError, ReportValidationError) as error:
        raise _translate(error) from error


@router.get("/{report_id}/source-reports")
async def source_reports(
    report_id: Annotated[uuid.UUID, Path()],
    db: DbDep,
    current_user: CurrentUserDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    search: Annotated[str | None, Query(max_length=240)] = None,
) -> dict:
    try:
        return await list_source_reports(db, report_id, page=page, page_size=page_size, search=search)
    except ReportNotFoundError as error:
        raise _translate(error) from error


@router.get("/{report_id}/preview")
async def preview(report_id: Annotated[uuid.UUID, Path()], db: DbDep, current_user: CurrentUserDep) -> dict:
    try:
        return await preview_report(db, report_id)
    except (ReportNotFoundError, ReportValidationError) as error:
        raise _translate(error) from error


@router.post("/{report_id}/publish", status_code=status.HTTP_201_CREATED)
async def publish(
    report_id: Annotated[uuid.UUID, Path()], payload: PublishRequest, db: DbDep, current_user: CurrentUserDep
) -> dict:
    try:
        version = await publish_report(
            db,
            report_id,
            expected_version=payload.expected_version,
            template_version=payload.template_version,
            actor_id=_actor(current_user),
            correlation_id=_correlation(),
        )
        return version_dict(version)
    except (ReportNotFoundError, ReportConflictError, ReportValidationError) as error:
        raise _translate(error) from error


@router.get("/{report_id}/versions")
async def versions(
    report_id: Annotated[uuid.UUID, Path()],
    db: DbDep,
    current_user: CurrentUserDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
) -> dict:
    try:
        return await list_versions(db, report_id, page=page, page_size=page_size)
    except ReportNotFoundError as error:
        raise _translate(error) from error


@router.get("/{report_id}/versions/{revision}")
async def version(
    report_id: Annotated[uuid.UUID, Path()], revision: Annotated[int, Path(ge=1)], db: DbDep, current_user: CurrentUserDep
) -> dict:
    try:
        return await get_version(db, report_id, revision)
    except ReportNotFoundError as error:
        raise _translate(error) from error


@exports_router.post("/report-versions/{version_id}/exports", status_code=status.HTTP_202_ACCEPTED)
async def create_export(
    version_id: Annotated[uuid.UUID, Path()], payload: ExportRequest, db: DbDep, current_user: CurrentUserDep
) -> dict:
    if not get_settings().TASKIQ_ENABLED:
        # The Render free profile deliberately has no Redis/worker. Reject the
        # request before persisting a QUEUED job that could never be consumed.
        raise HTTPException(status_code=503, detail="Report export worker is disabled")
    try:
        job, enqueue = await request_export(
            db,
            report_version_id=version_id,
            format_=payload.format,
            options=payload.options,
            template_version=payload.template_version,
            actor_id=_actor(current_user),
            retry_failed=payload.retry_failed,
        )
        if enqueue:
            try:
                await enqueue_report_export(job.id)
            except Exception as error:
                raise HTTPException(status_code=503, detail="Unable to queue report export") from error
        artifact = (await db.scalars(select(Artifact).where(Artifact.export_job_id == job.id))).one_or_none()
        return job_dict(job, artifact)
    except (ReportNotFoundError, ReportConflictError, ReportValidationError) as error:
        raise _translate(error) from error


@exports_router.get("/exports/{job_id}")
async def export_status(job_id: Annotated[uuid.UUID, Path()], db: DbDep, current_user: CurrentUserDep) -> dict:
    job = await db.get(ExportJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Export job not found")
    if job.requested_by_user_id != _actor(current_user) and not current_user.get("is_superuser"):
        raise HTTPException(status_code=404, detail="Export job not found")
    artifact = (await db.scalars(select(Artifact).where(Artifact.export_job_id == job.id))).one_or_none()
    return job_dict(job, artifact)


@exports_router.get("/exports/{job_id}/download")
async def download(job_id: Annotated[uuid.UUID, Path()], db: DbDep, current_user: CurrentUserDep) -> Response:
    job = await db.get(ExportJob, job_id)
    if job is None or (job.requested_by_user_id != _actor(current_user) and not current_user.get("is_superuser")):
        raise HTTPException(status_code=404, detail="Export job not found")
    if job.status != "COMPLETED":
        raise HTTPException(status_code=409, detail="Export is not ready")
    artifact = (await db.scalars(select(Artifact).where(Artifact.export_job_id == job.id))).one_or_none()
    if artifact is None:
        raise HTTPException(status_code=404, detail="Export artifact not found")
    try:
        content = ReportArtifactStorage().read(artifact.storage_key)
    except (FileNotFoundError, ValueError) as error:
        raise HTTPException(status_code=404, detail="Export artifact not found") from error
    filename = quote(artifact.filename, safe=".-_")
    return Response(
        content=content,
        media_type=artifact.content_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{filename}",
            "Content-Length": str(len(content)),
            "X-Content-SHA256": artifact.sha256,
        },
    )
