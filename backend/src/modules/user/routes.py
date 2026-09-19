from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, File, Query, UploadFile
from fastapi.responses import FileResponse
from fastcrud import PaginatedListResponse, compute_offset, paginated_response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from starlette.concurrency import run_in_threadpool

from ...infrastructure.auth.http_exceptions import HTTPException
from ...infrastructure.dependencies import (
    AsyncSessionDep,
    CurrentSuperUserDep,
    CurrentUserDep,
)
from ...infrastructure.logging import get_logger
from ..common.utils.error_handler import handle_exception
from .dependencies import ProfileImageStorageDep, UserServiceDep
from .profile_image import (
    ALLOWED_IMAGE_CONTENT_TYPES,
    DEFAULT_PROFILE_IMAGE_URL,
    ProfileImageValidationError,
)
from .schemas import (
    AdminUserUpdate,
    ProfileImageResponse,
    UserAdminPage,
    UserCreate,
    UserRead,
    UserStatusUpdate,
    UserTierUpdate,
    UserUpdate,
)

router = APIRouter(tags=["Users"])
logger = get_logger()

UNEXPECTED_ERROR_DETAIL = "An unexpected error occurred"


@router.get("/admin/all", response_model=UserAdminPage)
async def list_managed_users(
    db: AsyncSessionDep,
    _: CurrentSuperUserDep,
    page: Annotated[int, Query(ge=1)] = 1,
    items_per_page: Annotated[int, Query(ge=1, le=100)] = 25,
) -> dict[str, Any]:
    """Page through active and inactive accounts, excluding removed accounts."""
    from .models import User  # noqa: PLC0415

    visible = User.deleted_at.is_(None)
    total_items = (await db.execute(select(func.count(User.id)).where(visible))).scalar_one()
    result = await db.execute(
        select(User).where(visible).order_by(User.name, User.id)
        .offset((page - 1) * items_per_page).limit(items_per_page)
    )
    return {
        "items": list(result.scalars().all()),
        "total_items": total_items,
        "total_pages": (total_items + items_per_page - 1) // items_per_page,
        "page": page,
    }


@router.patch("/admin/{user_id}/status", response_model=UserRead)
async def set_managed_user_status(
    user_id: int, values: UserStatusUpdate, db: AsyncSessionDep, admin: CurrentSuperUserDep,
) -> Any:
    from .models import User  # noqa: PLC0415

    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.deleted_at is not None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin["id"]:
        raise HTTPException(status_code=403, detail="You cannot deactivate your own account")
    user.is_deleted = not values.is_active
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/admin/{user_id}", response_model=UserRead)
async def update_managed_user(
    user_id: int, values: AdminUserUpdate, db: AsyncSessionDep, admin: CurrentSuperUserDep,
) -> Any:
    """Update account identity and managed role together."""
    from .models import User  # noqa: PLC0415

    user = await db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin["id"] and values.role != "admin":
        raise HTTPException(status_code=403, detail="You cannot remove your own administrator access")

    user.name = values.name
    user.username = values.username
    user.email = str(values.email)
    user.role = values.role
    user.is_superuser = values.role == "admin"
    try:
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Username or email already exists") from error
    await db.refresh(user)
    return user


@router.delete("/admin/{user_id}", status_code=204)
async def remove_managed_user(user_id: int, db: AsyncSessionDep, admin: CurrentSuperUserDep) -> None:
    from .models import User  # noqa: PLC0415

    user = await db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin["id"]:
        raise HTTPException(status_code=403, detail="You cannot delete your own account")
    # Preserve references from reports and audit records.
    user.is_deleted = True
    user.deleted_at = datetime.now(UTC)
    await db.commit()


