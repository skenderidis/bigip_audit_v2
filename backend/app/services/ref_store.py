"""Refresh the bundled WAF reference data (signatures + signature sets) from an
uploaded file or an F5 pull. Normalises both our seed shape and the raw F5
iControl-REST shape, then replaces the DB tables wholesale."""
from __future__ import annotations

import gzip
import json
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import and_, delete, func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reference import Signature, SignatureSetRef

META_PATH = Path(__file__).resolve().parent.parent / "data" / "ref_meta.json"


# ---------------------------------------------------------------------------
# normalisation (accepts our seed shape OR raw F5 iControl-REST items)
# ---------------------------------------------------------------------------
def _name_of(v):
    if isinstance(v, dict):
        return v.get("name")
    return v


def normalize_signature(r: dict) -> dict | None:
    """Map one signature (seed shape or F5 raw) to a ref_signatures row."""
    if not isinstance(r, dict):
        return None
    sid = r.get("id") or r.get("signatureId") or r.get("signatureReference", {}).get("signatureId")
    if sid is None:
        return None
    attack = r.get("attack_type")
    if attack is None:
        # F5 iControl returns the attack type as `attackTypeReference`
        # (carries .name); older/seed shapes use `attackType`.
        attack = _name_of(r.get("attackType")) or _name_of(r.get("attackTypeReference"))
    systems = r.get("systems")
    if systems and isinstance(systems[0], dict):
        systems = [_name_of(s) for s in systems]
    # CVE: seed shape has `cve`; F5 keeps CVE ids in `references` [{type,value}]
    # and a `hasCve` flag.
    cve = r.get("cve")
    if not cve:
        cves = [x.get("value") for x in (r.get("references") or [])
                if isinstance(x, dict) and (x.get("type") or "").lower() == "cve" and x.get("value")]
        cve = ", ".join(cves) if cves else ("cve" if r.get("hasCve") else None)
    return {
        "id": str(sid),
        "name": r.get("name"),
        "accuracy": r.get("accuracy"),
        "risk": r.get("risk"),
        "attack_type": attack,
        "systems": systems,
        "cve": cve,
        "description": r.get("description"),
        "scope": r.get("scope") or r.get("signatureType"),
    }


def normalize_set(s: dict) -> dict | None:
    """Map one signature set (seed shape or F5 raw) to a ref_signature_sets row."""
    if not isinstance(s, dict) or not s.get("name"):
        return None
    return {
        "name": s["name"],
        "type": s.get("type"),
        "category": s.get("category"),
        "signature_count": s.get("signature_count") or s.get("signatureCount"),
        "filter": s.get("filter"),
        "member_ids": s.get("member_ids"),
    }


def parse_signatures_bytes(raw: bytes, filename: str) -> list[dict]:
    """Parse a signatures upload: .json(.gz) array/object or .ndjson(.gz)."""
    if filename.endswith(".gz"):
        raw = gzip.decompress(raw)
    text = raw.decode("utf-8", errors="replace").strip()
    rows: list[dict] = []
    if text[:1] == "[":
        rows = json.loads(text)
    elif text[:1] == "{" and '"items"' in text[:200]:
        rows = json.loads(text).get("items", [])
    elif text[:1] == "{":
        # single object or ndjson that happens to start with {
        try:
            obj = json.loads(text)
            rows = obj.get("items", [obj]) if isinstance(obj, dict) else obj
        except json.JSONDecodeError:
            rows = [json.loads(ln) for ln in text.splitlines() if ln.strip()]
    else:
        rows = [json.loads(ln) for ln in text.splitlines() if ln.strip()]
    out = [normalize_signature(r) for r in rows]
    return [r for r in out if r]


def parse_sets_bytes(raw: bytes, filename: str) -> list[dict]:
    if filename.endswith(".gz"):
        raw = gzip.decompress(raw)
    text = raw.decode("utf-8", errors="replace").strip()
    if text[:1] == "{":
        data = json.loads(text)
        data = data.get("items", []) if isinstance(data, dict) else data
    else:
        data = json.loads(text)
    out = [normalize_set(s) for s in data]
    # de-dup by name (table has a unique constraint)
    seen, rows = set(), []
    for r in out:
        if r and r["name"] not in seen:
            seen.add(r["name"])
            rows.append(r)
    return rows


# ---------------------------------------------------------------------------
# DB replace
# ---------------------------------------------------------------------------
async def replace_signatures(db: AsyncSession, rows: list[dict]) -> int:
    await db.execute(delete(Signature))
    for i in range(0, len(rows), 2000):
        await db.execute(insert(Signature), rows[i:i + 2000])
    await db.commit()
    return len(rows)


async def replace_signature_sets(db: AsyncSession, rows: list[dict]) -> int:
    await db.execute(delete(SignatureSetRef))
    if rows:
        await db.execute(insert(SignatureSetRef), rows)
    await db.commit()
    return len(rows)


# ---------------------------------------------------------------------------
# status + meta
# ---------------------------------------------------------------------------
def read_meta() -> dict:
    try:
        return json.loads(META_PATH.read_text())
    except (OSError, json.JSONDecodeError):
        return {}


