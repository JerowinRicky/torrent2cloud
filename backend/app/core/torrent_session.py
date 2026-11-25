import os
import shutil
from pathlib import Path
import libtorrent as lt
from app.config import settings
from app.core.logging import logger

class TorrentSessionManager:
    """
    Manages the local libtorrent session, handles, file priority configuration,
    and alert loops.
    """
    _instance = None

    def __init__(self):
        self.session = lt.session({
            'listen_interfaces': '0.0.0.0:6881',
            'alert_mask': lt.alert_category.all,
            'enable_dht': True,
            'enable_lsd': True,
            'download_rate_limit': 0, # unthrottled by default, configurable
            'upload_rate_limit': 0,
            'connections_limit': 200,
        })
        self.handles: dict[str, lt.torrent_handle] = {}
        storage_paths = settings.get_absolute_storage_paths()
        self.incomplete_path = str(storage_paths["incomplete"])
        self.completed_path = str(storage_paths["completed"])
        self.resume_path = str(storage_paths["resume"])
        logger.info("Initialized libtorrent session manager.")

    @classmethod
    def get_instance(cls) -> "TorrentSessionManager":
        if cls._instance is None:
            cls._instance = TorrentSessionManager()
        return cls._instance

    def parse_magnet(self, magnet_uri: str) -> dict:
        """Parses a magnet URI into info_hash, display name, and trackers."""
        params = lt.parse_magnet_uri(magnet_uri)
        info_hash = str(params.info_hashes.v1) if hasattr(params.info_hashes, 'v1') else str(params.info_hash)
        name = params.name or "Magnet Download"
        trackers = list(params.trackers) if hasattr(params, 'trackers') else []
        return {
            "info_hash": info_hash,
            "name": name,
            "trackers": trackers,
            "total_size": 0,
            "piece_count": 0,
            "piece_length": 0,
            "files": [],
            "is_magnet": True
        }

    def parse_torrent_bytes(self, torrent_bytes: bytes) -> dict:
        """Parses raw .torrent file bytes and extracts the file tree."""
        info = lt.torrent_info(torrent_bytes)
        files = []
        file_storage = info.files()
        for idx in range(file_storage.num_files()):
            files.append({
                "file_index": idx,
                "filename": file_storage.file_name(idx),
                "relative_path": file_storage.file_path(idx),
                "file_size": file_storage.file_size(idx),
                "is_selected": True
            })
        trackers = [t.url for t in info.trackers()]
        return {
            "info_hash": str(info.info_hash()),
            "name": info.name(),
            "total_size": info.total_size(),
            "piece_count": info.num_pieces(),
            "piece_length": info.piece_length(),
            "files": files,
            "trackers": trackers,
            "is_magnet": False,
            "torrent_info": info
        }

    def add_torrent(
        self,
        info_hash: str,
        save_dir: str,
        torrent_info: lt.torrent_info | None = None,
        magnet_uri: str | None = None,
        selected_indices: list[int] | None = None
    ) -> lt.torrent_handle:
        """Adds a torrent to the session, sets file priorities and tracks handle."""
        if info_hash in self.handles and self.handles[info_hash].is_valid():
            return self.handles[info_hash]

        atp = lt.add_torrent_params()
        atp.save_path = save_dir

        if torrent_info:
            atp.ti = torrent_info
            if selected_indices is not None:
                # 0 = do not download, 4 = default priority
                priorities = [
                    4 if i in selected_indices else 0 
                    for i in range(torrent_info.files().num_files())
                ]
                atp.file_priorities = priorities
        elif magnet_uri:
            parsed = lt.parse_magnet_uri(magnet_uri)
            atp.info_hashes = parsed.info_hashes if hasattr(parsed, 'info_hashes') else parsed.info_hash
            atp.name = parsed.name
            atp.trackers = parsed.trackers

        handle = self.session.add_torrent(atp)
        self.handles[info_hash] = handle
        logger.info(f"Added torrent {info_hash} to session.")
        return handle

    def get_handle(self, info_hash: str) -> lt.torrent_handle | None:
        handle = self.handles.get(info_hash)
        if handle and handle.is_valid():
            return handle
        return None

    def pause_torrent(self, info_hash: str):
        handle = self.get_handle(info_hash)
        if handle:
            handle.pause()

    def resume_torrent(self, info_hash: str):
        handle = self.get_handle(info_hash)
        if handle:
            handle.resume()

    def remove_torrent(self, info_hash: str, delete_files: bool = False):
        handle = self.get_handle(info_hash)
        if handle:
            if delete_files and hasattr(lt.session, "delete_files"):
                self.session.remove_torrent(handle, lt.session.delete_files)
            else:
                self.session.remove_torrent(handle)
            self.handles.pop(info_hash, None)
            logger.info(f"Removed torrent {info_hash} from session (delete_files={delete_files}).")

    def get_status(self, info_hash: str) -> dict | None:
        handle = self.get_handle(info_hash)
        if not handle:
            return None
        st = handle.status()
        state_map = {
            lt.torrent_status.checking_files: "VALIDATING",
            lt.torrent_status.downloading_metadata: "FETCHING_METADATA",
            lt.torrent_status.downloading: "DOWNLOADING",
            lt.torrent_status.finished: "COMPLETED",
            lt.torrent_status.seeding: "COMPLETED",
            lt.torrent_status.allocating: "VALIDATING",
            lt.torrent_status.checking_resume_data: "VALIDATING",
        }
        status_name = "PAUSED" if st.paused else state_map.get(st.state, "DOWNLOADING")
        return {
            "status": status_name,
            "progress": round(st.progress * 100, 2),
            "download_speed": st.download_rate,
            "upload_speed": st.upload_rate,
            "downloaded_bytes": st.total_done,
            "uploaded_bytes": st.total_upload,
            "peers_connected": st.num_peers,
            "seeds_connected": st.num_seeds,
            "is_finished": st.is_finished,
        }

    def set_rate_limits(self, download_limit_bytes: int = 0, upload_limit_bytes: int = 0):
        """Sets global download/upload rate limits in bytes/second (0 = unthrottled)."""
        self.session.apply_settings({
            'download_rate_limit': download_limit_bytes,
            'upload_rate_limit': upload_limit_bytes
        })
        logger.info(f"Applied rate limits: download={download_limit_bytes} B/s, upload={upload_limit_bytes} B/s")
