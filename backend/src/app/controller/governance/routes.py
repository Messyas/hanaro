import hashlib
import uuid
from typing import Annotated, Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.governance.models import Artifact, ExportJob, PublishedEvidence, Report, ReportVersion
from src.app.models.governance.schemas import (
    ExportRequest,
    PublishRequest,
    ReportActionSourcesUpdate,
    ReportCreate,
    ReportEvidenceSourcesUpdate,
    ReportScopeUpdate,
    ReportSectionsUpdate,
    ReportUpdate,
    SourceMutation,
)
from src.app.services.governance.notifications.service import emit
from src.app.services.governance.service import (
    archive_report,
    create_report,
    get_report_detail,
    get_report_scope,
    get_report_sections,
    get_version,
    list_eligible_actions,
    list_eligible_occurrences,
    list_report_evidence_candidates,
    list_reports,
    list_source_reports,
    list_versions,
    mutate_sources,
    preview_report,
    publish_report,
    replace_report_action_sources,
    replace_report_evidence_sources,
    replace_report_sections,
    report_dict,
    report_scope_dict,
    report_section_dict,
    update_report,
    update_report_scope,
    version_dict,
)
from src.app.services.governance.storage import ReportArtifactStorage
from src.app.support.governance.exceptions import ReportConflictError, ReportNotFoundError, ReportValidationError
from src.app.support.governance.exports import job_dict, request_export
from src.app.support.governance.reporting.analytics import ReportAnalyticsService
from src.infrastructure.auth.dependencies import get_current_user
from src.infrastructure.config.settings import get_settings
from src.infrastructure.database.session import async_session
from src.infrastructure.logging.config import generate_correlation_id, get_correlation_id

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
            report_kind=payload.report_kind,
            content_schema_version=payload.content_schema_version,
            scope=payload.scope.model_dump() if payload.scope else None,
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


