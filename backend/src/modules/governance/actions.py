"""Plans reuse ImprovementAction; every command records actor and optimistic version."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..material_scrap.models import ScrapOccurrence
from ..user.models import User
from .exceptions import ReportConflictError, ReportNotFoundError, ReportValidationError
from .models import (
    ActionOccurrence,
    ActionParticipant,
    ActionPlan,
    AuditEvent,
    ImprovementAction,
    PlanReport,
    Report,
    ReportVersion,
    now,
)
from .notifications.service import emit
from .service import _factory

STATES = ("PLANNED", "IN_PROGRESS", "UNDER_VERIFICATION", "COMPLETED")


class PlanInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=240)
    description: str = Field(default="", max_length=10000)
    report_version_ids: list[uuid.UUID] = Field(default_factory=list, max_length=100)
    expected_version: int | None = Field(default=None, ge=1)
    status: Literal["OPEN", "COMPLETED"] = "OPEN"


class TaskInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=240)
    description: str = Field(default="", max_length=20000)
    priority: Literal["LOW", "MEDIUM", "HIGH", "URGENT"] = "MEDIUM"
    due_at: datetime | None = None
    participant_ids: list[int] = Field(default_factory=list, max_length=100)
    occurrence_ids: list[uuid.UUID] = Field(default_factory=list, max_length=100)
    blocked_reason: str | None = Field(default=None, max_length=2000)
    expected_version: int | None = Field(default=None, ge=1)


class TaskCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_version: int = Field(ge=1)
    command: Literal["move", "validate", "reopen", "comment"]
    status: Literal["PLANNED", "IN_PROGRESS", "UNDER_VERIFICATION"] | None = None
    position: int = Field(default=0, ge=0, le=1000000000)
    comment: str = Field(default="", max_length=10000)


def record(db, entity, actor_id, event_type, detail):
    payload = {"actor_id": actor_id, **detail}
    db.add(
        AuditEvent(
            event_type=event_type,
            entity_type="ACTION_PLAN" if isinstance(entity, ActionPlan) else "ACTION",
            entity_id=entity.id,
            actor_id=actor_id,
            correlation_id=str(uuid.uuid4()),
            payload=payload,
        )
    )


def view(entity):
    return {column.name: getattr(entity, column.name) for column in entity.__table__.columns}


def report_link_view(version: ReportVersion) -> dict:
    return {
        "id": version.id,
        "report_id": version.report_id,
        "revision": version.revision,
        "title": version.content.get("report", {}).get("title", ""),
    }


async def plan_list_items(db: AsyncSession, plans: list[ActionPlan]) -> list[dict]:
    """Serialize plan summaries with the same reports contract as plan_detail."""
    items = {plan.id: {**view(plan), "reports": []} for plan in plans}
    if not items:
        return []
    report_rows = await db.execute(
        select(PlanReport.plan_id, ReportVersion)
        .join(ReportVersion, ReportVersion.id == PlanReport.report_version_id)
        .where(PlanReport.plan_id.in_(items))
        .order_by(PlanReport.plan_id, ReportVersion.revision, ReportVersion.id)
    )
    for plan_id, version in report_rows:
        items[plan_id]["reports"].append(report_link_view(version))
    return [items[plan.id] for plan in plans]


async def get_plan(db, plan_id, lock=False):
    plan = await db.get(ActionPlan, plan_id, with_for_update=lock, populate_existing=True)
    if plan is None:
        raise ReportNotFoundError("Action plan not found")
    return plan


async def save_plan(db: AsyncSession, data: PlanInput, actor_id: int, plan_id=None):
    if plan_id:
        plan = await get_plan(db, plan_id, True)
        if data.expected_version != plan.version:
            raise ReportConflictError("Plan changed; local edits have been preserved")
        plan.version += 1
    else:
        factory = await _factory(db, None)
        plan = ActionPlan(factory_id=factory.id, title=data.title, author_id=actor_id)
        db.add(plan)
        await db.flush()
    versions = list(
        await db.scalars(
            select(ReportVersion)
            .join(Report, Report.id == ReportVersion.report_id)
            .where(
                ReportVersion.id.in_(data.report_version_ids),
                ReportVersion.published_at.is_not(None),
                Report.factory_id == plan.factory_id,
            )
        )
    )
    if {v.id for v in versions} != set(data.report_version_ids):
        raise ReportValidationError("Plan sources must be published report versions from the same factory")
    plan.title, plan.description, plan.status = data.title, data.description, data.status
    await db.execute(delete(PlanReport).where(PlanReport.plan_id == plan.id))
    db.add_all([PlanReport(plan_id=plan.id, report_version_id=v.id) for v in versions])
    record(db, plan, actor_id, "PLAN_SAVED", data.model_dump(mode="json"))
    await db.commit()
    return await plan_detail(db, plan.id)


async def plan_detail(db, plan_id):
    result = view(await get_plan(db, plan_id))
    result["reports"] = [
        report_link_view(v)
        for v in await db.scalars(
            select(ReportVersion)
            .join(PlanReport, PlanReport.report_version_id == ReportVersion.id)
            .where(PlanReport.plan_id == plan_id)
        )
    ]
    return result


async def task_detail(db, task_id):
    task = await db.get(ImprovementAction, task_id)
    if task is None:
        raise ReportNotFoundError("Task not found")
    result = view(task)
    result["participants"] = [
        dict(id=u.id, name=u.name, profile_image_url=u.profile_image_url)
        for u in await db.scalars(
            select(User)
            .join(ActionParticipant, ActionParticipant.user_id == User.id)
            .where(ActionParticipant.action_id == task.id)
            .order_by(User.id)
        )
    ]
    result["occurrence_ids"] = list(
        await db.scalars(select(ActionOccurrence.occurrence_id).where(ActionOccurrence.action_id == task.id))
    )
    return result


async def save_task(db, plan_id, data: TaskInput, actor_id, task_id=None):
    plan = await get_plan(db, plan_id, True)
    if plan.status != "OPEN":
        raise ReportConflictError("Reopen the plan before editing tasks")
    if task_id:
        task = await db.get(ImprovementAction, task_id, with_for_update=True, populate_existing=True)
        if task is None or task.plan_id != plan.id:
            raise ReportNotFoundError("Task not found")
        if task.version != data.expected_version:
            raise ReportConflictError("Task changed; local edits have been preserved")
        if task.status == "COMPLETED":
            raise ReportConflictError("Reopen the task before editing")
        task.version += 1
    else:
        task = ImprovementAction(
            factory_id=plan.factory_id,
            plan_id=plan.id,
            title=data.title,
            code=f"ACT-{uuid.uuid4().hex[:12]}",
            author_id=actor_id,
        )
        db.add(task)
        await db.flush()
    users = set(await db.scalars(select(User.id).where(User.id.in_(data.participant_ids), User.is_deleted.is_(False))))
    if users != set(data.participant_ids):
        raise ReportValidationError("Unknown or inactive participant")
    occurrences = set(await db.scalars(select(ScrapOccurrence.id).where(ScrapOccurrence.id.in_(data.occurrence_ids))))
    if occurrences != set(data.occurrence_ids):
        raise ReportValidationError("Unknown occurrence")
    old_users = set(await db.scalars(select(ActionParticipant.user_id).where(ActionParticipant.action_id == task.id)))
    for field in ("title", "description", "priority", "due_at", "blocked_reason"):
        setattr(task, field, getattr(data, field))
    task.updated_at = now()
    await db.execute(delete(ActionParticipant).where(ActionParticipant.action_id == task.id))
    await db.execute(delete(ActionOccurrence).where(ActionOccurrence.action_id == task.id))
    db.add_all([ActionParticipant(action_id=task.id, user_id=user_id) for user_id in users])
    db.add_all([ActionOccurrence(action_id=task.id, occurrence_id=oid) for oid in occurrences])
    record(db, task, actor_id, "TASK_SAVED", data.model_dump(mode="json"))
    if users - old_users:
        emit(
            db,
            "TASK_ASSIGNED",
            task.id,
            {
                "title": task.title,
                "recipient_ids": sorted(users - old_users),
                "link": f"/planos-de-acao/{plan.id}?task={task.id}",
            },
        )
    await db.commit()
    return await task_detail(db, task.id)


async def command_task(db, task_id, data: TaskCommand, actor_id):
    plan_id = await db.scalar(select(ImprovementAction.plan_id).where(ImprovementAction.id == task_id))
    if plan_id:
        plan = await get_plan(db, plan_id, True)
        if plan.status != "OPEN":
            raise ReportConflictError("Reopen the plan before changing tasks")
    task = await db.get(ImprovementAction, task_id, with_for_update=True, populate_existing=True)
    if task is None:
        raise ReportNotFoundError("Task not found")
    if task.version != data.expected_version:
        raise ReportConflictError("Task changed; refresh before moving it again")
    previous = task.status
    event_type = "TASK_CHANGED"
    if data.command == "validate":
        if task.status != "UNDER_VERIFICATION" or task.blocked_reason:
            raise ReportConflictError("Only an unblocked task awaiting verification can be validated")
        task.status, task.validated_at, task.validated_by_id = "COMPLETED", now(), actor_id
        event_type = "TASK_VALIDATED"
    elif data.command == "reopen":
        if task.status != "COMPLETED":
            raise ReportConflictError("Only completed tasks can be reopened")
        task.status, task.validated_at, task.validated_by_id = "IN_PROGRESS", None, None
    elif data.command == "move":
        if task.status == "COMPLETED" or data.status is None:
            raise ReportConflictError("Use the explicit reopen command")
        task.status, task.position = data.status, data.position
        # Serialize the complete column under the plan lock and normalize ranks.
        # Every affected row retains its optimistic version, including siblings.
        siblings = list(
            await db.scalars(
                select(ImprovementAction)
                .where(
                    ImprovementAction.plan_id == task.plan_id,
                    ImprovementAction.status == data.status,
                    ImprovementAction.id != task.id,
                )
                .order_by(ImprovementAction.position, ImprovementAction.id)
            )
        )
        siblings.insert(min(data.position // 1024, len(siblings)), task)
        for position, sibling in enumerate(siblings):
            sibling.position = position * 1024
        if task.status == "UNDER_VERIFICATION" and previous != task.status:
            event_type = "TASK_VERIFICATION"
    elif not data.comment.strip():
        raise ReportValidationError("Comment cannot be empty")
    task.version += 1
    task.updated_at = now()
    record(
        db,
        task,
        actor_id,
        event_type,
        {
            "previous": previous,
            "status": task.status,
            "comment": data.comment,
            "position": task.position,
            "version": task.version,
        },
    )
    recipients = list(await db.scalars(select(ActionParticipant.user_id).where(ActionParticipant.action_id == task.id)))
    emit(
        db,
        event_type,
        task.id,
        {"title": task.title, "recipient_ids": recipients, "link": f"/planos-de-acao/{task.plan_id}?task={task.id}"},
    )
    await db.commit()
    return await task_detail(db, task.id)


async def board(db, plan_id, status, page, page_size, search=None, priority=None):
    await get_plan(db, plan_id)
    filters = [ImprovementAction.plan_id == plan_id, ImprovementAction.status == status]
    if search:
        filters.append(ImprovementAction.title.ilike(f"%{search}%"))
    if priority:
        filters.append(ImprovementAction.priority == priority)
    total = await db.scalar(select(func.count()).select_from(ImprovementAction).where(*filters))
    tasks = list(
        await db.scalars(
            select(ImprovementAction)
            .where(*filters)
            .order_by(ImprovementAction.position, ImprovementAction.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    people = (
        await db.execute(
            select(ActionParticipant.action_id, User.id, User.name, User.profile_image_url)
            .join(User, User.id == ActionParticipant.user_id)
            .where(ActionParticipant.action_id.in_([t.id for t in tasks]))
        )
    ).all()
    grouped = {}
    for action_id, user_id, name, photo in people:
        grouped.setdefault(action_id, []).append(dict(id=user_id, name=name, profile_image_url=photo))
    return {
        "items": [{**view(t), "participants": grouped.get(t.id, [])} for t in tasks],
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": page * page_size < total,
    }
