import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.core.logging import setup_logging, logger
from app.core.redis import init_redis, close_redis
from app.core.database import engine, async_session_factory
from app.api.router import api_router
from app.services.auth_service import AuthService

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_logging()
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION} [{settings.APP_ENV}]")
    
    # Ensure storage paths exist
    storage_paths = settings.get_absolute_storage_paths()
    logger.info(f"Verified storage directories: {list(storage_paths.keys())}")
    
    # Initialize Redis connection pool
    try:
        await init_redis()
    except Exception as e:
        logger.error(f"Could not connect to Redis at startup: {e}")

    # Ensure default Administrator exists & recover interrupted jobs
    try:
        async with async_session_factory() as session:
            await AuthService.init_default_admin(session)
            from app.services.queue_service import QueueService
            await QueueService.recover_interrupted_jobs(session)
    except Exception as e:
        logger.warning(f"Startup task verification failure (migrations may be pending): {e}")
    
    # Background telemetry broadcast loop
    async def telemetry_loop():
        from app.services.telemetry_service import TelemetryService
        while True:
            try:
                await asyncio.sleep(1.5)
                async with async_session_factory() as session:
                    await TelemetryService.broadcast_tick(session)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.debug(f"Telemetry broadcast loop error: {e}")

    telemetry_task = asyncio.create_task(telemetry_loop())

    yield
    
    # Shutdown
    logger.info("Shutting down application resources...")
    telemetry_task.cancel()
    try:
        await telemetry_task
    except asyncio.CancelledError:
        pass
    await close_redis()
    await engine.dispose()
    logger.info("Shutdown complete.")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Private Cloud Torrent Downloader with Direct HTTP Download",
    docs_url="/docs" if settings.APP_DEBUG else None,
    redoc_url="/redoc" if settings.APP_DEBUG else None,
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global API router
app.include_router(api_router, prefix="/api")

@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "online",
        "api_docs": "/docs" if settings.APP_DEBUG else "disabled"
    }

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please contact the administrator."}
    )
