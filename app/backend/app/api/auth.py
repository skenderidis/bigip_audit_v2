import time

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from jose import jwt, JWTError
from app.db import get_db
from pydantic import BaseModel
from app.schemas.auth import LoginRequest, TokenResponse, UserInfo, PasswordResetRequest, PasswordReset
from app.services.auth_service import authenticate_user, create_access_token, hash_password, verify_password
from app.models.user import User
from app.config import settings

_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise ValueError
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user

router = APIRouter(prefix="/api/auth", tags=["auth"])


# Simple in-memory login throttle (per client IP): the first _FREE_ATTEMPTS are
# unrestricted; after that, only one attempt is allowed every _INTERVAL seconds.
# A successful login clears the counter. In-memory = per-process (fine for the
# single-worker deployment here); it resets on restart.
_FREE_ATTEMPTS = 10
_INTERVAL = 10.0
_login_attempts: dict[str, tuple[int, float]] = {}


def _rate_check(ip: str):
    count, last = _login_attempts.get(ip, (0, 0.0))
    if count >= _FREE_ATTEMPTS:
        wait = _INTERVAL - (time.monotonic() - last)
        if wait > 0:
            retry = int(wait) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many login attempts. Try again in {retry} second(s).",
                headers={"Retry-After": str(retry)},
            )


def _rate_record(ip: str):
    count, _ = _login_attempts.get(ip, (0, 0.0))
    _login_attempts[ip] = (count + 1, time.monotonic())


def _client_ip(request: Request) -> str:
    # Behind the bundled nginx reverse proxy the socket peer is the proxy, so
    # every client would share one bucket. nginx sets X-Real-IP to the true
    # client address ($remote_addr) and the backend port is not published, so
    # the header cannot be spoofed by an outside client. Fall back to the socket
    # peer when there is no proxy (e.g. local dev).
    xri = request.headers.get("x-real-ip")
    if xri:
        return xri.strip()
    return request.client.host if request.client else "unknown"


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip = _client_ip(request)
    _rate_check(ip)
    _rate_record(ip)
    user = await authenticate_user(db, body.username, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    _login_attempts.pop(ip, None)   # successful login clears the throttle

    token = create_access_token({"sub": user.username, "role": user.role})
    return TokenResponse(
        access_token=token,
        user=UserInfo(
            id=user.id,
            username=user.username,
            email=user.email,
            role=user.role,
            mfa_enabled=user.mfa_enabled,
        )
    )


@router.post("/password-reset-request")
async def request_password_reset(body: PasswordResetRequest):
    # Always returns success to prevent email enumeration
    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/password-reset")
async def reset_password(body: PasswordReset, db: AsyncSession = Depends(get_db)):
    # TODO: validate token against a stored password-reset-token table once implemented
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="This reset link is invalid or has expired"
    )


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
async def change_password(body: ChangePassword, db: AsyncSession = Depends(get_db),
                          user: User = Depends(get_current_user)):
    """Change the signed-in user's password (verifies the current one first)."""
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Current password is incorrect")
    if len(body.new_password or "") < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="New password must be at least 8 characters")
    if body.new_password == body.current_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="New password must be different from the current one")
    user.hashed_password = hash_password(body.new_password)
    await db.commit()
    return {"message": "Password changed"}


@router.get("/me")
async def me():
    # TODO: add JWT dependency guard
    return {"status": "ok"}
