"""LTM / Bot / DDoS audit API. A device review is created by pulling an F5
iHealth QKView (needs iHealth credentials configured under Settings), analyzing
it, and storing the result. The Bot and DDoS pages read the same row."""
import asyncio
import base64
import json

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.db import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.ltm_audit import LtmAudit
from app.services import ihealth, ihealth_settings, ltm_analyzer, ltm_report

router = APIRouter(prefix="/api/ltm", tags=["ltm"])


def _device_name(results: dict) -> str:
    """The device's FQDN. BIG-IP records it as `hostname` in the sys DB and in
    the cm-device record; both are the fully-qualified name (e.g.
    bigip1.example.net)."""
    sysdb = results.get("sysdb_file") or {}
    if sysdb.get("hostname"):
        return str(sysdb["hostname"])
    cm = results.get("list_cm_device") or {}
    if isinstance(cm, dict) and (cm.get("hostname") or cm.get("name")):
        return str(cm.get("hostname") or cm.get("name"))
    show = results.get("show_cm_device")
    if isinstance(show, list) and show and isinstance(show[0], dict) and show[0].get("Hostname"):
        return str(show[0]["Hostname"])
    hi = results.get("host_info") or {}
    for k in ("hostname", "host_name", "device_name"):
        if hi.get(k):
            return str(hi[k])
    return "BIG-IP device"


_SEV_MAP = {"CRITICAL": "High", "HIGH": "High", "MEDIUM": "Medium", "LOW": "Low", "INFO": "Low"}


def _summarize(findings: dict) -> dict:
    def counts(items):
        c = {"High": 0, "Medium": 0, "Low": 0}
        for f in items or []:
            r = f.get("rating")
            if r in c:
                c[r] += 1
        return {**c, "total": len(items or [])}

    def counts_diag(items):
        c = {"High": 0, "Medium": 0, "Low": 0}
        for d in items or []:
            sev = _SEV_MAP.get((d.get("h_importance") or "").upper())
            if sev:
                c[sev] += 1
        return {**c, "total": len(items or [])}

    out = {k: counts(findings.get(k)) for k in ("ltm", "bot", "dos")}

    # Diagnostics roll up by the iHealth h_importance severity — CVE and Other
    # kept as separate columns, plus a combined rollup for back-compat.
    diag = findings.get("diag") or {}
    cve_items = diag.get("cve") or []
    other_items = diag.get("other") or []
    out["cve"] = counts_diag(cve_items)
    out["other"] = counts_diag(other_items)
    alld = cve_items + other_items
    out["diag"] = {**counts_diag(alld), "cve": len(cve_items), "other": len(other_items)}
    return out


class CreateBody(BaseModel):
    qkview_id: str
    customer: str | None = None


# Resources-Utilization graphs: the six report slots and the filename tokens
# (case-insensitive substrings) that identify each uploaded image.
GRAPH_SLOTS = [
    ("throughput", "Throughput", ("throughput",)),
    ("http_requests", "HTTP Requests", ("httprequest", "http_request", "httpreq")),
    ("memory", "Memory Usage", ("memory", "memusage")),
    ("ssl", "SSL Transactions", ("ssltps", "ssltransaction", "ssl")),
    ("cpu", "CPU Utilization", ("cpucores", "cpucore", "cpu")),
    ("active_connections", "Active Connections", ("activecon", "active_connection", "activeconnection")),
]
GRAPH_KEYS = [k for k, _, _ in GRAPH_SLOTS]


def _match_graph_key(filename: str) -> str | None:
    name = (filename or "").lower()
    for key, _label, tokens in GRAPH_SLOTS:
        if any(tok in name for tok in tokens):
            return key
    return None


