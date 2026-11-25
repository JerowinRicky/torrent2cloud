import uuid
import math
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, and_, func, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityEvent
from app.models.user import User
from app.schemas.activity import ActivityEventResponse, ActivityListResponse
from app.core.logging import logger

class ActivityService:

    @staticmethod
    async def log_event(
        db: AsyncSession,
        event_type: str,
        title: str,
        description: str,
        user_id: Optional[uuid.UUID] = None,
        severity: str = "INFO",
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        meta_data: Optional[str] = None,
        auto_commit: bool = False
    ) -> ActivityEvent:
        """
        Creates and persists a structured audit log event.
        """
        event = ActivityEvent(
            id=uuid.uuid4(),
            user_id=user_id,
            event_type=event_type,
            severity=severity,
            title=title,
            description=description,
            entity_type=entity_type,
            entity_id=entity_id,
            ip_address=ip_address,
            user_agent=user_agent,
            meta_data=meta_data
        )
        db.add(event)
        if auto_commit:
            try:
                await db.commit()
            except Exception as e:
                logger.error(f"Failed to auto-commit activity event: {e}")
                await db.rollback()

        # Telemetry notification to active WebSockets
        try:
            from app.services.telemetry_service import TelemetryService
            await TelemetryService.notify_status_change(
                user_id=user_id,
                job_id=entity_id if entity_type == "TORRENT" else None,
                status=event_type
            )
        except Exception:
            pass

        return event

    @staticmethod
    async def list_events(
        db: AsyncSession,
        user: User,
        severity: Optional[str] = None,
        event_type: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        cluster_wide: bool = False
    ) -> ActivityListResponse:
        """
        Queries paginated activity and audit logs. Regular users view their own events;
        admins can optionally view cluster-wide events.
        """
        query = select(ActivityEvent)

        # Non-admins or non-cluster-wide requests are scoped to the user
        if not (user.role == "ADMIN" and cluster_wide):
            query = query.where(ActivityEvent.user_id == user.id)

        if severity and severity.upper() != "ALL":
            query = query.where(ActivityEvent.severity == severity.upper())

        if event_type and event_type.upper() != "ALL":
            query = query.where(ActivityEvent.event_type == event_type.upper())

        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.where(
                (ActivityEvent.title.ilike(term)) | 
                (ActivityEvent.description.ilike(term))
            )

        # Count total
        count_stmt = select(func.count()).select_from(query.subquery())
        total_items = (await db.execute(count_stmt)).scalar() or 0

        # Order by newest first
        query = query.order_by(desc(ActivityEvent.created_at))

        # Pagination
        offset = max(0, (page - 1) * page_size)
        query = query.offset(offset).limit(page_size).options(selectinload(ActivityEvent.user))

        result = await db.execute(query)
        events = result.scalars().all()

        items = []
        for ev in events:
            items.append(
                ActivityEventResponse(
                    id=ev.id,
                    user_id=ev.user_id,
                    event_type=ev.event_type,
                    severity=ev.severity,
                    title=ev.title,
                    description=ev.description,
                    entity_type=ev.entity_type,
                    entity_id=ev.entity_id,
                    ip_address=ev.ip_address,
                    user_agent=ev.user_agent,
                    meta_data=ev.meta_data,
                    created_at=ev.created_at,
                    user_name=ev.user.full_name if ev.user else "System"
                )
            )

        total_pages = math.ceil(total_items / page_size) if page_size > 0 else 1

        return ActivityListResponse(
            items=items,
            total=total_items,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
