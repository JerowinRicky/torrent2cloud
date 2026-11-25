from pydantic import BaseModel
from typing import Dict, Any

class CpuMetrics(BaseModel):
    usage_percent: float
    cores_count: int

class MemoryMetrics(BaseModel):
    total_bytes: int
    available_bytes: int
    used_bytes: int
    usage_percent: float

class DiskMetrics(BaseModel):
    total_bytes: int
    used_bytes: int
    free_bytes: int
    usage_percent: float

class EngineMetrics(BaseModel):
    active_torrents: int
    downloading_torrents: int
    seeding_torrents: int
    total_peers: int
    global_download_speed: int
    global_upload_speed: int

class WorkerMetrics(BaseModel):
    redis_connected: bool
    db_connected: bool
    active_workers: int
    uptime_seconds: float

class SystemMetricsResponse(BaseModel):
    cpu: CpuMetrics
    memory: MemoryMetrics
    disk: DiskMetrics
    engine: EngineMetrics
    workers: WorkerMetrics
    timestamp: str
