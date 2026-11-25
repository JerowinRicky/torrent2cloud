import os
import uuid
import math
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import select, and_, func, desc, asc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.storage import StoredFile, UserStorageUsage
from app.models.torrent import TorrentJob
from app.models.file import TorrentFile
from app.models.user import User
from app.schemas.storage import (
    StoredFileResponse,
    FileListResponse,
    StorageStatsResponse,
    StorageCategoryStat,
    DiskUsageStat,
    BulkDeleteResponse
)
from app.core.storage import get_storage_adapter
from app.utils.mime_classifier import classify_file
from app.core.logging import logger

ALL_CATEGORIES = [
    "VIDEOS", "AUDIO", "IMAGES", "DOCUMENTS", 
    "ARCHIVES", "DISK_IMAGES", "CODE", "OTHER"
]

class StorageService:

    @staticmethod
    async def index_completed_torrent(db: AsyncSession, job: TorrentJob) -> list[StoredFile]:
        """
        Scans completed torrent job files on disk, classifies MIME types & categories,
        calculates checksums, registers StoredFile records, and reconciles storage quotas.
        """
        adapter = get_storage_adapter()
        created_or_updated: list[StoredFile] = []
        save_path = Path(job.save_path)

        if not save_path.exists():
            logger.warning(f"Torrent save_path does not exist for indexing: {job.save_path}")
            return []

        # Query registered TorrentFile entries safely
        files_stmt = select(TorrentFile).where(TorrentFile.job_id == job.id).order_by(TorrentFile.file_index)
        torrent_files = list((await db.execute(files_stmt)).scalars().all())

        if torrent_files:
            for tf in torrent_files:
                if not tf.is_selected:
                    continue

                full_path = save_path / tf.relative_path
                # In case relative path is nested or points to single file
                if not full_path.exists():
                    # Fallback check directly in save_path with tf.filename
                    alt_path = save_path / tf.filename
                    if alt_path.exists():
                        full_path = alt_path

                if full_path.exists() and full_path.is_file():
                    actual_size = adapter.get_file_size(full_path)
                    ext, mime, category = classify_file(tf.filename)
                    sha256 = adapter.compute_sha256(full_path)

                    # Check for existing record
                    query = select(StoredFile).where(
                        and_(
                            StoredFile.user_id == job.user_id,
                            StoredFile.job_id == job.id,
                            StoredFile.relative_path == tf.relative_path
                        )
                    )
                    existing = (await db.execute(query)).scalars().first()

                    if existing:
                        existing.file_size = actual_size
                        existing.extension = ext
                        existing.mime_type = mime
                        existing.category = category
                        existing.storage_path = str(full_path)
                        existing.sha256_hash = sha256
                        existing.is_available = True
                        stored_file = existing
                    else:
                        stored_file = StoredFile(
                            id=uuid.uuid4(),
                            user_id=job.user_id,
                            job_id=job.id,
                            torrent_file_id=tf.id,
                            filename=tf.filename,
                            relative_path=tf.relative_path,
                            file_size=actual_size,
                            extension=ext,
                            mime_type=mime,
                            category=category,
                            storage_path=str(full_path),
                            sha256_hash=sha256,
                            is_available=True
                        )
                        db.add(stored_file)

                    tf.is_completed = True
                    tf.storage_object_id = stored_file.id
                    created_or_updated.append(stored_file)
        else:
            # Walk directory or single file if no individual TorrentFile records
            files_to_index: list[Path] = []
            if save_path.is_file():
                files_to_index.append(save_path)
            else:
                for root, _, files in os.walk(save_path):
                    for f in files:
                        files_to_index.append(Path(root) / f)

            for fp in files_to_index:
                rel_path = str(fp.relative_to(save_path))
                actual_size = adapter.get_file_size(fp)
                ext, mime, category = classify_file(fp.name)
                sha256 = adapter.compute_sha256(fp)

                query = select(StoredFile).where(
                    and_(
                        StoredFile.user_id == job.user_id,
                        StoredFile.job_id == job.id,
                        StoredFile.relative_path == rel_path
                    )
                )
                existing = (await db.execute(query)).scalars().first()

                if existing:
                    existing.file_size = actual_size
                    existing.storage_path = str(fp)
                    existing.is_available = True
                    stored_file = existing
                else:
                    stored_file = StoredFile(
                        id=uuid.uuid4(),
                        user_id=job.user_id,
                        job_id=job.id,
                        filename=fp.name,
                        relative_path=rel_path,
                        file_size=actual_size,
                        extension=ext,
                        mime_type=mime,
                        category=category,
                        storage_path=str(fp),
                        sha256_hash=sha256,
                        is_available=True
                    )
                    db.add(stored_file)
                created_or_updated.append(stored_file)

        await db.flush()
        await StorageService.reconcile_user_storage(db, job.user_id)

        from app.services.activity_service import ActivityService
        try:
            await ActivityService.log_event(
                db=db,
                event_type="DOWNLOAD_COMPLETED",
                severity="SUCCESS",
                title="Download Completed",
                description=f"Completed downloading '{job.torrent_name}' ({len(created_or_updated)} files indexed)",
                user_id=job.user_id,
                entity_type="TORRENT",
                entity_id=str(job.id)
            )
        except Exception:
            pass

        await db.commit()
        return created_or_updated

    @staticmethod
    async def list_files(
        db: AsyncSession,
        user: User,
        category: str = "ALL",
        search: str = "",
        sort_by: str = "created_at",
        order: str = "desc",
        page: int = 1,
        page_size: int = 50,
        job_id: uuid.UUID | None = None
    ) -> FileListResponse:
        """
        Queries indexed stored files with search, category filtering, sorting and pagination.
        """
        query = select(StoredFile).where(
            and_(
                StoredFile.user_id == user.id,
                StoredFile.is_available == True
            )
        )

        if category and category.upper() != "ALL":
            query = query.where(StoredFile.category == category.upper())

        if search and search.strip():
            query = query.where(StoredFile.filename.ilike(f"%{search.strip()}%"))

        if job_id:
            query = query.where(StoredFile.job_id == job_id)

        # Count total matches
        count_stmt = select(func.count()).select_from(query.subquery())
        total_items = (await db.execute(count_stmt)).scalar() or 0

        # Sorting
        sort_column_map = {
            "filename": StoredFile.filename,
            "file_size": StoredFile.file_size,
            "created_at": StoredFile.created_at,
            "category": StoredFile.category,
            "extension": StoredFile.extension,
        }
        sort_col = sort_column_map.get(sort_by, StoredFile.created_at)
        if order.lower() == "asc":
            query = query.order_by(asc(sort_col))
        else:
            query = query.order_by(desc(sort_col))

        # Pagination
        offset = max(0, (page - 1) * page_size)
        query = query.offset(offset).limit(page_size).options(selectinload(StoredFile.job))

        result = await db.execute(query)
        files = result.scalars().all()

        items = []
        for f in files:
            items.append(
                StoredFileResponse(
                    id=f.id,
                    user_id=f.user_id,
                    job_id=f.job_id,
                    torrent_file_id=f.torrent_file_id,
                    filename=f.filename,
                    relative_path=f.relative_path,
                    file_size=f.file_size,
                    extension=f.extension,
                    mime_type=f.mime_type,
                    category=f.category,
                    storage_path=f.storage_path,
                    sha256_hash=f.sha256_hash,
                    is_available=f.is_available,
                    created_at=f.created_at,
                    updated_at=f.updated_at,
                    torrent_name=f.job.torrent_name if f.job else None,
                    info_hash=f.job.info_hash if f.job else None,
                )
            )

        total_pages = math.ceil(total_items / page_size) if page_size > 0 else 1

        return FileListResponse(
            items=items,
            total=total_items,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )

    @staticmethod
    async def get_storage_stats(db: AsyncSession, user: User) -> StorageStatsResponse:
        """
        Calculates user storage usage, quota remaining, file category breakdown,
        and physical disk metrics.
        """
        adapter = get_storage_adapter()

        # Aggregate total used bytes and files count
        total_stmt = select(
            func.coalesce(func.sum(StoredFile.file_size), 0),
            func.count(StoredFile.id)
        ).where(
            and_(
                StoredFile.user_id == user.id,
                StoredFile.is_available == True
            )
        )
        total_res = (await db.execute(total_stmt)).first()
        used_bytes = int(total_res[0]) if total_res else 0
        total_files = int(total_res[1]) if total_res else 0

        # Category aggregates
        cat_stmt = select(
            StoredFile.category,
            func.count(StoredFile.id),
            func.coalesce(func.sum(StoredFile.file_size), 0)
        ).where(
            and_(
                StoredFile.user_id == user.id,
                StoredFile.is_available == True
            )
        ).group_by(StoredFile.category)

        cat_rows = (await db.execute(cat_stmt)).all()
        cat_map = {row[0]: {"count": int(row[1]), "bytes": int(row[2])} for row in cat_rows}

        category_stats = []
        for cat in ALL_CATEGORIES:
            stats = cat_map.get(cat, {"count": 0, "bytes": 0})
            category_stats.append(
                StorageCategoryStat(
                    category=cat,
                    count=stats["count"],
                    bytes=stats["bytes"]
                )
            )

        quota_bytes = user.storage_quota_bytes
        free_bytes = max(0, quota_bytes - used_bytes)
        usage_pct = round((used_bytes / quota_bytes * 100), 2) if quota_bytes > 0 else 0.0

        # Physical disk stats
        disk_raw = adapter.get_disk_usage()
        disk_usage = DiskUsageStat(
            total_bytes=disk_raw.get("total", 0),
            used_bytes=disk_raw.get("used", 0),
            free_bytes=disk_raw.get("free", 0),
        )

        return StorageStatsResponse(
            quota_bytes=quota_bytes,
            used_bytes=used_bytes,
            free_bytes=free_bytes,
            usage_percentage=min(100.0, usage_pct),
            is_near_capacity=(usage_pct >= 90.0),
            total_files=total_files,
            categories=category_stats,
            disk_usage=disk_usage
        )

    @staticmethod
    async def get_file(db: AsyncSession, user: User, file_id: uuid.UUID) -> StoredFileResponse:
        query = select(StoredFile).where(
            and_(
                StoredFile.id == file_id,
                StoredFile.user_id == user.id,
                StoredFile.is_available == True
            )
        ).options(selectinload(StoredFile.job))

        file = (await db.execute(query)).scalars().first()
        if not file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found or not available"
            )

        return StoredFileResponse(
            id=file.id,
            user_id=file.user_id,
            job_id=file.job_id,
            torrent_file_id=file.torrent_file_id,
            filename=file.filename,
            relative_path=file.relative_path,
            file_size=file.file_size,
            extension=file.extension,
            mime_type=file.mime_type,
            category=file.category,
            storage_path=file.storage_path,
            sha256_hash=file.sha256_hash,
            is_available=file.is_available,
            created_at=file.created_at,
            updated_at=file.updated_at,
            torrent_name=file.job.torrent_name if file.job else None,
            info_hash=file.job.info_hash if file.job else None,
        )

    @staticmethod
    async def delete_file(
        db: AsyncSession,
        user: User,
        file_id: uuid.UUID,
        delete_torrent: bool = False
    ) -> int:
        """
        Deletes stored file from physical storage, database, and updates user quota.
        Optionally deletes parent torrent job if requested.
        """
        adapter = get_storage_adapter()
        query = select(StoredFile).where(
            and_(
                StoredFile.id == file_id,
                StoredFile.user_id == user.id
            )
        )
        file = (await db.execute(query)).scalars().first()
        if not file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )

        freed_bytes = file.file_size
        adapter.delete_file(file.storage_path)

        job_id = file.job_id
        await db.delete(file)
        await db.flush()

        if delete_torrent and job_id:
            # Check if other stored files exist for this job
            remaining = await db.execute(
                select(func.count()).select_from(StoredFile).where(StoredFile.job_id == job_id)
            )
            count = remaining.scalar() or 0
            if count == 0:
                from app.services.torrent_service import TorrentService
                try:
                    await TorrentService.delete_job(db, user, job_id, delete_files=False)
                except Exception as e:
                    logger.warning(f"Failed to delete parent torrent job {job_id}: {e}")

        await StorageService.reconcile_user_storage(db, user.id)

        from app.services.activity_service import ActivityService
        try:
            await ActivityService.log_event(
                db=db,
                event_type="FILE_DELETED",
                severity="WARNING",
                title="Cloud File Deleted",
                description=f"Deleted file '{file.filename}'",
                user_id=user.id,
                entity_type="FILE",
                entity_id=str(file_id)
            )
        except Exception:
            pass

        await db.commit()
        return freed_bytes

    @staticmethod
    async def bulk_delete_files(
        db: AsyncSession,
        user: User,
        file_ids: list[uuid.UUID]
    ) -> BulkDeleteResponse:
        """Deletes multiple stored files in a single batch operation."""
        adapter = get_storage_adapter()
        query = select(StoredFile).where(
            and_(
                StoredFile.id.in_(file_ids),
                StoredFile.user_id == user.id
            )
        )
        files = (await db.execute(query)).scalars().all()

        deleted_count = 0
        freed_bytes = 0
        found_ids = set()

        for f in files:
            found_ids.add(f.id)
            adapter.delete_file(f.storage_path)
            freed_bytes += f.file_size
            await db.delete(f)
            deleted_count += 1

        failed_ids = [fid for fid in file_ids if fid not in found_ids]

        await db.flush()
        await StorageService.reconcile_user_storage(db, user.id)
        await db.commit()

        return BulkDeleteResponse(
            deleted_count=deleted_count,
            freed_bytes=freed_bytes,
            failed_ids=failed_ids
        )

    @staticmethod
    async def reconcile_user_storage(db: AsyncSession, user_id: uuid.UUID) -> int:
        """Synchronizes UserStorageUsage with sum of active StoredFiles."""
        total_stmt = select(func.coalesce(func.sum(StoredFile.file_size), 0)).where(
            and_(
                StoredFile.user_id == user_id,
                StoredFile.is_available == True
            )
        )
        actual_used = (await db.execute(total_stmt)).scalar() or 0

        usage = await db.get(UserStorageUsage, user_id)
        if not usage:
            usage = UserStorageUsage(
                user_id=user_id,
                used_bytes=actual_used,
                active_jobs_count=0
            )
            db.add(usage)
        else:
            usage.used_bytes = actual_used
            usage.last_calculated_at = datetime.now(timezone.utc)

        await db.flush()
        return actual_used
