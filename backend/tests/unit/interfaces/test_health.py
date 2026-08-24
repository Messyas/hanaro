"""Tests for process liveness and dependency readiness endpoints."""

from unittest.mock import AsyncMock

import pytest
from fastapi import Response, status

from src.interfaces import main


class ConnectionContext:
    def __init__(self, connection: AsyncMock | None = None, error: Exception | None = None):
        self.connection = connection or AsyncMock()
        self.error = error

    async def __aenter__(self) -> AsyncMock:
        if self.error is not None:
            raise self.error
        return self.connection

    async def __aexit__(self, *_: object) -> None:
        return None


class FakeEngine:
    def __init__(self, context: ConnectionContext):
        self.context = context

    def connect(self) -> ConnectionContext:
        return self.context


@pytest.mark.asyncio
async def test_liveness_check() -> None:
    assert await main.liveness_check() == {"status": "healthy"}


@pytest.mark.asyncio
async def test_readiness_check_passes_when_dependencies_respond(monkeypatch) -> None:
    connection = AsyncMock()
    monkeypatch.setattr(main, "engine", FakeEngine(ConnectionContext(connection)))
    monkeypatch.setattr(main.settings, "CACHE_ENABLED", True)
    ping_all = AsyncMock(return_value={"redis": True})
    monkeypatch.setattr(main.cache_provider, "ping_all", ping_all)
    response = Response()

    assert await main.readiness_check(response) == {"status": "healthy"}
    assert response.status_code == status.HTTP_200_OK
    connection.execute.assert_awaited_once()
    ping_all.assert_awaited_once()


@pytest.mark.asyncio
async def test_readiness_check_returns_503_when_a_dependency_fails(monkeypatch) -> None:
    monkeypatch.setattr(
        main,
        "engine",
        FakeEngine(ConnectionContext(error=RuntimeError("database unavailable"))),
    )
    response = Response()

    assert await main.readiness_check(response) == {"status": "unavailable"}
    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
