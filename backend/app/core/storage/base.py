from abc import ABC, abstractmethod
from pathlib import Path
import uuid

class BaseStorageAdapter(ABC):
    """Abstract interface for CloudTorrent storage backends (Local SSD, MinIO, S3)."""

    @abstractmethod
    def file_exists(self, path: str | Path) -> bool:
        """Returns True if file exists and is accessible."""
        pass

    @abstractmethod
    def get_file_size(self, path: str | Path) -> int:
        """Returns file size in bytes."""
        pass

    @abstractmethod
    def delete_file(self, path: str | Path) -> bool:
        """Deletes file from storage. Returns True if deleted, False if not found."""
        pass

    @abstractmethod
    def delete_directory(self, path: str | Path) -> bool:
        """Deletes directory recursively. Returns True on success."""
        pass

    @abstractmethod
    def get_disk_usage(self) -> dict[str, int]:
        """Returns physical storage capacity stats: {total, used, free} in bytes."""
        pass

    @abstractmethod
    def compute_sha256(self, path: str | Path, max_bytes: int = 100 * 1024 * 1024) -> str | None:
        """Calculates SHA256 checksum for file if smaller than max_bytes."""
        pass
