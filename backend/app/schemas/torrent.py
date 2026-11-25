import uuid
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class TorrentFileItem(BaseModel):
    file_index: int
    filename: str
    relative_path: str
    file_size: int
    is_selected: bool = True

class MagnetInspectRequest(BaseModel):
    magnet_uri: str = Field(min_length=10)

class TorrentInspectResponse(BaseModel):
    info_hash: str
    name: str
    total_size: int
    piece_count: int
    piece_length: int
    files: list[TorrentFileItem]
    trackers: list[str]
    is_magnet: bool

class TorrentCreateRequest(BaseModel):
    magnet_uri: str | None = None
    torrent_file_b64: str | None = None
    selected_indices: list[int] | None = None
    priority: int = Field(default=5, ge=1, le=10)

class JobPriorityUpdateRequest(BaseModel):
    priority: int = Field(ge=1, le=10)

class TorrentFileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    file_index: int
    filename: str
    relative_path: str
    file_size: int
    is_selected: bool
    is_completed: bool

class TorrentJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    info_hash: str
    torrent_name: str
    status: str
    total_size: int
    downloaded_bytes: int
    uploaded_bytes: int
    progress: float
    download_speed: int
    upload_speed: int
    eta_seconds: int | None
    peers_connected: int
    seeds_connected: int
    priority: int = 5
    retry_count: int = 0
    max_retries: int = 3
    error_message: str | None
    created_at: datetime
    queued_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    updated_at: datetime
    files: list[TorrentFileRead] = []

class QueueConfigRead(BaseModel):
    global_max_concurrent_downloads: int
    default_max_active_jobs: int
    download_speed_limit_kbps: int
    upload_speed_limit_kbps: int
    max_queued_jobs_per_user: int

class QueueConfigUpdate(BaseModel):
    global_max_concurrent_downloads: int | None = Field(default=None, ge=1, le=100)
    default_max_active_jobs: int | None = Field(default=None, ge=1, le=20)
    download_speed_limit_kbps: int | None = Field(default=None, ge=0)
    upload_speed_limit_kbps: int | None = Field(default=None, ge=0)

class QueueStatsResponse(BaseModel):
    global_active: int
    global_limit: int
    user_active: int
    user_limit: int
    user_queued: int
    total_queued: int
