import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.database import async_session_factory
from app.services.auth_service import DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD

@pytest.mark.asyncio
async def test_admin_governance_e2e(async_client: AsyncClient):
    # 1. Login as Admin
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": DEFAULT_ADMIN_EMAIL, "password": DEFAULT_ADMIN_PASSWORD}
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Create a standard (non-admin) user via database
    test_user_email = f"user_{uuid.uuid4().hex[:8]}@cloudtorrent.io"
    async with async_session_factory() as session:
        user_id = uuid.uuid4()
        await session.execute(
            text(
                "INSERT INTO users (id, email, hashed_password, full_name, role, is_active, storage_quota_bytes, max_active_jobs) "
                "VALUES (:id, :email, :pass, :name, 'USER', true, 53687091200, 3)"
            ),
            {
                "id": user_id,
                "email": test_user_email,
                "pass": "$2b$12$e8uq4f.Q9v4nB.3VwB6h9.iF1d2G3h4j5k6l7m8n9o0p1q2r3s4t5",
                "name": "Standard User"
            }
        )
        await session.commit()

    # 3. Verify user in admin users list
    users_resp = await async_client.get("/api/v1/admin/users", headers=admin_headers)
    assert users_resp.status_code == 200
    user_list = users_resp.json()
    assert user_list["total"] >= 2
    assert any(u["email"] == test_user_email for u in user_list["items"])

    # 4. Fetch single user details
    user_detail_resp = await async_client.get(f"/api/v1/admin/users/{user_id}", headers=admin_headers)
    assert user_detail_resp.status_code == 200
    detail = user_detail_resp.json()
    assert detail["email"] == test_user_email
    assert detail["role"] == "USER"
    assert detail["max_active_jobs"] == 3

    # 5. Modify user quotas and max active jobs
    new_quota = 100 * 1024 * 1024 * 1024  # 100 GB
    patch_resp = await async_client.patch(
        f"/api/v1/admin/users/{user_id}",
        headers=admin_headers,
        json={
            "storage_quota_bytes": new_quota,
            "max_active_jobs": 5,
            "full_name": "Standard User Updated"
        }
    )
    assert patch_resp.status_code == 200
    updated = patch_resp.json()
    assert updated["storage_quota_bytes"] == new_quota
    assert updated["max_active_jobs"] == 5
    assert updated["full_name"] == "Standard User Updated"

    # 6. Global Torrents list
    global_torrents = await async_client.get("/api/v1/admin/torrents", headers=admin_headers)
    assert global_torrents.status_code == 200
    assert "items" in global_torrents.json()

    # 7. System Settings query and update
    settings_resp = await async_client.get("/api/v1/admin/settings", headers=admin_headers)
    assert settings_resp.status_code == 200
    assert isinstance(settings_resp.json(), list)

    update_settings_resp = await async_client.put(
        "/api/v1/admin/settings",
        headers=admin_headers,
        json={"settings": {"default_download_rate_limit_kbps": "10240"}}
    )
    assert update_settings_resp.status_code == 200
    settings_list = update_settings_resp.json()
    assert any(s["key"] == "default_download_rate_limit_kbps" and s["value"] == "10240" for s in settings_list)

    # 8. Prevent self-lockout
    async with async_session_factory() as session:
        admin_res = await session.execute(text(f"SELECT id FROM users WHERE email = '{DEFAULT_ADMIN_EMAIL}'"))
        admin_id = admin_res.scalar()

    self_deactivate_resp = await async_client.patch(
        f"/api/v1/admin/users/{admin_id}",
        headers=admin_headers,
        json={"is_active": False}
    )
    assert self_deactivate_resp.status_code == 400
    assert "Cannot deactivate your own" in self_deactivate_resp.json()["detail"]
