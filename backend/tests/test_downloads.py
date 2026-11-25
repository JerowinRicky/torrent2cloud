import os
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.database import async_session_factory
from app.models.storage import StoredFile
from app.models.torrent import TorrentJob
from app.services.auth_service import DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD
from app.config import settings

@pytest.mark.asyncio
async def test_secure_download_service_e2e(async_client: AsyncClient):
    # 1. Login
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": DEFAULT_ADMIN_EMAIL, "password": DEFAULT_ADMIN_PASSWORD}
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Seed a physical test file and StoredFile record
    async with async_session_factory() as session:
        user_res = await session.execute(text(f"SELECT id FROM users WHERE email = '{DEFAULT_ADMIN_EMAIL}'"))
        user_id = user_res.scalar()

        storage_paths = settings.get_absolute_storage_paths()
        job_dir = storage_paths["completed"] / str(user_id) / "test_download_job"
        job_dir.mkdir(parents=True, exist_ok=True)

        payload_bytes = b"0123456789ABCDEF" * 6400  # Exactly 102,400 bytes (100 KB)
        test_file_path = job_dir / "streaming_demo.bin"
        with open(test_file_path, "wb") as f:
            f.write(payload_bytes)

        file_id = uuid.uuid4()
        stored_file = StoredFile(
            id=file_id,
            user_id=user_id,
            job_id=None,
            filename="streaming_demo.bin",
            relative_path="streaming_demo.bin",
            file_size=len(payload_bytes),
            extension="bin",
            mime_type="application/octet-stream",
            category="OTHER",
            storage_path=str(test_file_path),
            is_available=True
        )
        session.add(stored_file)
        await session.commit()

    # 3. Generate signed download link
    gen_resp = await async_client.post(
        "/api/v1/downloads/generate",
        headers=headers,
        json={"file_id": str(file_id), "expires_in_hours": 24}
    )
    assert gen_resp.status_code == 201
    gen_data = gen_resp.json()
    signed_token = gen_data["token"]
    link_id = gen_data["link_id"]
    assert gen_data["file_size"] == 102400
    assert gen_data["filename"] == "streaming_demo.bin"

    # 4. List user links
    links_resp = await async_client.get("/api/v1/downloads/links", headers=headers)
    assert links_resp.status_code == 200
    links_data = links_resp.json()
    assert links_data["total"] >= 1
    assert any(l["link_id"] == link_id for l in links_data["items"])

    # 5. Full file download (WITHOUT Authorization header - simulating external client / browser)
    dl_resp = await async_client.get(f"/api/v1/downloads/file/{signed_token}")
    assert dl_resp.status_code == 200
    assert dl_resp.headers["Content-Length"] == "102400"
    assert dl_resp.headers["Accept-Ranges"] == "bytes"
    assert "attachment; filename=\"streaming_demo.bin\"" in dl_resp.headers["Content-Disposition"]
    assert dl_resp.content == payload_bytes

    # 6. HTTP Range Request (First 100 bytes)
    range_resp1 = await async_client.get(
        f"/api/v1/downloads/file/{signed_token}",
        headers={"Range": "bytes=0-99"}
    )
    assert range_resp1.status_code == 206
    assert range_resp1.headers["Content-Range"] == "bytes 0-99/102400"
    assert range_resp1.headers["Content-Length"] == "100"
    assert range_resp1.content == payload_bytes[:100]

    # 7. HTTP Range Request (Middle 500 bytes: 1000-1499)
    range_resp2 = await async_client.get(
        f"/api/v1/downloads/file/{signed_token}",
        headers={"Range": "bytes=1000-1499"}
    )
    assert range_resp2.status_code == 206
    assert range_resp2.headers["Content-Range"] == "bytes 1000-1499/102400"
    assert range_resp2.headers["Content-Length"] == "500"
    assert range_resp2.content == payload_bytes[1000:1500]

    # 8. HTTP Range Request (Suffix: last 200 bytes)
    range_resp3 = await async_client.get(
        f"/api/v1/downloads/file/{signed_token}",
        headers={"Range": "bytes=-200"}
    )
    assert range_resp3.status_code == 206
    assert range_resp3.headers["Content-Range"] == "bytes 102200-102399/102400"
    assert range_resp3.headers["Content-Length"] == "200"
    assert range_resp3.content == payload_bytes[-200:]

    # 9. Unsatisfiable Range Check (bytes=200000-300000)
    invalid_range_resp = await async_client.get(
        f"/api/v1/downloads/file/{signed_token}",
        headers={"Range": "bytes=200000-300000"}
    )
    assert invalid_range_resp.status_code == 416
    assert invalid_range_resp.headers["Content-Range"] == "bytes */102400"

    # 10. Tampered Token Check
    tampered_token = signed_token[:-4] + "XXXX"
    tampered_resp = await async_client.get(f"/api/v1/downloads/file/{tampered_token}")
    assert tampered_resp.status_code == 401

    # 11. Revoke Download Link
    revoke_resp = await async_client.delete(f"/api/v1/downloads/links/{link_id}", headers=headers)
    assert revoke_resp.status_code == 200
    assert revoke_resp.json()["status"] == "revoked"

    # 12. Attempt to download with revoked link -> 403 Forbidden
    blocked_resp = await async_client.get(f"/api/v1/downloads/file/{signed_token}")
    assert blocked_resp.status_code == 403
