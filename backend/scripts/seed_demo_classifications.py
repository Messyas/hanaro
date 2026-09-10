"""Idempotent business classifications used by the local/demo history seed."""

from __future__ import annotations

import os
from datetime import UTC, datetime

from sqlalchemy import select

from src.infrastructure.database.session import local_session
from src.modules.material_scrap.models import ScrapClassificationRule
from src.modules.user.models import User

# These are the observed GERP organization mappings used by the synthetic
# history. They are demo data, not a replacement for a company's homologated
# production taxonomy.
ORGANIZATION_CLASSIFICATIONS: dict[str, tuple[str, str]] = {
    "NWK": ("BM", "BM"),
    "NW1": ("TV", "HE"),
    "NW4": ("AV", "HE"),
    "NWH": ("MNT", "MNT"),
    "NWX": ("AV", "HE"),
    "NWU": ("AV", "HE"),
    "NWD": ("TV", "HE"),
    "NWE": ("TV", "HE"),
    "NWW": ("MNT", "MNT"),
    "NWZ": ("TV", "HE"),
}

ITEM_TYPE_PATTERNS: tuple[tuple[str, str], ...] = (
    (r"^(?:pcba|pcb assembly|printed circuit)(?:,|\b)", "PCBA"),
    (r"^tape(?:,|\b)", "Tape"),
    (r"^(?:cover assembly)(?:,|\b)", "Cover Assembly"),
    (r"^cover(?:,|\b)", "Cover"),
    (r"^(?:lcd|led assembly|module)(?:,|\b)", "Module"),
    (r"^chassis(?:,|\b)", "Chassis"),
    (r"^box(?:,|\b)", "Box"),
    (r"^packing(?:,|\b)", "Packing"),
    (r"^base(?:,|\b)", "Base"),
    (r"^lens(?:,|\b)", "Lens"),
    (r"^gasket(?:,|\b)", "Gasket"),
    (r"^sheet(?:,|\b)", "Sheet"),
    (r"^part(?:,|\b)", "Part"),
)


async def seed_demo_classifications() -> int:
    """Create/update demo organization rules and return the number of rules."""
    admin_username = os.getenv("ADMIN_USERNAME", "")
    async with local_session() as db:
        admin = await db.scalar(select(User).where(User.username == admin_username)) if admin_username else None
        admin_id = int(admin.id) if admin else None
        now = datetime.now(UTC)
        created = 0
        for source_value, (product, division) in ORGANIZATION_CLASSIFICATIONS.items():
            rule = await db.scalar(
                select(ScrapClassificationRule).where(
                    ScrapClassificationRule.kind == "ORGANIZATION",
                    ScrapClassificationRule.source_value == source_value,
                    ScrapClassificationRule.source_context.is_(None),
                )
            )
            if rule is None:
                rule = ScrapClassificationRule(
                    kind="ORGANIZATION",
                    source_value=source_value,
                    source_context=None,
                    target_value=product,
                    target_secondary=division,
                    boolean_value=None,
                    match_mode="EXACT",
                    priority=0,
                    is_active=True,
                    created_by_id=admin_id,
                    updated_by_id=admin_id,
                    created_at=now,
                    updated_at=now,
                )
                db.add(rule)
                created += 1
            else:
                rule.target_value = product
                rule.target_secondary = division
                rule.is_active = True
                rule.updated_by_id = admin_id
                rule.updated_at = now
        for source_value, item_type in ITEM_TYPE_PATTERNS:
            rule = await db.scalar(
                select(ScrapClassificationRule).where(
                    ScrapClassificationRule.kind == "ITEM_TYPE",
                    ScrapClassificationRule.source_value == source_value,
                    ScrapClassificationRule.source_context.is_(None),
                )
            )
            if rule is None:
                db.add(
                    ScrapClassificationRule(
                        kind="ITEM_TYPE",
                        source_value=source_value,
                        source_context=None,
                        target_value=item_type,
                        target_secondary=None,
                        boolean_value=None,
                        match_mode="REGEX",
                        priority=0,
                        is_active=True,
                        created_by_id=admin_id,
                        updated_by_id=admin_id,
                        created_at=now,
                        updated_at=now,
                    )
                )
                created += 1
            else:
                rule.target_value = item_type
                rule.match_mode = "REGEX"
                rule.is_active = True
                rule.updated_by_id = admin_id
                rule.updated_at = now
        await db.commit()
    return created


if __name__ == "__main__":
    import asyncio
    print("Seeded classification rules:", asyncio.run(seed_demo_classifications()))

