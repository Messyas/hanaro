from collections.abc import AsyncGenerator
from datetime import UTC, date, datetime
from pathlib import Path

import pytest
import pytest_asyncio
from fastapi import APIRouter, FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.infrastructure.auth.dependencies import get_current_superuser, get_current_user
from src.infrastructure.database.session import Base, async_session
from src.modules.material_scrap.dependencies import get_scrap_review_image_storage
from src.modules.material_scrap.models import ScrapOccurrence
from src.modules.material_scrap.review_image import ScrapReviewImageStorage
from src.modules.material_scrap.routes import scrap_router
from src.modules.user.models import User


@pytest_asyncio.fixture
async def template_client(
    tmp_path: Path,
) -> AsyncGenerator[tuple[AsyncClient, list[str], FastAPI, AsyncSession, int], None]:
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
        for index in range(1, 6)
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
        yield client, ids, app, session, user.id
    await session.close()
    await engine.dispose()


@pytest.mark.asyncio
async def test_editable_template_lifecycle_and_author_permissions(
    template_client: tuple[AsyncClient, list[str], FastAPI, AsyncSession, int],
) -> None:
    client, occurrences, app, session, author_id = template_client

    # 1. Criar tipo de defeito
    defect_resp = await client.post(
        "/api/v1/scrap/review-types",
        json={"code": "SMT_OXID", "name": "Oxidação SMT", "display_order": 1},
    )
    assert defect_resp.status_code == 201
    defect_type_id = defect_resp.json()["id"]

    # 2. Criar e finalizar uma análise modelo na ocorrência 0
    await client.put(
        f"/api/v1/scrap/reviews/{occurrences[0]}",
        json={
            "defect_type_id": defect_type_id,
            "title": "Oxidação de trilha por umidade",
            "description": "Corrosão verificada nos pinos 3 e 4 da placa mãe.",
        },
    )
    finalized = await client.post(
        f"/api/v1/scrap/reviews/{occurrences[0]}/finalize",
        params={"expected_version": 1},
    )
    assert finalized.status_code == 200
    source_review_id = finalized.json()["id"]

    # 3. Criar template favorito (❤️) vinculado a esta análise
    create_tpl_resp = await client.post(
        "/api/v1/scrap/reviews/templates",
        json={
            "name": "Padrão de Oxidação SMT",
            "source_review_id": source_review_id,
        },
    )
    assert create_tpl_resp.status_code == 201
    tpl_data = create_tpl_resp.json()
    assert tpl_data["name"] == "Padrão de Oxidação SMT"
    assert tpl_data["title"] == "Oxidação de trilha por umidade"
    assert tpl_data["description"] == "Corrosão verificada nos pinos 3 e 4 da placa mãe."
    template_id = tpl_data["id"]

    # 4. Editar o modelo como um preset independente do relatório fonte
    edited_tpl_resp = await client.patch(
        f"/api/v1/scrap/reviews/templates/{template_id}",
        json={
            "name": "Padrão SMT refinado",
            "title": "Oxidação confirmada no processo",
            "description": "Aplicar inspeção visual e registrar a causa raiz.",
            "defect_type_id": defect_type_id,
        },
    )
    assert edited_tpl_resp.status_code == 200
    assert edited_tpl_resp.json()["name"] == "Padrão SMT refinado"

    # 5. Outro usuário não vê nem edita o modelo e não altera o relatório finalizado
    other_user = User(
        name="Other Analyst",
        username="other.analyst",
        email="other.analyst@example.com",
        hashed_password="not-used-in-test",
    )
    session.add(other_user)
    await session.commit()

    async def other_authenticated_user() -> dict[str, object]:
        return {
            "id": other_user.id,
            "name": other_user.name,
            "username": other_user.username,
            "is_superuser": False,
        }

    app.dependency_overrides[get_current_user] = other_authenticated_user
    assert (await client.get("/api/v1/scrap/reviews/templates")).json() == []
    forbidden_template = await client.patch(
        f"/api/v1/scrap/reviews/templates/{template_id}",
        json={"name": "Tentativa sem permissão"},
    )
    assert forbidden_template.status_code == 403
    forbidden_report = await client.put(
        f"/api/v1/scrap/reviews/{occurrences[0]}",
        json={"title": "Tentativa", "description": "Sem permissão", "expected_version": 2},
    )
    assert forbidden_report.status_code == 403

    async def author_authenticated_user() -> dict[str, object]:
        return {
            "id": author_id,
            "name": "Analyst User",
            "username": "analyst",
            "is_superuser": True,
        }

    app.dependency_overrides[get_current_user] = author_authenticated_user

    # 6. Listar templates e checar se o modelo editado aparece
    list_resp = await client.get("/api/v1/scrap/reviews/templates")
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert len(items) == 1
    assert items[0]["id"] == template_id
    assert items[0]["title"] == "Oxidação confirmada no processo"

    # 7. Aplicar o modelo editado nas ocorrências selecionadas
    bulk_resp = await client.post(
        "/api/v1/scrap/reviews/bulk",
        json={
            "template_id": template_id,
            "occurrence_ids": [occurrences[1], occurrences[2], occurrences[3]],
            "copy_attachments": False,
        },
    )
    assert bulk_resp.status_code == 201
    bulk_data = bulk_resp.json()
    assert bulk_data["created_count"] == 3
    assert bulk_data["skipped_count"] == 0

    # O relatório gerado usa o conteúdo do preset editado, preservando a origem para auditoria.
    rev1 = await client.get(f"/api/v1/scrap/reviews/{occurrences[1]}")
    assert rev1.status_code == 200
    assert rev1.json()["status"] == "REVIEWED"
    assert rev1.json()["title"] == "Oxidação confirmada no processo"
    assert rev1.json()["description"] == "Aplicar inspeção visual e registrar a causa raiz."
    assert rev1.json()["source_review_id"] == source_review_id

    # 8. Remover (desfavoritar) o modelo
    del_resp = await client.delete(f"/api/v1/scrap/reviews/templates/{template_id}")
    assert del_resp.status_code == 204

    # Verificar que lista de templates agora está vazia
    list_after_del = await client.get("/api/v1/scrap/reviews/templates")
    assert len(list_after_del.json()) == 0

    # Relatórios já gerados continuam independentes após remover o modelo.
    assert (await client.get(f"/api/v1/scrap/reviews/{occurrences[1]}")).json()["title"] == ("Oxidação confirmada no processo")
    source_rev = await client.get(f"/api/v1/scrap/reviews/{occurrences[0]}")
    assert source_rev.status_code == 200
    assert source_rev.json()["status"] == "REVIEWED"
