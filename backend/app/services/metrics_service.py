import time
import shutil
import psutil
from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.metrics import (
    SystemMetricsResponse,
    CpuMetrics,
    MemoryMetrics,
    DiskMetrics,
    EngineMetrics,
    WorkerMetrics
)
from app.core.torrent_session import TorrentSessionManager
from app.core.redis import get_redis
from app.config import settings
from app.core.logging import logger

_STARTUP_TIME = time.time()

class MetricsService:

    @staticmethod
    async def get_system_metrics(db: AsyncSession) -> SystemMetricsResponse:
        """
        Gathers live operational health metrics: CPU, Memory, Disk, libtorrent cluster,
        Redis broker, and database status.
        """
        # 1. CPU
        try:
            cpu_pct = psutil.cpu_percent(interval=None)
            cpu_cores = psutil.cpu_count(logical=True) or 1
        except Exception:
            cpu_pct = 0.0
            cpu_cores = 1

        cpu = CpuMetrics(usage_percent=cpu_pct, cores_count=cpu_cores)

        # 2. Memory
        try:
            mem = psutil.virtual_memory()
            memory = MemoryMetrics(
                total_bytes=mem.total,
                available_bytes=mem.available,
                used_bytes=mem.used,
                usage_percent=mem.percent
            )
        except Exception:
            memory = MemoryMetrics(
                total_bytes=0,
                available_bytes=0,
                used_bytes=0,
                usage_percent=0.0
            )

        # 3. Disk
        try:
            storage_paths = settings.get_absolute_storage_paths()
            disk_raw = shutil.disk_usage(str(storage_paths["completed"]))
            used_pct = round((disk_raw.used / disk_raw.total * 100), 1) if disk_raw.total > 0 else 0.0
            disk = DiskMetrics(
                total_bytes=disk_raw.total,
                used_bytes=disk_raw.used,
                free_bytes=disk_raw.free,
                usage_percent=used_pct
            )
        except Exception:
            disk = DiskMetrics(
                total_bytes=0,
                used_bytes=0,
                free_bytes=0,
                usage_percent=0.0
            )

        # 4. Engine Metrics
        manager = TorrentSessionManager.get_instance()
        active_handles = list(manager.handles.values())
        downloading_count = 0
        seeding_count = 0
        total_peers = 0
        global_dl_speed = 0
        global_ul_speed = 0

        for h in active_handles:
            try:
                st = h.status()
                global_dl_speed += st.download_rate
                global_ul_speed += st.upload_rate
                total_peers += st.num_peers
                if st.is_seeding:
                    seeding_count += 1
                elif st.state in [3, 4]:  # downloading / downloading metadata
                    downloading_count += 1
            except Exception:
                pass

        engine = EngineMetrics(
            active_torrents=len(active_handles),
            downloading_torrents=downloading_count,
            seeding_torrents=seeding_count,
            total_peers=total_peers,
            global_download_speed=global_dl_speed,
            global_upload_speed=global_ul_speed
        )

        # 5. Workers & Backend Health
        redis_ok = False
        try:
            redis = await get_redis()
            if redis and await redis.ping():
                redis_ok = True
        except Exception:
            redis_ok = False

        db_ok = False
        try:
            await db.execute(text("SELECT 1"))
            db_ok = True
        except Exception:
            db_ok = False

        uptime = round(time.time() - _STARTUP_TIME, 1)

        workers = WorkerMetrics(
            redis_connected=redis_ok,
            db_connected=db_ok,
            active_workers=1 if redis_ok else 0,
            uptime_seconds=uptime
        )

        return SystemMetricsResponse(
            cpu=cpu,
            memory=memory,
            disk=disk,
            engine=engine,
            workers=workers,
            timestamp=datetime.now(timezone.utc).isoformat()
        )
