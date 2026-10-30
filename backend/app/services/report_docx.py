"""Word (.docx) report generation for an audited ASM policy.

Ported from the legacy skenderidis/asm_audit tool (create_summary.py /
create_asm.py + documention_asm.py). Two outputs:

  * build_summary()      -> the one-table "Download Summary" (suggestions only)
  * build_full_report()  -> the full "F5 ASM - Config Review" per policy

The legacy tool read F5 iControl-REST JSON dumps; this app stores declarative
WAF policies in Postgres, so the builders read from config_summary.build_summary()
plus the analyzer findings, and access every field defensively (never throw on a
missing key — show "-"/"No suggestions found." instead).
"""
from __future__ import annotations

import io
import os
import re
from datetime import datetime, timezone

from docx import Document
from docx.shared import Inches, Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

from app.services import config_summary, analyzer, report_settings

ASSETS = os.path.join(os.path.dirname(__file__), os.pardir, "report_assets")
TMPL_FULL = os.path.join(ASSETS, "ASM_Template.docx")
TMPL_SUMMARY = os.path.join(ASSETS, "ASM_Summary.docx")
_ICON = {s: os.path.join(ASSETS, f"{s}.png") for s in ("error", "warning", "info", "low", "medium", "high")}

# Catalog "section" value each report section pulls its inline suggestions from.
SECTIONS = [
    ("Overview", "Overview"),
    ("Learning Configuration", "Policy Builder"),
    ("Trusted IPs", "Trusted IPs"),
    ("Blocking Settings", "Blocking Settings"),
    ("Compliance Violations", "HTTP Compliance"),
    ("Evasion Techniques", "Evasions"),
    ("Signatures", "Signatures"),
    ("File Types", "File Types"),
    ("URLs", "URLs"),
    ("Parameters", "Parameters"),
    ("Headers", "Headers"),
    ("Cookies", "Cookies"),
    ("IP Intelligence", "IP Intelligence"),
    ("Redirection Domains", "Redirection Domains"),
    ("Methods", "Methods"),
    ("Response Codes", "Response Codes"),
    ("Geolocation", "Geolocation"),
]


# ---------------------------------------------------------------------------
# small helpers
# ---------------------------------------------------------------------------
def _yn(v):
    if v in (True, "true", "True", 1, "1", "yes", "Yes", "enabled"):
        return "Yes"
    if v in (False, "false", "False", 0, "0", "no", "No", "disabled"):
        return "No"
    return "-" if v is None else str(v)


def _txt(v):
    if v is None:
        return "-"
    if isinstance(v, (list, tuple)):
        return "\n".join(str(x) for x in v) if v else "-"
    return str(v)


def _set_para_text(p, text):
    """Replace a paragraph's text, keeping the first run's formatting."""
    if p.runs:
        p.runs[0].text = text
        for r in p.runs[1:]:
            r.text = ""
    else:
        p.add_run(text)


def _apply_cover(doc):
    """Stamp the report cover with the configured customer name + location,
    replacing the template's "Customer" / "Location" placeholders. Values come
    from report settings at generation time, so every report (now or future)
    picks up the current values."""
    cfg = report_settings.load()
    repl = {"customer": cfg.get("customer_name") or "", "location": cfg.get("location") or ""}
    for p in doc.paragraphs:
        key = p.text.strip().strip('“”"“”\'').strip().lower()
        if key in repl and repl[key]:
            _set_para_text(p, repl[key])


def _open(template):
    """Open the styled base template; fall back to a blank document."""
    try:
        return Document(template)
    except Exception:
        return Document()


def _set_col_width(column, width):
    for cell in column.cells:
        cell.width = width


def _grid(doc, headers):
    """A header-row table using the built-in 'Table Grid' style (always present)."""
    table = doc.add_table(rows=1, cols=len(headers))
    try:
        table.style = "Table Grid"
    except Exception:
        pass
    for i, h in enumerate(headers):
        table.cell(0, i).text = h
    return table


def _kv_table(doc, pairs):
    """Two-column Settings/Values table from a list of (label, value) pairs."""
    table = _grid(doc, ["Settings", "Values"])
    for label, value in pairs:
        cells = table.add_row().cells
        cells[0].text = str(label)
        cells[1].text = _txt(value)
    return table


def _suggestion_para(doc, severity, text):
    try:
        p = doc.add_paragraph(style="Intense Quote")
    except Exception:
        p = doc.add_paragraph()
    run = p.add_run()
    icon = _ICON.get(severity) or _ICON["info"]
    try:
        if os.path.exists(icon):
            run.add_picture(icon, width=Inches(0.22), height=Inches(0.22))
    except Exception:
        pass
    run.add_text(" " + (text or ""))


def _inline_suggestions(doc, findings, section):
    """Per-section suggestions, ordered error -> warning -> info."""
    n = 0
    for sev in ("error", "warning", "info"):
        for f in findings:
            if f.get("severity") == sev and f.get("section") == section:
                _suggestion_para(doc, sev, f.get("txt"))
                n += 1
    if n == 0:
        _suggestion_para(doc, "low", "No suggestions found.")
    doc.add_paragraph()


