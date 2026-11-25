import asyncio
import json
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.celery_app import celery_app
from app.core.task_db import get_task_db, run_task_async
from app.core.torrent_session import TorrentSessionManager
from app.core.redis import get_redis
from app.models.torrent import TorrentJob
from app.services.queue_service import QueueService
from app.core.logging import logger

@celery_app.task(name="app.tasks.torrent_tasks.sync_active_telemetry")
def sync_active_telemetry() -> int:
    """
    Synchronizes active torrent statistics from libtorrent handles
    into PostgreSQL and broadcasts metrics to Redis cache for real-time telemetry.
    """
    async def _run():
        manager = TorrentSessionManager.get_instance()
        active_handles = list(manager.handles.keys())
        if not active_handles:
            return 0

        updated_count = 0
        async with get_task_db() as db:
            query = (
                select(TorrentJob)
                .where(TorrentJob.info_hash.in_(active_handles))
                .options(selectinload(TorrentJob.files))
            )
            jobs = (await db.execute(query)).scalars().all()
            completed_any = False

            redis = await get_redis()

            for job in jobs:
                st = manager.get_status(job.info_hash)
                if not st:
                    continue

                job.download_speed = st["download_speed"]
                job.upload_speed = st["upload_speed"]
                job.downloaded_bytes = st["downloaded_bytes"]
                job.uploaded_bytes = st["uploaded_bytes"]
                job.progress = st["progress"]
                job.peers_connected = st["peers_connected"]
                job.seeds_connected = st["seeds_connected"]

                # Cache in Redis for instant WebSocket telemetry broadcast
                try:
                    telemetry_payload = {
                        "job_id": str(job.id),
                        "info_hash": job.info_hash,
                        "status": job.status,
                        "progress": float(job.progress),
                        "download_speed": job.download_speed,
                        "upload_speed": job.upload_speed,
                        "downloaded_bytes": job.downloaded_bytes,
                        "uploaded_bytes": job.uploaded_bytes,
                        "peers_connected": job.peers_connected,
                        "seeds_connected": job.seeds_connected,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                    await redis.set(
                        f"torrent:telemetry:{job.id}",
                        json.dumps(telemetry_payload),
                        ex=30
                    )
                except Exception as re:
                    logger.debug(f"Redis telemetry cache write: {re}")

                if st["is_finished"] and job.status not in ["COMPLETED", "PAUSED", "CANCELED"]:
                    job.status = "COMPLETED"
                    job.completed_at = datetime.now(timezone.utc)
                    completed_any = True
                    logger.info(f"[Engine] Torrent completed: {job.torrent_name} ({job.info_hash})")

                updated_count += 1

            await db.commit()

            # If any download completed, trigger queue scheduler to advance waiting jobs
            if completed_any:
                await QueueService.schedule_next_jobs(db)

        return updated_count

    try:
        return run_task_async(_run)
    except Exception as e:
        logger.error(f"[Celery] Error in sync_active_telemetry: {e}")
        return 0
