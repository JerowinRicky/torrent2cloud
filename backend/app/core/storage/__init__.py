from app.core.storage.base import BaseStorageAdapter
from app.core.storage.local import LocalStorageAdapter

_adapter_instance: BaseStorageAdapter | None = None

def get_storage_adapter() -> BaseStorageAdapter:
    """Returns singleton instance of the configured storage adapter."""
    global _adapter_instance
    if _adapter_instance is None:
        _adapter_instance = LocalStorageAdapter()
    return _adapter_instance

__all__ = ["BaseStorageAdapter", "LocalStorageAdapter", "get_storage_adapter"]
