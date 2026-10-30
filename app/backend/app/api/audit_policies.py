import json
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.audit_policy import AuditPolicy
from app.schemas.audit_policy import AuditPolicyOut, AuditPolicyDetail
from app.services import analyzer
from app.services import config_summary
from app.services import owasp
from app.services import ref_store
from app.services import report_docx
from app.services import templates as tsvc

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _safe_filename(name: str) -> str:
    base = re.sub(r"[^A-Za-z0-9._-]+", "-", (name or "policy").strip()).strip("-")
    return base or "policy"

router = APIRouter(prefix="/api/audit/policies", tags=["audit-policies"])


async def _name_group_ids(db: AsyncSession) -> dict:
    """Catalogue signature-id groups for OWASP requirements that F5 doesn't
    model as an attack type (e.g. SSRF — matched by signature name)."""
    return {"SSRF": await ref_store.signature_ids_name_like(db, "%ssrf%")}


def _unwrap(doc: dict) -> dict:
    """Declarative policies wrap the body as {"policy": {...}}; accept either."""
    if isinstance(doc, dict) and isinstance(doc.get("policy"), dict):
        return doc["policy"]
    return doc if isinstance(doc, dict) else {}


def _summarize(pol: dict) -> dict:
    """Cheap, structural signals for the posture / list pages. NOT the compliance
    audit — that is computed later against a defined baseline."""
    bs = pol.get("blocking-settings", {}) or {}
    violations = bs.get("violations", []) or []
    sig_sets = pol.get("signature-sets", []) or []
    return {
        "enforcementMode": pol.get("enforcementMode"),
        "violations": len(violations),
        "violationsBlocking": sum(1 for v in violations if v.get("block")),
        "signatureSets": len(sig_sets),
        "dataGuard": bool((pol.get("data-guard") or {}).get("enabled")),
        "hasBlockingSettings": bool(bs),
    }


