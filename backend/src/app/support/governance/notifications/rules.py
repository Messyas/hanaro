import uuid
from datetime import UTC, date, timedelta
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import func, select

from src.app.models.governance.models import NotificationRule, RuleEvaluation, now
from src.app.models.material_scrap.models import ScrapOccurrence, ScrapTransaction
from src.app.models.tier.models import Tier
from src.app.models.user.models import User
from src.app.services.governance.notifications.service import CHANNELS, emit
from src.app.support.governance.exceptions import ReportConflictError, ReportValidationError


class RuleInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=160)
    event_type: str
    enabled: bool = True
    dimension: Literal["occurrence", "item", "line", "product", "organization"] = "occurrence"
    filters: dict[Literal["organization", "item", "line", "product"], str] = Field(default_factory=dict, max_length=4)
    window_days: int = Field(default=30, ge=1, le=366)
    threshold: Decimal = Field(default=Decimal("1000"), ge=0, max_digits=24, decimal_places=6)
    currency: Literal["BRL", "USD"] = "USD"
    severity: Literal["INFO", "WARNING", "CRITICAL", "POSITIVE"] = "WARNING"
    user_ids: list[int] = Field(default_factory=list, max_length=100)
    tier_ids: list[int] = Field(default_factory=list, max_length=100)
    channels: list[Literal["FRONT", "EMAIL"]] | None = None
    cooldown_minutes: int = Field(default=1440, ge=1, le=525600)
    date_from: date | None = None
    date_to: date | None = None
    expected_version: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_combination(self):
        if self.event_type not in CHANNELS:
            raise ValueError("Unknown notification type")
        if self.channels is None:
            self.channels = CHANNELS[self.event_type].copy()
        self.channels = sorted(set(self.channels))
        self.user_ids, self.tier_ids = sorted(set(self.user_ids)), sorted(set(self.tier_ids))
        if any(len(value) > 120 for value in self.filters.values()):
            raise ValueError("Filter too long")
        if self.event_type in {"COST_EXCEEDED", "GOAL_ACHIEVED"}:
            if not self.date_from or not self.date_to or self.date_to < self.date_from:
                raise ValueError("Cost goals require an explicit valid evaluation period")
            if self.dimension == "occurrence":
                raise ValueError("Cost goals require an aggregate dimension")
        if self.event_type != "GOAL_ACHIEVED" and self.severity == "POSITIVE":
            raise ValueError("Only a closed-period achieved goal may be positive")
        return self


async def save_rule(db, data: RuleInput, rule_id=None):
    if data.user_ids:
        found = set(await db.scalars(select(User.id).where(User.id.in_(data.user_ids), User.is_deleted.is_(False))))
        if found != set(data.user_ids):
            raise ReportValidationError("Unknown notification recipient")
    if data.tier_ids:
        tiers = set(await db.scalars(select(Tier.id).where(Tier.id.in_(data.tier_ids), Tier.is_deleted.is_(False))))
        if tiers != set(data.tier_ids):
            raise ReportValidationError("Unknown notification recipient profile")
    if rule_id:
        rule = await db.get(NotificationRule, rule_id, with_for_update=True)
        if rule is None:
            raise ReportValidationError("Unknown notification rule")
        if data.expected_version != rule.version:
            raise ReportConflictError("Notification rule changed")
        rule.version += 1
        rule.name, rule.event_type, rule.enabled = data.name, data.event_type, data.enabled
        rule.config = data.model_dump(mode="json", exclude={"expected_version"})
    else:
        rule = NotificationRule(
            name=data.name,
            event_type=data.event_type,
            enabled=data.enabled,
            config=data.model_dump(mode="json", exclude={"expected_version"}),
        )
        db.add(rule)
    await db.commit()
    return {"id": rule.id, "version": rule.version, **rule.config}


def _get_amount_column(config):
    return ScrapTransaction.amount_usd if config.currency == "USD" else ScrapTransaction.issue_amount_brl


def _get_dimension_column(config):
    columns = {
        "item": ScrapTransaction.item_code,
        "line": ScrapTransaction.receipt_department,
        "product": ScrapTransaction.product,
        "organization": ScrapTransaction.organization_code,
    }
    return ScrapOccurrence.id if config.dimension == "occurrence" else columns[config.dimension]


def _build_query(amount, dimension, config, start, end):
    columns = {
        "item": ScrapTransaction.item_code,
        "line": ScrapTransaction.receipt_department,
        "product": ScrapTransaction.product,
        "organization": ScrapTransaction.organization_code,
    }
    query = (
        select(dimension, func.sum(amount))
        .select_from(ScrapOccurrence)
        .join(ScrapTransaction, ScrapOccurrence.current_transaction_id == ScrapTransaction.id)
        .where(
            ScrapOccurrence.status == "ACTIVE",
            ScrapTransaction.transaction_date >= start,
            ScrapTransaction.transaction_date <= end,
        )
    )
    for key, value in config.filters.items():
        query = query.where(columns[key] == value)
    return query.group_by(dimension)


