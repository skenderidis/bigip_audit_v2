"""Seed the bundled WAF reference data into the DB on first run. Idempotent:
each table is loaded only when empty, so restarts are cheap and safe."""
import gzip
import json
from pathlib import Path

from sqlalchemy import select, func, insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reference import Signature, SignatureSetRef, ThreatCampaign

SEED_DIR = Path(__file__).resolve().parent.parent / "seed"


def _read_ndjson(path: Path):
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


async def _empty(db: AsyncSession, model) -> bool:
    n = (await db.execute(select(func.count()).select_from(model))).scalar_one()
    return n == 0


async def seed_reference(db: AsyncSession) -> None:
    # ── signatures ──
    sig_gz = SEED_DIR / "signatures.ndjson.gz"
    if sig_gz.exists() and await _empty(db, Signature):
        rows = [{
            "id": str(r["id"]), "name": r.get("name"), "accuracy": r.get("accuracy"),
            "risk": r.get("risk"), "attack_type": r.get("attack_type"),
            "systems": r.get("systems"), "cve": r.get("cve"),
            "description": r.get("description"), "scope": r.get("scope"),
        } for r in _read_ndjson(sig_gz)]
        for i in range(0, len(rows), 2000):          # batch to keep statements sane
            await db.execute(insert(Signature), rows[i:i + 2000])
        await db.commit()
        print(f"[seed] signatures: {len(rows)}")

    # ── signature sets ──
    sets_path = SEED_DIR / "signature_sets.json"
    if sets_path.exists() and await _empty(db, SignatureSetRef):
        data = json.loads(sets_path.read_text()) or []
        rows = [{
            "name": s["name"], "type": s.get("type"), "category": s.get("category"),
            "signature_count": s.get("signature_count"), "filter": s.get("filter"),
            "member_ids": s.get("member_ids"),
        } for s in data if s.get("name")]
        if rows:
            await db.execute(insert(SignatureSetRef), rows)
            await db.commit()
            print(f"[seed] signature_sets: {len(rows)}")

    # ── threat campaigns ──
    tc_gz = SEED_DIR / "threat_campaigns.ndjson.gz"
    if tc_gz.exists() and await _empty(db, ThreatCampaign):
        seen, rows = set(), []
        for r in _read_ndjson(tc_gz):
            tid = str(r["id"])
            if tid in seen:
                continue
            seen.add(tid)
            rows.append({
                "id": tid, "name": r.get("name"), "description": r.get("description"),
                "is_enabled": bool(r.get("is_enabled")),
            })
        for i in range(0, len(rows), 2000):
            await db.execute(insert(ThreatCampaign), rows[i:i + 2000])
        await db.commit()
        print(f"[seed] threat_campaigns: {len(rows)}")


def load_character_sets() -> dict | None:
    """Global default character sets — served straight from the bundled file."""
    path = SEED_DIR / "character_sets.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return None
