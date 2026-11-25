import os
import sys
import time
from celery import Celery
from app.config import settings

# Windows Redis Compatibility Patch for MSOpenTech Redis (Redis 3.0.x on Windows)
if sys.platform == "win32":
    try:
        import kombu.transport.redis as kr
        def _safe_refresh_binding(self):
            def execute(keys, args, client):
                try:
                    key, deadlines_key = keys[0], keys[1]
                    member, exchange, ttl = args[0], args[1], args[2]
                    ms = int(time.time() * 1000)
                    with client.pipeline() as pipe:
                        pipe.sadd(key, member)
                        pipe.zadd(deadlines_key, {exchange: ms + int(ttl)})
                        pipe.execute()
                except Exception:
                    pass
            return execute

        def _safe_sweep_bindings(self):
            def execute(keys, args, client):
                return 0
            return execute

        kr.Channel._refresh_binding = property(_safe_refresh_binding)
        kr.Channel._sweep_bindings = property(_safe_sweep_bindings)
    except Exception:
        pass

# Initialize Celery app
celery_app = Celery(
    "cloudtorrent",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.queue_tasks",
        "app.tasks.torrent_tasks",
    ]
)

# Celery Configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600 * 24,  # 24-hour limit
    broker_connection_retry_on_startup=True,
    worker_prefetch_multiplier=1,
    worker_concurrency=1 if sys.platform == "win32" else settings.GLOBAL_MAX_CONCURRENT_DOWNLOADS,
    worker_pool="solo" if sys.platform == "win32" else "prefork",
    beat_schedule={
        "schedule-queued-jobs-every-5s": {
            "task": "app.tasks.queue_tasks.schedule_queued_jobs",
            "schedule": 5.0,
        },
        "sync-active-telemetry-every-2s": {
            "task": "app.tasks.torrent_tasks.sync_active_telemetry",
            "schedule": 2.0,
        },
    }
)
