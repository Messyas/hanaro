from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...infrastructure.auth.dependencies import get_current_user
from ...infrastructure.database.session import async_session
from .production_schemas import (
    ProductionMeasurementBatchWrite,
    ProductionMeasurementClearWrite,
    ProductionMeasurementRead,
)
from .production_service import (
    ProductionMeasurementConflictError,
    clear_production_measurements,
    list_production_measurements,
    save_production_measurements,
)

router = APIRouter(prefix="/production-measurements", tags=["Production Measurements"])
DbDep = Annotated[AsyncSession, Depends(async_session)]
CurrentUserDep = Annotated[dict, Depends(get_current_user)]


def _read_model(item) -> ProductionMeasurementRead:
    return ProductionMeasurementRead.model_validate(item)


@router.get("", response_model=list[ProductionMeasurementRead])
async def list_measurements(
    year: Annotated[int, Query(ge=2000, le=2200)],
    db: DbDep,
    _: CurrentUserDep,
) -> list[ProductionMeasurementRead]:
    return [_read_model(item) for item in await list_production_measurements(db, year)]


@router.put("/{year}", response_model=list[ProductionMeasurementRead], status_code=status.HTTP_200_OK)
async def save_measurements(
    year: Annotated[int, Path(ge=2000, le=2200)],
    payload: ProductionMeasurementBatchWrite,
    db: DbDep,
    current_user: CurrentUserDep,
) -> list[ProductionMeasurementRead]:
    try:
        rows = await save_production_measurements(
            db,
            year=year,
            currency=payload.currency,
            measurements=payload.measurements,
            author_id=int(current_user["id"]),
        )
    except ProductionMeasurementConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    return [_read_model(item) for item in rows]


@router.delete("/{year}", status_code=status.HTTP_204_NO_CONTENT)
async def clear_measurements(
    year: Annotated[int, Path(ge=2000, le=2200)],
    payload: ProductionMeasurementClearWrite,
    db: DbDep,
    _: CurrentUserDep,
) -> Response:
    try:
        await clear_production_measurements(
            db,
            year=year,
            expected_versions=payload.expected_versions,
        )
    except ProductionMeasurementConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
