import hmac
import hashlib
import time
from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
from app.config import settings

import uuid

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 14

def hash_password(password: str) -> str:
    """Hashes a password using bcrypt with a salt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against the bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def hash_token(token: str) -> str:
    """Computes a SHA-256 hash of a token for secure database storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Creates a short-lived signed JWT access token with unique jti."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "access",
        "jti": uuid.uuid4().hex
    })
    return jwt.encode(to_encode, settings.APP_SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict, expires_delta: timedelta | None = None) -> tuple[str, datetime]:
    """Creates a signed JWT refresh token with unique jti and returns the token and its expiration datetime."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "refresh",
        "jti": uuid.uuid4().hex
    })
    token = jwt.encode(to_encode, settings.APP_SECRET_KEY, algorithm=ALGORITHM)
    return token, expire

def decode_token(token: str) -> dict:
    """Decodes and validates a JWT token."""
    try:
        payload = jwt.decode(token, settings.APP_SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Token has expired")
    except jwt.InvalidTokenError:
        raise ValueError("Invalid token")

def create_download_token(file_id: uuid.UUID, user_id: uuid.UUID, link_id: uuid.UUID, expires_delta: timedelta) -> tuple[str, datetime]:
    """Creates a signed, expiring JWT download token bound to a specific file and link ID."""
    now = datetime.now(timezone.utc)
    expire = now + expires_delta
    payload = {
        "sub": str(user_id),
        "file_id": str(file_id),
        "link_id": str(link_id),
        "type": "download",
        "exp": expire,
        "iat": now,
        "jti": str(link_id)
    }
    token = jwt.encode(payload, settings.APP_SECRET_KEY, algorithm=ALGORITHM)
    return token, expire

def decode_download_token(token: str) -> dict:
    """Decodes and validates a download token."""
    try:
        payload = jwt.decode(token, settings.APP_SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "download":
            raise ValueError("Token is not a download token")
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Download link has expired")
    except jwt.InvalidTokenError:
        raise ValueError("Invalid download link token")

def generate_signed_token(file_id: str, expires_at: int) -> str:
    """Generates an HMAC SHA-256 token for secure, expiring download URLs."""
    message = f"{file_id}:{expires_at}".encode("utf-8")
    signature = hmac.new(
        settings.APP_SECRET_KEY.encode("utf-8"),
        message,
        hashlib.sha256
    ).hexdigest()
    return signature

def verify_signed_token(file_id: str, expires_at: int, token: str) -> bool:
    """Verifies that the signed token is authentic and not expired."""
    if time.time() > expires_at:
        return False
    expected_token = generate_signed_token(file_id, expires_at)
    return hmac.compare_digest(expected_token, token)