@router.post(
    "/",
    status_code=201,
    response_model=UserRead,
    summary="Create New User Account",
    description="""
           Creates a new user account in the system. Only administrators can
           provision accounts; public self-registration is disabled.

           This endpoint allows registration of new users with their basic information:
           - Full name
           - Username (must be lowercase alphanumeric)
           - Email address
           - Password (with security requirements)

           New accounts are automatically assigned to the default tier.
           """,
    responses={
        201: {"description": "User account created successfully"},
        400: {"description": "Invalid user data"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized - requires admin privileges"},
        409: {"description": "Username or email already exists"},
    },
    response_description="The created user profile with assigned ID",
)
async def create_user(
    user: UserCreate,
    db: AsyncSessionDep,
    _: CurrentSuperUserDep,
    user_service: UserServiceDep,
) -> dict[str, Any]:
    """Create a new user account (administrators only)."""
    try:
        created = await user_service.create(user, db)
        if user.role == "admin":
            from .models import User  # noqa: PLC0415

            created_model = await db.get(User, created["id"])
            if created_model is not None:
                created_model.is_superuser = True
                await db.commit()
                await db.refresh(created_model)
                return UserRead.model_validate(created_model, from_attributes=True).model_dump()
        return created
    except Exception as e:
        http_exception = handle_exception(e)
        if http_exception:
            raise http_exception
        raise HTTPException(status_code=500, detail=UNEXPECTED_ERROR_DETAIL)


@router.get(
    "/",
    response_model=PaginatedListResponse[UserRead],
    summary="List All Users (Admin)",
    description="""
           Retrieves a paginated list of all users in the system.

           This admin-only endpoint provides access to all user accounts and supports
           pagination to handle large numbers of users efficiently. The results include
           basic profile information for each user.

           For security reasons, sensitive information like passwords is never included
           in the response.
           """,
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized - requires admin privileges"},
    },
    response_description="A paginated list of users with total count and pagination metadata",
)
async def get_users(
    db: AsyncSessionDep,
    _: CurrentSuperUserDep,
    user_service: UserServiceDep,
    page: int = 1,
    items_per_page: int = 10,
) -> dict[str, Any]:
    """Get paginated list of all users (admin only)."""
    users_data = await user_service.get_paginated(skip=compute_offset(page, items_per_page), limit=items_per_page, db=db)

    return paginated_response(crud_data=users_data, page=page, items_per_page=items_per_page)


@router.get(
    "/me",
    response_model=UserRead,
    summary="Get Current User Profile",
    description="""
            Retrieves the profile information of the currently authenticated user.

            This endpoint provides users with their own profile data including:
            - Basic profile information (name, username, email)
            - Profile image URL
            - Subscription tier information
            - Authentication details (superuser status, email verification)

            This is a convenient way for frontend applications to get the current
            user's information for display or personalization purposes.
            """,
    responses={401: {"description": "Not authenticated"}},
    response_description="The current user's profile data",
)
async def get_current_user_profile(
    current_user: CurrentUserDep,
) -> dict[str, Any]:
    """Get current authenticated user's profile."""
    return current_user


@router.get(
    "/me/profile-image",
    response_class=FileResponse,
    summary="Read Current Profile Image",
    responses={401: {"description": "Not authenticated"}, 404: {"description": "Image not found"}},
)
async def get_current_profile_image(
    current_user: CurrentUserDep,
    image_storage: ProfileImageStorageDep,
) -> FileResponse:
    """Serve only the authenticated user's normalized profile image."""
    path = image_storage.resolve(int(current_user["id"]), current_user.get("profile_image_url"))
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="Profile image not found")

    return FileResponse(
        path,
        media_type="image/webp",
        headers={"Cache-Control": "private, max-age=31536000, immutable"},
    )


@router.put(
    "/me/profile-image",
    response_model=ProfileImageResponse,
    summary="Create or Replace Current Profile Image",
    responses={
        401: {"description": "Not authenticated"},
        413: {"description": "Image exceeds the configured size limit"},
        415: {"description": "Unsupported image media type"},
        422: {"description": "Invalid or unsafe image"},
    },
)
async def upsert_current_profile_image(
    image: Annotated[UploadFile, File(description="JPEG, PNG or WebP profile image")],
    current_user: CurrentUserDep,
    db: AsyncSessionDep,
    user_service: UserServiceDep,
    image_storage: ProfileImageStorageDep,
) -> ProfileImageResponse:
    """Normalize and atomically replace the authenticated user's image."""
    if image.content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported profile image type")

    try:
        payload = await image.read(image_storage.max_bytes + 1)
    finally:
        await image.close()

    if len(payload) > image_storage.max_bytes:
        raise HTTPException(status_code=413, detail="Profile image is too large")

    try:
        stored = await run_in_threadpool(image_storage.store, int(current_user["id"]), payload)
    except ProfileImageValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    previous_url = current_user.get("profile_image_url")
    try:
        await user_service.update(
            int(current_user["id"]),
            UserUpdate(profile_image_url=stored.url),
            db,
        )
    except Exception:
        await run_in_threadpool(image_storage.delete, int(current_user["id"]), stored.url)
        raise

    try:
        await run_in_threadpool(image_storage.delete, int(current_user["id"]), previous_url)
    except OSError:
        logger.warning("Unable to remove the replaced profile image for user_id=%s", current_user["id"])

    return ProfileImageResponse(profile_image_url=stored.url)


