"""Device-compatible shim. The ported policy editor fetches its signature /
signature-set / threat-campaign / violation catalogs from
`/api/devices/{id}/...`. This standalone audit app has no devices, so these
endpoints serve the bundled reference in the SAME shapes the editor expects —
the `device_id` is ignored. This lets the editor render unchanged."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.reference import Signature, SignatureSetRef, ThreatCampaign

router = APIRouter(prefix="/api/devices", tags=["device-shim"])


@router.get("/{device_id}/signatures")
async def device_signatures(
    device_id: str,
    skip: int = 0,
    limit: int = Query(100000),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (await db.execute(
        select(Signature).order_by(Signature.id).offset(skip).limit(limit)
    )).scalars().all()
    return [{
        "signatureId": s.id, "name": s.name, "description": s.description,
        "accuracy": s.accuracy, "risk": s.risk, "hasCve": bool(s.cve),
        "systems": s.systems or [], "signatureType": None, "matchesWithin": {},
    } for s in rows]


@router.get("/{device_id}/signature-sets")
async def device_signature_sets(device_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (await db.execute(select(SignatureSetRef).order_by(SignatureSetRef.name))).scalars().all()
    return [{
        "name": s.name, "type": s.type, "category": s.category,
        "signatureCount": s.signature_count, "filter": s.filter,
        "memberIds": s.member_ids or [], "syncedAt": None,
    } for s in rows]


@router.get("/{device_id}/threat-campaigns")
async def device_threat_campaigns(device_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (await db.execute(select(ThreatCampaign).order_by(ThreatCampaign.name))).scalars().all()
    return [{
        "name": t.name, "displayName": t.name, "attackType": None,
        "risk": None, "isEnabled": t.is_enabled, "lastUpdated": None,
    } for t in rows]


@router.get("/{device_id}/violations")
async def device_violations(device_id: str, user: User = Depends(get_current_user)):
    # No device violation catalog in the standalone app; the editor degrades
    # gracefully (shows the policy's own violation names without titles).
    return []
