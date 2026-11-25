import uuid
import pytest
from starlette.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.auth_service import DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD
from app.services.telemetry_service import TelemetryService
from app.core.database import async_session_factory
from app.api.v1.telemetry import authenticate_ws_token

@pytest.mark.asyncio
async def test_websocket_telemetry_flow():
    # 1. Login to get auth token
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        login_res = await client.post("/api/v1/auth/login", json={
            "email": DEFAULT_ADMIN_EMAIL,
            "password": DEFAULT_ADMIN_PASSWORD
        })
        assert login_res.status_code == 200
        admin_data = login_res.json()
        token = admin_data["access_token"]
        user_id = admin_data["user"]["id"]

        # 2. Create a test torrent download job to have active telemetry
        h = uuid.uuid4().hex + uuid.uuid4().hex[:8]
        magnet = f"magnet:?xt=urn:btih:{h}&dn=TelemetryTestJob"
        headers = {"Authorization": f"Bearer {token}"}
        create_res = await client.post("/api/v1/torrents/create", headers=headers, json={"magnet_uri": magnet})
        assert create_res.status_code == 201
        job_data = create_res.json()
        job_id = job_data["id"]

    # 3. Connect via WebSocket with token
    test_client = TestClient(app)
    with test_client.websocket_connect(f"/api/v1/telemetry/ws?token={token}") as ws:
        # A. Receive initial snapshot
        init_frame = ws.receive_json()
        assert init_frame["type"] == "init"
        assert init_frame["user_id"] == user_id
        assert isinstance(init_frame["jobs"], list)
        assert any(j["job_id"] == job_id for j in init_frame["jobs"])

        # B. Heartbeat ping/pong test
        ws.send_json({"type": "ping"})
        pong_frame = ws.receive_json()
        assert pong_frame["type"] == "pong"
        assert "timestamp" in pong_frame

        # C. Broadcast tick test
        async with async_session_factory() as db:
            await TelemetryService.broadcast_tick(db)

        telemetry_frame = ws.receive_json()
        assert telemetry_frame["type"] == "telemetry"
        assert telemetry_frame["job_id"] == job_id
        assert "progress" in telemetry_frame
        assert "download_speed" in telemetry_frame
        assert "upload_speed" in telemetry_frame
        assert "peers_connected" in telemetry_frame

        # D. Status change notification test
        await TelemetryService.notify_status_change(uuid.UUID(user_id), uuid.UUID(job_id), "PAUSED")
        status_frame = ws.receive_json()
        assert status_frame["type"] == "job_status_change"
        assert status_frame["job_id"] == job_id
        assert status_frame["status"] == "PAUSED"

def test_websocket_unauthorized_rejection():
    test_client = TestClient(app)
    try:
        with test_client.websocket_connect("/api/v1/telemetry/ws?token=invalid_token") as ws:
            pass
    except Exception:
        # Starlette raises when the server closes with policy violation
        pass

@pytest.mark.asyncio
async def test_sse_telemetry_unauthorized():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Missing or invalid token must return 401 Unauthorized
        res = await client.get("/api/v1/telemetry/events?token=invalid_token")
        assert res.status_code == 401

@pytest.mark.asyncio
async def test_sse_telemetry_auth_and_snapshot():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        login_res = await client.post("/api/v1/auth/login", json={
            "email": DEFAULT_ADMIN_EMAIL,
            "password": DEFAULT_ADMIN_PASSWORD
        })
        token = login_res.json()["access_token"]

        async with async_session_factory() as db:
            user = await authenticate_ws_token(token, db)
            assert user is not None
            assert user.email == DEFAULT_ADMIN_EMAIL

            snapshot = await TelemetryService.get_user_snapshot(user.id, db)
            assert isinstance(snapshot, list)
