"""Admin endpoints to refresh the WAF reference data (attack signatures +
signature sets): by file upload or by pulling from a live F5 BIG-IP."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.db import get_db
from app.models.user import User
from app.services import f5_signatures, ref_store

router = APIRouter(prefix="/api/audit/ref", tags=["reference-admin"])


@router.get("/status")
async def ref_status(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Counts of the current reference data plus last-refresh metadata."""
    return await ref_store.status(db)


@router.post("/import")
async def import_reference(
    signatures: UploadFile | None = File(None),
    signature_sets: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Replace the signatures and/or signature sets from uploaded files."""
    if signatures is None and signature_sets is None:
        raise HTTPException(status_code=400, detail="Provide a signatures and/or signature-sets file.")
    counts: dict = {}
    try:
        if signature_sets is not None:
            rows = ref_store.parse_sets_bytes(await signature_sets.read(), signature_sets.filename or "")
            counts["signature_sets"] = await ref_store.replace_signature_sets(db, rows)
        if signatures is not None:
            rows = ref_store.parse_signatures_bytes(await signatures.read(), signatures.filename or "")
            if not rows:
                raise HTTPException(status_code=400, detail="No signatures parsed from the file.")
            counts["signatures"] = await ref_store.replace_signatures(db, rows)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse upload: {e}")
    ref_store.write_meta("file import", user.username, counts)
    return await ref_store.status(db)


class PullBody(BaseModel):
    url: str
    username: str
    password: str
    verify: bool = False


@router.post("/pull")
async def pull_reference(body: PullBody, db: AsyncSession = Depends(get_db),
                         user: User = Depends(get_current_user)):
    """Pull signatures + signature sets from a live F5 BIG-IP and replace them."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    try:
        sig_rows, set_rows = await f5_signatures.pull(body.url, body.username, body.password, body.verify)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"F5 pull failed: {e}")
    if not sig_rows and not set_rows:
        raise HTTPException(status_code=502, detail="F5 returned no signatures or signature sets.")
    counts: dict = {}
    if set_rows:
        counts["signature_sets"] = await ref_store.replace_signature_sets(db, set_rows)
    if sig_rows:
        counts["signatures"] = await ref_store.replace_signatures(db, sig_rows)
    ref_store.write_meta(f"F5 pull ({body.url})", user.username, counts)
    return await ref_store.status(db)
