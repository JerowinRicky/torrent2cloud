import os
import uuid
import pytest
from httpx import AsyncClient
from pathlib import Path
from sqlalchemy import text

from app.core.database import async_session_factory
from app.models.torrent import TorrentJob
from app.models.file import TorrentFile
from app.models.user import User
from app.services.auth_service import DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD
from app.services.storage_service import StorageService
from app.config import settings

@pytest.mark.asyncio
async def test_storage_engine_and_file_management(async_client: AsyncClient):
    # 1. Login as default admin
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": DEFAULT_ADMIN_EMAIL, "password": DEFAULT_ADMIN_PASSWORD}
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Check initial storage stats
    stats_resp = await async_client.get("/api/v1/files/stats", headers=headers)
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["used_bytes"] == 0
    assert stats["total_files"] == 0
    assert len(stats["categories"]) == 8

    # 3. Create simulated completed torrent and physical files on disk
    async with async_session_factory() as session:
        user_res = await session.execute(text(f"SELECT id FROM users WHERE email = '{DEFAULT_ADMIN_EMAIL}'"))
        user_id = user_res.scalar()

        job_id = uuid.uuid4()
        storage_paths = settings.get_absolute_storage_paths()
        job_dir = storage_paths["completed"] / str(user_id) / str(job_id)
        job_dir.mkdir(parents=True, exist_ok=True)

        # Create dummy video file
        video_path = job_dir / "sample_video.mp4"
        with open(video_path, "wb") as f:
            f.write(b"0" * 1024 * 100)  # 100 KB dummy video

        # Create dummy archive file
        archive_path = job_dir / "data_backup.zip"
        with open(archive_path, "wb") as f:
            f.write(b"0" * 1024 * 50)  # 50 KB dummy zip

        job = TorrentJob(
            id=job_id,
            user_id=user_id,
            info_hash="aabbccddeeff00112233445566778899aabbccdd",
            torrent_name="Simulated Archive Pack",
            status="COMPLETED",
            total_size=150 * 1024,
            downloaded_bytes=150 * 1024,
            save_path=str(job_dir),
            progress=100.00
        )
        session.add(job)
        await session.flush()

        tf1 = TorrentFile(
            id=uuid.uuid4(),
            job_id=job.id,
            file_index=0,
            relative_path="sample_video.mp4",
            filename="sample_video.mp4",
            file_size=100 * 1024,
            is_selected=True,
            is_completed=True
        )
        tf2 = TorrentFile(
            id=uuid.uuid4(),
            job_id=job.id,
            file_index=1,
            relative_path="data_backup.zip",
            filename="data_backup.zip",
            file_size=50 * 1024,
            is_selected=True,
            is_completed=True
        )
        session.add_all([tf1, tf2])
        await session.commit()

        # Index the completed files
        indexed = await StorageService.index_completed_torrent(session, job)
        assert len(indexed) == 2

    # 4. Verify storage stats updated
    stats_resp2 = await async_client.get("/api/v1/files/stats", headers=headers)
    assert stats_resp2.status_code == 200
    stats2 = stats_resp2.json()
    assert stats2["total_files"] == 2
    assert stats2["used_bytes"] == 150 * 1024

    # Check category breakdown: VIDEOS has 100KB, ARCHIVES has 50KB
    cat_map = {c["category"]: c for c in stats2["categories"]}
    assert cat_map["VIDEOS"]["count"] == 1
    assert cat_map["VIDEOS"]["bytes"] == 100 * 1024
    assert cat_map["ARCHIVES"]["count"] == 1
    assert cat_map["ARCHIVES"]["bytes"] == 50 * 1024

    # 5. List files API
    list_resp = await async_client.get("/api/v1/files", headers=headers)
    assert list_resp.status_code == 200
    file_list = list_resp.json()
    assert file_list["total"] == 2
    assert len(file_list["items"]) == 2

    # Test category filter: only VIDEOS
    video_resp = await async_client.get("/api/v1/files?category=VIDEOS", headers=headers)
    assert video_resp.status_code == 200
    video_list = video_resp.json()
    assert video_list["total"] == 1
    assert video_list["items"][0]["filename"] == "sample_video.mp4"
    assert video_list["items"][0]["mime_type"] == "video/mp4"
    assert video_list["items"][0]["category"] == "VIDEOS"
    video_id = video_list["items"][0]["id"]

    # Test search filter
    search_resp = await async_client.get("/api/v1/files?search=backup", headers=headers)
    assert search_resp.status_code == 200
    search_list = search_resp.json()
    assert search_list["total"] == 1
    assert search_list["items"][0]["filename"] == "data_backup.zip"
    archive_id = search_list["items"][0]["id"]

    # 6. Retrieve single file details
    detail_resp = await async_client.get(f"/api/v1/files/{video_id}", headers=headers)
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["filename"] == "sample_video.mp4"
    assert detail["torrent_name"] == "Simulated Archive Pack"
    assert detail["file_size"] == 100 * 1024

    # 7. Delete single file
    del_resp = await async_client.delete(f"/api/v1/files/{video_id}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["freed_bytes"] == 100 * 1024

    # Verify file deleted from disk
    assert not os.path.exists(video_path)

    # Verify stats updated after single delete
    stats_resp3 = await async_client.get("/api/v1/files/stats", headers=headers)
    assert stats_resp3.json()["total_files"] == 1
    assert stats_resp3.json()["used_bytes"] == 50 * 1024

    # 8. Bulk delete remaining files
    bulk_del_resp = await async_client.post(
        "/api/v1/files/bulk-delete",
        headers=headers,
        json={"file_ids": [archive_id]}
    )
    assert bulk_del_resp.status_code == 200
    bulk_res = bulk_del_resp.json()
    assert bulk_res["deleted_count"] == 1
    assert bulk_res["freed_bytes"] == 50 * 1024

    # Verify disk cleanup
    assert not os.path.exists(archive_path)

    # 9. Verify storage usage returned to zero
    stats_resp4 = await async_client.get("/api/v1/files/stats", headers=headers)
    assert stats_resp4.json()["total_files"] == 0
    assert stats_resp4.json()["used_bytes"] == 0
