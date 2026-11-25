import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.schemas.activity import ActivityListResponse
from app.schemas.metrics import SystemMetricsResponse
from app.services.activity_service import ActivityService
from app.services.metrics_service import MetricsService

router = APIRouter()

@router.get("/activity", response_model=ActivityListResponse)
async def list_activity_events(
    severity: Optional[str] = Query("ALL", description="Filter by severity: INFO, SUCCESS, WARNING, ERROR, CRITICAL"),
    event_type: Optional[str] = Query("ALL", description="Filter by event type"),
    search: Optional[str] = Query(None, description="Search event titles or descriptions"),
    cluster_wide: bool = Query(False, description="Whether to include cluster-wide events (Admin only)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns paginated audit and activity events. Regular users view their own events;
    admins can query cluster-wide logs.
    """
    return await ActivityService.list_events(
        db=db,
        user=current_user,
        severity=severity,
        event_type=event_type,
        search=search,
        page=page,
        page_size=page_size,
        cluster_wide=cluster_wide
    )

@router.get("/metrics", response_model=SystemMetricsResponse)
async def get_system_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns real-time cluster metrics including CPU usage, RAM allocation,
    storage disk capacity, libtorrent session telemetry, and Redis/DB status.
    """
    return await MetricsService.get_system_metrics(db=db)
