import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.material_scrap.service import ingest_material_scrap
from tests.unit.modules.material_scrap.helpers import canonical_fixture


@pytest.fixture
async def loaded_scrap(db_session: AsyncSession) -> None:
    await ingest_material_scrap(canonical_fixture(), db_session)


@pytest.mark.asyncio
async def test_scrap_listing_requires_authentication(client: AsyncClient, loaded_scrap: None) -> None:
    response = await client.get("/api/v1/scrap")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_scrap_listing_pagination_filters_search_and_sort_validation(
    auth_client: AsyncClient, loaded_scrap: None
) -> None:
    response = await auth_client.get(
        "/api/v1/scrap",
        params=[("organizations", "NWK"), ("page", "1"), ("page_size", "2"), ("sort_by", "item_code")],
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total_items"] == 3
    assert body["total_pages"] == 2
    assert len(body["items"]) == 2

    search = await auth_client.get("/api/v1/scrap", params={"search": "linha inicial"})
    assert search.json()["total_items"] == 1
    invalid_sort = await auth_client.get("/api/v1/scrap", params={"sort_by": "drop_table"})
    assert invalid_sort.status_code == 422


@pytest.mark.asyncio
async def test_filter_options_and_dashboard_queries(client: AsyncClient, loaded_scrap: None) -> None:
    options = (await client.get("/api/v1/scrap/filters")).json()
    assert {"NWK", "NW1", "NW4", "NQX"}.issubset(options["organizations"])
    assert options["account_aliases"]

    summary = (await client.get("/api/v1/dashboard/scrap/summary")).json()
    assert summary["total_records"] == 6
    assert summary["total_issue_amount_brl"] == "246.50"
    assert summary["exchange_rate_used"] == "5.150000"

    trend = (await client.get("/api/v1/dashboard/scrap/trend", params={"group_by": "day"})).json()
    assert sum(point["record_count"] for point in trend) == 6
    breakdown = (
        await client.get(
            "/api/v1/dashboard/scrap/breakdown",
            params={"group_by": "organization", "metric": "records"},
        )
    ).json()
    assert sum(item["record_count"] for item in breakdown) == 6


@pytest.mark.asyncio
async def test_multiple_organization_and_derived_department_filters(auth_client: AsyncClient, loaded_scrap: None) -> None:
    organizations = await auth_client.get(
        "/api/v1/scrap",
        params=[("organizations", "NWK"), ("organizations", "NW1")],
    )
    assert organizations.json()["total_items"] == 4
    unmapped = await auth_client.get("/api/v1/scrap", params={"to_be_counted": "unmapped"})
    assert unmapped.json()["total_items"] == 6


@pytest.mark.asyncio
async def test_superuser_manages_target_and_dashboard_consumes_it(
    superuser_auth_client: AsyncClient,
    loaded_scrap: None,
) -> None:
    created = await superuser_auth_client.put(
        "/api/v1/dashboard/scrap/targets/2026/8",
        json={"currency": "USD", "amount": "1000.000000"},
    )
    assert created.status_code == 200
    assert created.json()["amount"] == "1000.000000"

    updated = await superuser_auth_client.put(
        "/api/v1/dashboard/scrap/targets/2026/8",
        json={"currency": "USD", "amount": "900.000000"},
    )
    assert updated.status_code == 200
    targets = (await superuser_auth_client.get("/api/v1/dashboard/scrap/targets", params={"year": 2026})).json()
    assert len(targets) == 1
    assert targets[0]["amount"] == "900.000000"

    dashboard = (
        await superuser_auth_client.get(
            "/api/v1/dashboard/scrap",
            params={"year": 2026, "currency": "USD"},
        )
    ).json()
    assert dashboard["kpis"]["target"] == "900.000000"
    assert dashboard["monthly"][7]["target"] == "900.000000"