@router.get("/eligible-actions")
async def eligible_actions(
    db: DbDep,
    current_user: CurrentUserDep,
    factory_id: Annotated[uuid.UUID, Query()],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    search: Annotated[str | None, Query(max_length=240)] = None,
) -> dict:
    return await list_eligible_actions(
        db,
        factory_id=factory_id,
        page=page,
        page_size=page_size,
        search=search,
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


@router.get("/{report_id}/scope")
async def scope(report_id: Annotated[uuid.UUID, Path()], db: DbDep, current_user: CurrentUserDep) -> dict | None:
    try:
        return report_scope_dict(await get_report_scope(db, report_id))
    except ReportNotFoundError as error:
        raise _translate(error) from error


@router.put("/{report_id}/scope")
async def update_scope(
    report_id: Annotated[uuid.UUID, Path()], payload: ReportScopeUpdate, db: DbDep, current_user: CurrentUserDep
) -> dict:
    try:
        report = await update_report_scope(
            db,
            report_id,
            expected_version=payload.expected_version,
            scope=payload.scope.model_dump(),
            actor_id=_actor(current_user),
            correlation_id=_correlation(),
        )
        return await get_report_detail(db, report.id)
    except (ReportNotFoundError, ReportConflictError, ReportValidationError) as error:
        raise _translate(error) from error


@router.get("/{report_id}/sections")
async def sections(report_id: Annotated[uuid.UUID, Path()], db: DbDep, current_user: CurrentUserDep) -> list[dict]:
    try:
        return [report_section_dict(section) for section in await get_report_sections(db, report_id)]
    except ReportNotFoundError as error:
        raise _translate(error) from error


@router.get("/{report_id}/analytics")
async def analytics(report_id: Annotated[uuid.UUID, Path()], db: DbDep, current_user: CurrentUserDep) -> dict:
    try:
        report = await db.get(Report, report_id)
        if report is None:
            raise ReportNotFoundError("Report not found")
        scope = await get_report_scope(db, report_id)
        if report.report_kind != "PERIOD_CLOSE" or scope is None:
            raise ReportValidationError("Analytics is available only for PERIOD_CLOSE reports with a scope")
        dataset = await ReportAnalyticsService().build_dataset(db, report, scope)
        dataset.pop("financial_rows", None)
        if dataset.get("comparison"):
            dataset["comparison"].pop("financial_rows", None)
        return dataset
    except (ReportNotFoundError, ReportValidationError) as error:
        raise _translate(error) from error


@router.get("/{report_id}/eligible-evidence")
async def eligible_evidence(
    report_id: Annotated[uuid.UUID, Path()],
    db: DbDep,
    current_user: CurrentUserDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    search: Annotated[str | None, Query(max_length=240)] = None,
) -> dict:
    try:
        return await list_report_evidence_candidates(
            db,
            report_id,
            page=page,
            page_size=page_size,
            search=search,
        )
    except (ReportNotFoundError, ReportValidationError) as error:
        raise _translate(error) from error


@router.put("/{report_id}/action-sources")
async def replace_action_sources(
    report_id: Annotated[uuid.UUID, Path()],
    payload: ReportActionSourcesUpdate,
    db: DbDep,
    current_user: CurrentUserDep,
) -> dict:
    try:
        report = await replace_report_action_sources(
            db,
            report_id,
            expected_version=payload.expected_version,
            action_ids=payload.action_ids,
            actor_id=_actor(current_user),
            correlation_id=_correlation(),
        )
        return await get_report_detail(db, report.id)
    except (ReportNotFoundError, ReportConflictError, ReportValidationError) as error:
        raise _translate(error) from error


@router.put("/{report_id}/evidence-sources")
async def replace_evidence_sources(
    report_id: Annotated[uuid.UUID, Path()],
    payload: ReportEvidenceSourcesUpdate,
    db: DbDep,
    current_user: CurrentUserDep,
) -> dict:
    try:
        report = await replace_report_evidence_sources(
            db,
            report_id,
            expected_version=payload.expected_version,
            evidence=[item.model_dump() for item in payload.evidence],
            actor_id=_actor(current_user),
            correlation_id=_correlation(),
        )
        return await get_report_detail(db, report.id)
    except (ReportNotFoundError, ReportConflictError, ReportValidationError) as error:
        raise _translate(error) from error


@router.put("/{report_id}/sections")
async def replace_sections(
    report_id: Annotated[uuid.UUID, Path()], payload: ReportSectionsUpdate, db: DbDep, current_user: CurrentUserDep
) -> dict:
    try:
        report = await replace_report_sections(
            db,
            report_id,
            expected_version=payload.expected_version,
            sections=[section.model_dump() for section in payload.sections],
            actor_id=_actor(current_user),
            correlation_id=_correlation(),
        )
        return await get_report_detail(db, report.id)
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
            content_schema_version=payload.content_schema_version,
            preview_fingerprint=payload.preview_fingerprint,
            acknowledged_warning_codes=payload.acknowledged_warning_codes,
            idempotency_key=payload.idempotency_key,
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
        job, _ = await request_export(
            db,
            report_version_id=version_id,
            format_=payload.format,
            options=payload.options.model_dump(),
            template_version=payload.template_version,
            actor_id=_actor(current_user),
            retry_failed=payload.retry_failed,
        )
        # The committed outbox is the dispatch authority, including broker outages.
        artifact = (await db.scalars(select(Artifact).where(Artifact.export_job_id == job.id))).one_or_none()
        return job_dict(job, artifact)
    except (ReportNotFoundError, ReportConflictError, ReportValidationError) as error:
        raise _translate(error) from error


@exports_router.get("/exports/{job_id}")
async def export_status(job_id: Annotated[uuid.UUID, Path()], db: DbDep, current_user: CurrentUserDep) -> dict:
    job = await db.get(ExportJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Export job not found")
    await _authorize_export(db, job)
    artifact = (await db.scalars(select(Artifact).where(Artifact.export_job_id == job.id))).one_or_none()
    return job_dict(job, artifact)


@exports_router.get("/exports/{job_id}/download")
async def download(job_id: Annotated[uuid.UUID, Path()], db: DbDep, current_user: CurrentUserDep) -> Response:
    job = await db.get(ExportJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Export job not found")
    await _authorize_export(db, job)
    if job.status != "COMPLETED":
        raise HTTPException(status_code=409, detail="Export is not ready")
    artifact = (await db.scalars(select(Artifact).where(Artifact.export_job_id == job.id))).one_or_none()
    if artifact is None:
        raise HTTPException(status_code=404, detail="Export artifact not found")
    try:
        content = ReportArtifactStorage().read(artifact.storage_key)
    except (FileNotFoundError, ValueError) as error:
        job.status = "FAILED"
        job.error_message = "Export artifact is missing"
        emit(
            db,
            "REPORT_EXPORT_FAILED",
            job.id,
            {"title": "Export artifact is missing", "recipient_ids": [job.requested_by_user_id]},
        )
        await db.commit()
        raise HTTPException(status_code=409, detail="Export artifact is missing; request a retry") from error
    filename = quote(artifact.filename, safe=".-_")
    if len(content) != artifact.size_bytes or hashlib.sha256(content).hexdigest() != artifact.sha256:
        job.status = "FAILED"
        job.error_message = "Export artifact failed integrity verification"
        emit(
            db,
            "REPORT_EXPORT_FAILED",
            job.id,
            {"title": "Export artifact is corrupted", "recipient_ids": [job.requested_by_user_id]},
        )
        await db.commit()
        raise HTTPException(status_code=409, detail="Export artifact failed integrity verification; request a retry")
    return Response(
        content=content,
        media_type=artifact.content_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{filename}",
            "Content-Length": str(len(content)),
            "X-Content-SHA256": artifact.sha256,
        },
    )


async def _authorize_export(db, job):
    # MVP report policy: all authenticated users can access existing reports,
    # including archived historical versions. Never authorize by job ownership.
    resource = await db.scalar(
        select(Report.id)
        .join(ReportVersion, ReportVersion.report_id == Report.id)
        .where(ReportVersion.id == job.report_version_id)
    )
    if resource is None:
        raise HTTPException(404, "Report not found")


@exports_router.get("/governance/capabilities")
async def capabilities(current_user: CurrentUserDep):
    return {
        "exports_available": get_settings().TASKIQ_ENABLED,
        "notifications_available": get_settings().TASKIQ_ENABLED,
        "email_provider": "simulation",
        "formats": ["CSV", "PDF", "PPTX", "MARKDOWN"],
        "template_versions": ["1", "2"],
        "csv": {"encoding": "UTF-8 BOM", "separator": ",", "summary": "not applicable"},
    }


@exports_router.get("/report-versions/{version_id}/exports")
async def version_exports(
    version_id: uuid.UUID,
    db: DbDep,
    current_user: CurrentUserDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
):
    resource = await db.scalar(
        select(Report.id).join(ReportVersion, ReportVersion.report_id == Report.id).where(ReportVersion.id == version_id)
    )
    if resource is None:
        raise HTTPException(404, "Report version not found")
    query = (
        select(ExportJob, Artifact)
        .outerjoin(Artifact, Artifact.export_job_id == ExportJob.id)
        .where(ExportJob.report_version_id == version_id)
    )
    total = await db.scalar(select(func.count()).select_from(ExportJob).where(ExportJob.report_version_id == version_id))
    rows = (
        await db.execute(
            query.order_by(ExportJob.created_at.desc(), ExportJob.id).offset((page - 1) * page_size).limit(page_size)
        )
    ).all()
    total = int(total or 0)
    return {"items": [job_dict(job, artifact) for job, artifact in rows], "total": total, "has_next": page * page_size < total}


@exports_router.get("/report-evidence/{evidence_id}")
async def evidence_download(evidence_id: uuid.UUID, db: DbDep, current_user: CurrentUserDep):
    evidence = await db.get(PublishedEvidence, evidence_id)
    if evidence is None:
        raise HTTPException(404, "Published evidence not found")
    # A row only becomes visible after its publication transaction commits.
    try:
        content = ReportArtifactStorage().read(evidence.storage_key)
    except (ValueError, FileNotFoundError) as error:
        raise HTTPException(404, "Published evidence file unavailable") from error
    if hashlib.sha256(content).hexdigest() != evidence.sha256:
        raise HTTPException(409, "Evidence integrity verification failed")
    return Response(
        content,
        media_type=evidence.content_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(evidence.filename)}"},
    )
