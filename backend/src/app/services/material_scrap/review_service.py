import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.material_scrap.enums import ScrapReviewBulkStatus, ScrapReviewStatus
from src.app.models.material_scrap.models import (
    ScrapDefectType,
    ScrapOccurrence,
    ScrapReview,
    ScrapReviewAttachment,
    ScrapReviewBulkOperation,
    ScrapReviewTemplate,
)
from src.app.models.material_scrap.schemas import (
    ScrapDefectTypeCreate,
    ScrapDefectTypeRead,
    ScrapDefectTypeUpdate,
    ScrapReviewAttachmentRead,
    ScrapReviewBulkCreate,
    ScrapReviewBulkResult,
    ScrapReviewBulkSkipped,
    ScrapReviewRead,
    ScrapReviewTemplateCreate,
    ScrapReviewTemplateRead,
    ScrapReviewTemplateUpdate,
    ScrapReviewWrite,
)
from src.app.services.material_scrap.review_image import ScrapReviewImageStorage, StoredScrapReviewImage


class ScrapReviewNotFoundError(LookupError):
    pass


class ScrapReviewPermissionError(PermissionError):
    pass


class ScrapReviewConflictError(ValueError):
    pass


class ScrapReviewValidationError(ValueError):
    pass


def _now() -> datetime:
    return datetime.now(UTC)


def _attachment_read(attachment: ScrapReviewAttachment) -> ScrapReviewAttachmentRead:
    return ScrapReviewAttachmentRead(
        id=attachment.id,
        original_filename=attachment.original_filename,
        content_type=attachment.content_type,
        size_bytes=attachment.size_bytes,
        width=attachment.width,
        height=attachment.height,
        position=attachment.position,
        created_at=attachment.created_at,
        url=f"/api/v1/scrap/reviews/by-id/{attachment.review_id}/attachments/{attachment.id}",
    )


async def _read_review(db: AsyncSession, review: ScrapReview) -> ScrapReviewRead:
    defect_type = None
    if review.defect_type_id is not None:
        defect_type = await db.get(ScrapDefectType, review.defect_type_id)
    attachments = list(
        (
            await db.execute(
                select(ScrapReviewAttachment)
                .where(ScrapReviewAttachment.review_id == review.id)
                .order_by(ScrapReviewAttachment.position, ScrapReviewAttachment.id)
            )
        )
        .scalars()
        .all()
    )
    return ScrapReviewRead(
        id=review.id,
        occurrence_id=review.occurrence_id,
        status=ScrapReviewStatus(review.status),
        defect_type=ScrapDefectTypeRead.model_validate(defect_type) if defect_type is not None else None,
        responsible_user_id=review.responsible_user_id,
        responsible_name=review.responsible_name,
        title=review.title,
        description=review.description,
        version=review.version,
        source_review_id=review.source_review_id,
        bulk_operation_id=review.bulk_operation_id,
        reviewed_at=review.reviewed_at,
        created_at=review.created_at,
        updated_at=review.updated_at,
        attachments=[_attachment_read(attachment) for attachment in attachments],
    )


async def list_defect_types(db: AsyncSession, *, include_inactive: bool = False) -> list[ScrapDefectTypeRead]:
    statement = select(ScrapDefectType)
    if not include_inactive:
        statement = statement.where(ScrapDefectType.is_active.is_(True))
    statement = statement.order_by(ScrapDefectType.display_order, ScrapDefectType.name, ScrapDefectType.id)
    return [ScrapDefectTypeRead.model_validate(item) for item in (await db.execute(statement)).scalars().all()]


