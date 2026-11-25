import uuid
from app.core.celery_app import celery_app
from app.core.task_db import get_task_db, run_task_async
from app.services.queue_service import QueueService
from app.models.user import User
from app.core.logging import logger

@celery_app.task(name="app.tasks.queue_tasks.schedule_queued_jobs")
def schedule_queued_jobs() -> list[str]:
    """
    Periodic or event-triggered task to inspect the download queue
    and promote waiting jobs to DOWNLOADING based on active limits.
    """
    async def _run():
        async with get_task_db() as db:
            promoted = await QueueService.schedule_next_jobs(db)
            return [str(pid) for pid in promoted]

    try:
        promoted = run_task_async(_run)
        if promoted:
            logger.info(f"[Celery] Scheduled {len(promoted)} queued jobs: {promoted}")
        return promoted
    except Exception as e:
        logger.error(f"[Celery] Error in schedule_queued_jobs: {e}")
        return []

@celery_app.task(name="app.tasks.queue_tasks.retry_job_task")
def retry_job_task(job_id_str: str, user_id_str: str) -> bool:
    """
    Background task to retry a failed job.
    """
    async def _run():
        async with get_task_db() as db:
            user = await db.get(User, uuid.UUID(user_id_str))
            if not user:
                return False
            await QueueService.retry_job(db, user, uuid.UUID(job_id_str))
            return True

    try:
        return run_task_async(_run)
    except Exception as e:
        logger.error(f"[Celery] Error in retry_job_task: {e}")
        return False

@celery_app.task(name="app.tasks.queue_tasks.recover_interrupted_jobs")
def recover_interrupted_jobs() -> int:
    """
    Recovers unmanaged active jobs on worker boot.
    """
    async def _run():
        async with get_task_db() as db:
            return await QueueService.recover_interrupted_jobs(db)

    try:
        count = run_task_async(_run)
        logger.info(f"[Celery] Recovered {count} interrupted jobs.")
        return count
    except Exception as e:
        logger.error(f"[Celery] Error in recover_interrupted_jobs: {e}")
        return 0
