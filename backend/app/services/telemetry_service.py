import json
import uuid
from datetime import datetime, timezone
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.torrent import TorrentJob
from app.core.torrent_session import TorrentSessionManager
from app.core.ws_manager import ws_manager
from app.core.redis import get_redis
from app.core.logging import logger

class TelemetryService:
    @staticmethod
    def format_job_telemetry(job: TorrentJob) -> dict:
        """Formats a torrent job into a clean telemetry payload."""
        return {
            "type": "telemetry",
            "job_id": str(job.id),
            "info_hash": job.info_hash,
            "torrent_name": job.torrent_name,
            "status": job.status,
            "progress": float(job.progress),
            "download_speed": job.download_speed,
            "upload_speed": job.upload_speed,
            "downloaded_bytes": job.downloaded_bytes,
            "uploaded_bytes": job.uploaded_bytes,
            "total_size": job.total_size,
            "eta_seconds": job.eta_seconds,
            "peers_connected": job.peers_connected,
            "seeds_connected": job.seeds_connected,
            "priority": job.priority,
            "retry_count": job.retry_count,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    @staticmethod
    async def get_user_snapshot(user_id: uuid.UUID, db: AsyncSession) -> list[dict]:
        """Provides an instant initial state snapshot of all user's downloads."""
        manager = TorrentSessionManager.get_instance()
        query = select(TorrentJob).where(TorrentJob.user_id == user_id).order_by(TorrentJob.created_at.desc())
        jobs = (await db.execute(query)).scalars().all()
        snapshot = []
        for job in jobs:
            st = manager.get_status(job.info_hash)
            if st and job.status not in ["COMPLETED", "FAILED", "CANCELED"]:
                job.download_speed = st["download_speed"]
                job.upload_speed = st["upload_speed"]
                job.downloaded_bytes = st["downloaded_bytes"]
                job.uploaded_bytes = st["uploaded_bytes"]
                job.progress = st["progress"]
                job.peers_connected = st["peers_connected"]
                job.seeds_connected = st["seeds_connected"]
            snapshot.append(TelemetryService.format_job_telemetry(job))
        return snapshot

    @staticmethod
    async def broadcast_tick(db: AsyncSession) -> int:
        """
        Gathers live metrics from libtorrent engine and pushes updates
        over active WebSockets and Redis pub/sub.
        """
        # If no active connections in the system and no worker handles, skip
        manager = TorrentSessionManager.get_instance()
        active_handles = list(manager.handles.keys())
        if not active_handles and ws_manager.get_connected_user_count() == 0:
            return 0

        query = (
            select(TorrentJob)
            .where(TorrentJob.status.in_(["DOWNLOADING", "FETCHING_METADATA", "QUEUED", "VALIDATING"]))
            .options(selectinload(TorrentJob.files))
        )
        active_jobs = (await db.execute(query)).scalars().all()
        if not active_jobs:
            return 0

        try:
            redis = await get_redis()
        except Exception:
            redis = None

        count = 0
        for job in active_jobs:
            st = manager.get_status(job.info_hash)
            if st and job.status != "QUEUED":
                job.download_speed = st["download_speed"]
                job.upload_speed = st["upload_speed"]
                job.downloaded_bytes = st["downloaded_bytes"]
                job.uploaded_bytes = st["uploaded_bytes"]
                job.progress = st["progress"]
                job.peers_connected = st["peers_connected"]
                job.seeds_connected = st["seeds_connected"]

                # Calculate ETA if downloading and speed > 0
                if job.download_speed > 0 and job.total_size > job.downloaded_bytes:
                    remaining_bytes = job.total_size - job.downloaded_bytes
                    job.eta_seconds = int(remaining_bytes / job.download_speed)
                else:
                    job.eta_seconds = None

            telemetry_packet = TelemetryService.format_job_telemetry(job)

            # 1. Push directly to connected WebSockets of this user
            await ws_manager.broadcast_to_user(job.user_id, telemetry_packet)

            # 2. Publish to Redis Pub/Sub & Cache for distributed workers / SSE
            if redis:
                try:
                    payload_json = json.dumps(telemetry_packet)
                    await redis.publish(f"channel:telemetry:user:{job.user_id}", payload_json)
                    await redis.set(f"torrent:telemetry:{job.id}", payload_json, ex=15)
                except Exception as re:
                    logger.debug(f"Redis telemetry publish failed: {re}")

            count += 1

        return count

    @staticmethod
    async def notify_status_change(user_id: uuid.UUID, job_id: uuid.UUID, new_status: str):
        """Immediately broadcasts a status change event to connected clients."""
        event_packet = {
            "type": "job_status_change",
            "job_id": str(job_id),
            "status": new_status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await ws_manager.broadcast_to_user(user_id, event_packet)
        try:
            redis = await get_redis()
            if redis:
                await redis.publish(f"channel:telemetry:user:{user_id}", json.dumps(event_packet))
        except Exception:
            pass
