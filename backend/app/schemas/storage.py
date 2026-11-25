import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class StoredFileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    job_id: uuid.UUID | None = None
    torrent_file_id: uuid.UUID | None = None
    filename: str
    relative_path: str
    file_size: int
    extension: str
    mime_type: str
    category: str
    storage_path: str
    sha256_hash: str | None = None
    is_available: bool
    created_at: datetime
    updated_at: datetime
    torrent_name: str | None = None
    info_hash: str | None = None

class FileListResponse(BaseModel):
    items: list[StoredFileResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

class StorageCategoryStat(BaseModel):
    category: str
    count: int
    bytes: int

class DiskUsageStat(BaseModel):
    total_bytes: int
    used_bytes: int
    free_bytes: int

class StorageStatsResponse(BaseModel):
    quota_bytes: int
    used_bytes: int
    free_bytes: int
    usage_percentage: float
    is_near_capacity: bool
    total_files: int
    categories: list[StorageCategoryStat]
    disk_usage: DiskUsageStat

class BulkDeleteRequest(BaseModel):
    file_ids: list[uuid.UUID]

class BulkDeleteResponse(BaseModel):
    deleted_count: int
    freed_bytes: int
    failed_ids: list[uuid.UUID]
