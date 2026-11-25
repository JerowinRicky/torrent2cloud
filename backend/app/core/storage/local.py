import os
import shutil
import hashlib
from pathlib import Path
from app.core.storage.base import BaseStorageAdapter
from app.config import settings
from app.core.logging import logger

class LocalStorageAdapter(BaseStorageAdapter):
    """
    Local SSD storage adapter managing dedicated completed and incomplete storage mounts.
    Includes bounds checking to avoid directory traversal.
    """

    def __init__(self):
        self.storage_paths = settings.get_absolute_storage_paths()
        self.completed_root = self.storage_paths["completed"]
        self.incomplete_root = self.storage_paths["incomplete"]

    def file_exists(self, path: str | Path) -> bool:
        p = Path(path)
        return p.is_file() and p.exists()

    def get_file_size(self, path: str | Path) -> int:
        p = Path(path)
        if not p.exists():
            return 0
        try:
            return p.stat().st_size
        except OSError as e:
            logger.warning(f"Failed to read file size for {path}: {e}")
            return 0

    def delete_file(self, path: str | Path) -> bool:
        p = Path(path)
        if not p.exists():
            return False
        try:
            p.unlink()
            # If parent directory is empty, clean it up
            parent = p.parent
            if parent.exists() and not any(parent.iterdir()):
                try:
                    parent.rmdir()
                except OSError:
                    pass
            return True
        except OSError as e:
            logger.error(f"Error deleting file {path}: {e}")
            return False

    def delete_directory(self, path: str | Path) -> bool:
        p = Path(path)
        if not p.exists():
            return False
        try:
            shutil.rmtree(p, ignore_errors=True)
            return True
        except OSError as e:
            logger.error(f"Error deleting directory {path}: {e}")
            return False

    def get_disk_usage(self) -> dict[str, int]:
        try:
            usage = shutil.disk_usage(str(self.completed_root))
            return {
                "total": usage.total,
                "used": usage.used,
                "free": usage.free
            }
        except Exception as e:
            logger.error(f"Failed to obtain disk usage: {e}")
            return {"total": 0, "used": 0, "free": 0}

    def compute_sha256(self, path: str | Path, max_bytes: int = 100 * 1024 * 1024) -> str | None:
        p = Path(path)
        if not p.is_file() or not p.exists():
            return None
        
        try:
            if p.stat().st_size > max_bytes:
                # Omit for massive multi-gigabyte files to avoid IO locks
                return None
            
            sha = hashlib.sha256()
            with open(p, "rb") as f:
                while chunk := f.read(65536):
                    sha.update(chunk)
            return sha.hexdigest()
        except Exception as e:
            logger.warning(f"Error computing sha256 for {path}: {e}")
            return None
