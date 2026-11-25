import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.services.auth_service import DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD
from app.tasks.queue_tasks import schedule_queued_jobs
from app.tasks.torrent_tasks import sync_active_telemetry

@pytest.mark.asyncio
async def test_download_queue_e2e():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Login as Administrator
        login_res = await client.post("/api/v1/auth/login", json={
            "email": DEFAULT_ADMIN_EMAIL,
            "password": DEFAULT_ADMIN_PASSWORD
        })
        assert login_res.status_code == 200
        admin_tokens = login_res.json()
        headers = {"Authorization": f"Bearer {admin_tokens['access_token']}"}

        # 2. Get initial queue statistics
        stats_res = await client.get("/api/v1/torrents/queue/stats", headers=headers)
        assert stats_res.status_code == 200
        stats = stats_res.json()
        assert "global_active" in stats
        assert "global_limit" in stats
        assert "user_active" in stats
        assert "user_limit" in stats

        # 3. Read and update queue config (Admin only)
        cfg_res = await client.get("/api/v1/torrents/queue/config", headers=headers)
        assert cfg_res.status_code == 200
        initial_cfg = cfg_res.json()
        assert initial_cfg["global_max_concurrent_downloads"] > 0

        # Update bandwidth limit and capacity
        update_res = await client.put(
            "/api/v1/torrents/queue/config",
            headers=headers,
            json={
                "global_max_concurrent_downloads": 15,
                "download_speed_limit_kbps": 50000,
                "upload_speed_limit_kbps": 10000
            }
        )
        assert update_res.status_code == 200
        updated_cfg = update_res.json()
        assert updated_cfg["global_max_concurrent_downloads"] == 15
        assert updated_cfg["download_speed_limit_kbps"] == 50000

        # 4. Create an invited test user with max_active_jobs = 1 to test queue promotion
        rand_id = uuid.uuid4().hex[:6]
        test_email = f"queue_tester_{rand_id}@example.com"
        
        inv_res = await client.post(
            "/api/v1/auth/invitations",
            headers=headers,
            json={"email": test_email, "expires_in_days": 1}
        )
        assert inv_res.status_code == 201
        inv_code = inv_res.json()["code"]

        reg_res = await client.post("/api/v1/auth/register", json={
            "invitation_code": inv_code,
            "email": test_email,
            "password": "Password123!",
            "full_name": "Queue Tester"
        })
        assert reg_res.status_code == 201

        user_login = await client.post("/api/v1/auth/login", json={
            "email": test_email,
            "password": "Password123!"
        })
        user_tokens = user_login.json()
        user_headers = {"Authorization": f"Bearer {user_tokens['access_token']}"}

        # User's default max_active_jobs is 3
        # Job 1: Magnet Link 1 (Starts DOWNLOADING/FETCHING_METADATA)
        h1 = uuid.uuid4().hex + uuid.uuid4().hex[:8]
        m1 = f"magnet:?xt=urn:btih:{h1}&dn=Job1_Active"
        job1_res = await client.post(
            "/api/v1/torrents/create",
            headers=user_headers,
            json={"magnet_uri": m1, "priority": 5}
        )
        assert job1_res.status_code == 201
        job1 = job1_res.json()
        assert job1["status"] in ["DOWNLOADING", "FETCHING_METADATA"]

        # Job 2: Magnet Link 2 (Starts active)
        h2 = uuid.uuid4().hex + uuid.uuid4().hex[:8]
        m2 = f"magnet:?xt=urn:btih:{h2}&dn=Job2_Active"
        job2_res = await client.post(
            "/api/v1/torrents/create",
            headers=user_headers,
            json={"magnet_uri": m2, "priority": 5}
        )
        assert job2_res.status_code == 201
        job2 = job2_res.json()
        assert job2["status"] in ["DOWNLOADING", "FETCHING_METADATA"]

        # Job 3: Magnet Link 3 (Starts active, hits user max_active_jobs=3)
        h3 = uuid.uuid4().hex + uuid.uuid4().hex[:8]
        m3 = f"magnet:?xt=urn:btih:{h3}&dn=Job3_Active"
        job3_res = await client.post(
            "/api/v1/torrents/create",
            headers=user_headers,
            json={"magnet_uri": m3, "priority": 5}
        )
        assert job3_res.status_code == 201
        job3 = job3_res.json()
        assert job3["status"] in ["DOWNLOADING", "FETCHING_METADATA"]

        # Job 4: Magnet Link 4 (Must enter QUEUED state!)
        h4 = uuid.uuid4().hex + uuid.uuid4().hex[:8]
        m4 = f"magnet:?xt=urn:btih:{h4}&dn=Job4_Queued"
        job4_res = await client.post(
            "/api/v1/torrents/create",
            headers=user_headers,
            json={"magnet_uri": m4, "priority": 3}
        )
        assert job4_res.status_code == 201
        job4 = job4_res.json()
        assert job4["status"] == "QUEUED"
        assert job4["queued_at"] is not None

        # 5. Check queue stats reflect the queued job
        q_stats = await client.get("/api/v1/torrents/queue/stats", headers=user_headers)
        assert q_stats.json()["user_queued"] >= 1

        # 6. Change priority of Job 4 to High (8)
        prio_res = await client.patch(
            f"/api/v1/torrents/{job4['id']}/priority",
            headers=user_headers,
            json={"priority": 8}
        )
        assert prio_res.status_code == 200
        assert prio_res.json()["priority"] == 8

        # 7. Cancel Job 1 -> This frees a slot and automatically promotes Job 4 from QUEUED!
        cancel_res = await client.post(
            f"/api/v1/torrents/{job1['id']}/cancel",
            headers=user_headers
        )
        assert cancel_res.status_code == 200
        assert cancel_res.json()["status"] == "CANCELED"

        # Verify Job 4 has now been automatically promoted to DOWNLOADING/FETCHING_METADATA
        promoted_job4 = await client.get(
            f"/api/v1/torrents/{job4['id']}",
            headers=user_headers
        )
        assert promoted_job4.status_code == 200
        assert promoted_job4.json()["status"] in ["DOWNLOADING", "FETCHING_METADATA"]

        # 8. Test Retry on Job 1 (which is CANCELED)
        retry_res = await client.post(
            f"/api/v1/torrents/{job1['id']}/retry",
            headers=user_headers
        )
        assert retry_res.status_code == 200
        retried_job = retry_res.json()
        assert retried_job["retry_count"] == 1
        assert retried_job["status"] in ["DOWNLOADING", "FETCHING_METADATA", "QUEUED"]

        # 9. Verify Celery background tasks run without error
        scheduled = schedule_queued_jobs()
        assert isinstance(scheduled, list)

        synced = sync_active_telemetry()
        assert isinstance(synced, int)
