import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, BigInteger, Integer, Numeric, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.file import TorrentFile
    from app.models.storage import StoredFile

class TorrentJob(Base):
    __tablename__ = "torrent_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    info_hash: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    torrent_name: Mapped[str] = mapped_column(String(512), nullable=False)
    magnet_uri: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(32), index=True, default="VALIDATING", nullable=False
    )
    total_size: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    downloaded_bytes: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    uploaded_bytes: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    progress: Mapped[float] = mapped_column(Numeric(5, 2), default=0.00, nullable=False)
    download_speed: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)  # bytes/s
    upload_speed: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)    # bytes/s
    eta_seconds: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    peers_connected: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    seeds_connected: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=5, nullable=False)  # 1 (low) to 10 (high)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_retries: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    save_path: Mapped[str] = mapped_column(String(1024), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    queued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User")
    files: Mapped[list["TorrentFile"]] = relationship(
        "TorrentFile",
        back_populates="job",
        cascade="all, delete-orphan",
        order_by="TorrentFile.file_index",
        lazy="selectin"
    )
    stored_files: Mapped[list["StoredFile"]] = relationship(
        "StoredFile",
        back_populates="job",
        lazy="selectin"
    )
