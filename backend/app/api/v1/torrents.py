import uuid
from fastapi import APIRouter, Depends, UploadFile, File, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.core.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.torrent import TorrentJob
from app.schemas.torrent import (
    MagnetInspectRequest,
    TorrentInspectResponse,
    TorrentCreateRequest,
    TorrentJobRead,
    JobPriorityUpdateRequest,
    QueueConfigRead,
    QueueConfigUpdate,
    QueueStatsResponse
)
from app.services.torrent_service import TorrentService
from app.services.queue_service import QueueService

router = APIRouter(prefix="/torrents", tags=["Torrents & Queue"])

@router.post("/inspect-magnet", response_model=TorrentInspectResponse, summary="Inspect magnet link metadata")
async def inspect_magnet(
    payload: MagnetInspectRequest,
    current_user: User = Depends(get_current_user)
):
    return TorrentService.inspect_magnet(payload.magnet_uri)

@router.post("/inspect-file", response_model=TorrentInspectResponse, summary="Inspect uploaded .torrent file")
async def inspect_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    contents = await file.read()
    return TorrentService.inspect_torrent_file(contents)

@router.post("/create", response_model=TorrentJobRead, status_code=status.HTTP_201_CREATED, summary="Create a new torrent download job")
async def create_torrent(
    payload: TorrentCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await TorrentService.create_job(db, current_user, payload)

@router.get("/queue/stats", response_model=QueueStatsResponse, summary="Get download queue statistics")
async def get_queue_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cfg = await QueueService.get_queue_config(db)
    
    # Global active
    global_act_q = select(func.count()).select_from(TorrentJob).where(
        TorrentJob.status.in_(["DOWNLOADING", "FETCHING_METADATA"])
    )
    global_active = (await db.execute(global_act_q)).scalar() or 0

    # User active
    user_act_q = select(func.count()).select_from(TorrentJob).where(
        and_(
            TorrentJob.user_id == current_user.id,
            TorrentJob.status.in_(["DOWNLOADING", "FETCHING_METADATA"])
        )
    )
    user_active = (await db.execute(user_act_q)).scalar() or 0

    # User queued
    user_q_q = select(func.count()).select_from(TorrentJob).where(
        and_(
            TorrentJob.user_id == current_user.id,
            TorrentJob.status == "QUEUED"
        )
    )
    user_queued = (await db.execute(user_q_q)).scalar() or 0

    # Total queued in system
    tot_q = select(func.count()).select_from(TorrentJob).where(
        TorrentJob.status == "QUEUED"
    )
    total_queued = (await db.execute(tot_q)).scalar() or 0

    return {
        "global_active": global_active,
        "global_limit": cfg["global_max_concurrent_downloads"],
        "user_active": user_active,
        "user_limit": current_user.max_active_jobs,
        "user_queued": user_queued,
        "total_queued": total_queued
    }

@router.get("/queue/config", response_model=QueueConfigRead, summary="Admin: Get global queue configuration")
async def get_queue_config(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    return await QueueService.get_queue_config(db)

@router.put("/queue/config", response_model=QueueConfigRead, summary="Admin: Update global queue and bandwidth limits")
async def update_queue_config(
    payload: QueueConfigUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    return await QueueService.update_queue_config(db, update_data)

@router.get("", response_model=list[TorrentJobRead], summary="List user torrent jobs")
async def list_torrents(
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await TorrentService.list_jobs(db, current_user, status_filter)

@router.get("/{job_id}", response_model=TorrentJobRead, summary="Get details for a specific torrent job")
async def get_torrent(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await TorrentService.get_job(db, current_user, job_id)

@router.post("/{job_id}/pause", response_model=TorrentJobRead, summary="Pause an active torrent download")
async def pause_torrent(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await TorrentService.pause_job(db, current_user, job_id)

@router.post("/{job_id}/resume", response_model=TorrentJobRead, summary="Resume a paused torrent download")
async def resume_torrent(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await TorrentService.resume_job(db, current_user, job_id)

@router.post("/{job_id}/cancel", response_model=TorrentJobRead, summary="Cancel an active torrent download")
async def cancel_torrent(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await TorrentService.cancel_job(db, current_user, job_id)

@router.post("/{job_id}/retry", response_model=TorrentJobRead, summary="Retry a failed or canceled job")
async def retry_torrent(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await QueueService.retry_job(db, current_user, job_id)

@router.patch("/{job_id}/priority", response_model=TorrentJobRead, summary="Change priority (1-10) of a job in the queue")
async def update_torrent_priority(
    job_id: uuid.UUID,
    payload: JobPriorityUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await QueueService.change_priority(db, current_user, job_id, payload.priority)

@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete torrent job from history")
async def delete_torrent(
    job_id: uuid.UUID,
    delete_files: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await TorrentService.delete_job(db, current_user, job_id, delete_files)
