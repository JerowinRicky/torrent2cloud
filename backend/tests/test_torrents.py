import uuid
import tempfile
import libtorrent as lt
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.services.auth_service import DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD

UBUNTU_MAGNET = "magnet:?xt=urn:btih:3b245504cf5f11bbdbe1201cea6a6bf45aee1bc0&dn=ubuntu-22.04.3-live-server-amd64.iso&tr=https%3A%2F%2Ftorrent.ubuntu.com%2Fannounce"

import hashlib

def create_dummy_torrent_file() -> bytes:
    """Generates a small in-memory legal .torrent file using libtorrent."""
    fs = lt.file_storage()
    fs.add_file("sample_doc.txt", 1024 * 1024)
    t = lt.create_torrent(fs, 32 * 1024)
    t.add_tracker("https://tracker.example.com/announce")
    t.set_creator("CloudTorrent Test")
    t.set_comment("Test torrent file")
    
    # Generate pieces
    dummy_data = b"0" * (1024 * 1024)
    for i in range(t.num_pieces()):
        piece_data = dummy_data[i * 32 * 1024 : (i + 1) * 32 * 1024]
        digest = hashlib.sha1(piece_data).digest()
        t.set_hash(i, digest)
        
    torrent_entry = t.generate()
    return lt.bencode(torrent_entry)

@pytest.mark.asyncio
async def test_torrent_engine_e2e():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        async with app.router.lifespan_context(app):
            # Dynamic magnet link
            rand_hash = uuid.uuid4().hex + uuid.uuid4().hex[:8]  # 40 hex chars
            test_magnet = f"magnet:?xt=urn:btih:{rand_hash}&dn=ubuntu-22.04.3-live-server-amd64.iso&tr=https%3A%2F%2Ftorrent.ubuntu.com%2Fannounce"

            # 1. Login as Admin
            login_res = await client.post("/api/v1/auth/login", json={
                "email": DEFAULT_ADMIN_EMAIL,
                "password": DEFAULT_ADMIN_PASSWORD
            })
            tokens = login_res.json()
            headers = {"Authorization": f"Bearer {tokens['access_token']}"}

            # 2. Inspect invalid magnet
            bad_magnet_res = await client.post(
                "/api/v1/torrents/inspect-magnet",
                headers=headers,
                json={"magnet_uri": "invalid-link"}
            )
            assert bad_magnet_res.status_code == 400

            # 3. Inspect valid magnet
            magnet_res = await client.post(
                "/api/v1/torrents/inspect-magnet",
                headers=headers,
                json={"magnet_uri": test_magnet}
            )
            assert magnet_res.status_code == 200
            magnet_data = magnet_res.json()
            assert magnet_data["info_hash"] == rand_hash
            assert "ubuntu" in magnet_data["name"].lower()
            assert len(magnet_data["trackers"]) > 0

            # 4. Inspect .torrent file upload
            torrent_bytes = create_dummy_torrent_file()
            files_payload = {"file": ("sample.torrent", torrent_bytes, "application/x-bittorrent")}
            inspect_file_res = await client.post(
                "/api/v1/torrents/inspect-file",
                headers=headers,
                files=files_payload
            )
            assert inspect_file_res.status_code == 200
            file_data = inspect_file_res.json()
            assert file_data["name"] == "sample_doc.txt"
            assert file_data["total_size"] == 1024 * 1024
            assert len(file_data["files"]) == 1
            assert file_data["files"][0]["filename"] == "sample_doc.txt"

            # 5. Create a download job from magnet
            create_res = await client.post(
                "/api/v1/torrents/create",
                headers=headers,
                json={"magnet_uri": test_magnet}
            )
            assert create_res.status_code == 201
            job = create_res.json()
            job_id = job["id"]
            assert job["info_hash"] == rand_hash
            assert job["status"] in ["FETCHING_METADATA", "DOWNLOADING"]

            # 6. Duplicate job creation must return 409 Conflict
            dup_res = await client.post(
                "/api/v1/torrents/create",
                headers=headers,
                json={"magnet_uri": test_magnet}
            )
            assert dup_res.status_code == 409

            # 7. List jobs
            list_res = await client.get("/api/v1/torrents", headers=headers)
            assert list_res.status_code == 200
            jobs = list_res.json()
            assert any(j["id"] == job_id for j in jobs)

            # 8. Pause job
            pause_res = await client.post(f"/api/v1/torrents/{job_id}/pause", headers=headers)
            assert pause_res.status_code == 200
            assert pause_res.json()["status"] == "PAUSED"

            # 9. Resume job
            resume_res = await client.post(f"/api/v1/torrents/{job_id}/resume", headers=headers)
            assert resume_res.status_code == 200
            assert resume_res.json()["status"] in ["DOWNLOADING", "FETCHING_METADATA"]

            # 10. Cancel job
            cancel_res = await client.post(f"/api/v1/torrents/{job_id}/cancel", headers=headers)
            assert cancel_res.status_code == 200
            assert cancel_res.json()["status"] == "CANCELED"

            # 11. Delete job
            delete_res = await client.delete(f"/api/v1/torrents/{job_id}", headers=headers)
            assert delete_res.status_code == 204

            # Verify deletion
            get_after_delete = await client.get(f"/api/v1/torrents/{job_id}", headers=headers)
            assert get_after_delete.status_code == 404
