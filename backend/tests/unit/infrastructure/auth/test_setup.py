"""Tests for the application's CRUDAuth composition root."""

from src.infrastructure.auth.setup import auth


def test_auth_uses_three_login_attempts_and_secure_session_defaults():
    """The deployed auth policy must lock a username/IP after three failures."""
    transport = auth._session_transport

    assert transport is not None
    assert transport.login_max_attempts == 3
    assert transport.session_timeout_minutes == 30
    assert transport.cookie_config().samesite == "lax"
