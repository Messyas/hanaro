from collections.abc import AsyncGenerator
from datetime import UTC, date, datetime
from io import BytesIO
from pathlib import Path

import pytest
import pytest_asyncio
from fastapi import APIRouter, FastAPI
from httpx import ASGITransport, AsyncClient
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.infrastructure.auth.dependencies import get_current_superuser, get_current_user
from src.infrastructure.database.session import Base, async_session
from src.modules.material_scrap.dependencies import get_scrap_review_image_storage
from src.modules.material_scrap.models import ScrapOccurrence
from src.modules.material_scrap.review_image import ScrapReviewImageStorage
from src.modules.material_scrap.routes import scrap_router
from src.modules.user.models import User


@pytest_asyncio.fixture
async def review_client(tmp_path: Path) -> AsyncGenerator[tuple[AsyncClient, list[str]], None]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    session = factory()
    user = User(
        name="Analyst User",
        username="analyst",
        email="analyst@example.com",
        hashed_password="not-used-in-test",
    )
    session.add(user)
    await session.flush()
    now = datetime.now(UTC)
    occurrences = [
        ScrapOccurrence(
            record_key=f"{index:064x}",
            record_key_version="v1",
            identity_slot=1,
            organization_code="NWK",
            transaction_date=date(2026, 8, 26),
            first_seen_at=now,
            last_seen_at=now,
            created_at=now,
            updated_at=now,
        )
        for index in range(1, 5)
    ]
    session.add_all(occurrences)
    await session.commit()

    app = FastAPI()
    router = APIRouter(prefix="/api/v1")
    router.include_router(scrap_router, prefix="/scrap")
    app.include_router(router)

    async def override_session() -> AsyncGenerator[AsyncSession, None]:
        yield session

    async def authenticated_user() -> dict[str, object]:
        return {
            "id": user.id,
            "name": user.name,
            "username": user.username,
            "is_superuser": True,
        }

    storage = ScrapReviewImageStorage(str(tmp_path), 1024 * 1024, 4096, max_attachments=3)
    app.dependency_overrides[async_session] = override_session
    app.dependency_overrides[get_current_user] = authenticated_user
    app.dependency_overrides[get_current_superuser] = authenticated_user
    app.dependency_overrides[get_scrap_review_image_storage] = lambda: storage
    ids = [str(item.id) for item in occurrences]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        yield client, ids
    await session.close()
    await engine.dispose()


@pytest.mark.asyncio
async def test_review_draft_finalize_and_immutable_contract(
    review_client: tuple[AsyncClient, list[str]],
) -> None:
    client, occurrences = review_client
    defect_response = await client.post(
        "/api/v1/scrap/review-types",
        json={"code": "PROCESS", "name": "Process defect", "display_order": 1},
    )
    assert defect_response.status_code == 201
    defect_type_id = defect_response.json()["id"]

    draft = await client.put(
        f"/api/v1/scrap/reviews/{occurrences[0]}",
        json={
            "defect_type_id": defect_type_id,
            "title": "Observed process defect",
            "description": "Evidence and analysis for this occurrence.",
        },
    )
    assert draft.status_code == 200
    assert draft.json()["status"] == "DRAFT"
    assert draft.json()["responsible_name"] == "Analyst User"
    assert draft.json()["version"] == 1

    finalized = await client.post(
        f"/api/v1/scrap/reviews/{occurrences[0]}/finalize",
        params={"expected_version": 1},
    )
    assert finalized.status_code == 200
    assert finalized.json()["status"] == "REVIEWED"
    assert finalized.json()["version"] == 2

    immutable = await client.put(
        f"/api/v1/scrap/reviews/{occurrences[0]}",
        json={"title": "Changed", "description": "Changed", "expected_version": 2},
    )
    assert immutable.status_code == 409


@pytest.mark.asyncio
async def test_bulk_clones_reference_and_skips_existing_review(
    review_client: tuple[AsyncClient, list[str]],
) -> None:
    client, occurrences = review_client
    defect_type_id = (
        await client.post(
            "/api/v1/scrap/review-types",
            json={"code": "MATERIAL", "name": "Material defect"},
        )
    ).json()["id"]
    reference = (
        await client.put(
            f"/api/v1/scrap/reviews/{occurrences[0]}",
            json={
                "defect_type_id": defect_type_id,
                "title": "Reference title",
                "description": "Reference description",
            },
        )
    ).json()
    await client.post(f"/api/v1/scrap/reviews/{occurrences[0]}/finalize")

    response = await client.post(
        "/api/v1/scrap/reviews/bulk",
        json={
            "reference_review_id": reference["id"],
            "occurrence_ids": occurrences[:3],
            "copy_attachments": False,
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["created_count"] == 2
    assert body["skipped_count"] == 1
    assert body["skipped"][0]["reason"] == "ALREADY_REVIEWED"

    cloned = (await client.get(f"/api/v1/scrap/reviews/{occurrences[1]}")).json()
    assert cloned["status"] == "REVIEWED"
    assert cloned["source_review_id"] == reference["id"]
    assert cloned["bulk_operation_id"] == body["operation_id"]


@pytest.mark.asyncio
async def test_private_attachment_lifecycle(review_client: tuple[AsyncClient, list[str]]) -> None:
    client, occurrences = review_client
    review = (
        await client.put(
            f"/api/v1/scrap/reviews/{occurrences[3]}",
            json={"title": "Draft with evidence", "description": "Pending classification"},
        )
    ).json()
    image_bytes = BytesIO()
    Image.new("RGB", (16, 12), color=(180, 20, 40)).save(image_bytes, format="PNG")
    uploaded = await client.post(
        f"/api/v1/scrap/reviews/by-id/{review['id']}/attachments",
        files={"image": ("evidence.png", image_bytes.getvalue(), "image/png")},
    )
    assert uploaded.status_code == 201
    attachment = uploaded.json()
    assert attachment["content_type"] == "image/webp"
    assert attachment["width"] == 16
    assert attachment["height"] == 12

    content = await client.get(attachment["url"])
    assert content.status_code == 200
    assert content.headers["content-type"].startswith("image/webp")

    second = await client.post(
        f"/api/v1/scrap/reviews/by-id/{review['id']}/attachments",
        files={"image": ("second.png", image_bytes.getvalue(), "image/png")},
    )
    assert second.status_code == 201
    deleted = await client.delete(attachment["url"])
    assert deleted.status_code == 204
    assert (await client.get(attachment["url"])).status_code == 404
    remaining = (await client.get(f"/api/v1/scrap/reviews/{occurrences[3]}")).json()["attachments"]
    assert len(remaining) == 1
    assert remaining[0]["position"] == 1
