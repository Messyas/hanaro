from decimal import Decimal
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.material_scrap.service import ingest_material_scrap
from src.modules.material_scrap.simulator import simulate_smart_office_output

FIXTURE = Path(__file__).parents[5] / "fixtures" / "Other_Account_Transaction_Text_anonymized"


@pytest.fixture
async def loaded_scrap(db_session: AsyncSession) -> None:
    await ingest_material_scrap(simulate_smart_office_output(FIXTURE, Decimal("5.15")), db_session)


@pytest.mark.asyncio
async def test_scrap_listing_pagination_filters_search_and_sort_validation(client: AsyncClient, loaded_scrap: None) -> None:
    response = await client.get(
        "/api/v1/scrap",
        params=[("organizations", "NWK"), ("page", "1"), ("page_size", "2"), ("sort_by", "item_code")],
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total_items"] == 3
    assert body["total_pages"] == 2
    assert len(body["items"]) == 2

    raw_sector = await client.get("/api/v1/scrap", params={"receipt_departments": "NOVO_SETOR"})
    assert raw_sector.json()["items"][0]["department"] is None
    search = await client.get("/api/v1/scrap", params={"search": "linha inicial"})
    assert search.json()["total_items"] == 1
    invalid_sort = await client.get("/api/v1/scrap", params={"sort_by": "drop_table"})
    assert invalid_sort.status_code == 422


@pytest.mark.asyncio
async def test_filter_options_and_dashboard_queries(client: AsyncClient, loaded_scrap: None) -> None:
    options = (await client.get("/api/v1/scrap/filters")).json()
    assert {"NWK", "NW1", "NW4", "NQX"}.issubset(options["organizations"])
    assert "NOVO_SETOR" in options["receipt_departments"]

    summary = (await client.get("/api/v1/dashboard/scrap/summary")).json()
    assert summary["total_records"] == 6
    assert summary["total_issue_amount_brl"] == "246.50"
    assert summary["total_amount_usd"] == "47.864079"
    assert summary["counted_records"] == 4
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
async def test_multiple_organization_and_derived_department_filters(client: AsyncClient, loaded_scrap: None) -> None:
    organizations = await client.get(
        "/api/v1/scrap",
        params=[("organizations", "NWK"), ("organizations", "NW1")],
    )
    assert organizations.json()["total_items"] == 4
    department = await client.get("/api/v1/scrap", params={"departments": "Quality"})
    assert department.json()["total_items"] == 1
