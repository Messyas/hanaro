import uuid
from datetime import datetime
from typing import Annotated, Literal
from urllib.parse import quote

from fastapi import APIRouter, File, Form, HTTPException, Query, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.sql import ColumnElement

from ..user.models import User
from .action_evidence import MAX_EVIDENCE_BYTES, add_evidence, read_evidence, remove_evidence
from .actions import (
    PlanInput,
    TaskCommand,
    TaskInput,
    board,
    command_task,
    plan_detail,
    plan_list_items,
    save_plan,
    save_task,
    task_detail,
    view,
)
from .models import ActionPlan, Alert, AlertRecipient, AuditEvent, EmailDelivery, NotificationRule, now
from .notifications.rules import RuleInput, save_rule
from .routes import CurrentUserDep, DbDep

router = APIRouter(tags=["Governance workflows"])
Page = Annotated[int, Query(ge=1)]
Size = Annotated[int, Query(ge=1, le=100)]


@router.get("/action-plans")
async def plans(
    db: DbDep,
    user: CurrentUserDep,
    page: Page = 1,
    page_size: Size = 25,
    search: Annotated[str, Query(max_length=240)] = "",
    status: Literal["OPEN", "COMPLETED"] | None = None,
    sort: Literal["newest", "oldest", "title"] = "newest",
):
    filters: list[ColumnElement[bool]] = []
    if search.strip():
        filters.append(ActionPlan.title.ilike(f"%{search.strip()}%"))
    if status:
        filters.append(ActionPlan.status == status)
    order = {
        "newest": (ActionPlan.created_at.desc(), ActionPlan.id),
        "oldest": (ActionPlan.created_at, ActionPlan.id),
        "title": (ActionPlan.title, ActionPlan.id),
    }[sort]
    total = await db.scalar(select(func.count()).select_from(ActionPlan).where(*filters))
    total = int(total or 0)
    rows = list(
        await db.scalars(select(ActionPlan).where(*filters).order_by(*order).offset((page - 1) * page_size).limit(page_size))
    )
    return {"items": await plan_list_items(db, rows), "total": total, "page": page, "has_next": page * page_size < total}


@router.post("/action-plans", status_code=201)
async def create_plan(data: PlanInput, db: DbDep, user: CurrentUserDep):
    return await save_plan(db, data, int(user["id"]))


@router.get("/action-plans/{plan_id}")
async def read_plan(plan_id: uuid.UUID, db: DbDep, user: CurrentUserDep):
    return await plan_detail(db, plan_id)


@router.put("/action-plans/{plan_id}")
async def update_plan(plan_id: uuid.UUID, data: PlanInput, db: DbDep, user: CurrentUserDep):
    return await save_plan(db, data, int(user["id"]), plan_id)


@router.get("/action-plans/{plan_id}/tasks")
async def tasks(
    plan_id: uuid.UUID,
    db: DbDep,
    user: CurrentUserDep,
    status: Literal["PLANNED", "IN_PROGRESS", "UNDER_VERIFICATION", "COMPLETED"] = "PLANNED",
    page: Page = 1,
    page_size: Size = 25,
    search: Annotated[str | None, Query(max_length=240)] = None,
    priority: Literal["LOW", "MEDIUM", "HIGH", "URGENT"] | None = None,
):
    return await board(db, plan_id, status, page, page_size, search, priority)


@router.post("/action-plans/{plan_id}/tasks", status_code=201)
async def create_task(plan_id: uuid.UUID, data: TaskInput, db: DbDep, user: CurrentUserDep):
    return await save_task(db, plan_id, data, int(user["id"]))


@router.put("/action-plans/{plan_id}/tasks/{task_id}")
async def update_task(plan_id: uuid.UUID, task_id: uuid.UUID, data: TaskInput, db: DbDep, user: CurrentUserDep):
    return await save_task(db, plan_id, data, int(user["id"]), task_id)


@router.get("/actions/{task_id}")
async def read_task(task_id: uuid.UUID, db: DbDep, user: CurrentUserDep):
    return await task_detail(db, task_id)


@router.post("/actions/{task_id}/evidence", status_code=201)
async def upload_task_evidence(
    task_id: uuid.UUID,
    file: Annotated[UploadFile, File(description="PDF, JPEG, PNG or WebP evidence")],
    expected_version: Annotated[int, Form(ge=1)],
    db: DbDep,
    user: CurrentUserDep,
):
    content = await file.read(MAX_EVIDENCE_BYTES + 1)
    return await add_evidence(
        db,
        task_id,
        content=content,
        filename=file.filename or "evidence",
        content_type=file.content_type or "",
        expected_version=expected_version,
        actor_id=int(user["id"]),
    )


@router.get("/actions/{task_id}/evidence/{evidence_id}/download")
async def download_task_evidence(task_id: uuid.UUID, evidence_id: uuid.UUID, db: DbDep, user: CurrentUserDep):
    evidence, content = await read_evidence(db, task_id, evidence_id)
    return Response(
        content,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(evidence.filename)}",
            "X-Content-Type-Options": "nosniff",
            "X-Content-SHA256": evidence.sha256,
        },
    )


