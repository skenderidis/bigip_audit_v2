"""Pull the attack-signature catalog + signature sets from a live F5 BIG-IP
over iControl REST, normalised into ref_store rows."""
from __future__ import annotations

import re

import httpx

from app.services import ref_store


def _base(url: str) -> str:
    url = (url or "").strip().rstrip("/")
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


async def _login(client: httpx.AsyncClient, base: str, username: str, password: str) -> dict:
    """Token auth; returns the auth header (empty dict falls back to basic auth)."""
    try:
        r = await client.post(
            f"{base}/mgmt/shared/authn/login",
            json={"username": username, "password": password, "loginProviderName": "tmos"},
        )
        if r.status_code == 200:
            token = (r.json().get("token") or {}).get("token")
            if token:
                return {"X-F5-Auth-Token": token}
    except httpx.HTTPError:
        pass
    return {}


async def _paged(client, base, path, headers, auth, params, page):
    """Collect every item from a paginated iControl-REST collection."""
    items, skip = [], 0
    while True:
        q = dict(params or {})
        q["$top"] = page
        q["$skip"] = skip
        r = await client.get(f"{base}{path}", params=q, headers=headers, auth=auth)
        r.raise_for_status()
        batch = r.json().get("items", []) or []
        items.extend(batch)
        if len(batch) < page:
            break
        skip += page
    return items


def _ref_id(ref) -> str | None:
    """The trailing id of an iControl reference ({'link': '.../<id>?ver=..'})."""
    if not isinstance(ref, dict):
        return None
    if ref.get("id"):
        return str(ref["id"])
    m = re.search(r"/([^/?]+)(?:\?|$)", ref.get("link") or "")
    return m.group(1) if m else None


def _resolve_attack_type(sig: dict, amap: dict) -> None:
    """F5 returns attackType as an unexpanded reference; resolve it to a name
    via the attack-types map and store it where normalize_signature reads it."""
    at = sig.get("attackType")
    name = at.get("name") if isinstance(at, dict) else None
    if not name:
        name = amap.get(_ref_id(at))
    if name:
        sig["attack_type"] = name


async def pull(url: str, username: str, password: str, verify: bool = False) -> tuple[list[dict], list[dict]]:
    """Return (signature_rows, signature_set_rows) normalised for ref_store."""
    base = _base(url)
    async with httpx.AsyncClient(verify=verify, timeout=120) as client:
        headers = await _login(client, base, username, password)
        auth = None if headers else (username, password)

        # Attack types come back as references on each signature — fetch the
        # catalogue once to map reference-id -> human name.
        atypes_raw = await _paged(client, base, "/mgmt/tm/asm/attack-types", headers, auth, {}, 500)
        amap = {}
        for a in atypes_raw:
            if isinstance(a, dict) and a.get("name"):
                if a.get("id"):
                    amap[str(a["id"])] = a["name"]
                rid = _ref_id({"link": a.get("selfLink", "")})
                if rid:
                    amap[rid] = a["name"]

        sets_raw = await _paged(client, base, "/mgmt/tm/asm/signature-sets", headers, auth, {}, 500)
        sigs_raw = await _paged(
            client, base, "/mgmt/tm/asm/signatures", headers, auth,
            {"$select": "signatureId,name,accuracy,risk,attackTypeReference,systems,signatureType,description,hasCve,references"},
            1000,
        )

    for s in sigs_raw:
        _resolve_attack_type(s, amap)
    sig_rows = [r for r in (ref_store.normalize_signature(s) for s in sigs_raw) if r]

    seen, set_rows = set(), []
    for s in sets_raw:
        row = ref_store.normalize_set(s)
        if row and row["name"] not in seen:
            seen.add(row["name"])
            set_rows.append(row)
    return sig_rows, set_rows