@router.post("/upload", response_model=AuditPolicyOut, status_code=201)
async def upload_policy(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    raw = await file.read()
    try:
        doc = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="File is not valid JSON")
    pol = _unwrap(doc)
    if not pol:
        raise HTTPException(status_code=400, detail="JSON does not contain a policy object")

    name = pol.get("name") or (file.filename or "uploaded-policy").rsplit(".", 1)[0]
    row = AuditPolicy(
        name=name,
        source="upload",
        filename=file.filename,
        domain="waf",
        content=doc,
        summary=_summarize(pol),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.get("", response_model=list[AuditPolicyOut])
async def list_policies(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (await db.execute(select(AuditPolicy).order_by(AuditPolicy.uploaded_at.desc()))).scalars().all()
    return rows


@router.get("/{policy_id}", response_model=AuditPolicyDetail)
async def get_policy(policy_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    row = await db.get(AuditPolicy, policy_id)
    if not row:
        raise HTTPException(status_code=404, detail="Policy not found")
    return row


@router.delete("/{policy_id}", status_code=204)
async def delete_policy(policy_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    row = await db.get(AuditPolicy, policy_id)
    if not row:
        raise HTTPException(status_code=404, detail="Policy not found")
    await db.delete(row)
    await db.commit()


class TemplateBody(BaseModel):
    # None / "" clears the template → gap analysis is skipped, config quality and
    # OWASP are still computed.
    template: str | None = None


def _known_template_names() -> set[str]:
    """Names (and keys) of every template defined in Settings → Templates."""
    all_ = tsvc.load_all()
    names = {k for k in all_}
    names.update(v.get("name") for v in all_.values()
                 if isinstance(v, dict) and v.get("name"))
    return names


def _resolve_template_checks(template: str | None) -> dict:
    """Find a Settings template by key or display name and return its check map
    (VIOL_* → yes/no). Empty when the policy has no / an unknown template."""
    if not template:
        return {}
    all_ = tsvc.load_all()
    if template in all_ and isinstance(all_[template], dict):
        return all_[template]
    for v in all_.values():
        if isinstance(v, dict) and v.get("name") == template:
            return v
    return {}


@router.put("/{policy_id}/template", response_model=AuditPolicyOut)
async def set_template(policy_id: int, body: TemplateBody,
                       db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    template = (body.template or "").strip() or None
    if template is not None and template not in _known_template_names():
        raise HTTPException(status_code=400, detail="Unknown template; choose one defined in Settings → Templates.")
    row = await db.get(AuditPolicy, policy_id)
    if not row:
        raise HTTPException(status_code=404, detail="Policy not found")
    row.template = template
    await db.commit()
    await db.refresh(row)
    return row


@router.post("/{policy_id}/analyze")
async def analyze_one(policy_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Run the analyzer against the stored policy content; persist findings + summary."""
    row = await db.get(AuditPolicy, policy_id)
    if not row:
        raise HTTPException(status_code=404, detail="Policy not found")
    findings = analyzer.analyze_policy(row.content or {})
    summary = analyzer.summarize(findings)
    # Risk = coverage gap vs the policy's selected template (separate from the
    # configuration-quality score the findings produce). With no template, gap
    # analysis is skipped (risk = None) while config quality + OWASP still run.
    checks = _resolve_template_checks(row.template)
    if checks:
        gap = analyzer.compare_to_template(row.content or {}, checks)
        summary["risk"] = gap["risk"]
        summary["gap"] = {k: gap[k] for k in ("total", "missing", "partial", "covered")}
    else:
        summary["risk"] = None
        summary["gap"] = {"total": 0, "missing": [], "partial": [], "covered": []}
    # OWASP Top-10 compliance (compact; full per-requirement detail via /owasp).
    avail = await ref_store.attack_type_counts(db)
    set_coverage = await ref_store.set_coverage(db)
    named_cov = await ref_store.named_signature_coverage(db, owasp.enforced_set_names(row.content or {}), owasp.named_signature_names())
    name_groups = await _name_group_ids(db)
    summary["owasp"] = owasp.summary(row.content or {}, avail, row.owasp_acks or {}, set_coverage, named_cov, name_groups)
    row.findings = findings
    row.analysis = summary
    row.analyzed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return {"id": row.id, "name": row.name, "template": row.template,
            "analysis": summary, "findings": findings}


@router.get("/{policy_id}/config")
async def get_config(policy_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Presentation-ready config summary for the Configuration Review page."""
    row = await db.get(AuditPolicy, policy_id)
    if not row:
        raise HTTPException(status_code=404, detail="Policy not found")
    return config_summary.build_summary(row.content or {})


@router.get("/{policy_id}/risk")
async def get_risk(policy_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Full coverage-gap (Risk) breakdown vs the policy's selected template —
    per-violation missing / partial / covered lists."""
    row = await db.get(AuditPolicy, policy_id)
    if not row:
        raise HTTPException(status_code=404, detail="Policy not found")
    checks = _resolve_template_checks(row.template)
    if not checks:
        return {"risk": None, "total": 0, "template": row.template,
                "missing": [], "partial": [], "covered": []}
    gap = analyzer.compare_to_template(row.content or {}, checks)
    return {
        "risk": gap["risk"], "total": gap["total"], "template": row.template,
        "missing": gap["missing"], "partial": gap["partial"], "covered": gap["covered"],
    }


@router.get("/{policy_id}/owasp")
async def get_owasp(policy_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Full OWASP Top-10 compliance breakdown (per-requirement) for a policy."""
    row = await db.get(AuditPolicy, policy_id)
    if not row:
        raise HTTPException(status_code=404, detail="Policy not found")
    avail = await ref_store.attack_type_counts(db)
    set_coverage = await ref_store.set_coverage(db)
    named_cov = await ref_store.named_signature_coverage(db, owasp.enforced_set_names(row.content or {}), owasp.named_signature_names())
    name_groups = await _name_group_ids(db)
    return owasp.evaluate(row.content or {}, avail, row.owasp_acks or {}, set_coverage, named_cov, name_groups)


class OwaspAckBody(BaseModel):
    acks: dict[str, bool]


@router.put("/{policy_id}/owasp/ack")
async def set_owasp_acks(policy_id: int, body: OwaspAckBody,
                         db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Accept (or un-accept) OWASP requirements that can't be derived from the
    policy (virtual-server TLS posture). Merges, re-scores, and returns the full
    breakdown plus the compact form stored on the analysis."""
    row = await db.get(AuditPolicy, policy_id)
    if not row:
        raise HTTPException(status_code=404, detail="Policy not found")
    acks = {**(row.owasp_acks or {}), **body.acks}
    row.owasp_acks = acks
    avail = await ref_store.attack_type_counts(db)
    set_coverage = await ref_store.set_coverage(db)
    named_cov = await ref_store.named_signature_coverage(db, owasp.enforced_set_names(row.content or {}), owasp.named_signature_names())
    name_groups = await _name_group_ids(db)
    full = owasp.evaluate(row.content or {}, avail, acks, set_coverage, named_cov, name_groups)
    compact = owasp.summary(row.content or {}, avail, acks, set_coverage, named_cov, name_groups)
    # Keep the cell % (from analysis.owasp) in sync if the policy was analyzed.
    if row.analysis:
        row.analysis = {**row.analysis, "owasp": compact}
    await db.commit()
    return {"owasp": compact, "detail": full}


@router.get("/{policy_id}/report/owasp")
async def download_owasp_report(policy_id: int, db: AsyncSession = Depends(get_db),
                                user: User = Depends(get_current_user)):
    """Download the OWASP Top-10 compliance breakdown as a .docx."""
    row = await db.get(AuditPolicy, policy_id)
    if not row:
        raise HTTPException(status_code=404, detail="Policy not found")
    avail = await ref_store.attack_type_counts(db)
    set_coverage = await ref_store.set_coverage(db)
    named_cov = await ref_store.named_signature_coverage(db, owasp.enforced_set_names(row.content or {}), owasp.named_signature_names())
    name_groups = await _name_group_ids(db)
    data = owasp.evaluate(row.content or {}, avail, row.owasp_acks or {}, set_coverage, named_cov, name_groups)
    doc = report_docx.build_owasp_report(data, row.name)
    fname = f"{_safe_filename(row.name)}_OWASP_Compliance.docx"
    return Response(content=doc, media_type=DOCX_MIME,
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.get("/{policy_id}/report/summary")
async def download_summary(policy_id: int, db: AsyncSession = Depends(get_db),
                           user: User = Depends(get_current_user)):
    """Download the one-table suggestions summary as a .docx."""
    row = await db.get(AuditPolicy, policy_id)
    if not row:
        raise HTTPException(status_code=404, detail="Policy not found")
    data = report_docx.build_summary(row)
    fname = f"{_safe_filename(row.name)}_summary.docx"
    return Response(content=data, media_type=DOCX_MIME,
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.get("/{policy_id}/report/full")
async def download_full_report(policy_id: int, db: AsyncSession = Depends(get_db),
                               user: User = Depends(get_current_user)):
    """Download the full F5 ASM Config Review report as a .docx."""
    row = await db.get(AuditPolicy, policy_id)
    if not row:
        raise HTTPException(status_code=404, detail="Policy not found")
    data = report_docx.build_full_report(row)
    fname = f"{_safe_filename(row.name)}_ASM_Config_Review.docx"
    return Response(content=data, media_type=DOCX_MIME,
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.get("/{policy_id}/report/coverage-gap")
async def download_coverage_gap_report(policy_id: int, db: AsyncSession = Depends(get_db),
                                       user: User = Depends(get_current_user)):
    """Download the Coverage Gap (vs template) summary as a .docx."""
    row = await db.get(AuditPolicy, policy_id)
    if not row:
        raise HTTPException(status_code=404, detail="Policy not found")
    checks = _resolve_template_checks(row.template)
    if not checks:
        raise HTTPException(status_code=400,
                            detail="No template selected for this policy — choose a template and re-analyze first.")
    gap = analyzer.compare_to_template(row.content or {}, checks)
    data_obj = {"risk": gap["risk"], "total": gap["total"], "template": row.template,
                "missing": gap["missing"], "partial": gap["partial"], "covered": gap["covered"]}
    doc = report_docx.build_coverage_gap_report(data_obj, row.name)
    fname = f"{_safe_filename(row.name)}_Coverage_Gap.docx"
    return Response(content=doc, media_type=DOCX_MIME,
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.delete("/{policy_id}/findings/{index}")
async def delete_finding(policy_id: int, index: int,
                         db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Dismiss one finding by index; recompute the summary and persist."""
    row = await db.get(AuditPolicy, policy_id)
    if not row:
        raise HTTPException(status_code=404, detail="Policy not found")
    findings = list(row.findings or [])
    if index < 0 or index >= len(findings):
        raise HTTPException(status_code=400, detail="Finding index out of range")
    findings.pop(index)
    summary = analyzer.summarize(findings)
    # Risk/gap come from the template comparison, not the findings list — carry
    # them over so dismissing a finding doesn't drop the Risk number.
    prev = row.analysis or {}
    if "risk" in prev:
        summary["risk"] = prev["risk"]
    if "gap" in prev:
        summary["gap"] = prev["gap"]
    row.findings = findings
    row.analysis = summary
    await db.commit()
    await db.refresh(row)
    return {"analysis": summary, "findings": findings}
