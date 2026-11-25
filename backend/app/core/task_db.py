from contextlib import asynccontextmanager
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool
from app.config import settings

# Dedicated task engine using NullPool for safe execution across event loops/threads
task_engine = create_async_engine(
    settings.DATABASE_URL,
    poolclass=NullPool,
    echo=False,
    future=True
)

task_session_factory = async_sessionmaker(
    bind=task_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

@asynccontextmanager
async def get_task_db() -> AsyncGenerator[AsyncSession, None]:
    """Provides a fresh isolated async database session for Celery tasks."""
    async with task_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

import asyncio
import concurrent.futures

def run_task_async(coro_fn, *args, **kwargs):
    """
    Executes an async task function safely whether an event loop is running or not.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(lambda: asyncio.run(coro_fn(*args, **kwargs)))
            return future.result()
    else:
        return asyncio.run(coro_fn(*args, **kwargs))
