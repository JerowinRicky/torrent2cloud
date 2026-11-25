import time
import shutil
import platform
import psutil
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis

from app.core.database import get_db
from app.core.redis import get_redis
from app.config import settings
from app.core.logging import logger

router = APIRouter(prefix="/health", tags=["Health"])

START_TIME = time.time()

@router.get("", summary="Comprehensive System Health Check")
async def health_check(
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis)
):
    """
    Checks health of the API server, PostgreSQL database, Redis message broker,
    and storage disk availability.
    """
    health_data = {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "uptime_seconds": round(time.time() - START_TIME, 2),
        "timestamp": int(time.time()),
        "components": {
            "database": {"status": "unknown"},
            "redis": {"status": "unknown"},
            "storage": {"status": "unknown"},
        },
        "system": {
            "python_version": platform.python_version(),
            "cpu_percent": psutil.cpu_percent(interval=None),
            "memory_percent": psutil.virtual_memory().percent,
        }
    }

    all_healthy = True

    # 1. Database Check
    try:
        db_start = time.perf_counter()
        result = await db.execute(text("SELECT 1"))
        db_latency_ms = round((time.perf_counter() - db_start) * 1000, 2)
        if result.scalar() == 1:
            health_data["components"]["database"] = {
                "status": "healthy",
                "latency_ms": db_latency_ms
            }
        else:
            all_healthy = False
            health_data["components"]["database"] = {
                "status": "degraded",
                "error": "Unexpected query response"
            }
    except Exception as e:
        all_healthy = False
        logger.error(f"Healthcheck Database failure: {e}")
        health_data["components"]["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }

    # 2. Redis Check
    try:
        redis_start = time.perf_counter()
        pong = await redis.ping()
        redis_latency_ms = round((time.perf_counter() - redis_start) * 1000, 2)
        if pong:
            health_data["components"]["redis"] = {
                "status": "healthy",
                "latency_ms": redis_latency_ms
            }
        else:
            all_healthy = False
            health_data["components"]["redis"] = {
                "status": "degraded",
                "error": "Redis did not respond to PING"
            }
    except Exception as e:
        all_healthy = False
        logger.error(f"Healthcheck Redis failure: {e}")
        health_data["components"]["redis"] = {
            "status": "unhealthy",
            "error": str(e)
        }

    # 3. Storage Disk Check
    try:
        storage_paths = settings.get_absolute_storage_paths()
        completed_path = storage_paths["completed"]
        disk_usage = shutil.disk_usage(completed_path)
        
        health_data["components"]["storage"] = {
            "status": "healthy",
            "mount_path": str(completed_path),
            "total_bytes": disk_usage.total,
            "used_bytes": disk_usage.used,
            "free_bytes": disk_usage.free,
            "free_gigabytes": round(disk_usage.free / (1024 ** 3), 2),
            "usage_percent": round((disk_usage.used / disk_usage.total) * 100, 2)
        }
        
        # Mark degraded if less than 2 GB remaining
        if disk_usage.free < 2 * 1024 * 1024 * 1024:
            all_healthy = False
            health_data["components"]["storage"]["status"] = "low_disk_warning"
    except Exception as e:
        all_healthy = False
        logger.error(f"Healthcheck Storage failure: {e}")
        health_data["components"]["storage"] = {
            "status": "unhealthy",
            "error": str(e)
        }

    health_data["status"] = "healthy" if all_healthy else "degraded"
    status_code = status.HTTP_200_OK if all_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(status_code=status_code, content=health_data)
