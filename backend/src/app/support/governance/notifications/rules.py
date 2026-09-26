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
        start = config.date_from or today - timedelta(days=config.window_days - 1)
        end = config.date_to or today
        closed = end < today
        if rule.event_type == "GOAL_ACHIEVED" and not closed:
            continue
        amount = ScrapTransaction.amount_usd if config.currency == "USD" else ScrapTransaction.issue_amount_brl
        columns = {
            "item": ScrapTransaction.item_code,
            "line": ScrapTransaction.receipt_department,
            "product": ScrapTransaction.product,
            "organization": ScrapTransaction.organization_code,
        }
        dimension = ScrapOccurrence.id if config.dimension == "occurrence" else columns[config.dimension]
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
        rows = (await db.execute(query.group_by(dimension))).all()
        recipient_ids = set(config.user_ids)
        recipient_ids.update(
            await db.scalars(select(User.id).where(User.tier_id.in_(config.tier_ids), User.is_deleted.is_(False)))
        )
        for subject, observed in rows:
            observed = Decimal(observed or 0)
            # Stable occurrence dedupe survives re-ingestion and rolling windows.
            window = (
                "occurrence"
                if config.dimension == "occurrence"
                else f"{start}:{end}"
                if config.date_from
                else f"rolling:{config.window_days}"
            )
            evaluation = await db.scalar(
                select(RuleEvaluation).where(
                    RuleEvaluation.rule_id == rule.id,
                    RuleEvaluation.window_key == window,
                    RuleEvaluation.subject == str(subject),
                )
            )
            if evaluation is None:
                evaluation = RuleEvaluation(rule_id=rule.id, window_key=window, subject=str(subject), observed=Decimal(0))
                db.add(evaluation)
            breached = observed <= config.threshold if rule.event_type == "GOAL_ACHIEVED" else observed > config.threshold
            last = evaluation.last_fired_at
            if last and last.tzinfo is None:
                last = last.replace(tzinfo=UTC)
            cooled = last is None or now() - last >= timedelta(minutes=config.cooldown_minutes)
            worsened = evaluation.sequence == 0 or (observed > evaluation.observed and rule.event_type != "GOAL_ACHIEVED")
            if breached and cooled and worsened:
                evaluation.sequence += 1
                evaluation.last_fired_at = now()
                evaluation.observed = observed
                entity_id = uuid.UUID(str(subject)) if config.dimension == "occurrence" else rule.id
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
                        "severity": "POSITIVE" if rule.event_type == "GOAL_ACHIEVED" else config.severity,
                        "component": str(subject),
                        "recipient_ids": sorted(recipient_ids),
                        "channels": config.channels,
                        "link": f"/base-de-scrap/revisao/{subject}" if config.dimension == "occurrence" else "/alertas",
                    },
                )
    await db.commit()
