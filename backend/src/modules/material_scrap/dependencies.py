from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from ...infrastructure.config.settings import settings
from ...infrastructure.dependencies import AsyncSessionDep
from ..api_keys.dependencies import APIKeyServiceDep
from ..api_keys.enums import KeyPermissionAction, KeyPermissionResource
from .classification_service import ScrapClassificationService
from .dashboard_service import ScrapDashboardService
from .review_image import ScrapReviewImageStorage
from .target_service import ScrapTargetService


async def require_material_scrap_ingestion_key(
    db: AsyncSessionDep,
    api_key_service: APIKeyServiceDep,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> int:
    if not x_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="X-API-Key is required")
    validation = await api_key_service.validate_api_key(
        x_api_key,
        KeyPermissionResource.MATERIAL_SCRAP.value,
        KeyPermissionAction.CREATE.value,
        db,
    )
    if not validation.is_valid:
        denied = (validation.error_message or "").startswith("No permission")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN if denied else status.HTTP_401_UNAUTHORIZED,
            detail=validation.error_message or "Invalid API key",
        )
    if validation.api_key_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    return validation.api_key_id


MaterialScrapIngestionKeyDep = Annotated[int, Depends(require_material_scrap_ingestion_key)]


@lru_cache
def get_scrap_dashboard_service() -> ScrapDashboardService:
    return ScrapDashboardService()


@lru_cache
def get_scrap_classification_service() -> ScrapClassificationService:
    return ScrapClassificationService()


@lru_cache
def get_scrap_target_service() -> ScrapTargetService:
    return ScrapTargetService()


@lru_cache
def get_scrap_review_image_storage() -> ScrapReviewImageStorage:
    return ScrapReviewImageStorage(
        directory=settings.SCRAP_REVIEW_IMAGE_DIR,
        max_bytes=settings.SCRAP_REVIEW_IMAGE_MAX_BYTES,
        max_dimension=settings.SCRAP_REVIEW_IMAGE_MAX_DIMENSION,
        max_attachments=settings.SCRAP_REVIEW_MAX_ATTACHMENTS,
    )


ScrapDashboardServiceDep = Annotated[ScrapDashboardService, Depends(get_scrap_dashboard_service)]
ScrapClassificationServiceDep = Annotated[ScrapClassificationService, Depends(get_scrap_classification_service)]
ScrapTargetServiceDep = Annotated[ScrapTargetService, Depends(get_scrap_target_service)]
ScrapReviewImageStorageDep = Annotated[ScrapReviewImageStorage, Depends(get_scrap_review_image_storage)]
