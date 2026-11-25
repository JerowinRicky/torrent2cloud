from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.torrents import router as torrents_router
from app.api.v1.telemetry import router as telemetry_router
from app.api.v1.files import router as files_router
from app.api.v1.downloads import router as downloads_router
from app.api.v1.monitoring import router as monitoring_router
from app.api.v1.admin import router as admin_router

api_router = APIRouter(prefix="/v1")
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(torrents_router)
api_router.include_router(telemetry_router)
api_router.include_router(files_router, prefix="/files", tags=["files"])
api_router.include_router(downloads_router, prefix="/downloads", tags=["downloads"])
api_router.include_router(monitoring_router, prefix="/monitoring", tags=["monitoring"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])


