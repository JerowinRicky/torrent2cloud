import os
import shutil
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict
from sqlalchemy import select, and_, func, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.user import User
from app.models.storage import UserStorageUsage, StoredFile
from app.models.torrent import TorrentJob
from app.models.setting import SystemSetting
from app.schemas.admin import (
    AdminUserResponse,
    AdminUserUpdateRequest,
    AdminGlobalTorrentResponse,
    AdminSystemSettingItem
)
from app.core.torrent_session import TorrentSessionManager
from app.services.activity_service import ActivityService
from app.core.logging import logger

class AdminService:

    @staticmethod
    async def list_users(db: AsyncSession, search: Optional[str] = None) -> list[AdminUserResponse]:
        """Lists all registered users with their quota metrics, active jobs, and file counts."""
        query = select(User).order_by(desc(User.created_at)).options(
            selectinload(User.storage_usage)
        )

        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.where(
                (User.email.ilike(term)) | (User.full_name.ilike(term))
            )

        users = (await db.execute(query)).scalars().all()

        # Aggregate counts for files and active jobs
        file_counts_stmt = select(
            StoredFile.user_id,
            func.count(StoredFile.id),
            func.coalesce(func.sum(StoredFile.file_size), 0)
        ).where(StoredFile.is_available == True).group_by(StoredFile.user_id)
        file_counts = {r[0]: {"count": int(r[1]), "size": int(r[2])} for r in (await db.execute(file_counts_stmt)).all()}

        active_jobs_stmt = select(
            TorrentJob.user_id,
            func.count(TorrentJob.id)
        ).where(TorrentJob.status.in_(["DOWNLOADING", "FETCHING_METADATA", "VALIDATING"])).group_by(TorrentJob.user_id)
        active_counts = {r[0]: int(r[1]) for r in (await db.execute(active_jobs_stmt)).all()}

        items = []
        for u in users:
            fc = file_counts.get(u.id, {"count": 0, "size": 0})
            aj = active_counts.get(u.id, 0)
            items.append(
                AdminUserResponse(
                    id=u.id,
                    email=u.email,
                    full_name=u.full_name,
                    role=u.role,
                    is_active=u.is_active,
                    storage_quota_bytes=u.storage_quota_bytes,
                    max_active_jobs=u.max_active_jobs,
                    used_bytes=fc["size"],
                    active_jobs_count=aj,
                    stored_files_count=fc["count"],
                    created_at=u.created_at,
                    updated_at=u.updated_at
                )
            )
        return items

    @staticmethod
    async def get_user(db: AsyncSession, user_id: uuid.UUID) -> AdminUserResponse:
        """Retrieves administration profile for a single user."""
        stmt = select(User).where(User.id == user_id).options(selectinload(User.storage_usage))
        user = (await db.execute(stmt)).scalars().first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        # Counts
        fc_stmt = select(func.count(StoredFile.id), func.coalesce(func.sum(StoredFile.file_size), 0)).where(
            and_(StoredFile.user_id == user.id, StoredFile.is_available == True)
        )
        fc_res = (await db.execute(fc_stmt)).first()
        file_count = int(fc_res[0]) if fc_res else 0
        used_size = int(fc_res[1]) if fc_res else 0

        aj_stmt = select(func.count(TorrentJob.id)).where(
            and_(TorrentJob.user_id == user.id, TorrentJob.status.in_(["DOWNLOADING", "FETCHING_METADATA", "VALIDATING"]))
        )
        active_jobs = (await db.execute(aj_stmt)).scalar() or 0

        return AdminUserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            storage_quota_bytes=user.storage_quota_bytes,
            max_active_jobs=user.max_active_jobs,
            used_bytes=used_size,
            active_jobs_count=active_jobs,
            stored_files_count=file_count,
            created_at=user.created_at,
            updated_at=user.updated_at
        )

    @staticmethod
    async def update_user(
        db: AsyncSession,
        admin_user: User,
        target_user_id: uuid.UUID,
        payload: AdminUserUpdateRequest
    ) -> AdminUserResponse:
        """Modifies a user's quotas, roles, active status, or profile details."""
        stmt = select(User).where(User.id == target_user_id).options(selectinload(User.storage_usage))
        user = (await db.execute(stmt)).scalars().first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        # Protect against self-lockout
        if user.id == admin_user.id:
            if payload.is_active is False:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate your own administrator account")
            if payload.role and payload.role != "ADMIN":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot revoke admin privileges from yourself")

        if payload.full_name is not None:
            user.full_name = payload.full_name
        if payload.role is not None:
            user.role = payload.role
        if payload.is_active is not None:
            user.is_active = payload.is_active
        if payload.storage_quota_bytes is not None:
            user.storage_quota_bytes = payload.storage_quota_bytes
        if payload.max_active_jobs is not None:
            user.max_active_jobs = payload.max_active_jobs

        await db.flush()

        # Audit log event
        try:
            await ActivityService.log_event(
                db=db,
                event_type="USER_QUOTA_MODIFIED",
                severity="WARNING",
                title="User Profile & Quotas Updated",
                description=f"Admin {admin_user.full_name} updated quotas for {user.email}: Quota={user.storage_quota_bytes // (1024**3)}GB, MaxJobs={user.max_active_jobs}, Role={user.role}",
                user_id=admin_user.id,
                entity_type="USER",
                entity_id=str(user.id),
                auto_commit=True
            )
        except Exception:
            pass

        await db.commit()
        return await AdminService.get_user(db, user.id)

    @staticmethod
    async def list_global_torrents(
        db: AsyncSession,
        status_filter: Optional[str] = None
    ) -> list[AdminGlobalTorrentResponse]:
        """Lists active and queued torrent downloads cluster-wide across all users."""
        manager = TorrentSessionManager.get_instance()
        query = select(TorrentJob).order_by(desc(TorrentJob.created_at)).options(
            selectinload(TorrentJob.user)
        )

        if status_filter and status_filter.upper() != "ALL":
            query = query.where(TorrentJob.status == status_filter.upper())

        jobs = (await db.execute(query)).scalars().all()

        items = []
        for job in jobs:
            st = manager.get_status(job.info_hash)
            dl_speed = st["download_speed"] if st else job.download_speed
            ul_speed = st["upload_speed"] if st else job.upload_speed
            dl_bytes = st["downloaded_bytes"] if st else job.downloaded_bytes
            ul_bytes = st["uploaded_bytes"] if st else job.uploaded_bytes
            progress = st["progress"] if st else job.progress
            peers = st["peers_connected"] if st else job.peers_connected
            seeds = st["seeds_connected"] if st else job.seeds_connected

            items.append(
                AdminGlobalTorrentResponse(
                    id=job.id,
                    user_id=job.user_id,
                    user_email=job.user.email if job.user else "Unknown",
                    user_name=job.user.full_name if job.user else "Unknown",
                    info_hash=job.info_hash,
                    torrent_name=job.torrent_name,
                    status=job.status,
                    total_size=job.total_size,
                    downloaded_bytes=dl_bytes,
                    uploaded_bytes=ul_bytes,
                    progress=progress,
                    download_speed=dl_speed,
                    upload_speed=ul_speed,
                    eta_seconds=job.eta_seconds,
                    peers_connected=peers,
                    seeds_connected=seeds,
                    priority=job.priority,
                    created_at=job.created_at
                )
            )
        return items

    @staticmethod
    async def manage_torrent(
        db: AsyncSession,
        admin_user: User,
        job_id: uuid.UUID,
        action: str
    ) -> dict:
        """Executes administrative controls (pause, resume, cancel, delete) over any user's job."""
        stmt = select(TorrentJob).where(TorrentJob.id == job_id).options(selectinload(TorrentJob.user))
        job = (await db.execute(stmt)).scalars().first()
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Torrent job not found")

        manager = TorrentSessionManager.get_instance()
        act = action.lower()

        if act == "pause":
            manager.pause_torrent(job.info_hash)
            job.status = "PAUSED"
        elif act == "resume":
            manager.resume_torrent(job.info_hash)
            job.status = "DOWNLOADING"
        elif act == "cancel":
            manager.remove_torrent(job.info_hash, delete_files=False)
            job.status = "CANCELED"
        elif act == "delete":
            manager.remove_torrent(job.info_hash, delete_files=True)
            if os.path.exists(job.save_path):
                shutil.rmtree(job.save_path, ignore_errors=True)
            await db.delete(job)
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported action: {action}")

        # Audit log event
        try:
            await ActivityService.log_event(
                db=db,
                event_type=f"ADMIN_TORRENT_{act.upper()}",
                severity="WARNING",
                title=f"Admin {act.capitalize()}ed Torrent",
                description=f"Administrator {admin_user.full_name} executed {act} on job '{job.torrent_name}' (Owner: {job.user.email if job.user else 'Unknown'})",
                user_id=admin_user.id,
                entity_type="TORRENT",
                entity_id=str(job_id),
                auto_commit=True
            )
        except Exception:
            pass

        await db.commit()
        return {"status": "success", "action": act, "job_id": job_id}

    @staticmethod
    async def get_settings(db: AsyncSession) -> list[AdminSystemSettingItem]:
        """Lists all system configuration settings."""
        stmt = select(SystemSetting).order_by(SystemSetting.key)
        rows = (await db.execute(stmt)).scalars().all()
        return [
            AdminSystemSettingItem(
                key=r.key,
                value=r.value,
                description=r.description,
                updated_at=r.updated_at
            ) for r in rows
        ]

    @staticmethod
    async def update_settings(
        db: AsyncSession,
        admin_user: User,
        updates: Dict[str, str]
    ) -> list[AdminSystemSettingItem]:
        """Updates runtime cluster settings and applies rate limit adjustments."""
        manager = TorrentSessionManager.get_instance()

        for key, val in updates.items():
            row = await db.get(SystemSetting, key)
            if row:
                row.value = str(val)
                row.updated_at = datetime.now(timezone.utc)
            else:
                row = SystemSetting(
                    key=key,
                    value=str(val),
                    description=f"Configured by {admin_user.email}",
                    updated_at=datetime.now(timezone.utc)
                )
                db.add(row)

        await db.flush()

        # Check and apply bandwidth limits to libtorrent if present
        dl_row = await db.get(SystemSetting, "default_download_rate_limit_kbps")
        ul_row = await db.get(SystemSetting, "default_upload_rate_limit_kbps")
        if dl_row or ul_row:
            dl_kb = int(dl_row.value) if dl_row and dl_row.value.isdigit() else 0
            ul_kb = int(ul_row.value) if ul_row and ul_row.value.isdigit() else 0
            manager.set_rate_limits(dl_kb, ul_kb)

        # Audit event
        try:
            await ActivityService.log_event(
                db=db,
                event_type="SYSTEM_SETTINGS_UPDATED",
                severity="WARNING",
                title="System Cluster Settings Modified",
                description=f"Admin {admin_user.full_name} updated settings: {list(updates.keys())}",
                user_id=admin_user.id,
                entity_type="SYSTEM",
                entity_id=None,
                auto_commit=True
            )
        except Exception:
            pass

        await db.commit()
        return await AdminService.get_settings(db)
