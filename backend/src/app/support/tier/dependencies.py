from typing import Annotated

from fastapi import Depends

from src.app.services.tier.service import TierService


def get_tier_service() -> TierService:
    return TierService()


TierServiceDep = Annotated[TierService, Depends(get_tier_service)]
