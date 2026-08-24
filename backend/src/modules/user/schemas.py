import re
from datetime import datetime
from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator
from zxcvbn import zxcvbn

from ..common.schemas import PersistentDeletion, TimestampSchema


class UserBase(BaseModel):
    name: Annotated[str, Field(min_length=2, max_length=30, examples=["User Userson"])]
    username: Annotated[
        str,
        Field(min_length=2, max_length=20, pattern=r"^[a-z0-9]+$", examples=["userson"]),
    ]
    email: Annotated[EmailStr, Field(examples=["user.userson@example.com"])]


class User(TimestampSchema, UserBase, PersistentDeletion):
    """Complete user model with all fields."""

    hashed_password: str
    notification_email: EmailStr | None = None
    phone: str | None = None
    job_title: str | None = None
    is_superuser: bool = False
    profile_image_url: Annotated[
        str,
        Field(
            default="https://www.profileimageurl.com",
            description="URL of the user's profile image",
        ),
    ]
    tier_id: int | None = None

    google_id: str | None = None
    github_id: str | None = None
    oauth_provider: str | None = None
    email_verified: bool = False
    oauth_created_at: datetime | None = None
    oauth_updated_at: datetime | None = None


class UserRead(BaseModel):
    """Schema for reading user data, excludes sensitive information."""

    id: int
    name: Annotated[str, Field(min_length=2, max_length=30, examples=["User Userson"])]
    username: Annotated[
        str,
        Field(min_length=2, max_length=20, pattern=r"^[a-z0-9]+$", examples=["userson"]),
    ]
    email: Annotated[EmailStr, Field(examples=["user.userson@example.com"])]
    notification_email: EmailStr | None = None
    phone: str | None = None
    job_title: str | None = None
    profile_image_url: str
    is_deleted: bool = False
    tier_id: int | None
    is_superuser: bool = False
    email_verified: bool = False
    oauth_provider: str | None = None


class UserCreate(UserBase):
    """Schema for creating a new user."""

    password: Annotated[
        str,
        Field(
            min_length=12,
            max_length=72,
            description=(
                "Password must contain 12 to 72 characters and receive a strong "
                "zxcvbn score. Long, unique passphrases are recommended."
            ),
            examples=["violet canoe glacier lantern 8472"],
        ),
    ]
    google_id: str | None = None
    github_id: str | None = None
    oauth_provider: str | None = None
    email_verified: bool = False
    oauth_created_at: datetime | None = None
    oauth_updated_at: datetime | None = None

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validate_password_strength(self) -> Self:
        """Reject common and predictable passwords, including user-specific terms."""
        user_inputs = [
            self.name,
            self.username,
            str(self.email),
            str(self.email).split("@", 1)[0],
        ]
        normalized_password = self.password.casefold()
        personal_terms = {term for value in user_inputs for term in re.split(r"[^a-z0-9]+", value.casefold()) if len(term) >= 4}
        if any(term in normalized_password for term in personal_terms):
            raise ValueError("Password must not contain your name, username, or email.")

        result = zxcvbn(self.password, user_inputs=user_inputs, max_length=72)
        if result["score"] < 3:
            raise ValueError(
                "Password is too easy to guess. Use a longer, unique passphrase "
                "that does not contain your name, username, or email."
            )
        return self


class UserCreateInternal(UserBase):
    """Internal schema for user creation with hashed password."""

    hashed_password: str
    google_id: str | None = None
    github_id: str | None = None
    oauth_provider: str | None = None
    email_verified: bool = False
    oauth_created_at: datetime | None = None
    oauth_updated_at: datetime | None = None


class UserUpdate(BaseModel):
    """Schema for updating user data."""

    model_config = ConfigDict(extra="forbid")

    name: (
        Annotated[
            str,
            Field(min_length=2, max_length=30, examples=["User Userberg"]),
        ]
        | None
    ) = None
    username: (
        Annotated[
            str,
            Field(
                min_length=2,
                max_length=20,
                pattern=r"^[a-z0-9]+$",
                examples=["userberg"],
            ),
        ]
        | None
    ) = None
    email: Annotated[EmailStr, Field(examples=["user.userberg@example.com"])] | None = None
    notification_email: (
        Annotated[
            EmailStr,
            Field(max_length=50, examples=["notifications@example.com"]),
        ]
        | None
    ) = None
    phone: Annotated[str, Field(max_length=24)] | None = None
    job_title: Annotated[str, Field(max_length=80)] | None = None
    profile_image_url: (
        Annotated[
            str,
            Field(
                pattern=(
                    r"^(?:(?:https?|ftp)://[^\s/$.?#].[^\s]*|"
                    r"/api/v1/users/me/profile-image\?v=[a-f0-9]{32})$"
                ),
                examples=["/api/v1/users/me/profile-image?v=0123456789abcdef0123456789abcdef"],
            ),
        ]
        | None
    ) = None
    google_id: str | None = None
    github_id: str | None = None
    oauth_provider: str | None = None
    email_verified: bool | None = None
    oauth_updated_at: datetime | None = None


class UserUpdateInternal(UserUpdate):
    """Internal schema for user updates."""

    updated_at: datetime


class UserTierUpdate(BaseModel):
    """Schema for updating a user's tier."""

    tier_id: int


class ProfileImageResponse(BaseModel):
    """Result of creating, replacing or removing the current profile image."""

    profile_image_url: str | None


class UserDelete(BaseModel):
    """Schema for soft-deleting a user."""

    model_config = ConfigDict(extra="forbid")

    is_deleted: bool
    deleted_at: datetime


class UserAnonymize(BaseModel):
    """Schema for GDPR/LGPD compliant user anonymization.

    This schema includes all fields that need to be updated during
    the user anonymization process for privacy compliance.
    """

    model_config = ConfigDict(extra="forbid")

    name: str
    username: str
    hashed_password: str | None = None
    notification_email: str | None = None
    phone: str | None = None
    job_title: str | None = None
    profile_image_url: str | None = None
    tier_id: int | None = None
    is_superuser: bool = False
    google_id: str | None = None
    github_id: str | None = None
    oauth_provider: str | None = None
    email_verified: bool = False
    oauth_created_at: datetime | None = None
    oauth_updated_at: datetime | None = None


class UserRestoreDeleted(BaseModel):
    """Schema for restoring a deleted user."""

    is_deleted: bool
