"""Persisted business classifications for Material Scrap.

The upstream automation can still submit its canonical contract, but these
rules are the final, auditable source of truth inside Hanaro.  They are applied
after canonical integrity validation so an analyst can correct a taxonomy
without ever rewriting the original GERP values.
"""

from __future__ import annotations

import builtins
import re
import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.material_scrap.models import (
    ScrapClassificationRule,
    ScrapDashboardAggregate,
    ScrapDashboardState,
    ScrapOccurrence,
    ScrapTransaction,
)
from src.app.models.material_scrap.schemas import (
    CanonicalScrapRecord,
    ScrapClassificationRuleRead,
    ScrapClassificationRuleWrite,
)
from src.app.utils.material_scrap.identity import content_hash
from src.app.utils.material_scrap.projection import build_dashboard_projection

_DERIVED_QUALITY_FLAGS = {
    "unmapped_product",
    "unmapped_division",
    "unmapped_department",
    "unmapped_to_be_counted",
    "unmapped_item_type",
}


def _key(value: str | None) -> str:
    return " ".join((value or "").split()).upper()


class ScrapClassificationService:
    async def list(self, db: AsyncSession, *, include_inactive: bool = True) -> list[ScrapClassificationRuleRead]:
        statement = select(ScrapClassificationRule)
        if not include_inactive:
            statement = statement.where(ScrapClassificationRule.is_active.is_(True))
        statement = statement.order_by(
            ScrapClassificationRule.kind, ScrapClassificationRule.priority, ScrapClassificationRule.source_value
        )
        return [ScrapClassificationRuleRead.model_validate(item) for item in (await db.execute(statement)).scalars()]

    async def create(
        self, command: ScrapClassificationRuleWrite, user_id: int, db: AsyncSession
    ) -> ScrapClassificationRuleRead:
        self._validate_regex(command)
        now = datetime.now(UTC)
        rule = ScrapClassificationRule(
            **command.model_dump(), created_by_id=user_id, updated_by_id=user_id, created_at=now, updated_at=now
        )
        db.add(rule)
        try:
            await db.commit()
        except IntegrityError as error:
            await db.rollback()
            raise ValueError("A rule with the same source already exists") from error
        await db.refresh(rule)
        return ScrapClassificationRuleRead.model_validate(rule)

    async def update(
        self, rule_id: uuid.UUID, command: ScrapClassificationRuleWrite, user_id: int, db: AsyncSession
    ) -> ScrapClassificationRuleRead:
        self._validate_regex(command)
        rule = await db.get(ScrapClassificationRule, rule_id)
        if rule is None:
            raise LookupError("Classification rule not found")
        for key, value in command.model_dump().items():
            setattr(rule, key, value)
        rule.updated_by_id = user_id
        rule.updated_at = datetime.now(UTC)
        try:
            await db.commit()
        except IntegrityError as error:
            await db.rollback()
            raise ValueError("A rule with the same source already exists") from error
        await db.refresh(rule)
        return ScrapClassificationRuleRead.model_validate(rule)

    async def delete(self, rule_id: uuid.UUID, db: AsyncSession) -> None:
        rule = await db.get(ScrapClassificationRule, rule_id)
        if rule is None:
            raise LookupError("Classification rule not found")
        await db.delete(rule)
        await db.commit()

    async def resolve_records(
        self, records: builtins.list[CanonicalScrapRecord], db: AsyncSession
    ) -> builtins.list[CanonicalScrapRecord]:
        rules = await self._active_rules(db)
        return [self._resolve(record, rules) for record in records]

    async def reapply(self, db: AsyncSession) -> tuple[int, uuid.UUID]:
        """Reclassify the current snapshot and atomically rebuild dashboard facts."""
        rules = await self._active_rules(db)
        rows = builtins.list(
            (
                await db.execute(
                    select(ScrapOccurrence, ScrapTransaction)
                    .join(ScrapTransaction, ScrapTransaction.id == ScrapOccurrence.current_transaction_id)
                    .where(ScrapOccurrence.status == "ACTIVE")
                )
            ).all()
        )
        facts = []
        for occurrence, transaction in rows:
            record = CanonicalScrapRecord(**{name: getattr(transaction, name) for name in CanonicalScrapRecord.model_fields})
            resolved = self._resolve(record, rules)
            for name, value in resolved.model_dump().items():
                setattr(transaction, name, value)
            facts.append(build_dashboard_projection(occurrence_id=occurrence.id, run_id=transaction.run_id, record=resolved))
        await db.execute(delete(ScrapDashboardAggregate))
        if facts:
            db.add_all(facts)
        state = await db.get(ScrapDashboardState, 1, with_for_update=True)
        now = datetime.now(UTC)
        if state is None:
            state = ScrapDashboardState(updated_at=now)
            db.add(state)
        else:
            state.revision = uuid.uuid4()
            state.updated_at = now
        await db.commit()
        return len(rows), state.revision

    async def _active_rules(self, db: AsyncSession) -> builtins.list[ScrapClassificationRule]:
        statement = (
            select(ScrapClassificationRule)
            .where(ScrapClassificationRule.is_active.is_(True))
            .order_by(ScrapClassificationRule.kind, ScrapClassificationRule.priority, ScrapClassificationRule.source_value)
        )
        return builtins.list((await db.execute(statement)).scalars())

    def _resolve(self, record: CanonicalScrapRecord, rules: builtins.list[ScrapClassificationRule]) -> CanonicalScrapRecord:
        exact: dict[tuple[str, str, str], ScrapClassificationRule] = {}
        item_rules: builtins.list[ScrapClassificationRule] = []
        for rule in rules:
            if rule.kind == "ITEM_TYPE":
                item_rules.append(rule)
            else:
                exact[(rule.kind, _key(rule.source_value), _key(rule.source_context))] = rule

        values = record.model_dump()
        # The submitted values may have been enriched by an older automation
        # mapping. Reset only derived dimensions so removing a database rule
        # also takes effect when an existing snapshot is reapplied.
        values.update(
            product=None,
            division=None,
            department=None,
            to_be_counted=None,
            item_type=None,
        )
        provenance = dict(record.derivation_provenance)
        flags = set(record.quality_flags) - _DERIVED_QUALITY_FLAGS
        organization = exact.get(("ORGANIZATION", _key(record.organization_code), ""))
        if organization:
            values.update(product=organization.target_value, division=organization.target_secondary)
        department = exact.get(("DEPARTMENT", _key(record.receipt_department), ""))
        if department:
            values["department"] = department.target_value
        counting = exact.get(("COUNTING", _key(record.account_description), _key(record.account_alias)))
        if counting:
            values["to_be_counted"] = counting.boolean_value
        item_text = record.item_description or ""
        for rule in item_rules:
            matches = (
                _key(item_text) == _key(rule.source_value)
                if rule.match_mode == "EXACT"
                else bool(re.search(rule.source_value, item_text, re.IGNORECASE))
            )
            if matches:
                values["item_type"] = rule.target_value
                break
        if values["product"] is None:
            flags.add("unmapped_product")
        if values["division"] is None:
            flags.add("unmapped_division")
        if values["department"] is None and record.receipt_department:
            flags.add("unmapped_department")
        if values["to_be_counted"] is None:
            flags.add("unmapped_to_be_counted")
        if values["item_type"] is None:
            flags.add("unmapped_item_type")
        provenance["classification_source"] = "database_rules"
        values["quality_flags"] = sorted(flags)
        values["derivation_provenance"] = provenance
        values["content_hash"] = "0" * 64
        resolved = CanonicalScrapRecord(**values)
        return resolved.model_copy(update={"content_hash": content_hash(resolved)})

    @staticmethod
    def _validate_regex(command: ScrapClassificationRuleWrite) -> None:
        if command.kind == "ITEM_TYPE" and command.match_mode == "REGEX":
            try:
                re.compile(command.source_value)
            except re.error as error:
                raise ValueError(f"Invalid item type regular expression: {error}") from error
