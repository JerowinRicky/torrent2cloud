import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

# Base directory of the project
BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Application
    APP_NAME: str = "CloudTorrent"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = Field(default="development")
    APP_DEBUG: bool = Field(default=False)
    APP_SECRET_KEY: str = Field(default="dev-super-secret-key-change-this-in-production-min-32-chars")
    APP_PORT: int = Field(default=8000)
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ]

    # Database (PostgreSQL)
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://cloudtorrent:cloudtorrent_secret@127.0.0.1:5432/cloudtorrent_db"
    )
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30

    # Redis
    REDIS_URL: str = Field(default="redis://127.0.0.1:6379/0")
    REDIS_MAX_CONNECTIONS: int = 20

    # Celery
    CELERY_BROKER_URL: str = Field(default="redis://127.0.0.1:6379/1")
    CELERY_RESULT_BACKEND: str = Field(default="redis://127.0.0.1:6379/1")

    # Storage Paths
    STORAGE_INCOMPLETE_PATH: str = Field(default="./volumes/data/incomplete")
    STORAGE_COMPLETED_PATH: str = Field(default="./volumes/data/completed")
    STORAGE_RESUME_PATH: str = Field(default="./volumes/data/resume_data")

    # Quotas and Defaults
    DEFAULT_STORAGE_QUOTA_BYTES: int = 50 * 1024 * 1024 * 1024  # 50 GB
    DEFAULT_MAX_ACTIVE_JOBS: int = 3
    MAX_QUEUED_JOBS_PER_USER: int = 20
    GLOBAL_MAX_CONCURRENT_DOWNLOADS: int = 10
    DEFAULT_DOWNLOAD_RATE_LIMIT_KBPS: int = 0  # 0 = unlimited
    DEFAULT_UPLOAD_RATE_LIMIT_KBPS: int = 0    # 0 = unlimited
    DEFAULT_LINK_EXPIRATION_HOURS: int = 24

    def get_absolute_storage_paths(self) -> dict[str, Path]:
        """Resolves storage paths to absolute paths, ensuring parent dirs exist."""
        paths = {
            "incomplete": (BASE_DIR / self.STORAGE_INCOMPLETE_PATH).resolve() if not os.path.isabs(self.STORAGE_INCOMPLETE_PATH) else Path(self.STORAGE_INCOMPLETE_PATH),
            "completed": (BASE_DIR / self.STORAGE_COMPLETED_PATH).resolve() if not os.path.isabs(self.STORAGE_COMPLETED_PATH) else Path(self.STORAGE_COMPLETED_PATH),
            "resume": (BASE_DIR / self.STORAGE_RESUME_PATH).resolve() if not os.path.isabs(self.STORAGE_RESUME_PATH) else Path(self.STORAGE_RESUME_PATH),
        }
        for path in paths.values():
            path.mkdir(parents=True, exist_ok=True)
        return paths

settings = Settings()