@router.delete(
    "/me/profile-image",
    response_model=ProfileImageResponse,
    summary="Remove Current Profile Image",
    responses={401: {"description": "Not authenticated"}},
)
async def delete_current_profile_image(
    current_user: CurrentUserDep,
    db: AsyncSessionDep,
    user_service: UserServiceDep,
    image_storage: ProfileImageStorageDep,
) -> ProfileImageResponse:
    """Clear the profile image reference and remove its private stored file."""
    previous_url = current_user.get("profile_image_url")
    await user_service.update(
        int(current_user["id"]),
        UserUpdate(profile_image_url=DEFAULT_PROFILE_IMAGE_URL),
        db,
    )

    try:
        await run_in_threadpool(image_storage.delete, int(current_user["id"]), previous_url)
    except OSError:
        logger.warning("Unable to remove the profile image for user_id=%s", current_user["id"])

    return ProfileImageResponse(profile_image_url=None)


@router.get(
    "/{username}",
    response_model=UserRead,
    summary="Get User Profile by Username",
    description="""
            Retrieves a user's profile information by their unique username.

            This endpoint lets authenticated users read their own profile and lets
            administrators read another user's profile. It returns the same profile
            data structure as the current-user endpoint.

            Note that usernames are case-sensitive in lookup operations.
            """,
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized"},
        404: {"description": "User not found"},
    },
    response_description="The requested user's profile data",
)
async def get_user_by_username(
    username: str,
    db: AsyncSessionDep,
    current_user: CurrentUserDep,
    user_service: UserServiceDep,
) -> dict[str, Any]:
    """Get a profile when the requester is its owner or an administrator."""
    try:
        await user_service.verify_user_permission(current_user, username, "view this profile")
        user = await user_service.get_by_username(username, db)
        if user is None:
            raise HTTPException(status_code=404, detail=f"User with username {username} not found")
        return user
    except Exception as e:
        http_exception = handle_exception(e)
        if http_exception:
            raise http_exception
        raise HTTPException(status_code=500, detail=UNEXPECTED_ERROR_DETAIL)


@router.get(
    "/active-and-inactive/{username}",
    response_model=UserRead,
    summary="Get Active and Inactive User Profile by Username(Admin)",
    description="""
            Retrieve a user's profile information by their unique username.

            This endpoint can be used to look up any user in the system by their
            username. It returns the same profile data structure as other user
            endpoints but does not include sensitive information.

            Note that usernames are case-sensitive in lookup operations.
            """,
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized - requires admin privileges"},
        404: {"description": "User not found"},
    },
    response_description="the requested user's profile data",
)
async def get_active_and_inactive_user_by_username(
    username: str,
    db: AsyncSessionDep,
    _: CurrentSuperUserDep,
    user_service: UserServiceDep,
) -> dict[str, Any]:
    """Get active and inactive profile by username."""
    try:
        user = await user_service.get_active_and_inactive_by_username(username, db)
        if user is None:
            raise HTTPException(status_code=404, detail=f"User with username {username} not found")
        return user
    except Exception as e:
        http_exception = handle_exception(e)
        if http_exception:
            raise http_exception
        raise HTTPException(status_code=500, detail=UNEXPECTED_ERROR_DETAIL)


