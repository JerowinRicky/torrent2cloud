import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.storage import (
    StoredFileResponse,
    FileListResponse,
    StorageStatsResponse,
    BulkDeleteRequest,
    BulkDeleteResponse,
)
from app.services.storage_service import StorageService

router = APIRouter()

@router.get("", response_model=FileListResponse)
async def list_files(
    category: Optional[str] = Query("ALL", description="Filter by category (VIDEOS, AUDIO, IMAGES, etc.)"),
    search: Optional[str] = Query(None, description="Search by filename"),
    sort_by: Optional[str] = Query("created_at", description="Sort field: created_at, filename, file_size"),
    order: Optional[str] = Query("desc", description="Sort order: asc, desc"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    job_id: Optional[uuid.UUID] = Query(None, description="Filter by parent torrent job ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves paginated and filtered list of completed cloud files owned by current user."""
    return await StorageService.list_files(
        db=db,
        user=current_user,
        category=category or "ALL",
        search=search or "",
        sort_by=sort_by or "created_at",
        order=order or "desc",
        page=page,
        page_size=page_size,
        job_id=job_id
    )

@router.get("/stats", response_model=StorageStatsResponse)
async def get_storage_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns storage quota utilization, breakdown by file categories, and physical disk metrics."""
    return await StorageService.get_storage_stats(db=db, user=current_user)

@router.get("/{file_id}", response_model=StoredFileResponse)
async def get_file_details(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves detailed metadata for a specific stored file."""
    return await StorageService.get_file(db=db, user=current_user, file_id=file_id)

@router.delete("/{file_id}", status_code=status.HTTP_200_OK)
async def delete_file(
    file_id: uuid.UUID,
    delete_torrent: bool = Query(False, description="Also delete parent torrent job if no other files remain"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Permanently deletes a stored file from cloud storage and frees up user quota."""
    freed_bytes = await StorageService.delete_file(
        db=db,
        user=current_user,
        file_id=file_id,
        delete_torrent=delete_torrent
    )
    return {
        "status": "deleted",
        "file_id": file_id,
        "freed_bytes": freed_bytes
    }

@router.post("/bulk-delete", response_model=BulkDeleteResponse)
async def bulk_delete_files(
    payload: BulkDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Batch deletes multiple files in a single atomic transaction."""
    return await StorageService.bulk_delete_files(
        db=db,
        user=current_user,
        file_ids=payload.file_ids
    )

@router.post("/sync", status_code=status.HTTP_200_OK)
async def sync_storage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Forces recalculation and synchronization of user storage usage against stored files."""
    used_bytes = await StorageService.reconcile_user_storage(db=db, user_id=current_user.id)
    await db.commit()
    return {
        "status": "synchronized",
        "user_id": current_user.id,
        "used_bytes": used_bytes
    }
