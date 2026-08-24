"""Mixins for SQLAdmin views to handle dataclass-based models."""

from typing import Any

from starlette.requests import Request


class DataclassModelMixin:
    """Mixin for SQLAdmin ModelView to support dataclass-based SQLAlchemy models.

    SQLAdmin's default insert_model creates an empty model instance via model(),
    then sets attributes. This fails for MappedAsDataclass models with required
    fields that have no defaults.

    This mixin overrides insert_model to create the model WITH the form data,
    which works correctly with dataclass __init__ signatures.

    Usage:
        class MyAdmin(DataclassModelMixin, ModelView, model=MyModel):
            ...

        # For custom data transformation before model creation:
        class UserAdmin(DataclassModelMixin, ModelView, model=User):
            async def on_model_change(self, data, model, is_created, request):
                if is_created:
                    # Transform data BEFORE model is created
                    data["hashed_password"] = hash(data.pop("password"))
    """

    def _relationship_value(self, key: str, value: Any) -> tuple[bool, str | None, Any]:
        """Translate a many-to-one relationship field into its foreign key."""
        mapper = getattr(self, "_mapper", None)
        if mapper is None or key not in mapper.relationships:
            return False, None, None

        relationship = mapper.relationships[key]
        if relationship.direction.name != "MANYTOONE":
            return True, None, None

        foreign_keys = list(relationship.local_columns)
        if not foreign_keys:
            return True, None, None
        return True, foreign_keys[0].name, int(value) if value else None

    def _nullable_value(self, key: str, value: Any) -> Any:
        """Convert empty form values to None for nullable columns."""
        mapper = getattr(self, "_mapper", None)
        if value != "" or mapper is None:
            return value
        column = mapper.columns.get(key)
        return None if column is not None and column.nullable else value

    def _clean_model_data(self, data: dict[str, Any]) -> dict[str, Any]:
        """Normalize SQLAdmin form data for a dataclass model constructor."""
        clean_data: dict[str, Any] = {}
        for key, value in data.items():
            is_relationship, foreign_key, relationship_value = self._relationship_value(
                key, value
            )
            if is_relationship:
                if foreign_key is not None:
                    clean_data[foreign_key] = relationship_value
                continue
            clean_data[key] = self._nullable_value(key, value)
        return clean_data

    async def insert_model(self, request: Request, data: dict[str, Any]) -> Any:
        """Create model instance with data for dataclass compatibility.

        Instead of creating an empty model then setting attributes,
        we create the model with all data at once, which satisfies
        dataclass required field constraints.
        """
        await self.on_model_change(data, None, True, request)  # type: ignore[attr-defined]

        clean_data = self._clean_model_data(data)
        obj = self.model(**clean_data)  # type: ignore[attr-defined]

        async with self.session_maker(expire_on_commit=False) as session:  # type: ignore[attr-defined]
            session.add(obj)
            await session.commit()
            await session.refresh(obj)
            await self.after_model_change(data, obj, True, request)  # type: ignore[attr-defined]
            return obj
