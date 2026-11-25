import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import require_admin
from app.models.user import User
from app.schemas.admin import (
    AdminUserResponse,
    AdminUserUpdateRequest,
    AdminUserListResponse,
    AdminGlobalTorrentResponse,
    AdminGlobalTorrentListResponse,
    AdminSystemSettingItem,
    AdminSystemSettingsUpdate
)
from app.services.admin_service import AdminService

router = APIRouter()

# ---------------------------------------------------------------------------
# User Administration & Quota Governance
# ---------------------------------------------------------------------------

@router.get("/users", response_model=AdminUserListResponse)
async def list_admin_users(
    search: Optional[str] = Query(None, description="Search users by email or full name"),
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Lists all registered users along with their storage quotas, active jobs count, and file counts."""
    users = await AdminService.list_users(db=db, search=search)
    return AdminUserListResponse(items=users, total=len(users))

@router.get("/users/{user_id}", response_model=AdminUserResponse)
async def get_admin_user(
    user_id: uuid.UUID,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves full admin details for a specific user account."""
    return await AdminService.get_user(db=db, user_id=user_id)

@router.patch("/users/{user_id}", response_model=AdminUserResponse)
async def update_admin_user(
    user_id: uuid.UUID,
    payload: AdminUserUpdateRequest,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Modifies user quotas, maximum active jobs, roles, or account activation state."""
    return await AdminService.update_user(
        db=db,
        admin_user=current_admin,
        target_user_id=user_id,
        payload=payload
    )

# ---------------------------------------------------------------------------
# Global Torrents Oversight
# ---------------------------------------------------------------------------

@router.get("/torrents", response_model=AdminGlobalTorrentListResponse)
async def list_admin_torrents(
    status: Optional[str] = Query(None, description="Filter by job status: DOWNLOADING, QUEUED, PAUSED, COMPLETED"),
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Lists all torrent jobs cluster-wide across all platform users."""
    jobs = await AdminService.list_global_torrents(db=db, status_filter=status)
    return AdminGlobalTorrentListResponse(items=jobs, total=len(jobs))

@router.post("/torrents/{job_id}/{action}", status_code=status.HTTP_200_OK)
async def manage_admin_torrent(
    job_id: uuid.UUID,
    action: str,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Executes administrative action (pause, resume, cancel, delete) on any user's torrent job."""
    return await AdminService.manage_torrent(
        db=db,
        admin_user=current_admin,
        job_id=job_id,
        action=action
    )

# ---------------------------------------------------------------------------
# Runtime Cluster Settings
# ---------------------------------------------------------------------------

@router.get("/settings", response_model=list[AdminSystemSettingItem])
async def get_system_settings(
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Lists all cluster settings and limits."""
    return await AdminService.get_settings(db=db)

@router.put("/settings", response_model=list[AdminSystemSettingItem])
async def update_system_settings(
    payload: AdminSystemSettingsUpdate,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Updates runtime cluster parameters and applies bandwidth rate limits."""
    return await AdminService.update_settings(
        db=db,
        admin_user=current_admin,
        updates=payload.settings
    )
