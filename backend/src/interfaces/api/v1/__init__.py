from fastapi import APIRouter

from ....infrastructure.auth.routes import router as auth_router
from ....modules.api_keys.routes import router as api_keys_router
from ....modules.governance.routes import exports_router
from ....modules.governance.routes import router as reports_router
from ....modules.governance.workflow_routes import router as workflow_router
from ....modules.material_scrap.routes import dashboard_router as scrap_dashboard_router
from ....modules.material_scrap.routes import scrap_router
from ....modules.rate_limit.routes import router as rate_limits_router
from ....modules.tier.routes import router as tiers_router
from ....modules.user.routes import router as users_router

router = APIRouter(prefix="/v1")
router.include_router(users_router, prefix="/users")
router.include_router(tiers_router, prefix="/tiers")
router.include_router(rate_limits_router, prefix="/rate-limits")
router.include_router(auth_router, prefix="/auth")
router.include_router(api_keys_router, prefix="/api-keys")
router.include_router(scrap_router, prefix="/scrap")
router.include_router(scrap_dashboard_router, prefix="/dashboard/scrap")
router.include_router(reports_router, prefix="/reports")
router.include_router(exports_router)
router.include_router(workflow_router)
