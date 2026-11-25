import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, Boolean, BigInteger, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.session import UserSession
    from app.models.invitation import Invitation
    from app.models.storage import UserStorageUsage, StoredFile

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="USER", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    storage_quota_bytes: Mapped[int] = mapped_column(
        BigInteger, default=53687091200, nullable=False
    )
    max_active_jobs: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    sessions: Mapped[list["UserSession"]] = relationship(
        "UserSession", back_populates="user", cascade="all, delete-orphan"
    )
    invitations_created: Mapped[list["Invitation"]] = relationship(
        "Invitation", foreign_keys="Invitation.created_by_user_id", back_populates="creator"
    )
    invitation_claimed: Mapped["Invitation"] = relationship(
        "Invitation", foreign_keys="Invitation.claimed_by_user_id", back_populates="claimed_by", uselist=False
    )
    storage_usage: Mapped["UserStorageUsage"] = relationship(
        "UserStorageUsage", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    stored_files: Mapped[list["StoredFile"]] = relationship(
        "StoredFile", back_populates="user", cascade="all, delete-orphan"
    )