def _suggestions_table(doc, findings):
    """The full # / Severity / Suggestion / Category table (summary + report)."""
    table = _grid(doc, ["#", "Severity", "Suggestion", "Category"])
    n = 0
    for sev in ("error", "warning", "info"):
        for f in findings:
            if f.get("severity") != sev:
                continue
            n += 1
            cells = table.add_row().cells
            cells[0].text = str(n)
            run = cells[1].paragraphs[0].add_run()
            icon = _ICON.get(sev)
            try:
                if icon and os.path.exists(icon):
                    run.add_picture(icon, width=Inches(0.22), height=Inches(0.22))
            except Exception:
                pass
            cells[2].text = _txt(f.get("txt"))
            cells[3].text = _txt(f.get("section"))
    _set_col_width(table.columns[0], Cm(1))
    _set_col_width(table.columns[1], Cm(1.6))
    _set_col_width(table.columns[2], Cm(12))
    _set_col_width(table.columns[3], Cm(3))
    if n == 0:
        cells = table.add_row().cells
        cells[0].text = "-"
        cells[2].text = "No suggestions found."
    return table


def _findings_as_suggestions(row):
    """Normalise analyzer findings to the legacy {severity, txt, section} shape."""
    findings = row.findings if getattr(row, "findings", None) else analyzer.analyze_policy(row.content or {})
    out = []
    for f in findings or []:
        if not isinstance(f, dict):
            continue
        out.append({
            "severity": f.get("severity", "info"),
            "txt": f.get("message") or f.get("txt") or f.get("violation") or "",
            "section": f.get("category") or f.get("section") or "Other",
        })
    return out


def _entity_list_table(doc, items, name_keys=("name",), extra=()):
    """Generic Name [+ Staging + Enabled + extra] table for an entity list."""
    headers = ["Name", "Staging", "Enabled"] + [h for h, _ in extra]
    table = _grid(doc, headers)
    for e in items or []:
        if not isinstance(e, dict):
            continue
        cells = table.add_row().cells
        cells[0].text = _txt(next((e.get(k) for k in name_keys if e.get(k) is not None), "-"))
        cells[1].text = _yn(e.get("performStaging") if e.get("performStaging") is not None else e.get("staging"))
        cells[2].text = _yn(False if e.get("enabled") is False else True)
        for i, (_, fn) in enumerate(extra, start=3):
            try:
                cells[i].text = _txt(fn(e))
            except Exception:
                cells[i].text = "-"
    if not items:
        doc.add_paragraph("None configured.")
    return table


def _tobytes(doc) -> bytes:
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _policy(row) -> dict:
    raw = row.content or {}
    return raw.get("policy", raw) if isinstance(raw, dict) else {}


def _grade_letter(score: int) -> str:
    """Letter grade matching the UI (configScore.js): A>=90 B>=80 C>=70 D>=60."""
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 60:
        return "D"
    return "F"


def _rollup_blocking(suggestions: list[dict]) -> list[dict]:
    """Collapse the repetitive per-violation Blocking Settings suggestions into
    one row per message, listing the violation names. Everything else is left
    untouched. Display-only — does not affect scoring."""
    out: list[dict] = []
    groups: dict[tuple, dict] = {}
    for s in suggestions:
        if s.get("section") != "Blocking Settings":
            out.append(s)
            continue
        txt = s.get("txt") or ""
        m = re.match(r"^(.*?)\s*\(([^()]*)\)\s*$", txt)
        base = (m.group(1) if m else txt).strip()
        name = m.group(2).strip() if m else None
        key = (base, s.get("severity"))
        g = groups.get(key)
        if g is None:
            g = {"severity": s.get("severity"), "section": "Blocking Settings",
                 "base": base, "names": []}
            groups[key] = g
            out.append(g)   # keep first-seen order
        if name:
            g["names"].append(name)

    # Render each group back into a single suggestion row.
    result: list[dict] = []
    for s in out:
        if "base" in s:   # a rolled-up group
            names = s["names"]
            if len(names) <= 1:
                txt = f"{s['base']} ({names[0]})" if names else s["base"]
            else:
                txt = f"{s['base']} ({len(names)} violations: {', '.join(names)})"
            result.append({"severity": s["severity"], "section": s["section"], "txt": txt})
        else:
            result.append(s)
    return result


