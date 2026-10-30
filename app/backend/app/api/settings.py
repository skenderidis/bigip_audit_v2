"""Settings API — the Violation Catalog editor. Files on disk are storage."""
import json

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.db import get_db
from app.models.user import User
from app.services import violations as vsvc
from app.services import report_settings as rsvc
from app.services import ihealth_settings as ihsvc
from app.services import ignore_settings as igsvc

router = APIRouter(prefix="/api/settings", tags=["settings"])


class ViolationPatch(BaseModel):
    severity: str | None = None
    section: str | None = None
    score: float | None = None
    txt: str | None = None


class ReportSettings(BaseModel):
    customer_name: str | None = None
    location: str | None = None


@router.get("/report")
async def get_report_settings(user: User = Depends(get_current_user)):
    """Cover-page details stamped on every generated report."""
    return rsvc.load()


@router.put("/report")
async def put_report_settings(patch: ReportSettings, user: User = Depends(get_current_user)):
    return rsvc.save(patch.model_dump(exclude_unset=True))


class IHealthSettings(BaseModel):
    client_id: str | None = None
    client_secret: str | None = None


@router.get("/ihealth")
async def get_ihealth_settings(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """F5 iHealth API credentials (secret masked) used for the LTM QKView pull."""
    return await ihsvc.masked(db)


@router.put("/ihealth")
async def put_ihealth_settings(patch: IHealthSettings, db: AsyncSession = Depends(get_db),
                               user: User = Depends(get_current_user)):
    # A blank client_secret in the patch means "leave the stored secret as-is".
    data = patch.model_dump(exclude_unset=True)
    if data.get("client_secret") == "":
        data.pop("client_secret", None)
    return await ihsvc.save(db, data)


@router.delete("/ihealth")
async def clear_ihealth_settings(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Remove the stored iHealth credentials."""
    return await ihsvc.clear(db)


class IgnoreDiagnostics(BaseModel):
    text: str | None = None
    entries: list[str] | None = None


@router.get("/ignore-diagnostics")
async def get_ignore_diagnostics(user: User = Depends(get_current_user)):
    """iHealth diagnostic headers suppressed as known noise (one per line)."""
    entries = igsvc.load_entries()
    return {"entries": entries, "text": "\n".join(entries)}


@router.put("/ignore-diagnostics")
async def put_ignore_diagnostics(patch: IgnoreDiagnostics, user: User = Depends(get_current_user)):
    if patch.text is not None:
        entries = igsvc.save_text(patch.text)
    elif patch.entries is not None:
        entries = igsvc.save_text("\n".join(patch.entries))
    else:
        entries = igsvc.load_entries()
    return {"entries": entries, "text": "\n".join(entries)}


@router.get("/violations")
async def get_violations(user: User = Depends(get_current_user)):
    """The whole catalog, as the JSON object (not a list)."""
    return vsvc.load_catalog()


@router.put("/violations/{name}")
async def put_violation(name: str, patch: ViolationPatch, user: User = Depends(get_current_user)):
    """Partial update of one entry; creates it if missing."""
    return vsvc.update_entry(name, patch.model_dump(exclude_unset=True))


@router.post("/violations/restore-defaults")
async def restore_violations(user: User = Depends(get_current_user)):
    return vsvc.restore_defaults()


@router.get("/violations/export")
async def export_violations(user: User = Depends(get_current_user)):
    body = json.dumps(vsvc.load_catalog(), indent=2, ensure_ascii=False)
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="violation_list.json"'},
    )


@router.post("/violations/import")
async def import_violations(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    raw = await file.read()
    try:
        count = vsvc.import_catalog(raw)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"imported": count}