def _compute_window_key(config, start, end):
    if config.dimension == "occurrence":
        return "occurrence"
    return f"{start}:{end}" if config.date_from else f"rolling:{config.window_days}"


def _is_breached(rule, observed, threshold):
    return observed <= threshold if rule.event_type == "GOAL_ACHIEVED" else observed > threshold


def _is_cooled(evaluation, cooldown_minutes):
    last = evaluation.last_fired_at
    if last and last.tzinfo is None:
        last = last.replace(tzinfo=UTC)
    return last is None or now() - last >= timedelta(minutes=cooldown_minutes)


def _is_worsened(rule, evaluation, observed):
    return evaluation.sequence == 0 or (observed > evaluation.observed and rule.event_type != "GOAL_ACHIEVED")


def _get_entity_id(config, subject, rule):
    return uuid.UUID(str(subject)) if config.dimension == "occurrence" else rule.id


def _get_severity(rule, config):
    return "POSITIVE" if rule.event_type == "GOAL_ACHIEVED" else config.severity


def _get_link(config, subject):
    return f"/base-de-scrap/revisao/{subject}" if config.dimension == "occurrence" else "/alertas"


def _get_rule_window(config, today):
    start = config.date_from or today - timedelta(days=config.window_days - 1)
    end = config.date_to or today
    return start, end, end < today


def _should_process_rule(rule, closed):
    return not (rule.event_type == "GOAL_ACHIEVED" and not closed)


async def _get_recipient_ids(db, config):
    recipient_ids = set(config.user_ids)
    if config.tier_ids:
        recipient_ids.update(
            await db.scalars(select(User.id).where(User.tier_id.in_(config.tier_ids), User.is_deleted.is_(False)))
        )
    return recipient_ids


async def _get_or_create_evaluation(db, rule, window, subject):
    evaluation = await db.scalar(
        select(RuleEvaluation).where(
            RuleEvaluation.rule_id == rule.id,
            RuleEvaluation.window_key == window,
            RuleEvaluation.subject == str(subject),
        )
    )
    if evaluation is not None:
        return evaluation

    evaluation = RuleEvaluation(rule_id=rule.id, window_key=window, subject=str(subject), observed=Decimal(0))
    db.add(evaluation)
    return evaluation


def _should_emit(rule, evaluation, observed, config):
    return (
        _is_breached(rule, observed, config.threshold)
        and _is_cooled(evaluation, config.cooldown_minutes)
        and _is_worsened(rule, evaluation, observed)
    )


async def evaluate(db, today: date | None = None):
    today = today or now().date()
    # Rule row serializes evaluators, including creation of first window records.
    rules = list(
        await db.scalars(
            select(NotificationRule)
            .where(
                NotificationRule.enabled.is_(True),
                NotificationRule.event_type.in_(["SCRAP_RELEVANT", "COST_EXCEEDED", "GOAL_ACHIEVED"]),
            )
            .order_by(NotificationRule.id)
            .with_for_update(skip_locked=True)
        )
    )
    for rule in rules:
        config = RuleInput.model_validate(rule.config)
        start, end, closed = _get_rule_window(config, today)
        if not _should_process_rule(rule, closed):
            continue

        amount = _get_amount_column(config)
        dimension = _get_dimension_column(config)
        query = _build_query(amount, dimension, config, start, end)
        rows = (await db.execute(query)).all()
        recipient_ids = await _get_recipient_ids(db, config)

        for subject, observed in rows:
            observed = Decimal(observed or 0)
            window = _compute_window_key(config, start, end)
            evaluation = await _get_or_create_evaluation(db, rule, window, subject)
            if not _should_emit(rule, evaluation, observed, config):
                continue

            evaluation.sequence += 1
            evaluation.last_fired_at = now()
            evaluation.observed = observed
            entity_id = _get_entity_id(config, subject, rule)
            emit(
                db,
                rule.event_type,
                entity_id,
                {
                    "title": rule.name,
                    "rule_id": str(rule.id),
                    "observed": str(observed),
                    "threshold": str(config.threshold),
                    "currency": config.currency,
                    "period": f"{start} / {end}",
                    "provisional": not closed,
                    "sequence": evaluation.sequence,
                    "severity": _get_severity(rule, config),
                    "component": str(subject),
                    "recipient_ids": sorted(recipient_ids),
                    "channels": config.channels,
                    "link": _get_link(config, subject),
                },
            )
    await db.commit()
