import sys
from pathlib import Path
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

# Add app to python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app
from app.core.database import async_session_factory
from app.core.torrent_session import TorrentSessionManager

@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

@pytest.fixture(autouse=True)
async def clean_torrent_jobs_fixture():
    """Cleans up active torrent jobs and handles between test cases."""
    manager = TorrentSessionManager.get_instance()
    for h in list(manager.handles.values()):
        try:
            manager.session.remove_torrent(h)
        except Exception:
            pass
    manager.handles.clear()

    async with async_session_factory() as session:
        await session.execute(text("DELETE FROM activity_events"))
        await session.execute(text("DELETE FROM download_links"))
        await session.execute(text("DELETE FROM stored_files"))
        await session.execute(text("DELETE FROM torrent_files"))
        await session.execute(text("DELETE FROM torrent_jobs"))
        await session.commit()
    yield
    manager.handles.clear()
    async with async_session_factory() as session:
        await session.execute(text("DELETE FROM activity_events"))
        await session.execute(text("DELETE FROM download_links"))
        await session.execute(text("DELETE FROM stored_files"))
        await session.execute(text("DELETE FROM torrent_files"))
        await session.execute(text("DELETE FROM torrent_jobs"))
        await session.commit()