def _row_out(row: LtmAudit, detail: bool = False) -> dict:
    out = {
        "id": row.id,
        "device_name": row.device_name,
        "qkview_id": row.qkview_id,
        "customer": row.customer,
        "summary": row.summary,
        "graph_keys": sorted((row.graphs or {}).keys()),
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
    if detail:
        out["findings"] = row.findings
        out["content"] = row.content
        out["diagnostics"] = row.diagnostics
        out["excluded"] = row.excluded or {"findings": [], "diag": []}
    return out


@router.get("/audits")
async def list_audits(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (await db.execute(select(LtmAudit).order_by(LtmAudit.created_at.desc()))).scalars().all()
    return [_row_out(r) for r in rows]


@router.get("/audits/{audit_id}")
async def get_audit(audit_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    row = await db.get(LtmAudit, audit_id)
    if not row:
        raise HTTPException(status_code=404, detail="Audit not found")
    return _row_out(row, detail=True)


class ExcludePatch(BaseModel):
    kind: str          # 'finding' | 'diag'
    key: str           # finding name, or diagnostic h_header
    excluded: bool     # True = remove, False = restore


@router.post("/audits/{audit_id}/exclude")
async def set_exclusion(audit_id: int, patch: ExcludePatch,
                        db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Remove (or restore) a single finding or diagnostic from an audit. Removed
    items are hidden from the UI and left out of the Word/Excel reports; the
    audit's summary counts are recomputed."""
    row = await db.get(LtmAudit, audit_id)
    if not row:
        raise HTTPException(status_code=404, detail="Audit not found")
    exc = {"findings": list((row.excluded or {}).get("findings") or []),
           "diag": list((row.excluded or {}).get("diag") or [])}
    bucket = "findings" if patch.kind == "finding" else "diag"
    current = set(exc[bucket])
    current.add(patch.key) if patch.excluded else current.discard(patch.key)
    exc[bucket] = sorted(current)
    row.excluded = exc
    row.summary = _summarize(ltm_analyzer.apply_exclusions(row.findings or {}, exc))
    flag_modified(row, "excluded")
    flag_modified(row, "summary")
    await db.commit()
    await db.refresh(row)
    return _row_out(row, detail=True)


@router.get("/graph-slots")
async def graph_slots(user: User = Depends(get_current_user)):
    """The six Resources-Utilization graph slots (key + label), in report order."""
    return [{"key": k, "label": lbl} for k, lbl, _ in GRAPH_SLOTS]


_MAX_GRAPH_BYTES = 4 * 1024 * 1024   # 4 MB per image
# PNG / JPEG / GIF magic bytes — only real images are accepted.
_IMAGE_MAGIC = (b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff", b"GIF87a", b"GIF89a")


@router.post("/audits/{audit_id}/graphs")
async def upload_graphs(audit_id: int, files: list[UploadFile] = File(...),
                        db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Upload one or more Resources-Utilization graph images. Each file is
    matched to a slot by its name (e.g. '…throughput….png'); files that are
    unrecognized, oversized (> 4 MB), or not images are reported back and skipped."""
    row = await db.get(LtmAudit, audit_id)
    if not row:
        raise HTTPException(status_code=404, detail="Audit not found")
    graphs = dict(row.graphs or {})
    stored, unrecognized, rejected = [], [], []
    for up in files:
        key = _match_graph_key(up.filename)
        data = await up.read()
        if not key or not data:
            unrecognized.append(up.filename)
            continue
        if len(data) > _MAX_GRAPH_BYTES:
            rejected.append(f"{up.filename} (over 4 MB)")
            continue
        if not data.startswith(_IMAGE_MAGIC):
            rejected.append(f"{up.filename} (not an image)")
            continue
        graphs[key] = base64.b64encode(data).decode("ascii")
        stored.append(key)
    row.graphs = graphs
    flag_modified(row, "graphs")
    await db.commit()
    return {"stored": stored, "unrecognized": unrecognized, "rejected": rejected,
            "graph_keys": sorted(graphs.keys())}


@router.get("/audits/{audit_id}/graphs/{key}")
async def get_graph(audit_id: int, key: str, db: AsyncSession = Depends(get_db),
                    user: User = Depends(get_current_user)):
    row = await db.get(LtmAudit, audit_id)
    if not row or not (row.graphs or {}).get(key):
        raise HTTPException(status_code=404, detail="Graph not found")
    try:
        data = base64.b64decode(row.graphs[key])
    except Exception:
        raise HTTPException(status_code=404, detail="Graph not found")
    return Response(content=data, media_type="image/png")


@router.delete("/audits/{audit_id}/graphs/{key}")
async def delete_graph(audit_id: int, key: str, db: AsyncSession = Depends(get_db),
                       user: User = Depends(get_current_user)):
    row = await db.get(LtmAudit, audit_id)
    if not row:
        raise HTTPException(status_code=404, detail="Audit not found")
    graphs = dict(row.graphs or {})
    graphs.pop(key, None)
    row.graphs = graphs
    flag_modified(row, "graphs")
    await db.commit()
    return {"graph_keys": sorted(graphs.keys())}


@router.post("/audits")
async def create_audit(body: CreateBody, db: AsyncSession = Depends(get_db),
                       user: User = Depends(get_current_user)):
    creds = await ihealth_settings.load(db)
    if not creds.get("client_id") or not creds.get("client_secret"):
        raise HTTPException(status_code=400,
                            detail="F5 iHealth credentials are not configured — set them under Settings → iHealth.")
    qid = (body.qkview_id or "").strip()
    if not qid:
        raise HTTPException(status_code=400, detail="A QKView ID is required.")

    # The pull is synchronous and slow (many authenticated requests) — run it
    # off the event loop.
    try:
        results, diagnostics = await asyncio.to_thread(
            ihealth.pull_qkview, qid, creds["client_id"], creds["client_secret"])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"iHealth pull failed: {e}")

    row = await _store_audit(db, qid, body.customer, results, diagnostics)
    return _row_out(row, detail=True)


async def _store_audit(db: AsyncSession, qid: str, customer, results: dict, diagnostics: dict) -> LtmAudit:
    findings = ltm_analyzer.analyze(results, diagnostics)
    row = LtmAudit(
        device_name=_device_name(results),
        qkview_id=qid,
        customer=customer,
        content=results,
        diagnostics=diagnostics,
        findings=findings,
        summary=_summarize(findings),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.post("/audits/stream")
async def create_audit_stream(body: CreateBody, db: AsyncSession = Depends(get_db),
                              user: User = Depends(get_current_user)):
    """Same as POST /audits but streams newline-delimited JSON progress events
    so the UI can show each individual iHealth call as it runs:
        {"type":"progress","label":"list /ltm pool all-properties","i":12,"n":40}
        {"type":"done","audit":{...}}   |   {"type":"error","detail":"..."}
    Credential/input errors are raised normally (before the stream opens)."""
    creds = await ihealth_settings.load(db)
    if not creds.get("client_id") or not creds.get("client_secret"):
        raise HTTPException(status_code=400,
                            detail="F5 iHealth credentials are not configured — set them under Settings → iHealth.")
    qid = (body.qkview_id or "").strip()
    if not qid:
        raise HTTPException(status_code=400, detail="A QKView ID is required.")

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    _DONE = object()

    def progress(label, i, n):
        # runs in the pull worker thread → marshal back onto the loop
        loop.call_soon_threadsafe(
            queue.put_nowait, {"type": "progress", "label": label, "i": i, "n": n})

    def _pull():
        return ihealth.pull_qkview(qid, creds["client_id"], creds["client_secret"], progress=progress)

    async def gen():
        holder: dict = {}

        async def driver():
            try:
                holder["value"] = await asyncio.to_thread(_pull)
            except Exception as e:  # noqa: BLE001
                holder["error"] = str(e)
            finally:
                await queue.put(_DONE)

        task = asyncio.create_task(driver())
        while True:
            evt = await queue.get()
            if evt is _DONE:
                break
            yield json.dumps(evt) + "\n"
        await task

        if "error" in holder:
            yield json.dumps({"type": "error", "detail": f"iHealth pull failed: {holder['error']}"}) + "\n"
            return
        try:
            results, diagnostics = holder["value"]
            row = await _store_audit(db, qid, body.customer, results, diagnostics)
            yield json.dumps({"type": "done", "audit": _row_out(row, detail=True)}) + "\n"
        except Exception as e:  # noqa: BLE001
            await db.rollback()
            yield json.dumps({"type": "error", "detail": f"Failed to store audit: {e}"}) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson",
                             headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"})


def _report_filename(row: LtmAudit, ext: str) -> str:
    device = (row.device_name or "device").replace("/", "-")
    today = row.created_at.date().isoformat() if row.created_at else ""
    name = f"F5 LTM - Config Review - {device} - {today}.{ext}".strip()
    # keep the header value ASCII-safe
    return name.encode("ascii", "ignore").decode() or f"ltm-report.{ext}"


@router.get("/audits/{audit_id}/report/{fmt}")
async def download_report(audit_id: int, fmt: str, db: AsyncSession = Depends(get_db),
                          user: User = Depends(get_current_user)):
    row = await db.get(LtmAudit, audit_id)
    if not row:
        raise HTTPException(status_code=404, detail="Audit not found")
    if fmt == "excel":
        data = ltm_report.build_ltm_excel(row)
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        fname = _report_filename(row, "xlsx")
    elif fmt == "word":
        data = ltm_report.build_ltm_docx(row)
        media = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        fname = _report_filename(row, "docx")
    else:
        raise HTTPException(status_code=400, detail="Unknown report format (use 'excel' or 'word').")
    return Response(content=data, media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.delete("/audits/{audit_id}")
async def delete_audit(audit_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    row = await db.get(LtmAudit, audit_id)
    if not row:
        raise HTTPException(status_code=404, detail="Audit not found")
    await db.delete(row)
    await db.commit()
    return {"deleted": audit_id}
