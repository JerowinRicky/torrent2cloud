import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class ActivityEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None = None
    event_type: str
    severity: str
    title: str
    description: str
    entity_type: str | None = None
    entity_id: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    meta_data: str | None = None
    created_at: datetime
    user_name: str | None = None

class ActivityListResponse(BaseModel):
    items: list[ActivityEventResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
