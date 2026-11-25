import base64
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy.orm import selectinload
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.torrent import TorrentJob
from app.models.file import TorrentFile
from app.models.user import User
from app.models.storage import UserStorageUsage
from app.schemas.torrent import TorrentCreateRequest
from app.core.torrent_session import TorrentSessionManager
from app.services.queue_service import QueueService
from app.config import settings
from app.core.logging import logger

class TorrentService:
    @staticmethod
    def inspect_magnet(magnet_uri: str) -> dict:
        """Validates and extracts parameters from a magnet URI."""
        if not magnet_uri.startswith("magnet:?"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid magnet URI. Must begin with 'magnet:?'"
            )
        try:
            manager = TorrentSessionManager.get_instance()
            return manager.parse_magnet(magnet_uri)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to parse magnet link: {e}"
            )

    @staticmethod
    def inspect_torrent_file(torrent_bytes: bytes) -> dict:
        """Parses .torrent file bytes and validates structure."""
        if len(torrent_bytes) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Torrent file exceeds maximum allowed size (10 MB)"
            )
        try:
            manager = TorrentSessionManager.get_instance()
            info_dict = manager.parse_torrent_bytes(torrent_bytes)
            # Remove raw object before serialization
            info_dict.pop("torrent_info", None)
            return info_dict
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid .torrent file structure: {e}"
            )

    @staticmethod
    async def create_job(
        db: AsyncSession,
        user: User,
        payload: TorrentCreateRequest
    ) -> TorrentJob:
        """
        Creates a new TorrentJob, validates user quota, queue limits,
        checks for duplicates, and assigns to DOWNLOADING or QUEUED based on capacity.
        """
        manager = TorrentSessionManager.get_instance()
        storage_paths = settings.get_absolute_storage_paths()

        # 1. User Queue Limit Check
        queued_query = select(func.count()).select_from(TorrentJob).where(
            and_(
                TorrentJob.user_id == user.id,
                TorrentJob.status == "QUEUED"
            )
        )
        queued_count = (await db.execute(queued_query)).scalar() or 0
        if queued_count >= settings.MAX_QUEUED_JOBS_PER_USER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User queue limit reached ({settings.MAX_QUEUED_JOBS_PER_USER} queued jobs allowed)"
            )

        # 2. Extract torrent metadata
        parsed_data = None
        torrent_info_obj = None

        if payload.torrent_file_b64:
            try:
                raw_bytes = base64.b64decode(payload.torrent_file_b64)
                parsed_data = manager.parse_torrent_bytes(raw_bytes)
                torrent_info_obj = parsed_data.pop("torrent_info", None)
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid base64 torrent data: {e}"
                )
        elif payload.magnet_uri:
            parsed_data = TorrentService.inspect_magnet(payload.magnet_uri)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Must provide either magnet_uri or torrent_file_b64"
            )

        info_hash = parsed_data["info_hash"].lower()

        # 3. Check for existing duplicate active/completed job by this user
        dup_query = select(TorrentJob).where(
            and_(
                TorrentJob.user_id == user.id,
                TorrentJob.info_hash == info_hash,
                TorrentJob.status.not_in(["CANCELED", "FAILED", "EXPIRED"])
            )
        )
        existing_job = (await db.execute(dup_query)).scalars().first()
        if existing_job:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You already have an active or completed download for this torrent"
            )

        # 4. Storage Quota Check
        selected_size = 0
        file_items = parsed_data.get("files", [])
        selected_indices = payload.selected_indices or [f["file_index"] for f in file_items]

        if file_items:
            for f in file_items:
                if f["file_index"] in selected_indices:
                    selected_size += f["file_size"]
        else:
            # For magnets without immediate metadata, check against a minimal requirement
            selected_size = parsed_data.get("total_size", 0)

        # Fetch current used storage
        usage = await db.get(UserStorageUsage, user.id)
        current_used = usage.used_bytes if usage else 0
        if current_used + selected_size > user.storage_quota_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient storage quota. Required: {selected_size // (1024**2)} MB, Remaining: {(user.storage_quota_bytes - current_used) // (1024**2)} MB"
            )

        # 5. Evaluate if job can immediately download or must enter the queue
        can_start, _ = await QueueService.can_start_download(db, user.id, user.max_active_jobs)
        now_utc = datetime.now(timezone.utc)

        job_id = uuid.uuid4()
        job_dir = storage_paths["incomplete"] / str(user.id) / str(job_id)
        job_dir.mkdir(parents=True, exist_ok=True)

        if can_start:
            initial_status = "DOWNLOADING" if torrent_info_obj else "FETCHING_METADATA"
            started_at = now_utc
            queued_at = None
        else:
            initial_status = "QUEUED"
            started_at = None
            queued_at = now_utc

        job = TorrentJob(
            id=job_id,
            user_id=user.id,
            info_hash=info_hash,
            torrent_name=parsed_data["name"],
            magnet_uri=payload.magnet_uri,
            status=initial_status,
            priority=payload.priority,
            total_size=selected_size,
            downloaded_bytes=0,
            uploaded_bytes=0,
            progress=0.0,
            save_path=str(job_dir),
            started_at=started_at,
            queued_at=queued_at
        )
        db.add(job)
        await db.flush()

        # 6. Add Files
        for f in file_items:
            tfile = TorrentFile(
                job_id=job.id,
                file_index=f["file_index"],
                filename=f["filename"],
                relative_path=f["relative_path"],
                file_size=f["file_size"],
                is_selected=f["file_index"] in selected_indices,
                is_completed=False
            )
            db.add(tfile)

        await db.commit()

        # 7. Start in libtorrent engine if capacity permitted immediate start
        if can_start:
            manager.add_torrent(
                info_hash=info_hash,
                save_dir=str(job_dir),
                torrent_info=torrent_info_obj,
                magnet_uri=payload.magnet_uri,
                selected_indices=selected_indices if file_items else None
            )

        job_query = select(TorrentJob).where(TorrentJob.id == job.id).options(selectinload(TorrentJob.files))
        loaded_job = (await db.execute(job_query)).scalars().one()

        from app.services.activity_service import ActivityService
        try:
            await ActivityService.log_event(
                db=db,
                event_type="TORRENT_ADDED",
                severity="INFO",
                title="Download Job Created",
                description=f"Submitted download for '{job.torrent_name}'",
                user_id=user.id,
                entity_type="TORRENT",
                entity_id=str(job.id),
                auto_commit=True
            )
        except Exception:
            pass

        return loaded_job

    @staticmethod
    async def list_jobs(
        db: AsyncSession,
        user: User,
        status_filter: str | None = None
    ) -> list[TorrentJob]:
        """Lists user's torrent jobs with live status enrichment from libtorrent."""
        manager = TorrentSessionManager.get_instance()
        query = select(TorrentJob).where(TorrentJob.user_id == user.id).options(selectinload(TorrentJob.files))

        if status_filter:
            if status_filter.upper() == "ACTIVE":
                query = query.where(TorrentJob.status.in_(["DOWNLOADING", "FETCHING_METADATA", "VALIDATING"]))
            elif status_filter.upper() == "COMPLETED":
                query = query.where(TorrentJob.status == "COMPLETED")
            elif status_filter.upper() == "PAUSED":
                query = query.where(TorrentJob.status == "PAUSED")
            elif status_filter.upper() == "QUEUED":
                query = query.where(TorrentJob.status == "QUEUED")
            else:
                query = query.where(TorrentJob.status == status_filter.upper())

        query = query.order_by(TorrentJob.priority.desc(), TorrentJob.created_at.desc())
        result = await db.execute(query)
        jobs = result.scalars().all()

        # Update with live engine metrics
        status_changed = False
        for job in jobs:
            st = manager.get_status(job.info_hash)
            if st and job.status not in ["COMPLETED", "FAILED", "CANCELED", "QUEUED"]:
                job.download_speed = st["download_speed"]
                job.upload_speed = st["upload_speed"]
                job.downloaded_bytes = st["downloaded_bytes"]
                job.uploaded_bytes = st["uploaded_bytes"]
                job.progress = st["progress"]
                job.peers_connected = st["peers_connected"]
                job.seeds_connected = st["seeds_connected"]
                if st["is_finished"] and job.status != "COMPLETED":
                    job.status = "COMPLETED"
                    job.completed_at = datetime.now(timezone.utc)
                    status_changed = True
                    db.add(job)
                    from app.services.storage_service import StorageService
                    try:
                        await StorageService.index_completed_torrent(db, job)
                    except Exception as e:
                        logger.error(f"Error auto-indexing completed torrent {job.id}: {e}")

        if status_changed:
            await db.commit()
            await QueueService.schedule_next_jobs(db)

        return list(jobs)

    @staticmethod
    async def get_job(db: AsyncSession, user: User, job_id: uuid.UUID) -> TorrentJob:
        query = select(TorrentJob).where(and_(TorrentJob.id == job_id, TorrentJob.user_id == user.id)).options(selectinload(TorrentJob.files))
        result = await db.execute(query)
        job = result.scalars().first()
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Torrent job not found")
        return job

    @staticmethod
    async def pause_job(db: AsyncSession, user: User, job_id: uuid.UUID) -> TorrentJob:
        job = await TorrentService.get_job(db, user, job_id)
        if job.status in ["DOWNLOADING", "FETCHING_METADATA", "QUEUED", "VALIDATING"]:
            manager = TorrentSessionManager.get_instance()
            manager.pause_torrent(job.info_hash)
            job.status = "PAUSED"
            db.add(job)
            await db.commit()
            # Freeing an active slot allows scheduled queued jobs to run
            await QueueService.schedule_next_jobs(db)
            return await TorrentService.get_job(db, user, job_id)
        return job

    @staticmethod
    async def resume_job(db: AsyncSession, user: User, job_id: uuid.UUID) -> TorrentJob:
        job = await TorrentService.get_job(db, user, job_id)
        if job.status == "PAUSED":
            can_start, _ = await QueueService.can_start_download(db, user.id, user.max_active_jobs)
            manager = TorrentSessionManager.get_instance()
            if can_start:
                manager.resume_torrent(job.info_hash)
                job.status = "DOWNLOADING" if job.files else "FETCHING_METADATA"
                job.started_at = datetime.now(timezone.utc)
                job.queued_at = None
            else:
                job.status = "QUEUED"
                job.queued_at = datetime.now(timezone.utc)

            db.add(job)
            await db.commit()
            return await TorrentService.get_job(db, user, job_id)
        return job

    @staticmethod
    async def cancel_job(db: AsyncSession, user: User, job_id: uuid.UUID) -> TorrentJob:
        job = await TorrentService.get_job(db, user, job_id)
        manager = TorrentSessionManager.get_instance()
        manager.remove_torrent(job.info_hash, delete_files=False)
        job.status = "CANCELED"
        db.add(job)
        await db.commit()
        # Freeing an active slot allows queued jobs to advance
        await QueueService.schedule_next_jobs(db)
        return await TorrentService.get_job(db, user, job_id)

    @staticmethod
    async def delete_job(
        db: AsyncSession,
        user: User,
        job_id: uuid.UUID,
        delete_files: bool = False
    ) -> None:
        job = await TorrentService.get_job(db, user, job_id)
        manager = TorrentSessionManager.get_instance()
        manager.remove_torrent(job.info_hash, delete_files=delete_files)

        if delete_files:
            from app.models.storage import StoredFile
            from app.services.storage_service import StorageService
            from sqlalchemy import delete as sa_delete
            await db.execute(sa_delete(StoredFile).where(StoredFile.job_id == job.id))
            if os.path.exists(job.save_path):
                shutil.rmtree(job.save_path, ignore_errors=True)
            await StorageService.reconcile_user_storage(db, user.id)

        await db.delete(job)
        await db.commit()
        await QueueService.schedule_next_jobs(db)
