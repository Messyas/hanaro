from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from fastapi import APIRouter, FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.infrastructure.database.session import Base, async_session
from src.modules.material_scrap.dependencies import require_material_scrap_ingestion_key
from src.modules.material_scrap.routes import dashboard_router, scrap_router
from src.modules.material_scrap.service import ingest_material_scrap

from .helpers import canonical_fixture


@pytest_asyncio.fixture
async def scrap_client() -> AsyncGenerator[AsyncClient, None]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    session = factory()
    await ingest_material_scrap(canonical_fixture(), session)

    app = FastAPI()
    router = APIRouter(prefix="/api/v1")
    router.include_router(scrap_router, prefix="/scrap")
    router.include_router(dashboard_router, prefix="/dashboard/scrap")
    app.include_router(router)

    async def override_session() -> AsyncGenerator[AsyncSession, None]:
        yield session

    async def allow_ingestion() -> int:
        return 1

    app.dependency_overrides[async_session] = override_session
    app.dependency_overrides[require_material_scrap_ingestion_key] = allow_ingestion
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        yield client
    await session.close()
    await engine.dispose()


@pytest.mark.asyncio
async def test_listing_filters_search_pagination_and_allowlist(scrap_client: AsyncClient) -> None:
    response = await scrap_client.get(
        "/api/v1/scrap",
        params=[("organizations", "NWK"), ("page", "1"), ("page_size", "2"), ("sort_by", "item_code")],
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total_items"] == 3
    assert body["total_pages"] == 2
    assert len(body["items"]) == 2
    assert body["items"][0]["issue_amount_brl"].startswith("-")

    unmapped = await scrap_client.get("/api/v1/scrap", params={"to_be_counted": "unmapped"})
    assert unmapped.json()["total_items"] == 6
    search = await scrap_client.get("/api/v1/scrap", params={"search": "linha inicial"})
    assert search.json()["total_items"] == 1
    assert (await scrap_client.get("/api/v1/scrap", params={"sort_by": "drop_table"})).status_code == 422


@pytest.mark.asyncio
async def test_dynamic_filters_summary_trend_breakdown_and_ingestion(
    scrap_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    options = (await scrap_client.get("/api/v1/scrap/filters")).json()
    assert {"NWK", "NW1", "NW4", "NQX"}.issubset(options["organizations"])
    assert options["account_aliases"]

    summary = (await scrap_client.get("/api/v1/dashboard/scrap/summary")).json()
    assert summary["total_records"] == 6
    assert summary["total_issue_amount_brl"] == "246.50"
    assert summary["exchange_rate_used"] == "5.150000"

    trend = (await scrap_client.get("/api/v1/dashboard/scrap/trend", params={"group_by": "day"})).json()
    assert sum(point["record_count"] for point in trend) == 6
    breakdown = (
        await scrap_client.get(
            "/api/v1/dashboard/scrap/breakdown",
            params={"group_by": "organization", "metric": "records"},
        )
    ).json()
    assert sum(item["record_count"] for item in breakdown) == 6

    payload = canonical_fixture().model_dump(mode="json")

    async def fake_enqueue(_payload: object) -> str:
        return "task-test-123"

    monkeypatch.setattr("src.modules.material_scrap.routes.enqueue_material_scrap", fake_enqueue)
    response = await scrap_client.post("/api/v1/scrap/ingestions", json=payload)
    assert response.status_code == 202
    assert response.json() == {
        "task_id": "task-test-123",
        "execution_id": payload["execution"]["execution_id"],
        "status": "QUEUED",
    }
