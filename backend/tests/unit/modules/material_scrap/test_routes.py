from collections.abc import AsyncGenerator
from decimal import Decimal

import pytest
import pytest_asyncio
from fastapi import APIRouter, FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.infrastructure.auth.dependencies import get_current_user
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

    async def authenticated_user() -> dict[str, object]:
        return {"id": 1, "name": "Test Analyst", "username": "analyst", "tier_id": 1, "is_superuser": False}

    app.dependency_overrides[async_session] = override_session
    app.dependency_overrides[get_current_user] = authenticated_user
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
    assert body["items"][0]["occurrence_id"]
    assert body["items"][0]["current_transaction_id"] == body["items"][0]["id"]
    assert body["items"][0]["occurrence_status"] == "ACTIVE"

    unmapped = await scrap_client.get("/api/v1/scrap", params={"to_be_counted": "unmapped"})
    assert unmapped.json()["total_items"] == 6
    search = await scrap_client.get("/api/v1/scrap", params={"search": "linha inicial"})
    assert search.json()["total_items"] == 1
    assert (await scrap_client.get("/api/v1/scrap", params={"sort_by": "drop_table"})).status_code == 422


@pytest.mark.asyncio
async def test_authenticated_users_manage_shared_classifications(scrap_client: AsyncClient) -> None:
    payload = {
        "kind": "PRODUCT_ALIAS",
        "source_value": "F700-1234",
        "target_value": "TV 55 Premium",
    }

    created = await scrap_client.post("/api/v1/scrap/classifications", json=payload)

    assert created.status_code == 201
    assert created.json()["source_value"] == payload["source_value"]
    assert (await scrap_client.get("/api/v1/scrap/classifications")).json()[0]["id"] == created.json()["id"]


@pytest.mark.asyncio
async def test_listing_exposes_and_filters_review_state(scrap_client: AsyncClient) -> None:
    listing = (await scrap_client.get("/api/v1/scrap", params={"page_size": 1})).json()
    occurrence_id = listing["items"][0]["occurrence_id"]
    draft = await scrap_client.put(
        f"/api/v1/scrap/reviews/{occurrence_id}",
        json={"title": "Draft analysis", "description": "Work in progress"},
    )
    assert draft.status_code == 200

    filtered = (await scrap_client.get("/api/v1/scrap", params={"review_status": "DRAFT"})).json()
    assert filtered["total_items"] == 1
    assert filtered["items"][0]["review_status"] == "DRAFT"
    assert filtered["items"][0]["responsible_name"] == "Test Analyst"
    assert filtered["items"][0]["attachment_count"] == 0

    unreviewed = (await scrap_client.get("/api/v1/scrap", params={"review_status": "UNREVIEWED"})).json()
    assert unreviewed["total_items"] == 5


@pytest.mark.asyncio
async def test_detailed_listing_requires_authentication() -> None:
    """The detailed report endpoint is not part of the public dashboard contract."""
    app = FastAPI()
    app.include_router(scrap_router, prefix="/api/v1/scrap")

    async def override_session() -> AsyncGenerator[AsyncSession, None]:
        yield AsyncSession()

    app.dependency_overrides[async_session] = override_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        response = await client.get("/api/v1/scrap")

    assert response.status_code == 401


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


@pytest.mark.asyncio
async def test_frontend_dashboard_contract_uses_precalculated_projection(scrap_client: AsyncClient) -> None:
    response = await scrap_client.get(
        "/api/v1/dashboard/scrap",
        params={"year": 2026, "currency": "USD", "impact_mode": "absolute", "ranking_limit": 5},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["metadata"]["data_through"] == "2026-08-26"
    assert body["metadata"]["target_scope"] == "global"
    assert Decimal(body["kpis"]["actual"]) > 0
    assert body["kpis"]["target"] is None
    assert len(body["monthly"]) == 12
    assert body["weekly"]
    assert body["rankings"]["products"]
    assert len(body["priority_occurrences"]) <= 5


@pytest.mark.asyncio
async def test_dashboard_rejects_invalid_window_and_unbounded_filters(
    scrap_client: AsyncClient,
    client: AsyncClient,
) -> None:
    reversed_window = await scrap_client.get(
        "/api/v1/dashboard/scrap",
        params={"date_from": "2026-08-27", "date_to": "2026-08-01"},
    )
    assert reversed_window.status_code == 422

    too_many_products = await scrap_client.get(
        "/api/v1/dashboard/scrap",
        params=[("products", f"P{index}") for index in range(51)],
    )
    assert too_many_products.status_code == 422

    regular_user_target_write = await scrap_client.put(
        "/api/v1/dashboard/scrap/targets/2026/8",
        json={"currency": "USD", "amount": "1000.00"},
    )
    assert regular_user_target_write.status_code == 200

    unauthenticated_target_write = await client.put(
        "/api/v1/dashboard/scrap/targets/2026/8",
        json={"currency": "USD", "amount": "1000.00"},
    )
    assert unauthenticated_target_write.status_code == 401


@pytest.mark.asyncio
async def test_scrap_list_exclude_reviewed(scrap_client: AsyncClient) -> None:
    response = await scrap_client.get("/api/v1/scrap", params={"exclude_reviewed": True})
    assert response.status_code == 200
    assert len(response.json()["items"]) > 0
