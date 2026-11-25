import secrets
from datetime import datetime, timedelta, timezone
import uuid
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.user import User
from app.models.session import UserSession
from app.models.invitation import Invitation
from app.models.storage import UserStorageUsage
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_token,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.core.logging import logger

DEFAULT_ADMIN_EMAIL = "admin@cloudtorrent.io"
DEFAULT_ADMIN_PASSWORD = "admin_password_123"

class AuthService:
    @staticmethod
    async def init_default_admin(db: AsyncSession) -> User | None:
        """Ensures an initial Administrator account exists on system startup."""
        query = select(User).where(User.role == "ADMIN")
        result = await db.execute(query)
        admin = result.scalars().first()
        if not admin:
            logger.info("No Administrator account detected. Creating default admin account...")
            admin = User(
                email=DEFAULT_ADMIN_EMAIL,
                hashed_password=hash_password(DEFAULT_ADMIN_PASSWORD),
                full_name="CloudTorrent Administrator",
                role="ADMIN",
                is_active=True,
                storage_quota_bytes=100 * 1024 * 1024 * 1024, # 100 GB
                max_active_jobs=10
            )
            db.add(admin)
            await db.flush()

            # Initialize storage record
            storage = UserStorageUsage(user_id=admin.id, used_bytes=0, active_jobs_count=0)
            db.add(storage)
            await db.commit()
            await db.refresh(admin)
            logger.info(f"Default Administrator account created: {DEFAULT_ADMIN_EMAIL}")
        return admin

    @staticmethod
    async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
        """Authenticates a user via email and password."""
        query = select(User).where(func.lower(User.email) == func.lower(email))
        result = await db.execute(query)
        user = result.scalars().first()

        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account has been disabled. Contact an administrator."
            )

        return user

    @staticmethod
    async def create_user_session(
        db: AsyncSession,
        user: User,
        user_agent: str | None = None,
        ip_address: str | None = None
    ) -> dict:
        """Creates access & refresh tokens and stores active session in database."""
        token_data = {"sub": str(user.id), "email": user.email, "role": user.role}
        access_token = create_access_token(token_data)
        refresh_token, expires_at = create_refresh_token(token_data)

        # Store session in DB
        session = UserSession(
            user_id=user.id,
            refresh_token_hash=hash_token(refresh_token),
            user_agent=user_agent,
            ip_address=ip_address,
            expires_at=expires_at,
            is_revoked=False
        )
        db.add(session)
        await db.commit()

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": user
        }

    @staticmethod
    async def refresh_session(
        db: AsyncSession,
        refresh_token: str,
        user_agent: str | None = None,
        ip_address: str | None = None
    ) -> dict:
        """Validates refresh token, revokes previous session and rotates new session tokens."""
        try:
            payload = decode_token(refresh_token)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid refresh token: {e}"
            )

        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type, expected refresh token"
            )

        token_hash = hash_token(refresh_token)
        now = datetime.now(timezone.utc)

        # Query session
        query = select(UserSession).where(
            and_(
                UserSession.refresh_token_hash == token_hash,
                UserSession.is_revoked.is_(False),
                UserSession.expires_at > now
            )
        )
        result = await db.execute(query)
        session = result.scalars().first()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token is expired, revoked, or invalid"
            )

        # Fetch active user
        user = await db.get(User, session.user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account inactive or not found"
            )

        # Revoke old session (Rotation)
        session.is_revoked = True
        db.add(session)

        # Issue new session
        return await AuthService.create_user_session(db, user, user_agent, ip_address)

    @staticmethod
    async def revoke_session(db: AsyncSession, refresh_token: str) -> None:
        """Revokes a session upon user logout."""
        token_hash = hash_token(refresh_token)
        query = select(UserSession).where(UserSession.refresh_token_hash == token_hash)
        result = await db.execute(query)
        session = result.scalars().first()
        if session:
            session.is_revoked = True
            db.add(session)
            await db.commit()

    @staticmethod
    async def create_invitation(
        db: AsyncSession,
        creator: User,
        email: str | None = None,
        expires_in_days: int = 7
    ) -> Invitation:
        """Generates a secure cryptographic invitation code."""
        code = f"ct-{secrets.token_hex(16)}"
        expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)

        invitation = Invitation(
            code=code,
            created_by_user_id=creator.id,
            email=email.lower() if email else None,
            is_claimed=False,
            expires_at=expires_at
        )
        db.add(invitation)
        await db.commit()
        await db.refresh(invitation)
        return invitation

    @staticmethod
    async def validate_invitation(db: AsyncSession, code: str) -> tuple[bool, str, Invitation | None]:
        """Validates if an invitation code is usable."""
        now = datetime.now(timezone.utc)
        query = select(Invitation).where(Invitation.code == code.strip())
        result = await db.execute(query)
        invitation = result.scalars().first()

        if not invitation:
            return False, "Invitation code not found", None
        if invitation.is_claimed:
            return False, "Invitation code has already been claimed", None
        if invitation.expires_at < now:
            return False, "Invitation code has expired", None

        return True, "Invitation code is valid", invitation

    @staticmethod
    async def register_user(
        db: AsyncSession,
        invitation_code: str,
        email: str,
        password: str,
        full_name: str
    ) -> User:
        """Registers a new user through a valid invitation code."""
        valid, msg, invitation = await AuthService.validate_invitation(db, invitation_code)
        if not valid or not invitation:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

        # Check if email is already taken
        query = select(User).where(func.lower(User.email) == func.lower(email))
        existing_user = (await db.execute(query)).scalars().first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address already exists"
            )

        # Create new user
        user = User(
            email=email.lower().strip(),
            hashed_password=hash_password(password),
            full_name=full_name.strip(),
            role="USER",
            is_active=True,
            storage_quota_bytes=50 * 1024 * 1024 * 1024, # 50 GB
            max_active_jobs=3
        )
        db.add(user)
        await db.flush()

        # Create initial storage tracker
        storage = UserStorageUsage(user_id=user.id, used_bytes=0, active_jobs_count=0)
        db.add(storage)

        # Mark invitation as claimed
        invitation.is_claimed = True
        invitation.claimed_by_user_id = user.id
        db.add(invitation)

        await db.commit()
        await db.refresh(user)
        logger.info(f"New user registered with invitation {invitation_code}: {user.email}")
        return user
