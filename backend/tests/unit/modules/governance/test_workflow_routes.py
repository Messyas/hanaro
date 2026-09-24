from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.infrastructure.auth.dependencies import get_current_user
from src.infrastructure.database.session import Base, async_session
from src.modules.governance.workflow_routes import router
from src.modules.user.models import User


@pytest_asyncio.fixture
async def workflow_client() -> AsyncGenerator[AsyncClient, None]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    session = async_sessionmaker(engine, expire_on_commit=False)()
    session.add(User(name="Analyst", username="analyst", email="analyst@example.com", hashed_password="hash"))
    await session.commit()

    app = FastAPI()
    app.include_router(router)

    async def override_session() -> AsyncGenerator[AsyncSession, None]:
        yield session

    async def authenticated_user() -> dict[str, object]:
        return {"id": 1, "role": "analista", "is_superuser": False}

    app.dependency_overrides[async_session] = override_session
    app.dependency_overrides[get_current_user] = authenticated_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        yield client
    await session.close()
    await engine.dispose()


@pytest.mark.asyncio
async def test_authenticated_user_manages_shared_notification_rules(workflow_client: AsyncClient) -> None:
    payload = {
        "name": "Relevant scrap",
        "event_type": "SCRAP_RELEVANT",
        "threshold": "1000",
        "user_ids": [1],
    }

    created = await workflow_client.post("/notification-rules", json=payload)

    assert created.status_code == 201
    assert created.json()["name"] == payload["name"]
    listed = await workflow_client.get("/notification-rules")
    assert listed.status_code == 200
    assert listed.json()["items"][0]["id"] == created.json()["id"]