def write_meta(source: str, by: str, counts: dict) -> dict:
    meta = {
        "source": source,
        "by": by,
        "counts": counts,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        META_PATH.write_text(json.dumps(meta, indent=2))
    except OSError:
        pass
    return meta


async def attack_type_counts(db: AsyncSession) -> dict:
    """{attack_type: signature count} — total catalog counts (the "available"
    figure shown behind the (i) icon)."""
    rows = (await db.execute(
        select(Signature.attack_type, func.count()).group_by(Signature.attack_type)
    )).all()
    return {a: c for a, c in rows if a}


async def signature_ids_name_like(db: AsyncSession, pattern: str) -> set[str]:
    """Catalogue signature ids whose name matches an ILIKE pattern — used for
    cross-cutting groups (e.g. SSRF) that F5 does not model as an attack type."""
    rows = (await db.execute(
        select(Signature.id).where(Signature.name.ilike(pattern))
    )).all()
    return {str(r[0]) for r in rows if r[0] is not None}


# ---------------------------------------------------------------------------
# signature-set membership resolution (from the set's stored F5 filter)
# ---------------------------------------------------------------------------
_ORD = {"low": 0, "medium": 1, "high": 2}


def _threshold_cond(col, filt, val):
    """F5 accuracy/risk filter: 'all' | 'eq' | 'ge' | 'le' with a value."""
    filt = (filt or "all").lower()
    val = (val or "").lower()
    if filt == "all" or val not in _ORD:
        return None
    if filt == "eq":
        return col == val
    lv = _ORD[val]
    allowed = [k for k, o in _ORD.items() if (o >= lv if filt == "ge" else o <= lv)]
    return col.in_(allowed)


def filter_conditions(flt: dict) -> list:
    """Translate a signature-set's stored filter into Signature predicates.
    Exact for attack-type and accuracy/risk sets; criteria we don't model
    (the internal "generic" rule, tags) are not expressible, so broad sets
    resolve to a superset."""
    conds = []
    if not isinstance(flt, dict):
        return conds
    at = flt.get("attackTypeReference")
    if isinstance(at, dict) and at.get("name"):
        conds.append(Signature.attack_type == at["name"])
    for col, f, v in ((Signature.accuracy, flt.get("accuracyFilter"), flt.get("accuracyValue")),
                      (Signature.risk, flt.get("riskFilter"), flt.get("riskValue"))):
        c = _threshold_cond(col, f, v)
        if c is not None:
            conds.append(c)
    st = flt.get("signatureType") or "all"
    if st not in ("all", None):
        conds.append(Signature.scope == st)
    hc = flt.get("hasCve")
    if hc in ("true", True):
        conds.append(and_(Signature.cve.isnot(None), Signature.cve != ""))
    elif hc in ("false", False):
        conds.append((Signature.cve.is_(None)) | (Signature.cve == ""))
    return conds


async def named_signature_coverage(db: AsyncSession, enforced_set_names: list[str],
                                   names: list[str]) -> dict:
    """For each specific signature name, whether it exists in the catalogue and
    whether it's a member of any set the policy enforces (resolved via the set
    filters). {name_lower: {found, available, inSet}}."""
    sets = (await db.execute(select(SignatureSetRef))).scalars().all()
    by_name = {s.name.lower(): s for s in sets}
    enforced_conds = [filter_conditions(by_name[n].filter or {})
                      for n in enforced_set_names if n in by_name]
    out: dict[str, dict] = {}
    for name in names:
        nlow = (name or "").lower()
        total = (await db.execute(
            select(func.count()).select_from(Signature).where(func.lower(Signature.name) == nlow)
        )).scalar_one()
        in_set = False
        if total and enforced_conds:
            for conds in enforced_conds:
                q = select(func.count()).select_from(Signature).where(func.lower(Signature.name) == nlow)
                for c in conds:
                    q = q.where(c)
                if (await db.execute(q)).scalar_one() > 0:
                    in_set = True
                    break
        out[nlow] = {"found": total > 0, "available": total, "inSet": in_set}
    return out


async def set_coverage(db: AsyncSession) -> dict:
    """{set_name_lower: {"types": {attack_type: count}, "exactType": name|None}}
    resolved from each set's filter. `exactType` is set for attack-type-specific
    sets (counts are then exact); broad sets have exactType=None and their
    per-type counts are a filter-matched superset (shown without a number)."""
    sets = (await db.execute(select(SignatureSetRef))).scalars().all()
    out: dict[str, dict] = {}
    for s in sets:
        flt = s.filter or {}
        stmt = select(Signature.attack_type, func.count()).group_by(Signature.attack_type)
        for c in filter_conditions(flt):
            stmt = stmt.where(c)
        rows = (await db.execute(stmt)).all()
        at = flt.get("attackTypeReference") if isinstance(flt, dict) else None
        out[s.name.lower()] = {
            "types": {a: n for a, n in rows if a},
            "exactType": at.get("name") if isinstance(at, dict) else None,
        }
    return out


async def status(db: AsyncSession) -> dict:
    sig_n = (await db.execute(select(func.count()).select_from(Signature))).scalar_one()
    set_n = (await db.execute(select(func.count()).select_from(SignatureSetRef))).scalar_one()
    rows = (await db.execute(
        select(Signature.attack_type, func.count())
        .group_by(Signature.attack_type).order_by(func.count().desc())
    )).all()
    attack_types = [{"attackType": a or "(none)", "count": c} for a, c in rows]
    return {
        "signatures": sig_n,
        "signature_sets": set_n,
        "attack_types": attack_types,
        "meta": read_meta(),
    }