@router.delete("/actions/{task_id}/evidence/{evidence_id}")
async def delete_task_evidence(
    task_id: uuid.UUID,
    evidence_id: uuid.UUID,
    db: DbDep,
    user: CurrentUserDep,
    expected_version: Annotated[int, Query(ge=1)],
):
    return await remove_evidence(db, task_id, evidence_id, expected_version, int(user["id"]))


@router.post("/actions/{task_id}/commands")
async def task_command(task_id: uuid.UUID, data: TaskCommand, db: DbDep, user: CurrentUserDep):
    return await command_task(db, task_id, data, int(user["id"]))


@router.get("/actions/{task_id}/history")
async def history(task_id: uuid.UUID, db: DbDep, user: CurrentUserDep, page: Page = 1, page_size: Size = 25):
    await task_detail(db, task_id)
    condition = [AuditEvent.entity_id == task_id, AuditEvent.entity_type == "ACTION"]
    total = await db.scalar(select(func.count()).select_from(AuditEvent).where(*condition))
    total = int(total or 0)
    rows = await db.execute(
        select(AuditEvent, User.name)
        .outerjoin(User, User.id == AuditEvent.actor_id)
        .where(*condition)
        .order_by(AuditEvent.created_at.desc(), AuditEvent.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return {
        "items": [{**view(event), "actor_name": actor_name} for event, actor_name in rows],
        "total": total,
        "has_next": page * page_size < total,
    }


@router.get("/governance/participants")
async def participants(
    db: DbDep, user: CurrentUserDep, search: Annotated[str, Query(max_length=100)] = "", page: Page = 1, page_size: Size = 25
):
    users = await db.scalars(
        select(User)
        .where(User.is_deleted.is_(False), User.name.ilike(f"%{search}%"))
        .order_by(User.name, User.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return [{"id": u.id, "name": u.name, "profile_image_url": u.profile_image_url} for u in users]


@router.get("/alerts")
async def alerts(
    db: DbDep,
    user: CurrentUserDep,
    page: Page = 1,
    page_size: Size = 25,
    severity: Literal["INFO", "WARNING", "CRITICAL", "POSITIVE"] | None = None,
    event_type: Annotated[str | None, Query(max_length=80)] = None,
    unread: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
):
    filters = [AlertRecipient.user_id == int(user["id"])]
    if severity:
        filters.append(Alert.severity == severity)
    if event_type:
        filters.append(Alert.event_type == event_type)
    if unread is not None:
        filters.append(AlertRecipient.read_at.is_(None) if unread else AlertRecipient.read_at.is_not(None))
    if date_from:
        filters.append(Alert.created_at >= date_from)
    if date_to:
        filters.append(Alert.created_at <= date_to)
    query = select(Alert, AlertRecipient.read_at).join(AlertRecipient, AlertRecipient.alert_id == Alert.id).where(*filters)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    total = int(total or 0)
    rows = (
        await db.execute(query.order_by(Alert.created_at.desc(), Alert.id).offset((page - 1) * page_size).limit(page_size))
    ).all()
    return {
        "items": [{**view(a), "read_at": read_at} for a, read_at in rows],
        "total": total,
        "has_next": page * page_size < total,
    }


@router.post("/alerts/{alert_id}/read")
async def read_alert(alert_id: uuid.UUID, db: DbDep, user: CurrentUserDep):
    recipient = await db.scalar(
        select(AlertRecipient).where(AlertRecipient.alert_id == alert_id, AlertRecipient.user_id == int(user["id"]))
    )
    if recipient is None:
        raise HTTPException(404, "Alert not found")
    recipient.read_at = now()
    await db.commit()
    return {"read_at": recipient.read_at}


@router.get("/notification-rules")
async def rules(db: DbDep, user: CurrentUserDep, page: Page = 1, page_size: Size = 25):
    total = await db.scalar(select(func.count()).select_from(NotificationRule))
    total = int(total or 0)
    rows = await db.scalars(
        select(NotificationRule)
        .order_by(NotificationRule.name, NotificationRule.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return {
        "items": [{"id": r.id, "version": r.version, **r.config} for r in rows],
        "total": total,
        "has_next": page * page_size < total,
    }


@router.post("/notification-rules", status_code=201)
async def create_rule(data: RuleInput, db: DbDep, user: CurrentUserDep):
    return await save_rule(db, data)


@router.put("/notification-rules/{rule_id}")
async def update_rule(rule_id: uuid.UUID, data: RuleInput, db: DbDep, user: CurrentUserDep):
    return await save_rule(db, data, rule_id)


@router.get("/notification-emails")
async def emails(db: DbDep, user: CurrentUserDep, page: Page = 1, page_size: Size = 25):
    filters = [] if user.get("is_superuser") else [EmailDelivery.user_id == int(user["id"])]
    rows = await db.scalars(
        select(EmailDelivery)
        .where(*filters)
        .order_by(EmailDelivery.created_at.desc(), EmailDelivery.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return [view(row) for row in rows]
