from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from ...infrastructure.config.settings import settings
from .profile_image import ProfileImageStorage
from .service import UserService


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
