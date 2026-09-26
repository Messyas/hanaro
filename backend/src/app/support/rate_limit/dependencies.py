from typing import Annotated

from fastapi import Depends

from src.app.services.rate_limit.service import RateLimitService


def get_rate_limit_service() -> RateLimitService:
    return RateLimitService()


RateLimitServiceDep = Annotated[RateLimitService, Depends(get_rate_limit_service)]