@router.patch(
    "/{username}",
    summary="Update User Profile",
    description="""
            Updates a user's profile information.

            This endpoint allows users to modify their own profile data or administrators
            to modify any user's data. Only the fields provided in the request will be
            updated, and all fields are optional.

            Permission rules:
            - Regular users can only update their own profiles
            - Administrators can update any user's profile
            - Note: Tier updates are handled by a separate endpoint (/users/{username}/tier)

            Username and email changes are validated to ensure uniqueness.
            """,
    responses={
        200: {"description": "Profile updated successfully"},
        400: {"description": "Invalid profile data"},
        403: {"description": "Not authorized to update this profile"},
        404: {"description": "User not found"},
        409: {"description": "Username or email already exists"},
    },
    response_description="Success confirmation message",
)
async def update_user_profile(
    username: str,
    values: UserUpdate,
    current_user: CurrentUserDep,
    db: AsyncSessionDep,
    user_service: UserServiceDep,
) -> dict[str, str]:
    """Update user profile information."""
    try:
        await user_service.verify_user_permission(current_user, username, "update profile")
        user = await user_service.get_by_username(username, db)
        if user is None:
            raise HTTPException(status_code=404, detail=f"User with username {username} not found")

        await user_service.update(user["id"], values, db)
        return {"message": "User updated successfully"}
    except Exception as e:
        http_exception = handle_exception(e)
        if http_exception:
            raise http_exception
        raise HTTPException(status_code=500, detail=UNEXPECTED_ERROR_DETAIL)


@router.delete(
    "/{username}",
    summary="Deactivate User Account",
    description="""
            Soft-deletes (deactivates) a user account.

            This endpoint performs a logical deletion of a user account, marking it
            as deactivated in the system rather than permanently removing it. This allows
            for potential reactivation in the future.

            Permission rules:
            - Regular users can only deactivate their own accounts
            - Administrators can deactivate any user's account

            Deactivated accounts cannot be used for login and are typically hidden
            from regular user listings.
            """,
    responses={
        200: {"description": "Account deactivated successfully"},
        403: {"description": "Not authorized to deactivate this account"},
        404: {"description": "User not found"},
    },
    response_description="Success confirmation message",
)
async def delete_user_account(
    username: str,
    current_user: CurrentUserDep,
    db: AsyncSessionDep,
    user_service: UserServiceDep,
) -> dict[str, str]:
    """Soft delete a user account."""
    try:
        user = await user_service.get_by_username(username, db)
        if user is None:
            raise HTTPException(status_code=404, detail=f"User with username {username} not found")

        if user["is_superuser"]:
            raise HTTPException(status_code=403, detail="Superuser accounts cannot be deactivated")

        await user_service.verify_user_permission(current_user, username, "delete this account")
        await user_service.delete(user["id"], db)
        return {"message": "User account deactivated"}
    except Exception as e:
        http_exception = handle_exception(e)
        if http_exception:
            raise http_exception
        raise HTTPException(status_code=500, detail=UNEXPECTED_ERROR_DETAIL)


@router.delete(
    "/db/{username}",
    summary="GDPR Delete User (Admin)",
    description="""
            GDPR/LGPD compliant user deletion with data anonymization.

            This admin-only endpoint anonymizes user PII while preserving business data
            integrity and maintaining referential relationships for conversations and
            analytics data.

            This operation:
            - Removes personally identifiable information (PII)
            - Retains email for legal compliance purposes
            - Prevents future login by clearing credentials
            - Maintains foreign key relationships (conversations, logs)
            - Logs the deletion event with legal basis for audit compliance

            Unlike hard deletion, this approach:
            - Complies with GDPR Article 17 (Right to Erasure)
            - Preserves business analytics data
            - Eliminates foreign key constraint violations
            - Maintains audit trails for legal requirements

            This operation is needed for:
            - GDPR/LGPD data deletion requests
            - Legal compliance while preserving business data
            - Safe user removal without breaking referential integrity
            """,
    responses={
        200: {"description": "User anonymized successfully"},
        403: {"description": "Not authorized - requires admin privileges"},
        404: {"description": "User not found"},
    },
    response_description="Success confirmation message",
)
async def gdpr_delete_user(
    username: str,
    db: AsyncSessionDep,
    user_service: UserServiceDep,
    _: CurrentSuperUserDep,
) -> dict[str, str]:
    """GDPR compliant user anonymization (admin only)."""
    try:
        user = await user_service.get_active_and_inactive_by_username(username, db)
        if user is None:
            raise HTTPException(status_code=404, detail=f"User with username {username} not found")
        if user["is_superuser"]:
            raise HTTPException(status_code=403, detail="Superuser accounts cannot be deleted")
        await user_service.anonymize_user(user["id"], db)
        return {"message": "User data anonymized in compliance with GDPR"}
    except Exception as e:
        http_exception = handle_exception(e)
        if http_exception:
            raise http_exception
        raise HTTPException(status_code=500, detail=UNEXPECTED_ERROR_DETAIL)


