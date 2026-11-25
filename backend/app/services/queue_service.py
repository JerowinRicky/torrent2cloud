import os
import uuid
from datetime import datetime, timezone
from typing import Tuple
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.torrent import TorrentJob
from app.models.user import User
from app.models.setting import SystemSetting
from app.core.torrent_session import TorrentSessionManager
from app.config import settings
from app.core.logging import logger

class QueueService:
    @staticmethod
    async def get_system_setting(db: AsyncSession, key: str, default_value: str) -> str:
        """Retrieves a system setting from DB or returns default."""
        setting = await db.get(SystemSetting, key)
        return setting.value if setting else default_value

    @staticmethod
    async def get_queue_config(db: AsyncSession) -> dict:
        """Retrieves current queue and bandwidth limits."""
        global_max = int(await QueueService.get_system_setting(
            db, "global_max_concurrent_downloads", str(settings.GLOBAL_MAX_CONCURRENT_DOWNLOADS)
        ))
        default_active = int(await QueueService.get_system_setting(
            db, "default_max_active_jobs", str(settings.DEFAULT_MAX_ACTIVE_JOBS)
        ))
        dl_limit = int(await QueueService.get_system_setting(
            db, "download_speed_limit_kbps", str(settings.DEFAULT_DOWNLOAD_RATE_LIMIT_KBPS)
        ))
        ul_limit = int(await QueueService.get_system_setting(
            db, "upload_speed_limit_kbps", str(settings.DEFAULT_UPLOAD_RATE_LIMIT_KBPS)
        ))
        return {
            "global_max_concurrent_downloads": global_max,
            "default_max_active_jobs": default_active,
            "download_speed_limit_kbps": dl_limit,
            "upload_speed_limit_kbps": ul_limit,
            "max_queued_jobs_per_user": settings.MAX_QUEUED_JOBS_PER_USER
        }

    @staticmethod
    async def update_queue_config(db: AsyncSession, new_config: dict) -> dict:
        """Updates system queue settings and applies bandwidth limits to libtorrent."""
        manager = TorrentSessionManager.get_instance()
        for key, val in new_config.items():
            setting = await db.get(SystemSetting, key)
            if setting:
                setting.value = str(val)
            else:
                db.add(SystemSetting(key=key, value=str(val), description="Queue & bandwidth config"))
        
        await db.commit()

        # Apply rate limits to libtorrent session if provided (kbps -> bytes/sec)
        dl_kbps = new_config.get("download_speed_limit_kbps")
        ul_kbps = new_config.get("upload_speed_limit_kbps")
        if dl_kbps is not None or ul_kbps is not None:
            dl_bytes = (dl_kbps * 1024) if dl_kbps and dl_kbps > 0 else 0
            ul_bytes = (ul_kbps * 1024) if ul_kbps and ul_kbps > 0 else 0
            manager.set_rate_limits(download_limit_bytes=dl_bytes, upload_limit_bytes=ul_bytes)

        return await QueueService.get_queue_config(db)

    @staticmethod
    async def can_start_download(
        db: AsyncSession,
        user_id: uuid.UUID,
        max_user_active: int
    ) -> Tuple[bool, str | None]:
        """
        Evaluates whether a user can immediately start downloading or must enter the queue.
        Checks global concurrency limits and user concurrency limits.
        """
        cfg = await QueueService.get_queue_config(db)
        global_limit = cfg["global_max_concurrent_downloads"]

        # Global active count
        global_active_query = select(func.count()).select_from(TorrentJob).where(
            TorrentJob.status.in_(["DOWNLOADING", "FETCHING_METADATA"])
        )
        global_active = (await db.execute(global_active_query)).scalar() or 0
        if global_active >= global_limit:
            return False, f"System capacity reached ({global_active}/{global_limit} active downloads)"

        # User active count
        user_active_query = select(func.count()).select_from(TorrentJob).where(
            and_(
                TorrentJob.user_id == user_id,
                TorrentJob.status.in_(["DOWNLOADING", "FETCHING_METADATA"])
            )
        )
        user_active = (await db.execute(user_active_query)).scalar() or 0
        if user_active >= max_user_active:
            return False, f"User active download limit reached ({user_active}/{max_user_active})"

        return True, None

    @staticmethod
    async def schedule_next_jobs(db: AsyncSession) -> list[uuid.UUID]:
        """
        Scheduler function called periodically or on slot freeing.
        Promotes highest priority QUEUED jobs to DOWNLOADING when capacity allows.
        """
        cfg = await QueueService.get_queue_config(db)
        global_limit = cfg["global_max_concurrent_downloads"]

        # Current global active
        global_active_query = select(func.count()).select_from(TorrentJob).where(
            TorrentJob.status.in_(["DOWNLOADING", "FETCHING_METADATA"])
        )
        global_active = (await db.execute(global_active_query)).scalar() or 0
        available_global_slots = max(0, global_limit - global_active)

        if available_global_slots <= 0:
            return []

        # Find queued jobs ordered by priority DESC, queued_at ASC, created_at ASC
        queued_query = (
            select(TorrentJob)
            .where(TorrentJob.status == "QUEUED")
            .options(selectinload(TorrentJob.files), selectinload(TorrentJob.user))
            .order_by(
                TorrentJob.priority.desc(),
                TorrentJob.queued_at.asc(),
                TorrentJob.created_at.asc()
            )
        )
        queued_jobs = (await db.execute(queued_query)).scalars().all()
        promoted_ids: list[uuid.UUID] = []
        manager = TorrentSessionManager.get_instance()

        # Cache active counts per user in memory for this scheduling tick
        user_active_counts: dict[uuid.UUID, int] = {}

        for job in queued_jobs:
            if available_global_slots <= 0:
                break

            u_id = job.user_id
            if u_id not in user_active_counts:
                user_act_q = select(func.count()).select_from(TorrentJob).where(
                    and_(
                        TorrentJob.user_id == u_id,
                        TorrentJob.status.in_(["DOWNLOADING", "FETCHING_METADATA"])
                    )
                )
                user_active_counts[u_id] = (await db.execute(user_act_q)).scalar() or 0

            max_active = job.user.max_active_jobs if job.user else settings.DEFAULT_MAX_ACTIVE_JOBS
            if user_active_counts[u_id] < max_active:
                # Promote to DOWNLOADING or FETCHING_METADATA
                new_status = "DOWNLOADING" if len(job.files) > 0 else "FETCHING_METADATA"
                job.status = new_status
                job.started_at = datetime.now(timezone.utc)
                job.queued_at = None

                # Mount into libtorrent engine
                selected_indices = [f.file_index for f in job.files if f.is_selected]
                manager.add_torrent(
                    info_hash=job.info_hash,
                    save_dir=job.save_path,
                    magnet_uri=job.magnet_uri,
                    selected_indices=selected_indices if selected_indices else None
                )

                user_active_counts[u_id] += 1
                available_global_slots -= 1
                promoted_ids.append(job.id)
                logger.info(f"Promoted job {job.id} ({job.torrent_name}) from QUEUED to {new_status}")

        if promoted_ids:
            await db.commit()

        return promoted_ids

    @staticmethod
    async def retry_job(db: AsyncSession, user: User, job_id: uuid.UUID) -> TorrentJob:
        """
        Retries a failed or canceled job if retry limits have not been exceeded.
        """
        query = select(TorrentJob).where(TorrentJob.id == job_id).options(selectinload(TorrentJob.files))
        if user.role != "ADMIN":
            query = query.where(TorrentJob.user_id == user.id)

        job = (await db.execute(query)).scalars().first()
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Torrent job not found")

        if job.status not in ["FAILED", "CANCELED"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot retry a job in '{job.status}' status"
            )

        if job.retry_count >= job.max_retries:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum retries exceeded ({job.retry_count}/{job.max_retries})"
            )

        job.retry_count += 1
        job.error_message = None
        job.status = "QUEUED"
        job.queued_at = datetime.now(timezone.utc)
        await db.commit()

        # Trigger queue check
        await QueueService.schedule_next_jobs(db)
        reloaded = (await db.execute(select(TorrentJob).where(TorrentJob.id == job_id).options(selectinload(TorrentJob.files)))).scalars().one()
        return reloaded

    @staticmethod
    async def change_priority(
        db: AsyncSession,
        user: User,
        job_id: uuid.UUID,
        priority: int
    ) -> TorrentJob:
        """Updates priority (1 to 10) of a job."""
        if priority < 1 or priority > 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Priority must be between 1 (lowest) and 10 (highest)"
            )

        query = select(TorrentJob).where(TorrentJob.id == job_id).options(selectinload(TorrentJob.files))
        if user.role != "ADMIN":
            query = query.where(TorrentJob.user_id == user.id)

        job = (await db.execute(query)).scalars().first()
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Torrent job not found")

        job.priority = priority
        await db.commit()
        logger.info(f"Updated priority of job {job_id} to {priority}")
        reloaded = (await db.execute(select(TorrentJob).where(TorrentJob.id == job_id).options(selectinload(TorrentJob.files)))).scalars().one()
        return reloaded

    @staticmethod
    async def recover_interrupted_jobs(db: AsyncSession) -> int:
        """
        Recovers jobs that were active when the worker or server unexpectedly terminated.
        Safely places them in the QUEUED state to be re-evaluated.
        """
        manager = TorrentSessionManager.get_instance()
        query = select(TorrentJob).where(TorrentJob.status.in_(["DOWNLOADING", "FETCHING_METADATA"]))
        active_jobs = (await db.execute(query)).scalars().all()
        recovered_count = 0

        for job in active_jobs:
            handle = manager.get_handle(job.info_hash)
            if not handle or not handle.is_valid():
                job.status = "QUEUED"
                job.queued_at = datetime.now(timezone.utc)
                recovered_count += 1
                logger.warning(f"Recovered interrupted job {job.id} ({job.torrent_name}) back to QUEUED")

        if recovered_count > 0:
            await db.commit()
            await QueueService.schedule_next_jobs(db)

        return recovered_count
