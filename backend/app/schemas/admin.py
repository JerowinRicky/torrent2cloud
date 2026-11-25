import uuid
from datetime import datetime
from typing import Optional, Dict
from pydantic import BaseModel, Field, ConfigDict

class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    storage_quota_bytes: int
    max_active_jobs: int
    used_bytes: int
    active_jobs_count: int
    stored_files_count: int
    created_at: datetime
    updated_at: datetime

class AdminUserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = Field(None, pattern="^(USER|ADMIN)$")
    is_active: Optional[bool] = None
    storage_quota_bytes: Optional[int] = Field(None, ge=1024 * 1024)
    max_active_jobs: Optional[int] = Field(None, ge=1, le=50)

class AdminUserListResponse(BaseModel):
    items: list[AdminUserResponse]
    total: int

class AdminGlobalTorrentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    user_email: str
    user_name: str
    info_hash: str
    torrent_name: str
    status: str
    total_size: int
    downloaded_bytes: int
    uploaded_bytes: int
    progress: float
    download_speed: int
    upload_speed: int
    eta_seconds: Optional[int] = None
    peers_connected: int
    seeds_connected: int
    priority: int
    created_at: datetime

class AdminGlobalTorrentListResponse(BaseModel):
    items: list[AdminGlobalTorrentResponse]
    total: int

class AdminSystemSettingItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    value: str
    description: Optional[str] = None
    updated_at: datetime

class AdminSystemSettingsUpdate(BaseModel):
    settings: Dict[str, str]