@router.get(
    "/{username}/rate-limits",
    summary="Get User Rate Limits",
    description="""
            Retrieves the rate limit configuration for a specific user.

            This endpoint returns detailed information about API rate limits
            applicable to the user based on their subscription tier. This includes
            limits for different API endpoints and operations.

            Permission rules:
            - Users can view their own rate limits
            - Administrators can view any user's rate limits

            This is useful for applications to understand their usage allowances
            and implement appropriate client-side throttling.
            """,
    responses={
        200: {"description": "Rate limit information retrieved"},
        403: {"description": "Not authorized to view these rate limits"},
        404: {"description": "User not found"},
    },
    response_description="Detailed rate limit configuration for the user",
)
async def get_user_rate_limits(
    username: str,
    db: AsyncSessionDep,
    current_user: CurrentUserDep,
    user_service: UserServiceDep,
) -> dict[str, Any]:
    """Get rate limits for a user."""
    try:
        await user_service.verify_user_permission(current_user, username, "view rate limits")
        user = await user_service.get_by_username(username, db)
        if user is None:
            raise HTTPException(status_code=404, detail=f"User with username {username} not found")
        return await user_service.get_rate_limits(user["id"], db)
    except Exception as e:
        http_exception = handle_exception(e)
        if http_exception:
            raise http_exception
        raise HTTPException(status_code=500, detail=UNEXPECTED_ERROR_DETAIL)


@router.get(
    "/{username}/tier",
    summary="Get User Subscription Tier",
    description="""
            Retrieves detailed information about a user's subscription tier.

            This endpoint returns comprehensive data about the user's current
            subscription tier, including name, features, limitations, and any
            custom configurations.

            Permission rules:
            - Users can view their own tier information
            - Administrators can view any user's tier information

            This is useful for displaying subscription information to users
            or for determining available features in client applications.
            """,
    responses={
        200: {"description": "Tier information retrieved"},
        403: {"description": "Not authorized to view this tier information"},
        404: {"description": "User not found"},
    },
    response_description="User profile with detailed tier information",
)
async def get_user_tier(
    username: str,
    db: AsyncSessionDep,
    current_user: CurrentUserDep,
    user_service: UserServiceDep,
) -> dict[str, Any]:
    """Get detailed tier information for a user."""
    try:
        await user_service.verify_user_permission(current_user, username, "view tier information")

        user = await user_service.get_by_username(username, db)
        if user is None:
            raise HTTPException(status_code=404, detail=f"User with username {username} not found")
        return await user_service.get_user_with_tier(user["id"], db)
    except Exception as e:
        http_exception = handle_exception(e)
        if http_exception:
            raise http_exception
        raise HTTPException(status_code=500, detail=UNEXPECTED_ERROR_DETAIL)


@router.patch(
    "/{username}/tier",
    summary="Update User Subscription Tier (Admin)",
    description="""
            Changes a user's subscription tier.

            This admin-only endpoint allows changing which subscription tier
            a user is assigned to. This affects the user's:
            - API rate limits
            - Available features
            - Access privileges

            When a user's tier is changed, all related configurations (such as
            rate limits) are automatically updated based on the new tier's settings.
            """,
    responses={
        200: {"description": "User tier updated successfully"},
        400: {"description": "Invalid tier ID"},
        403: {"description": "Not authorized - requires admin privileges"},
        404: {"description": "User not found or tier not found"},
    },
    response_description="Success confirmation message",
)
async def update_user_tier(
    username: str,
    values: UserTierUpdate,
    db: AsyncSessionDep,
    user_service: UserServiceDep,
    _: CurrentSuperUserDep,
) -> dict[str, str]:
    """Update a user's subscription tier (admin only)."""
    try:
        user = await user_service.get_by_username(username, db)
        if user is None:
            raise HTTPException(status_code=404, detail=f"User with username {username} not found")
        await user_service.update_tier(user["id"], values, db)
        return {"message": "User tier updated successfully"}
    except Exception as e:
        http_exception = handle_exception(e)
        if http_exception:
            raise http_exception
        raise HTTPException(status_code=500, detail=UNEXPECTED_ERROR_DETAIL)
