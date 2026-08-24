"""Unit tests for DataclassModelMixin."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.interfaces.admin.mixins import DataclassModelMixin


class DummyAdminView(DataclassModelMixin):
    def __init__(self):
        self._mapper = MagicMock()
        self.model = MagicMock()
        self.session_maker = MagicMock()
        self.on_model_change = AsyncMock()
        self.after_model_change = AsyncMock()


def test_relationship_value_no_mapper():
    mixin = DataclassModelMixin()
    is_rel, fk, val = mixin._relationship_value("some_key", "123")
    assert is_rel is False
    assert fk is None
    assert val is None


def test_relationship_value_key_not_in_relationships():
    mixin = DummyAdminView()
    mixin._mapper.relationships = {}
    is_rel, fk, val = mixin._relationship_value("some_key", "123")
    assert is_rel is False
    assert fk is None
    assert val is None


def test_relationship_value_not_many_to_one():
    mixin = DummyAdminView()
    rel = MagicMock()
    rel.direction.name = "ONETOMANY"
    mixin._mapper.relationships = {"user": rel}

    is_rel, fk, val = mixin._relationship_value("user", "123")
    assert is_rel is True
    assert fk is None
    assert val is None


def test_relationship_value_no_local_columns():
    mixin = DummyAdminView()
    rel = MagicMock()
    rel.direction.name = "MANYTOONE"
    rel.local_columns = []
    mixin._mapper.relationships = {"user": rel}

    is_rel, fk, val = mixin._relationship_value("user", "123")
    assert is_rel is True
    assert fk is None
    assert val is None


def test_relationship_value_many_to_one_with_value():
    mixin = DummyAdminView()
    rel = MagicMock()
    rel.direction.name = "MANYTOONE"
    col = MagicMock()
    col.name = "user_id"
    rel.local_columns = [col]
    mixin._mapper.relationships = {"user": rel}

    is_rel, fk, val = mixin._relationship_value("user", "42")
    assert is_rel is True
    assert fk == "user_id"
    assert val == 42


def test_relationship_value_many_to_one_empty_value():
    mixin = DummyAdminView()
    rel = MagicMock()
    rel.direction.name = "MANYTOONE"
    col = MagicMock()
    col.name = "user_id"
    rel.local_columns = [col]
    mixin._mapper.relationships = {"user": rel}

    is_rel, fk, val = mixin._relationship_value("user", "")
    assert is_rel is True
    assert fk == "user_id"
    assert val is None


def test_nullable_value_non_empty():
    mixin = DummyAdminView()
    assert mixin._nullable_value("name", "John") == "John"


def test_nullable_value_no_mapper():
    mixin = DataclassModelMixin()
    assert mixin._nullable_value("name", "") == ""


def test_nullable_value_column_not_found():
    mixin = DummyAdminView()
    mixin._mapper.columns = {}
    assert mixin._nullable_value("unknown_col", "") == ""


def test_nullable_value_nullable_column():
    mixin = DummyAdminView()
    col = MagicMock()
    col.nullable = True
    mixin._mapper.columns = {"bio": col}
    assert mixin._nullable_value("bio", "") is None


def test_nullable_value_non_nullable_column():
    mixin = DummyAdminView()
    col = MagicMock()
    col.nullable = False
    mixin._mapper.columns = {"title": col}
    assert mixin._nullable_value("title", "") == ""


def test_clean_model_data():
    mixin = DummyAdminView()
    rel = MagicMock()
    rel.direction.name = "MANYTOONE"
    col_fk = MagicMock()
    col_fk.name = "tier_id"
    rel.local_columns = [col_fk]

    col_bio = MagicMock()
    col_bio.nullable = True

    mixin._mapper.relationships = {"tier": rel}
    mixin._mapper.columns = {"bio": col_bio}

    data = {
        "tier": "5",
        "bio": "",
        "username": "alice",
    }
    clean = mixin._clean_model_data(data)
    assert clean == {
        "tier_id": 5,
        "bio": None,
        "username": "alice",
    }


@pytest.mark.asyncio
async def test_insert_model():
    mixin = DummyAdminView()
    mixin._mapper.relationships = {}
    mixin._mapper.columns = {}

    created_obj = MagicMock()
    mixin.model.return_value = created_obj

    mock_session = AsyncMock()
    mock_session.add = MagicMock()
    mock_session_cm = AsyncMock()
    mock_session_cm.__aenter__.return_value = mock_session
    mixin.session_maker.return_value = mock_session_cm

    mock_request = MagicMock()
    data = {"name": "Test"}

    result = await mixin.insert_model(mock_request, data)

    mixin.on_model_change.assert_awaited_once_with(data, None, True, mock_request)
    mixin.model.assert_called_once_with(name="Test")
    mock_session.add.assert_called_once_with(created_obj)
    mock_session.commit.assert_awaited_once()
    mock_session.refresh.assert_awaited_once_with(created_obj)
    mixin.after_model_change.assert_awaited_once_with(data, created_obj, True, mock_request)
    assert result == created_obj
