import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, Boolean, BigInteger, Integer, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.torrent import TorrentJob
    from app.models.file import TorrentFile

class UserStorageUsage(Base):
    __tablename__ = "user_storage_usage"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    used_bytes: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    active_jobs_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="storage_usage")


class StoredFile(Base):
    __tablename__ = "stored_files"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("torrent_jobs.id", ondelete="SET NULL"), index=True, nullable=True
    )
    torrent_file_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("torrent_files.id", ondelete="SET NULL"), nullable=True
    )

    filename: Mapped[str] = mapped_column(String(512), index=True, nullable=False)
    relative_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    extension: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(128), default="application/octet-stream", nullable=False)
    category: Mapped[str] = mapped_column(String(32), index=True, default="OTHER", nullable=False)
    storage_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    sha256_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Composite indexes for fast user file queries
    __table_args__ = (
        Index("ix_stored_files_user_category", "user_id", "category"),
        Index("ix_stored_files_user_created_at", "user_id", "created_at"),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="stored_files")
    job: Mapped["TorrentJob | None"] = relationship("TorrentJob", back_populates="stored_files")
    torrent_file: Mapped["TorrentFile | None"] = relationship("TorrentFile")
