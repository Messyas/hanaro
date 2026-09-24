import uuid

from src.modules.governance.reporting.scope import canonical_scope_key


def test_scope_key_is_stable_for_equivalent_filters_and_excludes_dates() -> None:
    factory_id = uuid.uuid4()
    first = canonical_scope_key(factory_id, {"lines": [" L2 ", "L1", "L2"], "divisions": []})
    second = canonical_scope_key(factory_id, {"divisions": [], "lines": ["L1", "L2"]})

    assert first == second
    assert first != canonical_scope_key(uuid.uuid4(), {"divisions": [], "lines": ["L1", "L2"]})
