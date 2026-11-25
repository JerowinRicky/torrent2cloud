import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)

class RegisterRequest(BaseModel):
    invitation_code: str = Field(min_length=8, max_length=64)
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=100)

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)

class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    storage_quota_bytes: int
    max_active_jobs: int
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # in seconds
    user: UserRead

class InvitationCreate(BaseModel):
    email: EmailStr | None = None
    expires_in_days: int = Field(default=7, ge=1, le=90)

class InvitationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    email: str | None
    is_claimed: bool
    expires_at: datetime
    created_at: datetime

class InvitationValidateResponse(BaseModel):
    valid: bool
    code: str
    email: str | None = None
    message: str
