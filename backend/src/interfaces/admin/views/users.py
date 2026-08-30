"""Admin view for User model."""

from typing import Any

from crudauth import get_password_hash
from sqladmin import ModelView
from starlette.requests import Request

from ....infrastructure.database.session import local_session
from ....modules.user.models import User
from ....modules.user.schemas import UserUpdate
from ....modules.user.service import UserService
from ..mixins import DataclassModelMixin

class UserAdmin(DataclassModelMixin, ModelView, model=User):
    """Admin view for User model with password hashing."""

    name = "User"
    name_plural = "Users"
    icon = "fa-solid fa-user"
    category = "Users & Access"

    column_list = [
        User.id,
        User.name,
        User.username,
        User.email,
        User.is_superuser,
        User.tier,
    ]
    column_details_list = "__all__"
    column_searchable_list = [User.name, User.username, User.email]
    column_sortable_list = [User.id, User.name, User.username, User.email]
    column_default_sort = [(User.id, True)]

    can_create = True
    can_edit = True
    can_delete = True
    can_view_details = True
    can_export = True

    column_labels = {"hashed_password": "Password"}

    form_create_rules = [
        "name",
        "username",
        "email",
        "hashed_password",
        "tier_id",
        "is_superuser",
    ]
    form_edit_rules = [*UserUpdate.model_fields.keys(), "tier_id", "is_superuser"]

    async def on_model_change(self, data: dict[str, Any], model: Any, is_created: bool, request: Request) -> None:
        """Hash the password before saving."""
        if is_created and "hashed_password" in data and data["hashed_password"]:
            data["hashed_password"] = get_password_hash(data["hashed_password"])

    async def delete_model(self, request: Request, pk: str) -> None:
        """Override delete to anonymize user instead of removing.

        GDPR/LGPD compliant deletion that:
        - Anonymizes all PII (name, username and password)
        - Retains email and timestamps for legal compliance
        - Soft deletes the user (is_deleted = True)
        - Maintains foreign key relationships

        Args:
            request: The incoming request object.
            pk: Primary key (ID) of the user to anonymize.
        """
        async with local_session() as db:
            user_service = UserService()
            await user_service.anonymize_user(user_id=int(pk), db=db)
