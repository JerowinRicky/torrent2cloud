import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.database import async_session_factory
from app.services.auth_service import DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD
from app.services.activity_service import ActivityService

@pytest.mark.asyncio
async def test_monitoring_and_activity_audit_e2e(async_client: AsyncClient):
    # 1. Login
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": DEFAULT_ADMIN_EMAIL, "password": DEFAULT_ADMIN_PASSWORD}
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Query System Metrics
    metrics_resp = await async_client.get("/api/v1/monitoring/metrics", headers=headers)
    assert metrics_resp.status_code == 200
    metrics = metrics_resp.json()
    assert "cpu" in metrics
    assert "memory" in metrics
    assert "disk" in metrics
    assert "engine" in metrics
    assert "workers" in metrics
    assert metrics["workers"]["db_connected"] is True
    assert metrics["memory"]["total_bytes"] > 0
    assert metrics["disk"]["total_bytes"] > 0

    # 3. Log simulated activity audit events
    async with async_session_factory() as session:
        user_res = await session.execute(text(f"SELECT id FROM users WHERE email = '{DEFAULT_ADMIN_EMAIL}'"))
        user_id = user_res.scalar()

        ev1 = await ActivityService.log_event(
            db=session,
            event_type="TORRENT_ADDED",
            severity="INFO",
            title="Download Job Queued",
            description="Submitted test torrent metadata",
            user_id=user_id,
            entity_type="TORRENT",
            entity_id=str(uuid.uuid4())
        )
        ev2 = await ActivityService.log_event(
            db=session,
            event_type="DOWNLOAD_COMPLETED",
            severity="SUCCESS",
            title="Download Finished",
            description="Finished downloading Ubuntu 24.04 ISO",
            user_id=user_id,
            entity_type="TORRENT",
            entity_id=str(uuid.uuid4())
        )
        ev3 = await ActivityService.log_event(
            db=session,
            event_type="FILE_DELETED",
            severity="WARNING",
            title="Cloud File Removed",
            description="Permanently deleted sample video",
            user_id=user_id,
            entity_type="FILE",
            entity_id=str(uuid.uuid4())
        )
        await session.commit()

    # 4. Query Activity Events
    activity_resp = await async_client.get("/api/v1/monitoring/activity", headers=headers)
    assert activity_resp.status_code == 200
    act_data = activity_resp.json()
    assert act_data["total"] == 3
    assert len(act_data["items"]) == 3

    # 5. Filter by severity
    filter_resp = await async_client.get("/api/v1/monitoring/activity?severity=SUCCESS", headers=headers)
    assert filter_resp.status_code == 200
    success_items = filter_resp.json()["items"]
    assert len(success_items) == 1
    assert success_items[0]["title"] == "Download Finished"

    # 6. Search events
    search_resp = await async_client.get("/api/v1/monitoring/activity?search=Ubuntu", headers=headers)
    assert search_resp.status_code == 200
    search_items = search_resp.json()["items"]
    assert len(search_items) == 1
    assert "Ubuntu 24.04" in search_items[0]["description"]

    # 7. Cluster-wide admin parameter
    admin_resp = await async_client.get("/api/v1/monitoring/activity?cluster_wide=true", headers=headers)
    assert admin_resp.status_code == 200
    assert admin_resp.json()["total"] == 3
