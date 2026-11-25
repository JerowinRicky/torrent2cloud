from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.invitation import Invitation
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RefreshTokenRequest,
    PasswordChangeRequest,
    TokenResponse,
    UserRead,
    InvitationCreate,
    InvitationRead,
    InvitationValidateResponse
)
from app.services.auth_service import AuthService
from app.core.security import verify_password, hash_password

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse, summary="Log in with email and password")
async def login(
    request: Request,
    credentials: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    user = await AuthService.authenticate_user(db, credentials.email, credentials.password)
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await AuthService.create_user_session(db, user, user_agent, ip)

@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED, summary="Register using an invitation code")
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    user = await AuthService.register_user(
        db,
        invitation_code=payload.invitation_code,
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name
    )
    return user

@router.post("/refresh", response_model=TokenResponse, summary="Refresh access token using refresh token")
async def refresh_token(
    request: Request,
    payload: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await AuthService.refresh_session(db, payload.refresh_token, user_agent, ip)

@router.post("/logout", summary="Log out and revoke current session")
async def logout(
    payload: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await AuthService.revoke_session(db, payload.refresh_token)
    return {"message": "Session successfully terminated"}

@router.get("/me", response_model=UserRead, summary="Get current authenticated user profile")
async def get_me(
    current_user: User = Depends(get_current_user)
):
    return current_user

@router.put("/password", summary="Change password for current user")
async def change_password(
    payload: PasswordChangeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    current_user.hashed_password = hash_password(payload.new_password)
    db.add(current_user)
    await db.commit()
    return {"message": "Password updated successfully"}

@router.get("/invitations/validate/{code}", response_model=InvitationValidateResponse, summary="Validate invitation code")
async def validate_invitation(
    code: str,
    db: AsyncSession = Depends(get_db)
):
    valid, message, invitation = await AuthService.validate_invitation(db, code)
    return {
        "valid": valid,
        "code": code,
        "email": invitation.email if invitation else None,
        "message": message
    }

@router.post("/invitations", response_model=InvitationRead, status_code=status.HTTP_201_CREATED, summary="Create an invitation code (Admin only)")
async def create_invitation(
    payload: InvitationCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    return await AuthService.create_invitation(
        db,
        creator=admin,
        email=payload.email,
        expires_in_days=payload.expires_in_days
    )

@router.get("/invitations", response_model=list[InvitationRead], summary="List all invitations (Admin only)")
async def list_invitations(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    query = select(Invitation).order_by(Invitation.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()
