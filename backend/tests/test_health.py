import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_root_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "CloudTorrent"
        assert data["status"] == "online"

@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v1/health")
        assert response.status_code in [200, 503]
        data = response.json()
        assert "status" in data
        assert "components" in data
        assert "database" in data["components"]
        assert "redis" in data["components"]
        assert "storage" in data["components"]
        assert "system" in data