async def create_defect_type(
    db: AsyncSession,
    command: ScrapDefectTypeCreate,
) -> ScrapDefectTypeRead:
    now = _now()
    item = ScrapDefectType(
        code=command.code.strip().upper(),
        name=command.name.strip(),
        description=command.description.strip() if command.description else None,
        display_order=command.display_order,
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        raise ScrapReviewConflictError("A defect type with this code already exists") from error
    return ScrapDefectTypeRead.model_validate(item)


async def update_defect_type(
    db: AsyncSession,
    defect_type_id: uuid.UUID,
    command: ScrapDefectTypeUpdate,
) -> ScrapDefectTypeRead:
    item = await db.get(ScrapDefectType, defect_type_id)
    if item is None:
        raise ScrapReviewNotFoundError("Defect type not found")
    if "name" in command.model_fields_set and command.name is not None:
        item.name = command.name.strip()
    if "description" in command.model_fields_set:
        item.description = command.description.strip() if command.description else None
    if command.display_order is not None:
        item.display_order = command.display_order
    if command.is_active is not None:
        item.is_active = command.is_active
    item.updated_at = _now()
    await db.commit()
    return ScrapDefectTypeRead.model_validate(item)


async def delete_defect_type(
    db: AsyncSession,
    defect_type_id: uuid.UUID,
) -> None:
    item = await db.get(ScrapDefectType, defect_type_id)
    if item is None:
        raise ScrapReviewNotFoundError("Defect type not found")

    review_count = (
        await db.execute(select(func.count()).select_from(ScrapReview).where(ScrapReview.defect_type_id == defect_type_id))
    ).scalar() or 0

    if review_count > 0:
        raise ScrapReviewConflictError(
            "Não é possível excluir este tipo de scrap pois existem "
            f"{review_count} relatório(s) vinculados a ele. Você pode desativá-lo "
            "para que não seja mais selecionado."
        )

    templates = (
        (await db.execute(select(ScrapReviewTemplate).where(ScrapReviewTemplate.defect_type_id == defect_type_id)))
        .scalars()
        .all()
    )
    for tpl in templates:
        tpl.defect_type_id = None

    await db.delete(item)
    await db.commit()


async def get_review_for_occurrence(db: AsyncSession, occurrence_id: uuid.UUID) -> ScrapReviewRead:
    review = (await db.execute(select(ScrapReview).where(ScrapReview.occurrence_id == occurrence_id))).scalar_one_or_none()
    if review is None:
        raise ScrapReviewNotFoundError("Review not found")
    return await _read_review(db, review)


async def _active_occurrence(db: AsyncSession, occurrence_id: uuid.UUID) -> ScrapOccurrence:
    occurrence = await db.get(ScrapOccurrence, occurrence_id)
    if occurrence is None or occurrence.status != "ACTIVE":
        raise ScrapReviewNotFoundError("Active Scrap occurrence not found")
    return occurrence


async def _active_defect_type(db: AsyncSession, defect_type_id: uuid.UUID | None) -> ScrapDefectType | None:
    if defect_type_id is None:
        return None
    defect_type = await db.get(ScrapDefectType, defect_type_id)
    if defect_type is None or not defect_type.is_active:
        raise ScrapReviewValidationError("Defect type is not active")
    return defect_type


def _assert_owner(review: ScrapReview, user_id: int) -> None:
    if review.responsible_user_id != user_id:
        raise ScrapReviewPermissionError("Only the review author can edit this report")


async def save_review_draft(
    db: AsyncSession,
    occurrence_id: uuid.UUID,
    command: ScrapReviewWrite,
    current_user: dict[str, Any],
) -> ScrapReviewRead:
    await _active_occurrence(db, occurrence_id)
    await _active_defect_type(db, command.defect_type_id)
    user_id = int(current_user["id"])
    responsible_name = str(current_user.get("name") or current_user.get("username") or f"User {user_id}")[:120]
    review = (
        await db.execute(select(ScrapReview).where(ScrapReview.occurrence_id == occurrence_id).with_for_update())
    ).scalar_one_or_none()
    now = _now()
    if review is None:
        review = ScrapReview(
            occurrence_id=occurrence_id,
            responsible_user_id=user_id,
            responsible_name=responsible_name,
            status=ScrapReviewStatus.DRAFT.value,
            title=command.title.strip(),
            description=command.description.strip(),
            version=1,
            created_at=now,
            updated_at=now,
            defect_type_id=command.defect_type_id,
        )
        db.add(review)
    else:
        _assert_owner(review, user_id)
        if command.expected_version is not None and command.expected_version != review.version:
            raise ScrapReviewConflictError("The review was changed by another request")
        review.defect_type_id = command.defect_type_id
        review.title = command.title.strip()
        review.description = command.description.strip()
        review.responsible_name = responsible_name
        review.version += 1
        review.updated_at = now
    await db.commit()
    return await _read_review(db, review)


async def finalize_review(
    db: AsyncSession,
    occurrence_id: uuid.UUID,
    current_user: dict[str, Any],
    *,
    expected_version: int | None,
) -> ScrapReviewRead:
    review = (
        await db.execute(select(ScrapReview).where(ScrapReview.occurrence_id == occurrence_id).with_for_update())
    ).scalar_one_or_none()
    if review is None:
        raise ScrapReviewNotFoundError("Draft review not found")
    _assert_owner(review, int(current_user["id"]))
    if review.status == ScrapReviewStatus.REVIEWED.value:
        raise ScrapReviewConflictError("Review is already finalized")
    if expected_version is not None and expected_version != review.version:
        raise ScrapReviewConflictError("The review was changed by another request")
    if review.defect_type_id is None or not review.title.strip() or not review.description.strip():
        raise ScrapReviewValidationError("Defect type, title and description are required to finalize")
    await _active_defect_type(db, review.defect_type_id)
    now = _now()
    review.status = ScrapReviewStatus.REVIEWED.value
    review.reviewed_at = now
    review.updated_at = now
    review.version += 1
    await db.commit()
    return await _read_review(db, review)


async def assert_review_accepts_attachment(
    db: AsyncSession,
    review_id: uuid.UUID,
    current_user: dict[str, Any],
    *,
    max_attachments: int,
) -> ScrapReview:
    review = (await db.execute(select(ScrapReview).where(ScrapReview.id == review_id).with_for_update())).scalar_one_or_none()
    if review is None:
        raise ScrapReviewNotFoundError("Review not found")
    _assert_owner(review, int(current_user["id"]))
    count = int(
        (
            await db.execute(
                select(func.count()).select_from(ScrapReviewAttachment).where(ScrapReviewAttachment.review_id == review_id)
            )
        ).scalar_one()
    )
    if count >= max_attachments:
        raise ScrapReviewValidationError(f"A review can contain at most {max_attachments} attachments")
    return review


async def add_review_attachment(
    db: AsyncSession,
    review: ScrapReview,
    stored: StoredScrapReviewImage,
    original_filename: str,
    current_user: dict[str, Any],
) -> ScrapReviewAttachmentRead:
    max_position = (
        await db.execute(select(func.max(ScrapReviewAttachment.position)).where(ScrapReviewAttachment.review_id == review.id))
    ).scalar_one()
    attachment = ScrapReviewAttachment(
        review_id=review.id,
        storage_key=stored.storage_key,
        original_filename=Path(original_filename).name[:255] or "image.webp",
        content_type="image/webp",
        size_bytes=stored.size_bytes,
        width=stored.width,
        height=stored.height,
        position=int(max_position or 0) + 1,
        uploaded_by_user_id=int(current_user["id"]),
        created_at=_now(),
    )
    db.add(attachment)
    review.version += 1
    review.updated_at = _now()
    await db.commit()
    return _attachment_read(attachment)


async def get_review_attachment(
    db: AsyncSession,
    review_id: uuid.UUID,
    attachment_id: uuid.UUID,
) -> ScrapReviewAttachment:
    attachment = await db.get(ScrapReviewAttachment, attachment_id)
    if attachment is None or attachment.review_id != review_id:
        raise ScrapReviewNotFoundError("Attachment not found")
    return attachment


async def delete_review_attachment(
    db: AsyncSession,
    review_id: uuid.UUID,
    attachment_id: uuid.UUID,
    current_user: dict[str, Any],
) -> ScrapReviewAttachment:
    review = (await db.execute(select(ScrapReview).where(ScrapReview.id == review_id).with_for_update())).scalar_one_or_none()
    if review is None:
        raise ScrapReviewNotFoundError("Review not found")
    _assert_owner(review, int(current_user["id"]))
    attachment = await get_review_attachment(db, review_id, attachment_id)
    await db.delete(attachment)
    await db.flush()
    remaining = list(
        (
            await db.execute(
                select(ScrapReviewAttachment)
                .where(
                    ScrapReviewAttachment.review_id == review_id,
                    ScrapReviewAttachment.id != attachment_id,
                )
                .order_by(ScrapReviewAttachment.position, ScrapReviewAttachment.id)
            )
        )
        .scalars()
        .all()
    )
    for position, item in enumerate(remaining, start=1):
        item.position = position
    review.version += 1
    review.updated_at = _now()
    await db.commit()
    return attachment


async def create_bulk_reviews(
    db: AsyncSession,
    command: ScrapReviewBulkCreate,
    current_user: dict[str, Any],
    storage: ScrapReviewImageStorage,
) -> ScrapReviewBulkResult:
    template: ScrapReviewTemplate | None = None
    reference_id: uuid.UUID
    if command.template_id is not None:
        template = await db.get(ScrapReviewTemplate, command.template_id)
        if template is None or not template.is_active:
            raise ScrapReviewValidationError("The selected template is not available")
        if template.created_by_user_id != int(current_user["id"]):
            raise ScrapReviewPermissionError("Only the template author can apply this template")
        source_review_id = template.source_review_id
        if source_review_id is None:
            raise ScrapReviewValidationError("The selected template has no source report")
        reference_id = source_review_id
    else:
        source_reference_id = command.reference_review_id
        if source_reference_id is None:
            raise ScrapReviewValidationError("A reference review or template is required")
        reference_id = source_reference_id

    reference = await db.get(ScrapReview, reference_id)
    if reference is None or reference.status != ScrapReviewStatus.REVIEWED.value:
        raise ScrapReviewValidationError("The reference review must be finalized")
    title = template.title if template is not None else reference.title
    description = template.description if template is not None else reference.description
    defect_type_id = template.defect_type_id if template is not None else reference.defect_type_id
    if defect_type_id is None or not title.strip() or not description.strip():
        raise ScrapReviewValidationError("Defect type, title and description are required to apply a template")
    await _active_defect_type(db, defect_type_id)
    reference_attachments = list(
        (
            await db.execute(
                select(ScrapReviewAttachment)
                .where(ScrapReviewAttachment.review_id == reference.id)
                .order_by(ScrapReviewAttachment.position, ScrapReviewAttachment.id)
            )
        )
        .scalars()
        .all()
    )
    active_ids = set(
        (
            await db.execute(
                select(ScrapOccurrence.id).where(
                    ScrapOccurrence.id.in_(command.occurrence_ids),
                    ScrapOccurrence.status == "ACTIVE",
                )
            )
        ).scalars()
    )
    reviewed_ids = set(
        (
            await db.execute(select(ScrapReview.occurrence_id).where(ScrapReview.occurrence_id.in_(command.occurrence_ids)))
        ).scalars()
    )
    skipped: list[ScrapReviewBulkSkipped] = []
    eligible: list[uuid.UUID] = []
    for occurrence_id in command.occurrence_ids:
        if occurrence_id not in active_ids:
            skipped.append(ScrapReviewBulkSkipped(occurrence_id=occurrence_id, reason="NOT_ACTIVE"))
        elif occurrence_id in reviewed_ids:
            skipped.append(ScrapReviewBulkSkipped(occurrence_id=occurrence_id, reason="ALREADY_REVIEWED"))
        else:
            eligible.append(occurrence_id)
    now = _now()
    user_id = int(current_user["id"])
    responsible_name = str(current_user.get("name") or current_user.get("username") or f"User {user_id}")[:120]
    operation = ScrapReviewBulkOperation(
        reference_review_id=reference.id,
        created_by_user_id=user_id,
        status=ScrapReviewBulkStatus.COMPLETED.value,
        requested_count=len(command.occurrence_ids),
        created_count=len(eligible),
        skipped_count=len(skipped),
        copy_attachments=command.copy_attachments,
        selection_snapshot={
            "occurrence_ids": [str(item) for item in command.occurrence_ids],
            "template_id": str(template.id) if template is not None else None,
        },
        created_at=now,
    )
    db.add(operation)
    await db.flush()
    copied_files: list[tuple[uuid.UUID, str]] = []
    try:
        for occurrence_id in eligible:
            review = ScrapReview(
                occurrence_id=occurrence_id,
                responsible_user_id=user_id,
                responsible_name=responsible_name,
                status=ScrapReviewStatus.REVIEWED.value,
                title=title,
                description=description,
                version=1,
                created_at=now,
                updated_at=now,
                defect_type_id=defect_type_id,
                source_review_id=reference.id,
                bulk_operation_id=operation.id,
                reviewed_at=now,
            )
            db.add(review)
            await db.flush()
            if command.copy_attachments:
                for source in reference_attachments:
                    stored = storage.copy(reference.id, review.id, source.storage_key)
                    copied_files.append((review.id, stored.storage_key))
                    db.add(
                        ScrapReviewAttachment(
                            review_id=review.id,
                            storage_key=stored.storage_key,
                            original_filename=source.original_filename,
                            content_type="image/webp",
                            size_bytes=stored.size_bytes,
                            width=stored.width,
                            height=stored.height,
                            position=source.position,
                            uploaded_by_user_id=user_id,
                            created_at=now,
                        )
                    )
        await db.commit()
    except Exception:
        await db.rollback()
        for review_id, storage_key in copied_files:
            storage.delete(review_id, storage_key)
        raise
    return ScrapReviewBulkResult(
        operation_id=operation.id,
        status=ScrapReviewBulkStatus.COMPLETED,
        requested_count=len(command.occurrence_ids),
        created_count=len(eligible),
        skipped_count=len(skipped),
        created_occurrence_ids=eligible,
        skipped=skipped,
    )


async def list_review_templates(
    db: AsyncSession,
    user_id: int | None = None,
) -> list[ScrapReviewTemplateRead]:
    statement = (
        select(ScrapReviewTemplate)
        .where(ScrapReviewTemplate.is_active.is_(True))
        .order_by(ScrapReviewTemplate.name, ScrapReviewTemplate.created_at.desc())
    )
    if user_id is not None:
        statement = statement.where(ScrapReviewTemplate.created_by_user_id == user_id)
    templates = list((await db.execute(statement)).scalars().all())
    result: list[ScrapReviewTemplateRead] = []
    for t in templates:
        defect_type = None
        if t.defect_type_id:
            defect_type = await db.get(ScrapDefectType, t.defect_type_id)
        result.append(
            ScrapReviewTemplateRead(
                id=t.id,
                name=t.name,
                title=t.title,
                description=t.description,
                defect_type_id=t.defect_type_id,
                defect_type=ScrapDefectTypeRead.model_validate(defect_type) if defect_type else None,
                created_by_user_id=t.created_by_user_id,
                source_review_id=t.source_review_id,
                is_active=t.is_active,
                created_at=t.created_at,
                updated_at=t.updated_at,
            )
        )
    return result


async def create_review_template(
    db: AsyncSession,
    command: ScrapReviewTemplateCreate,
    current_user: dict[str, Any],
) -> ScrapReviewTemplateRead:
    now = _now()
    user_id = int(current_user["id"])

    title = command.title
    description = command.description
    defect_type_id = command.defect_type_id
    if command.source_review_id:
        review = await db.get(ScrapReview, command.source_review_id)
        if review:
            if not title:
                title = review.title
            if not description:
                description = review.description
            if defect_type_id is None:
                defect_type_id = review.defect_type_id

    template = ScrapReviewTemplate(
        name=command.name.strip(),
        title=title.strip(),
        description=description.strip(),
        created_by_user_id=user_id,
        created_at=now,
        updated_at=now,
        defect_type_id=defect_type_id,
        source_review_id=command.source_review_id,
        is_active=True,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)

    defect_type = None
    if template.defect_type_id:
        defect_type = await db.get(ScrapDefectType, template.defect_type_id)

    return ScrapReviewTemplateRead(
        id=template.id,
        name=template.name,
        title=template.title,
        description=template.description,
        defect_type_id=template.defect_type_id,
        defect_type=ScrapDefectTypeRead.model_validate(defect_type) if defect_type else None,
        created_by_user_id=template.created_by_user_id,
        source_review_id=template.source_review_id,
        is_active=template.is_active,
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


async def update_review_template(
    db: AsyncSession,
    template_id: uuid.UUID,
    command: ScrapReviewTemplateUpdate,
    current_user: dict[str, Any],
) -> ScrapReviewTemplateRead:
    template = await db.get(ScrapReviewTemplate, template_id)
    if template is None or not template.is_active:
        raise ScrapReviewNotFoundError(f"Template {template_id} not found")

    user_id = int(current_user["id"])
    if template.created_by_user_id != user_id:
        raise ScrapReviewPermissionError("Only the template author can edit this template")

    if "name" in command.model_fields_set and command.name is not None:
        template.name = command.name.strip()
    if "title" in command.model_fields_set and command.title is not None:
        template.title = command.title.strip()
    if "description" in command.model_fields_set and command.description is not None:
        template.description = command.description.strip()
    if "defect_type_id" in command.model_fields_set:
        await _active_defect_type(db, command.defect_type_id)
        template.defect_type_id = command.defect_type_id

    template.updated_at = _now()
    await db.commit()
    await db.refresh(template)

    defect_type = None
    if template.defect_type_id:
        defect_type = await db.get(ScrapDefectType, template.defect_type_id)
    return ScrapReviewTemplateRead(
        id=template.id,
        name=template.name,
        title=template.title,
        description=template.description,
        defect_type_id=template.defect_type_id,
        defect_type=ScrapDefectTypeRead.model_validate(defect_type) if defect_type else None,
        created_by_user_id=template.created_by_user_id,
        source_review_id=template.source_review_id,
        is_active=template.is_active,
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


async def delete_review_template(
    db: AsyncSession,
    template_id: uuid.UUID,
    current_user: dict[str, Any],
) -> None:
    template = await db.get(ScrapReviewTemplate, template_id)
    if template is None or not template.is_active:
        raise ScrapReviewNotFoundError(f"Template {template_id} not found")

    user_id = int(current_user["id"])
    is_admin = bool(current_user.get("is_superuser"))
    if template.created_by_user_id != user_id and not is_admin:
        raise ScrapReviewPermissionError("Only the template author or an admin can remove this template")

    template.is_active = False
    template.updated_at = _now()
    await db.commit()
