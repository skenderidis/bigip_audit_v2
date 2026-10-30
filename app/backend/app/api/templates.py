"""Audit Templates API — Level 1/2/3 + custom check presets. Files on disk."""
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from pydantic import BaseModel

from app.api.auth import get_current_user
from app.models.user import User
from app.services import templates as tsvc

router = APIRouter(prefix="/api/templates", tags=["templates"])


class CreateTemplate(BaseModel):
    name: str
    checks: dict[str, Any] = {}


@router.get("")
async def get_all(user: User = Depends(get_current_user)):
    return tsvc.load_all()


@router.post("", status_code=201)
async def create_template(body: CreateTemplate, user: User = Depends(get_current_user)):
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Template name is required")
    key, data = tsvc.create(name, body.checks)
    return {"key": key, "template": data}


@router.get("/export/all")
async def export_all(user: User = Depends(get_current_user)):
    body = json.dumps(tsvc.load_all(), indent=2, ensure_ascii=False)
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="templates.json"'},
    )


@router.post("/import/all")
async def import_all(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    raw = await file.read()
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="File is not valid JSON")
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Expected a JSON object with level1/level2/level3 keys")
    imported = []
    for level in tsvc.LEVELS:
        if isinstance(data.get(level), dict):
            tsvc.save(level, data[level])
            imported.append(level)
    if not imported:
        raise HTTPException(status_code=400, detail="No level1/level2/level3 objects found in the file")
    return {"imported": imported}


@router.get("/{key}")
async def get_one(key: str, user: User = Depends(get_current_user)):
    data = tsvc.load(key)
    if not data:
        raise HTTPException(status_code=404, detail="Unknown template")
    return data


@router.put("/{key}")
async def put_one(key: str, body: dict[str, Any], user: User = Depends(get_current_user)):
    # Built-in levels and existing custom templates can both be saved. Reject a
    # PUT to a custom key that doesn't exist yet (use POST to create).
    if key not in tsvc.LEVELS and not tsvc.load(key):
        raise HTTPException(status_code=404, detail="Unknown template")
    return tsvc.save(key, body)


@router.delete("/{key}", status_code=204)
async def delete_one(key: str, user: User = Depends(get_current_user)):
    if tsvc.is_builtin(key):
        raise HTTPException(status_code=400, detail="Built-in levels cannot be deleted")
    if not tsvc.delete(key):
        raise HTTPException(status_code=404, detail="Unknown template")
