import redis.asyncio as aioredis
from app.config import settings
from app.core.logging import logger

redis_client: aioredis.Redis | None = None

async def init_redis() -> aioredis.Redis:
    """Initializes and verifies the async Redis connection."""
    global redis_client
    try:
        redis_client = aioredis.from_url(
            settings.REDIS_URL,
            max_connections=settings.REDIS_MAX_CONNECTIONS,
            decode_responses=True,
            protocol=2,
            socket_timeout=3.0,
            socket_connect_timeout=3.0
        )
        await redis_client.ping()
        logger.info("Connected to Redis server successfully.")
        return redis_client
    except Exception as e:
        logger.warning(f"Failed to connect to primary Redis: {e}. Falling back to fakeredis if available.")
        try:
            import fakeredis.aioredis
            redis_client = fakeredis.aioredis.FakeRedis(decode_responses=True)
            await redis_client.ping()
            logger.info("Using in-memory FakeRedis fallback for testing/offline mode.")
            return redis_client
        except Exception as fe:
            logger.error(f"Failed to initialize any Redis backend: {fe}")
            raise

async def close_redis() -> None:
    """Closes Redis connection cleanly."""
    global redis_client
    if redis_client:
        if hasattr(redis_client, "aclose"):
            await redis_client.aclose()
        else:
            await redis_client.close()
        logger.info("Redis connection closed.")

async def get_redis() -> aioredis.Redis:
    """Dependency for obtaining an active Redis client."""
    global redis_client
    if redis_client is None:
        await init_redis()
    return redis_client
