from datetime import UTC, datetime

from src.modules.material_scrap.classification_service import ScrapClassificationService
from src.modules.material_scrap.models import ScrapClassificationRule

from .helpers import canonical_fixture


def _rule(kind: str, source_value: str, **values: object) -> ScrapClassificationRule:
    now = datetime.now(UTC)
    return ScrapClassificationRule(
        kind=kind,
        source_value=source_value,
        source_context=values.get("source_context"),
        target_value=values.get("target_value"),
        target_secondary=values.get("target_secondary"),
        boolean_value=values.get("boolean_value"),
        match_mode=values.get("match_mode", "EXACT"),
        priority=0,
        is_active=True,
        created_at=now,
        updated_at=now,
    )


def test_database_rules_override_derived_dimensions_without_changing_source_identity() -> None:
    record = (
        canonical_fixture()
        .records[0]
        .model_copy(
            update={
                "organization_code": "NW4",
                "receipt_department": "BM1",
                "account_description": "DEFECT - DIRECT CHARGED",
                "account_alias": "D-DIRECT",
                "item_description": "LCD, display module",
                "quality_flags": ["unmapped_product", "unmapped_item_type", "expanded_req_comment_fields"],
            }
        )
    )
    resolved = ScrapClassificationService()._resolve(
        record,
        [
            _rule("ORGANIZATION", "NW4", target_value="AV", target_secondary="HE"),
            _rule("DEPARTMENT", "BM1", target_value="FA"),
            _rule(
                "COUNTING",
                "DEFECT - DIRECT CHARGED",
                source_context="D-DIRECT",
                boolean_value=True,
            ),
            _rule("ITEM_TYPE", r"^lcd(?:,|\b)", target_value="Module", match_mode="REGEX"),
        ],
    )

    assert resolved.organization_code == "NW4"
    assert resolved.product == "AV"
    assert resolved.division == "HE"
    assert resolved.department == "FA"
    assert resolved.to_be_counted is True
    assert resolved.item_type == "Module"
    assert resolved.quality_flags == ["expanded_req_comment_fields"]
    assert resolved.derivation_provenance["classification_source"] == "database_rules"
    assert resolved.content_hash != record.content_hash
