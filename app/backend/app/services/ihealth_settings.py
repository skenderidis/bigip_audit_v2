"""F5 iHealth API credentials storage (CLIENT_ID / CLIENT_SECRET), used for the
LTM QKView pull.

Stored in Postgres (table `ihealth_credentials`, single row id=1). The client
secret is encrypted at rest with Fernet, using a key derived from the app's
SECRET_KEY — it is never written in clear text. The GET side of the settings
API masks the secret; it is only decrypted here, server-side, for the pull.
"""
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.ihealth_credential import IHealthCredential

_ROW_ID = 1


def _fernet() -> Fernet:
    # Derive a stable 32-byte Fernet key from SECRET_KEY.
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest())
    return Fernet(key)


def _decrypt(token: str | None) -> str:
    if not token:
        return ""
    try:
        return _fernet().decrypt(token.encode()).decode()
    except (InvalidToken, ValueError):
        return ""


async def load(db: AsyncSession) -> dict:
    """Full credentials (secret decrypted) — server-side use only."""
    row = await db.get(IHealthCredential, _ROW_ID)
    if not row:
        return {"client_id": "", "client_secret": ""}
    return {"client_id": row.client_id or "", "client_secret": _decrypt(row.client_secret_enc)}


async def save(db: AsyncSession, patch: dict) -> dict:
    row = await db.get(IHealthCredential, _ROW_ID)
    if not row:
        row = IHealthCredential(id=_ROW_ID, client_id="", client_secret_enc=None)
        db.add(row)
    if patch.get("client_id") is not None:
        row.client_id = str(patch["client_id"])
    if patch.get("client_secret") is not None:
        row.client_secret_enc = _fernet().encrypt(str(patch["client_secret"]).encode()).decode()
    await db.commit()
    return await masked(db)


async def clear(db: AsyncSession) -> dict:
    row = await db.get(IHealthCredential, _ROW_ID)
    if row:
        await db.delete(row)
        await db.commit()
    return {"client_id": "", "client_secret_set": False}


async def masked(db: AsyncSession) -> dict:
    """Credentials for display: client_id as-is, secret reduced to whether it is
    set (never returned in full)."""
    cur = await load(db)
    return {"client_id": cur["client_id"], "client_secret_set": bool(cur["client_secret"])}
