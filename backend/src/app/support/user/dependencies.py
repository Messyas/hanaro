from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from src.app.services.user.service import UserService
from src.app.support.user.profile_image import ProfileImageStorage
from src.infrastructure.config.settings import settings


def get_user_service() -> UserService:
    return UserService()


UserServiceDep = Annotated[UserService, Depends(get_user_service)]


@lru_cache
def get_profile_image_storage() -> ProfileImageStorage:
    return ProfileImageStorage(
        directory=settings.PROFILE_IMAGE_DIR,
        max_bytes=settings.PROFILE_IMAGE_MAX_BYTES,
        max_dimension=settings.PROFILE_IMAGE_MAX_DIMENSION,
    )


ProfileImageStorageDep = Annotated[ProfileImageStorage, Depends(get_profile_image_storage)]
