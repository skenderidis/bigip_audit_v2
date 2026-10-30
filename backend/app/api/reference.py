"""Read-only API over the bundled WAF reference data (signatures, signature
sets, threat campaigns, character-set defaults). Feeds the policy viewer's
device-less enrichment."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.reference import Signature, SignatureSetRef, ThreatCampaign
from app.services.seed import load_character_sets

router = APIRouter(prefix="/api/audit/ref", tags=["reference"])


def _sig(s: Signature) -> dict:
    return {
        "id": s.id, "name": s.name, "accuracy": s.accuracy, "risk": s.risk,
        "attackType": s.attack_type, "systems": s.systems or [],
        "cve": s.cve or "", "hasCve": bool(s.cve), "description": s.description, "scope": s.scope,
    }


from app.services.ref_store import filter_conditions as _set_conditions


@router.get("/signatures")
async def signatures(
    ids: str | None = Query(None, description="comma-separated signature ids"),
    q: str | None = None,
    risk: str | None = None,
    accuracy: str | None = None,
    attack_type: str | None = None,
    cve: str | None = Query(None, description="'yes' or 'no'"),
    set_name: str | None = Query(None, alias="set", description="signature-set name"),
    limit: int = 200,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    limit = max(1, min(int(limit), 5000))
    stmt = select(Signature)
    if set_name:
        row = (await db.execute(
            select(SignatureSetRef).where(func.lower(SignatureSetRef.name) == set_name.lower())
        )).scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Signature set not found")
        for cond in _set_conditions(row.filter or {}):
            stmt = stmt.where(cond)
    if ids:
        id_list = [x.strip() for x in ids.split(",") if x.strip()]
        stmt = stmt.where(Signature.id.in_(id_list))
    if q:
        stmt = stmt.where(Signature.name.ilike(f"%{q}%"))
    if risk:
        stmt = stmt.where(Signature.risk == risk)
    if accuracy:
        stmt = stmt.where(Signature.accuracy == accuracy)
    if attack_type:
        stmt = stmt.where(Signature.attack_type == attack_type)
    if cve == "yes":
        stmt = stmt.where(Signature.cve.isnot(None), Signature.cve != "")
    elif cve == "no":
        stmt = stmt.where((Signature.cve.is_(None)) | (Signature.cve == ""))
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.order_by(Signature.id).limit(limit).offset(offset))).scalars().all()
    return {"total": total, "signatures": [_sig(s) for s in rows]}


@router.get("/signatures/{sig_id}")
async def signature(sig_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = await db.get(Signature, sig_id)
    if not s:
        raise HTTPException(status_code=404, detail="Signature not found")
    return _sig(s)


@router.get("/signature-sets")
async def signature_sets(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (await db.execute(select(SignatureSetRef).order_by(SignatureSetRef.name))).scalars().all()
    return [{
        "name": s.name, "type": s.type, "category": s.category,
        "signatureCount": s.signature_count, "filter": s.filter, "memberIds": s.member_ids,
    } for s in rows]


@router.get("/threat-campaigns")
async def threat_campaigns(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (await db.execute(select(ThreatCampaign).order_by(ThreatCampaign.name))).scalars().all()
    return [{"id": t.id, "name": t.name, "description": t.description, "isEnabled": t.is_enabled} for t in rows]


@router.get("/character-sets")
async def character_sets(user: User = Depends(get_current_user)):
    return load_character_sets()
