import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class DownloadLinkGenerateRequest(BaseModel):
    file_id: uuid.UUID
    expires_in_hours: int = Field(default=24, ge=1, le=168, description="Expiration time in hours (1h - 7d)")

class DownloadLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    link_id: uuid.UUID
    file_id: uuid.UUID
    token: str
    download_url: str
    expires_at: datetime
    is_revoked: bool
    download_count: int
    last_downloaded_at: datetime | None = None
    filename: str
    file_size: int
    category: str
    mime_type: str

class DownloadLinkListResponse(BaseModel):
    items: list[DownloadLinkResponse]
    total: int

class MultiFileDownloadRequest(BaseModel):
    file_ids: list[uuid.UUID]
    expires_in_hours: int = Field(default=24, ge=1, le=168)

class MultiFileDownloadResponse(BaseModel):
    links: list[DownloadLinkResponse]
