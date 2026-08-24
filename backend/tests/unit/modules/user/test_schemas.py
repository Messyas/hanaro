"""Validation tests for user request schemas."""

import pytest
from pydantic import ValidationError

from src.modules.user.schemas import UserCreate


def test_user_create_accepts_a_strong_passphrase() -> None:
    user = UserCreate(
        name="Alice Example",
        username="alice",
        email="alice@example.com",
        password="violet canoe glacier lantern 8472",
    )

    assert user.password == "violet canoe glacier lantern 8472"


@pytest.mark.parametrize(
    "password",
    [
        "short",
        "Password123!",
        "alice-example-2026",
    ],
)
def test_user_create_rejects_weak_or_personal_passwords(password: str) -> None:
    with pytest.raises(ValidationError):
        UserCreate(
            name="Alice Example",
            username="alice",
            email="alice@example.com",
            password=password,
        )