# ---------------------------------------------------------------------------
# 1) Download Summary
# ---------------------------------------------------------------------------
def build_summary(row) -> bytes:
    doc = _open(TMPL_SUMMARY)
    _apply_cover(doc)
    doc.add_heading("Summary", level=1)

    findings = (row.findings if getattr(row, "findings", None)
                else analyzer.analyze_policy(row.content or {}))
    findings = findings or []
    s = analyzer.summarize(findings)
    score = max(0, min(100, round(100 - (s.get("score") or 0))))
    grade = _grade_letter(score)

    # per-severity penalty (for the breakdown line)
    err_pen = sum(float(f.get("score") or 0) for f in findings if f.get("severity") == "error")
    warn_pen = sum(float(f.get("score") or 0) for f in findings if f.get("severity") == "warning")

    # ---- Scorecard ----
    _kv_table(doc, [
        ("Policy", row.name),
        ("Grade", grade),
        ("Score", f"{score} / 100"),
        ("Errors", s.get("error", 0)),
        ("Warnings", s.get("warning", 0)),
        ("Info", s.get("info", 0)),
        ("Areas affected", s.get("areas", 0)),
        ("Generated", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")),
    ])
    doc.add_paragraph()

    # ---- Score breakdown ----
    p = doc.add_paragraph()
    p.add_run("Score breakdown: ").bold = True
    p.add_run(
        f"{score}/100 (grade {grade}). Deductions: "
        f"{err_pen:g} from {s.get('error', 0)} error(s), "
        f"{warn_pen:g} from {s.get('warning', 0)} warning(s). "
        f"{s.get('info', 0)} info item(s) are advisory and do not affect the score."
    )
    doc.add_paragraph()

    # ---- Recommendations ----
    doc.add_heading("Recommendations", level=2)
    doc.add_paragraph(
        "The following table summarises all the recommendations of the health "
        "check for this ASM policy."
    )
    _suggestions_table(doc, _rollup_blocking(_findings_as_suggestions(row)))
    doc.add_paragraph()
    return _tobytes(doc)


# ---------------------------------------------------------------------------
# 2) Full ASM Report
# ---------------------------------------------------------------------------
def build_full_report(row) -> bytes:
    cfg = config_summary.build_summary(row.content or {})
    general = cfg["general"]
    counts = cfg["counts"]
    lists = cfg["lists"]
    blocking = cfg["blocking_settings"]
    _pol = _policy(row)
    pb = _pol.get("policy-builder") or _pol.get("policyBuilder") or {}
    # Per-entity learning settings live in their own sub-objects (F5 v17.1).
    pb_ft = _pol.get("policy-builder-filetype") or _pol.get("policyBuilderFiletype") or {}
    pb_url = _pol.get("policy-builder-url") or _pol.get("policyBuilderUrl") or {}
    pb_par = _pol.get("policy-builder-parameter") or _pol.get("policyBuilderParameter") or {}
    pb_ck = _pol.get("policy-builder-cookie") or _pol.get("policyBuilderCookie") or {}
    pb_redir = (_pol.get("policy-builder-redirection-protection")
                or _pol.get("policyBuilderRedirectionProtection") or {})
    sig_settings = _pol.get("signature-settings") or _pol.get("signatureSettings") or {}
    suggestions = _findings_as_suggestions(row)

    doc = _open(TMPL_FULL)
    _apply_cover(doc)
    doc.add_heading("ASM Configuration", level=1)
    doc.add_heading(_txt(general.get("name") or row.name), level=2)
    doc.add_paragraph("The following section analyses the configuration of the ASM policy.")

    # ---- Entities overview (Total configured vs Not enforced) ----
    doc.add_heading("Overview", level=3)
    doc.add_paragraph("A quick view of the entities configured on this policy and their enforced status.")
    ov = _grid(doc, ["Entities", "Total Configured", "Not Enforced"])
    rows_ov = [
        ("File Types", counts["file_types"]), ("URLs", counts["urls"]),
        ("Parameters", counts["parameters"]), ("Signatures", counts["signatures"]),
        ("Cookies", counts["cookies"]), ("HTTP Compliance", counts["compliance"]),
        ("Evasion", counts["evasion"]),
    ]
    for label, c in rows_ov:
        cells = ov.add_row().cells
        cells[0].text = label
        cells[1].text = str(c.get("total", 0))
        cells[2].text = str((c.get("staging", 0) or 0) + (c.get("disabled", 0) or 0))
    doc.add_paragraph()

    # ---- Full suggestions table ----
    doc.add_paragraph("The following table summarises all the recommendations for this ASM policy.")
    _suggestions_table(doc, suggestions)
    doc.add_paragraph()

    # ---- General settings ----
    doc.add_heading("General Settings", level=3)
    _kv_table(doc, [
        ("Policy Name", general.get("name")),
        ("Template", general.get("template")),
        ("Enforcement mode", general.get("enforcementMode")),
        ("Applied to vServers", general.get("virtualServers")),
        ("Application Language", general.get("applicationLanguage")),
        ("Policy is case sensitive", _yn(not general.get("caseInsensitive")) if general.get("caseInsensitive") is not None else "-"),
        ("Data Guard", _yn(general.get("dataGuardEnabled"))),
        ("Trust XFF", _yn(general.get("trustXff"))),
        ("Custom XFF", general.get("customXffHeaders")),
        ("Signature Staging", _yn(general.get("signatureStaging"))),
        ("Policy Builder Mode", general.get("policyBuilderMode")),
        ("Max HTTP Header Length", general.get("maximumHttpHeaderLength")),
        ("Max Cookie Length", general.get("maximumCookieHeaderLength")),
    ])
    doc.add_paragraph()
    _inline_suggestions(doc, suggestions, "Overview")

    # ---- Learning (Policy Builder) ----
    doc.add_heading("Learning Configuration", level=3)
    doc.add_paragraph("The Learning / Policy Builder configuration of the ASM policy.")
    _kv_table(doc, [
        ("Learning Mode", pb.get("learningMode")),
        ("Trust All IPs", _yn(pb.get("trustAllIps"))),
        ("Full Inspection", _yn(pb.get("enableFullPolicyInspection"))),
        ("Learn Inactive Entities", _yn(pb.get("learnInactiveEntities"))),
        ("Learn New File Types", pb_ft.get("learnExplicitFiletypes")),
        ("Learn New URLs", pb_url.get("learnExplicitUrls")),
        ("Learn New Parameters", pb_par.get("learnExplicitParameters")),
        ("Parameter Learning Level", pb_par.get("parameterLearningLevel")),
        ("Learn New Cookies", pb_ck.get("learnExplicitCookies")),
        ("Learn Redirection Domains", pb_redir.get("learnExplicitRedirectionDomains")),
    ])
    doc.add_paragraph()
    _inline_suggestions(doc, suggestions, "Policy Builder")

    # ---- Trusted IPs (whitelist) ----
    doc.add_heading("Trusted IPs", level=3)
    doc.add_paragraph("IP addresses configured as trusted (whitelisted) on the policy.")
    _entity_list_table(doc, lists.get("trusted_ips"),
                       name_keys=("ipAddress", "name"),
                       extra=[("Netmask", lambda e: e.get("ipMask"))])
    doc.add_paragraph()
    _inline_suggestions(doc, suggestions, "Trusted IPs")

    # ---- Blocking settings (all violations) ----
    doc.add_heading("Blocking Settings", level=3)
    doc.add_paragraph("Learn / Alarm / Block flags for every violation on the policy.")
    bs = _grid(doc, ["Violation", "Learn", "Alarm", "Block"])
    for v in blocking:
        cells = bs.add_row().cells
        cells[0].text = _txt(v.get("name"))
        cells[1].text = _yn(v.get("learn"))
        cells[2].text = _yn(v.get("alarm"))
        cells[3].text = _yn(v.get("block"))
    _set_col_width(bs.columns[0], Cm(9.5))
    doc.add_paragraph()
    _inline_suggestions(doc, suggestions, "Blocking Settings")

    # ---- HTTP Compliance ----
    doc.add_heading("Compliance Violations", level=3)
    doc.add_paragraph("HTTP protocol compliance sub-checks configured on the policy.")
    _entity_list_table(doc, lists.get("compliance"),
                       name_keys=("description", "name"))
    doc.add_paragraph()
    _inline_suggestions(doc, suggestions, "HTTP Compliance")

    # ---- Evasions ----
    doc.add_heading("Evasion Techniques", level=3)
    doc.add_paragraph("Evasion technique sub-checks configured on the policy.")
    _entity_list_table(doc, lists.get("evasions"),
                       name_keys=("description", "name"))
    doc.add_paragraph()
    _inline_suggestions(doc, suggestions, "Evasions")

    # ---- Signatures ----
    doc.add_heading("Signatures", level=3)
    doc.add_paragraph("Attack-signature configuration summary.")
    p = doc.add_paragraph()
    p.add_run("Signature Staging: ").bold = True
    p.add_run(_yn(general.get("signatureStaging")))
    p = doc.add_paragraph()
    p.add_run("Place New Signatures in Staging: ").bold = True
    p.add_run(_yn(sig_settings.get("placeSignaturesInStaging")))
    p = doc.add_paragraph()
    p.add_run("Minimum Accuracy for Auto-Added Signatures: ").bold = True
    p.add_run(_txt(sig_settings.get("minimumAccuracyForAutoAddedSignatures")))
    p = doc.add_paragraph()
    p.add_run("Total Signature Sets: ").bold = True
    p.add_run(str(len(lists.get("signature_sets") or [])))
    sset = _grid(doc, ["Signature Set", "Learn", "Alarm", "Block"])
    for s in lists.get("signature_sets") or []:
        if not isinstance(s, dict):
            continue
        cells = sset.add_row().cells
        cells[0].text = _txt(s.get("name") or (s.get("signatureSet") or {}).get("name"))
        cells[1].text = _yn(s.get("learn"))
        cells[2].text = _yn(s.get("alarm"))
        cells[3].text = _yn(s.get("block"))
    doc.add_paragraph()
    _inline_suggestions(doc, suggestions, "Signatures")

    # ---- File Types ----
    doc.add_heading("File Types", level=3)
    doc.add_paragraph("File-type entities and their length limits.")
    _entity_list_table(doc, lists.get("file_types"), extra=[
        ("URL Len", lambda e: e.get("urlLength")),
        ("Query Len", lambda e: e.get("queryStringLength")),
        ("POST Len", lambda e: e.get("postDataLength")),
        ("Request Len", lambda e: e.get("requestLength")),
    ])
    doc.add_paragraph()
    _inline_suggestions(doc, suggestions, "File Types")

    # ---- URLs ----
    doc.add_heading("URLs", level=3)
    urls = lists.get("urls") or []
    if len(urls) > 50:
        doc.add_paragraph(f"There are {len(urls)} URLs configured; table omitted for brevity.")
    else:
        _entity_list_table(doc, urls, extra=[
            ("Protocol", lambda e: e.get("protocol")),
            ("Check Signatures", lambda e: _yn(e.get("attackSignaturesCheck"))),
        ])
    doc.add_paragraph()
    _inline_suggestions(doc, suggestions, "URLs")

    # ---- Parameters ----
    doc.add_heading("Parameters", level=3)
    params = lists.get("parameters") or []
    if len(params) > 50:
        doc.add_paragraph(f"There are {len(params)} parameters configured; table omitted for brevity.")
    else:
        _entity_list_table(doc, params, extra=[
            ("Check Signatures", lambda e: _yn(e.get("attackSignaturesCheck"))),
            ("Data Type", lambda e: e.get("valueType") or e.get("parameterType")),
        ])
    doc.add_paragraph("Sensitive Parameters:")
    _entity_list_table(doc, lists.get("sensitive_parameters"))
    doc.add_paragraph()
    _inline_suggestions(doc, suggestions, "Parameters")

    # ---- Headers ----
    doc.add_heading("Headers", level=3)
    _entity_list_table(doc, lists.get("headers"), extra=[
        ("Check Signatures", lambda e: _yn(e.get("checkSignatures"))),
        ("Mandatory", lambda e: _yn(e.get("mandatory"))),
    ])
    doc.add_paragraph()
    _inline_suggestions(doc, suggestions, "Headers")

    # ---- Cookies ----
    doc.add_heading("Cookies", level=3)
    _entity_list_table(doc, lists.get("cookies"), extra=[
        ("Type", lambda e: e.get("type")),
        ("Enforcement", lambda e: e.get("enforcementType")),
    ])
    doc.add_paragraph()
    _inline_suggestions(doc, suggestions, "Cookies")

    # ---- IP Intelligence ----
    doc.add_heading("IP Intelligence", level=3)
    ipi = lists.get("ipi") or {}
    doc.add_paragraph(f"IP Intelligence enabled: {_yn(ipi.get('enabled'))}")
    _entity_list_table(doc, (ipi.get("ipIntelligenceCategories") or ipi.get("categories")),
                       name_keys=("category", "name"))
    doc.add_paragraph()
    _inline_suggestions(doc, suggestions, "IP Intelligence")

    # ---- Redirection Domains ----
    doc.add_heading("Redirection Domains", level=3)
    _entity_list_table(doc, lists.get("redirection_domains"), name_keys=("domainName", "name"))
    doc.add_paragraph()
    _inline_suggestions(doc, suggestions, "Redirection Domains")

    # ---- Methods ----
    doc.add_heading("Methods", level=3)
    _entity_list_table(doc, lists.get("methods"))
    doc.add_paragraph()
    _inline_suggestions(doc, suggestions, "Methods")

    # ---- Response Codes ----
    doc.add_heading("Response Codes", level=3)
    _entity_list_table(doc, lists.get("response_codes"), name_keys=("responseCode", "name"))
    doc.add_paragraph()
    _inline_suggestions(doc, suggestions, "Response Codes")

    # ---- Geolocation ----
    doc.add_heading("Geolocation", level=3)
    geo = _policy(row).get("geolocation-enforcement") or _policy(row).get("geolocationEnforcement") or {}
    disallowed = geo.get("disallowedLocations") or geo.get("disallowed-locations") or []
    doc.add_paragraph("Disallowed geolocations:")
    if disallowed:
        t = _grid(doc, ["Country / Location"])
        for g in disallowed:
            t.add_row().cells[0].text = _txt(g.get("countryName") if isinstance(g, dict) else g)
    else:
        doc.add_paragraph("None configured.")
    doc.add_paragraph()
    _inline_suggestions(doc, suggestions, "Geolocation")

    return _tobytes(doc)


# ---------------------------------------------------------------------------
# 3) OWASP Top 10 Compliance report
# ---------------------------------------------------------------------------
_OWASP_STATUS = {"fulfilled": "Fulfilled", "partial": "Partial", "not": "Not met",
                 "unknown": "Needs pull"}
_OWASP_GROUPS = ["Attack Signatures", "Required Signatures", "Protections",
                 "Policy Entities", "Best Practices", "Virtual Server Protection"]

# palette (hex, no '#') — matches the web UI bands
_C_GREEN, _C_AMBER, _C_RED = "16A34A", "D97706", "E4502B"
_C_INK, _C_MUTE, _C_TRACK = "1F2937", "6B7280", "E5E7EB"
_STATUS_FILL = {"fulfilled": "DCFCE7", "partial": "FEF3C7", "not": "FEE2E2", "unknown": "F3F4F6"}
_STATUS_TEXT = {"fulfilled": "166534", "partial": "92400E", "not": "991B1B", "unknown": "6B7280"}


def _band_hex(score):
    if not isinstance(score, (int, float)):
        return _C_MUTE
    return _C_GREEN if score >= 75 else _C_AMBER if score >= 50 else _C_RED


def _pct(score):
    return f"{score}%" if isinstance(score, (int, float)) else "—"


def _shade(cell, hex_fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)
    tcPr.append(shd)


def _no_borders(table):
    tblPr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        e = OxmlElement(f"w:{edge}")
        e.set(qn("w:val"), "none")
        e.set(qn("w:sz"), "0")
        borders.append(e)
    tblPr.append(borders)


def _row_height(row, inches, exact=True):
    trPr = row._tr.get_or_add_trPr()
    h = OxmlElement("w:trHeight")
    h.set(qn("w:val"), str(int(inches * 1440)))
    h.set(qn("w:hRule"), "exact" if exact else "atLeast")
    trPr.append(h)


def _cell_text(cell, text, color=None, bold=False, size=None, align=None, valign="center"):
    cell.text = ""
    if valign:
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    p = cell.paragraphs[0]
    if align:
        p.alignment = align
    run = p.add_run(text)
    run.font.bold = bold
    if color:
        run.font.color.rgb = RGBColor.from_string(color)
    if size:
        run.font.size = Pt(size)
    return run


def _spacer(doc, pts=6):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.add_run("").font.size = Pt(pts)
    return p


def _progress_bar(doc, score, segments=20, width_in=5.0, show_pct=True):
    """A segmented meter: `score`% of the segments filled in the band colour,
    with the percentage shown to the right of the bar."""
    _spacer(doc, 4)
    numeric = isinstance(score, (int, float))
    filled = round(score / 100 * segments) if numeric else 0
    color = _band_hex(score)
    cols = segments + (1 if show_pct else 0)
    t = doc.add_table(rows=1, cols=cols)
    t.autofit = False
    _no_borders(t)
    _row_height(t.rows[0], 0.18, exact=False)
    seg_w = Inches(width_in / segments)
    for i in range(segments):
        c = t.cell(0, i)
        c.width = seg_w
        _shade(c, color if i < filled else _C_TRACK)
        c.text = ""
        c.paragraphs[0].add_run("").font.size = Pt(2)
    if show_pct:
        pc = t.cell(0, segments)
        pc.width = Inches(0.8)
        _cell_text(pc, _pct(score), color=color, bold=True, size=11, align=WD_ALIGN_PARAGRAPH.LEFT)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def _banner(doc, left_text, right_text, fill, size=12):
    """A full-width coloured banner: left label + right value in white."""
    t = doc.add_table(rows=1, cols=2)
    t.autofit = False
    _no_borders(t)
    _row_height(t.rows[0], 0.3, exact=False)
    t.cell(0, 0).width = Inches(4.5)
    t.cell(0, 1).width = Inches(1.5)
    _shade(t.cell(0, 0), fill)
    _shade(t.cell(0, 1), fill)
    _cell_text(t.cell(0, 0), left_text, color="FFFFFF", bold=True, size=size)
    _cell_text(t.cell(0, 1), right_text, color="FFFFFF", bold=True, size=size,
               align=WD_ALIGN_PARAGRAPH.RIGHT)
    return t


def _heading_banner(doc, left_text, right_text, fill, level=2):
    """A Heading paragraph shaded full-width (so it's a modern banner AND a
    TOC entry). White bold label on the left, value right-aligned via a tab."""
    p = doc.add_heading("", level=level)
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    pPr.append(shd)
    p.paragraph_format.tab_stops.add_tab_stop(Inches(6.3), WD_TAB_ALIGNMENT.RIGHT)
    run = p.add_run(" " + left_text)
    run.bold = True
    run.font.color.rgb = RGBColor.from_string("FFFFFF")
    if right_text:
        run2 = p.add_run("\t" + right_text + " ")
        run2.bold = True
        run2.font.color.rgb = RGBColor.from_string("FFFFFF")
    return p


def _toc(doc):
    """Insert a Word Table-of-Contents field (populates on open / field update)."""
    p = doc.add_paragraph()
    r = p.add_run()._r
    begin = OxmlElement("w:fldChar"); begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText"); instr.set(qn("xml:space"), "preserve")
    instr.text = 'TOC \\o "1-3" \\h \\z \\u'
    sep = OxmlElement("w:fldChar"); sep.set(qn("w:fldCharType"), "separate")
    hint = OxmlElement("w:t"); hint.text = 'Update this field (F9) to build the table of contents.'
    end = OxmlElement("w:fldChar"); end.set(qn("w:fldCharType"), "end")
    for el in (begin, instr, sep, hint, end):
        r.append(el)
    return p


def _update_fields_on_open(doc):
    """Ask Word to refresh fields (so the TOC fills in) when the doc opens."""
    try:
        settings = doc.settings.element
        el = OxmlElement("w:updateFields")
        el.set(qn("w:val"), "true")
        settings.append(el)
    except Exception:
        pass


def _owasp_grid(doc, headers, widths=None):
    """A 'Table Grid' with a dark header row and white bold labels."""
    t = _grid(doc, [""] * len(headers))
    for i, h in enumerate(headers):
        _shade(t.cell(0, i), _C_INK)
        _cell_text(t.cell(0, i), h, color="FFFFFF", bold=True)
        if widths and widths[i]:
            t.cell(0, i).width = Inches(widths[i])
    return t


def build_owasp_report(data: dict, policy_name: str) -> bytes:
    """OWASP Top-10 (2021) compliance report from owasp.evaluate() output."""
    cats = data.get("categories", []) or []
    overall = data.get("score", 0)
    defined = data.get("defined", 0)
    total_c = data.get("total_categories", 10)

    doc = _open(TMPL_FULL)
    _apply_cover(doc)
    doc.add_heading("OWASP Top 10 Compliance", level=1)

    tf = tp = tn = 0
    for c in cats:
        for rq in c.get("requirements", []) or []:
            s = rq.get("status")
            tf += s == "fulfilled"
            tp += s == "partial"
            tn += s not in ("fulfilled", "partial")

    op = doc.add_paragraph()
    orun = op.add_run("Overall compliance")
    orun.bold = True
    orun.font.size = Pt(12)

    # Legend / totals sit above the bar.
    meta = doc.add_paragraph()
    meta.add_run(f"{defined} of {total_c} categories scored").font.color.rgb = RGBColor.from_string(_C_MUTE)
    meta.add_run("      ")
    meta.add_run(f"✓ {tf} met").font.color.rgb = RGBColor.from_string(_C_GREEN)
    meta.add_run("    ")
    meta.add_run(f"○ {tp} partial").font.color.rgb = RGBColor.from_string(_C_AMBER)
    meta.add_run("    ")
    meta.add_run(f"✕ {tn} not met").font.color.rgb = RGBColor.from_string(_C_RED)

    _progress_bar(doc, overall)

    doc.add_paragraph(
        "This report assesses the WAF policy against the OWASP Top 10 (2021). Each "
        "category's score is the share of its requirements that are met (a partially-"
        "met requirement counts as half)."
    ).runs[0].font.size = Pt(9)
    doc.add_paragraph()

    # ---- Summary table ----
    # (The template already provides a cover + Table of Contents up front; the
    #  TOC picks up the headings below when fields refresh on open.)
    doc.add_heading("Summary", level=2)
    st = _owasp_grid(doc, ["#", "Category", "Compliance"], widths=[0.5, 4.5, 1.2])
    for c in cats:
        cells = st.add_row().cells
        _cell_text(cells[0], _txt(c.get("id")), bold=True)
        name = _txt(c.get("name")) + ("   (in staging)" if c.get("staged") else "")
        _cell_text(cells[1], name)
        sc = c.get("score")
        _cell_text(cells[2], _pct(sc), color=_band_hex(sc), bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)

    # ---- Per-category detail (starts on a fresh page) ----
    order = {g: i for i, g in enumerate(_OWASP_GROUPS)}
    doc.add_page_break()
    for i, c in enumerate(cats):
        if i:
            doc.add_paragraph()
        sc = c.get("score")
        doc.add_heading(f"{c.get('id')}  {c.get('name')}", level=2)
        _progress_bar(doc, sc)
        if c.get("description"):
            d = doc.add_paragraph(_txt(c.get("description")))
            d.runs[0].font.size = Pt(9)
            d.runs[0].font.color.rgb = RGBColor.from_string(_C_MUTE)

        tbl = _owasp_grid(doc, ["Group", "Requirement", "Status", "Detail"],
                          widths=[1.4, 2.3, 0.75, 2.25])
        for rq in sorted(c.get("requirements", []) or [], key=lambda r: order.get(r.get("group"), 99)):
            cells = tbl.add_row().cells
            _cell_text(cells[0], _txt(rq.get("group")), color=_C_MUTE, size=9)
            _cell_text(cells[1], _txt(rq.get("label")))
            stt = rq.get("status")
            status_label = _OWASP_STATUS.get(stt, _txt(stt))
            if rq.get("overridden"):
                status_label += " · marked met"
            elif rq.get("staged"):
                status_label += " · staging"
            _shade(cells[2], _STATUS_FILL.get(stt, "F3F4F6"))
            _cell_text(cells[2], status_label,
                       color=_STATUS_TEXT.get(stt, _C_INK), bold=True, size=9,
                       align=WD_ALIGN_PARAGRAPH.CENTER)
            # When a requirement was manually marked met, state what it actually
            # resolved to so the report stays truthful about the override.
            if rq.get("overridden"):
                base = _OWASP_STATUS.get(rq.get("baseStatus"), _txt(rq.get("baseStatus")))
                detail = f"Marked met (computed: {base} — {_txt(rq.get('baseDetail'))})"
            else:
                detail = _txt(rq.get("detail"))
            _cell_text(cells[3], detail, color=_C_MUTE, size=9)

    _update_fields_on_open(doc)
    return _tobytes(doc)


# ---------------------------------------------------------------------------
# 4) Coverage Gap (Risk vs template) report
# ---------------------------------------------------------------------------
_LABELS_PATH = os.path.join(os.path.dirname(__file__), os.pardir, "data", "audit_check_labels.json")
_LABELS_CACHE: dict | None = None


def _check_labels() -> dict:
    """{labels: {VIOL_x: text}, groups: [{key,label,checks}]} — the readable
    names for coverage-gap violations, generated from the UI's audit-check set."""
    global _LABELS_CACHE
    if _LABELS_CACHE is None:
        try:
            import json
            with open(_LABELS_PATH, encoding="utf-8") as f:
                _LABELS_CACHE = json.load(f)
        except (OSError, ValueError):
            _LABELS_CACHE = {"labels": {}, "groups": []}
    return _LABELS_CACHE


def _viol_label(key: str) -> str:
    return _check_labels().get("labels", {}).get(key) or key


def _group_of_label() -> dict:
    out = {}
    for g in _check_labels().get("groups", []):
        for k in g.get("checks", []):
            out[k] = g.get("label", "Other")
    return out


def _gap_bucket_table(doc, keys, caption):
    """A #/Protection/Category table for one coverage-gap bucket, ordered by
    the UI's group order then label."""
    gol = _group_of_label()
    group_order = [g.get("label") for g in _check_labels().get("groups", [])]
    order_idx = {lbl: i for i, lbl in enumerate(group_order)}
    rows = sorted(keys, key=lambda k: (order_idx.get(gol.get(k, "Other"), 999), _viol_label(k).lower()))

    t = _grid(doc, ["#", "Protection", "Category"])
    for i, k in enumerate(rows, 1):
        cells = t.add_row().cells
        cells[0].text = str(i)
        cells[1].text = _viol_label(k)
        cells[2].text = gol.get(k, "Other")
    if not rows:
        cells = t.add_row().cells
        cells[0].text = "-"
        cells[1].text = caption
    _set_col_width(t.columns[0], Cm(1))
    _set_col_width(t.columns[1], Cm(11))
    _set_col_width(t.columns[2], Cm(4.5))
    return t


def build_coverage_gap_report(data: dict, policy_name: str) -> bytes:
    """Customer-facing Coverage Gap summary: the policy's protection measured
    against its selected template. `data` is the /risk payload
    {risk, total, template, missing, partial, covered}."""
    missing = data.get("missing") or []
    partial = data.get("partial") or []
    covered = data.get("covered") or []
    risk = data.get("risk")
    total = data.get("total") or 0
    template = data.get("template") or "—"

    if isinstance(risk, (int, float)):
        if risk >= 70:
            band = "High"
        elif risk >= 40:
            band = "Medium"
        else:
            band = "Low"
    else:
        band = "—"

    doc = _open(TMPL_FULL)
    _apply_cover(doc)
    doc.add_heading("Coverage Gap", level=1)
    doc.add_paragraph(f"Policy: {_txt(policy_name)}")

    # ---- Scorecard ----
    _kv_table(doc, [
        ("Template", template),
        ("Coverage gap", f"{risk}%" if isinstance(risk, (int, float)) else "—"),
        ("Risk level", band),
        ("Not enabled", len(missing)),
        ("Alarm only", len(partial)),
        ("Fully blocked", len(covered)),
        ("Template protections", total),
        ("Generated", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")),
    ])
    doc.add_paragraph()

    gap_txt = f" The coverage gap is {risk}% ({band} risk)." if isinstance(risk, (int, float)) else ""
    p = doc.add_paragraph()
    p.add_run("Summary: ").bold = True
    p.add_run(f"{len(covered)} of {total} template protections are fully blocked.{gap_txt}")
    doc.add_paragraph(
        "The coverage gap weights each shortfall: a protection that is not enabled "
        "counts in full, one that only alarms (does not block) counts as half. A "
        "lower percentage is better."
    )
    doc.add_paragraph()

    doc.add_heading("Not enabled — full risk weight", level=2)
    doc.add_paragraph("These template protections are not active on the policy.")
    _gap_bucket_table(doc, missing, "None — every template protection is at least alarming.")
    doc.add_paragraph()

    doc.add_heading("Alarm only — half weight", level=2)
    doc.add_paragraph("Enabled but only alarming; these do not block attacks.")
    _gap_bucket_table(doc, partial, "None — no protections are alarm-only.")
    doc.add_paragraph()

    doc.add_heading("Fully blocked", level=2)
    doc.add_paragraph("These template protections are enforced (blocking) on the policy.")
    _gap_bucket_table(doc, covered, "None blocked yet.")
    doc.add_paragraph()

    _update_fields_on_open(doc)
    return _tobytes(doc)
