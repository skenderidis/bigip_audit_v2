"""LTM / device audit report generation — Word (.docx) and Excel (.xlsx).

The Word report is a faithful port of skenderidis/bigip-audit
(create_ltm.build_word): it is built on the F5-branded Template.docx (cover
page, logo header, footer, house styles) and renders each finding as its own
Heading 3 block with a colour-coded "Severity:" line, narrative, supporting
tables and an "Additional details" section — followed by the CVE summary and
the iHealth diagnostics. It is driven from the audit data already stored on the
LtmAudit row (no re-pull). Findings added in this app (remote syslog, client-SSL
/ PQC, pool & virtual-server hygiene, bot/DoS, log-all-requests) that aren't in
the original hard-coded set are appended generically so nothing is lost.
"""
from __future__ import annotations

import base64
import datetime
import io
import os

from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter

from app.services import report_settings, ltm_analyzer

# F5-branded cover/header/footer template the Word report is built on top of
# (copied from the repo's Template.docx). We only append content after its
# cover page, so the report keeps the logo, footer and house styles.
_TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), os.pardir, "data", "ltm_template.docx")

# severity ordering used for both reports
_SEV_RANK = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3, "Info": 4}
_DIAG_SEV = {"CRITICAL": "Critical", "HIGH": "High", "MEDIUM": "Medium", "LOW": "Low", "INFO": "Info"}


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _customer(audit) -> str:
    return (getattr(audit, "customer", None)
            or report_settings.load().get("customer_name")
            or "Customer")


def _device_date(content: dict) -> str:
    d = content.get("date_info")
    if isinstance(d, dict):
        return d.get("system_date") or d.get("date") or ""
    return str(d or "")


def _safe(value, default="not configured") -> str:
    if value is None or str(value).strip() == "":
        return default
    return str(value)


def _normalize_cell(value, none_to_blank=True, list_join="\n") -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        if none_to_blank and value.strip().lower() == "none":
            return ""
        return value
    if isinstance(value, list):
        items = [str(x).strip() for x in value if str(x).strip()]
        if none_to_blank and len(items) == 1 and items[0].lower() == "none":
            return ""
        return list_join.join(items)
    if isinstance(value, dict):
        return "; ".join(f"{k}={v}" for k, v in value.items())
    return str(value)


# ---------------------------------------------------------------------------
# Excel
# ---------------------------------------------------------------------------
def _autosize(ws, min_width=12, max_width=80):
    wrap = Alignment(wrap_text=True, vertical="top")
    for col in ws.columns:
        max_len = 0
        letter = get_column_letter(col[0].column)
        for cell in col:
            cell.alignment = wrap
            if cell.value is not None:
                max_len = max(max_len, max((len(s) for s in str(cell.value).split("\n")), default=0))
        ws.column_dimensions[letter].width = min(max(min_width, max_len + 2), max_width)


def _sheet(wb, name, rows, columns, headers=None):
    ws = wb.create_sheet(name[:31])  # Excel caps sheet names at 31 chars
    bold = Font(bold=True)
    wrap = Alignment(wrap_text=True, vertical="top")
    ws.append(headers or columns)
    for i in range(1, len(columns) + 1):
        c = ws.cell(row=1, column=i)
        c.font = bold
        c.alignment = wrap
    for r in rows or []:
        ws.append([_normalize_cell(r.get(col)) for col in columns])
    _autosize(ws)
    return ws


def _flatten_certs(certs):
    flat = []
    for cert in certs or []:
        usages = cert.get("usages") or []
        base = {"certificate": cert.get("certificate"), "not_after": cert.get("not_after"),
                "days_to_expiry": cert.get("days_to_expiry")}
        if not usages:
            flat.append({**base, "usage_type": "", "profile": "", "virtual_server": ""})
            continue
        for u in usages:
            flat.append({**base, "usage_type": u.get("type"), "profile": u.get("profile"),
                         "virtual_server": u.get("virtual_server")})
    return flat


def build_ltm_excel(audit) -> bytes:
    c = audit.content or {}
    f = ltm_analyzer.apply_exclusions(audit.findings or {}, getattr(audit, "excluded", None))
    wb = Workbook()
    wb.remove(wb.active)

    _sheet(wb, "Virtuals", c.get("ltm_virtuals"),
           ["virtual", "partition", "destination", "pool", "persist", "fallback-persistence",
            "policies", "profiles", "security-log-profiles", "rules"])
    if c.get("asm_mapping"):
        _sheet(wb, "ASM Mapping", c.get("asm_mapping"),
               ["virtual", "ltm_policy", "asm_policy"])
    _sheet(wb, "Virtual_Details", c.get("virtual_details"),
           ["virtual", "partition", "has_dos", "has_bot", "has_asm", "has_client_ssl",
            "has_server_ssl", "has_http", "has_tcp", "has_udp", "has_web_acceleration",
            "has_compression"])
    _sheet(wb, "Pools", c.get("ltm_pools"),
           ["pool", "partition", "member_count", "monitor", "load-balancing-mode"])
    _sheet(wb, "HTTP_Profiles", c.get("http"),
           ["profile", "encrypt-cookies", "server-agent-name", "insert-xforwarded-for",
            "xff-alternative-names"])
    _sheet(wb, "ClientSSL_Profiles", c.get("client_ssl"),
           ["profile", "cipher-group", "ciphers", "options", "defaults-from"])
    _sheet(wb, "iRule Stats", c.get("irule_stats"),
           ["name", "event", "failures", "total_executions"])
    _sheet(wb, "VS Traffic", c.get("vs_traffic"),
           ["virtual", "clientside_bits_in", "clientside_bits_out", "clientside_packets_in",
            "clientside_packets_out", "clientside_current_connections",
            "clientside_total_connections", "total_requests", "cpu_usage_ratio_1min"])
    _sheet(wb, "SSL_Certs", _flatten_certs(c.get("ssl_certs")),
           ["certificate", "not_after", "days_to_expiry", "usage_type", "profile", "virtual_server"])

    # Findings (ltm + bot + dos) and Diagnostics — extras we now have
    findings = []
    for domain in ("ltm", "bot", "dos"):
        for item in f.get(domain) or []:
            findings.append({"domain": domain.upper(), "severity": item.get("rating"),
                             "title": item.get("title"), "details": item.get("details"),
                             "recommendation": item.get("additional")})
    findings.sort(key=lambda r: _SEV_RANK.get(r["severity"], 9))
    _sheet(wb, "Audit Findings", findings, ["domain", "severity", "title", "details", "recommendation"])

    diag = f.get("diag") or {}
    cve_rows = [{"severity": _DIAG_SEV.get((d.get("h_importance") or "").upper(), d.get("h_importance")),
                 "vulnerability": d.get("h_header"),
                 "cve_ids": d.get("h_cve_ids"), "fixed_in": d.get("fixedInVersions"),
                 "solution": d.get("solution_id")} for d in diag.get("cve") or []]
    _sheet(wb, "Diagnostics CVE", cve_rows, ["severity", "vulnerability", "cve_ids", "fixed_in", "solution"])
    other_rows = [{"severity": _DIAG_SEV.get((d.get("h_importance") or "").upper(), d.get("h_importance")),
                   "finding": d.get("h_header"),
                   "detail": d.get("output") or d.get("h_summary"),
                   "solution": d.get("solution_ids")} for d in diag.get("other") or []]
    _sheet(wb, "Diagnostics Other", other_rows, ["severity", "finding", "detail", "solution"])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Word — faithful port of create_ltm.build_word
# ---------------------------------------------------------------------------
_DASH = "--------------------------------------------------------------  Additional details  --------------------------------------------------------------"
_DASH_END = "------------------------------------------------------------------------------------------------------------------------------------------------------"
_SEV_FALLBACK_COLOR = {"Critical": "EE0000", "High": "EE0000", "Medium": "ED7D31",
                       "Low": "5B9BD5", "Info": "5B9BD5"}


def _humanize_int(value) -> str:
    try:
        value = int(value)
    except (TypeError, ValueError):
        return "0"
    if value < 1000:
        return str(value)
    for unit in ["K", "M", "G", "T"]:
        value /= 1000.0
        if value < 1000:
            return f"{value:.1f}{unit}"
    return f"{value:.1f}P"


def _set_col_width(column, width):
    column.width = width
    for cell in column.cells:
        cell.width = width


def _set_para_text(p, text):
    """Replace a paragraph's text in place, keeping its first run's formatting."""
    if p.runs:
        p.runs[0].text = text
        for r in p.runs[1:]:
            r.text = ""
    else:
        p.add_run(text)


def _fill_cover(doc, customer, location):
    """Fill the template cover page's 'Customer' (and 'Location' if provided)."""
    for p in doc.paragraphs:
        t = p.text.strip()
        if t == "Customer":
            _set_para_text(p, customer)
        elif location and t.strip("“”\"' ") == "Location":
            _set_para_text(p, location)


def _sev_paragraph(doc, label):
    """'Severity: <label>' using the template's sev* style, with a coloured
    fallback for styles the template doesn't define (Critical / Info)."""
    try:
        return doc.add_paragraph("Severity: " + label, style="sev" + label)
    except Exception:
        p = doc.add_paragraph()
        run = p.add_run("Severity: " + label)
        run.bold = True
        color = _SEV_FALLBACK_COLOR.get(label)
        if color:
            run.font.color.rgb = RGBColor.from_string(color)
        return p


def _finding_block(doc, item):
    """Generic finding block (Heading 3 + severity + details + recommendation)
    for findings added by this app that the hard-coded section doesn't cover."""
    doc.add_paragraph()
    doc.add_heading(item.get("title") or item.get("name") or "Finding", level=3)
    _sev_paragraph(doc, item.get("rating") or "Low")
    if item.get("details"):
        doc.add_paragraph(item["details"])
    if item.get("additional"):
        doc.add_paragraph()
        doc.add_paragraph(item["additional"])
    doc.add_paragraph()


def _add_expiring_certs_table(doc, ssl_certs, threshold_days=60):
    headers = ["Certificate", "Not After", "Days to Expiry", "Usages"]
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    for col, w in zip(table.columns, (6, 2, 1.3, 8)):
        _set_col_width(col, Cm(w))
    for i, h in enumerate(headers):
        table.rows[0].cells[i].text = h
        for run in table.rows[0].cells[i].paragraphs[0].runs:
            run.bold = True
    rows_added = 0
    for cert in ssl_certs or []:
        try:
            days = int(cert.get("days_to_expiry"))
        except (TypeError, ValueError):
            continue
        if days >= threshold_days:
            continue
        cells = table.add_row().cells
        rows_added += 1
        cells[0].text = cert.get("certificate", "")
        cells[1].text = cert.get("not_after", "")
        cells[2].text = str(days)
        usages = cert.get("usages") or []
        cells[3].text = ""
        if not usages:
            cells[3].paragraphs[0].add_run("No usages found")
        else:
            for idx, u in enumerate(usages):
                p = cells[3].add_paragraph() if idx > 0 else cells[3].paragraphs[0]
                p.add_run(f"{u.get('type', '')} | {u.get('profile', '')} | VS: {u.get('virtual_server', 'None')}")
    if rows_added == 0:
        cells = table.add_row().cells
        cells[0].merge(cells[-1])
        cells[0].text = f"No certificates expiring in less than {threshold_days} days."
    for row in table.rows:
        for cell in row.cells:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.size = Pt(9)


def _cnt(c, key):
    return len(c.get(key) or [])


def _add_toc(doc):
    """Insert a Word Table-of-Contents field (levels 1–3). Word fills it in from
    the document's headings; `_mark_update_fields` makes it build on open."""
    run = doc.add_paragraph().add_run()
    begin = OxmlElement("w:fldChar"); begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText"); instr.set(qn("xml:space"), "preserve")
    instr.text = 'TOC \\o "1-3" \\h \\z \\u'
    sep = OxmlElement("w:fldChar"); sep.set(qn("w:fldCharType"), "separate")
    placeholder = OxmlElement("w:t")
    placeholder.text = "Right-click and choose “Update Field” to build the table of contents."
    end = OxmlElement("w:fldChar"); end.set(qn("w:fldCharType"), "end")
    for el in (begin, instr, sep, placeholder, end):
        run._r.append(el)


def _mark_update_fields(doc):
    """Tell Word to refresh all fields (so the TOC populates) when opened."""
    settings = doc.settings.element
    el = settings.find(qn("w:updateFields"))
    if el is None:
        el = OxmlElement("w:updateFields")
        settings.append(el)
    el.set(qn("w:val"), "true")


def build_ltm_docx(audit) -> bytes:
    c = audit.content or {}
    excluded = getattr(audit, "excluded", None) or {}
    excluded_findings = set(excluded.get("findings") or [])
    f = ltm_analyzer.apply_exclusions(audit.findings or {}, excluded)
    customer = _customer(audit)
    loc = report_settings.load().get("location") or ""
    cm = c.get("list_cm_device") or {}
    hw = c.get("sys_hardware") or {}
    sysdb = c.get("sysdb_file") or {}
    host = c.get("host_info") or {}
    lic = c.get("license_file") or {}
    vsum = c.get("virtual_summary") or {}

    # Build on the F5-branded template (cover, logo header, footer, styles).
    try:
        doc = Document(_TEMPLATE_PATH)
        _fill_cover(doc, customer, loc)
    except Exception:
        doc = Document()

    # Table of contents (Word builds it from the headings on open).
    try:
        doc.add_paragraph("Table of Contents", style="TOC Heading")
    except Exception:
        doc.add_heading("Table of Contents", level=1)
    _add_toc(doc)
    doc.add_page_break()

    doc.add_heading("F5 LTM Configuration Review", level=1)
    doc.add_paragraph(f"During the meetings with {customer} and the configuration reviews we did on the F5 "
                      f"appliances we present our findings in this report.")
    doc.add_paragraph(f"This document presents the findings of the F5 BIG-IP Local Traffic Manager (LTM) "
                      f"configuration review performed for {customer}. The purpose of this review is to provide "
                      f"an in-depth assessment of the current BIG-IP configuration, highlight areas of "
                      f"improvement, and validate whether the deployment follows F5 recommended practices and "
                      f"aligns with industry standards.")
    doc.add_paragraph("Throughout the audit, our goal is to help ensure that the BIG-IP platform is operating in "
                      "a reliable, secure, and efficient manner. By examining the key configuration components of "
                      "the system, we aim to identify potential misconfigurations, performance bottlenecks, "
                      "unnecessary complexity, or settings that could introduce operational risk. The outcome of "
                      "this review is to provide actionable insights that can enhance stability, improve "
                      "resilience, and optimize traffic management across the environment.")
    doc.add_paragraph("This report also serves as a valuable reference point for future architectural decisions. "
                      "Whether the customer intends to scale the environment, introduce new services, upgrade "
                      "software versions, or improve operational processes, the observations in this document "
                      "provide a baseline understanding of the current state of the configuration. This visibility "
                      "enables more informed planning and supports long-term maintainability.")
    doc.add_paragraph("While the audit focuses on the technical configuration of the F5 LTM objects, it is not "
                      "intended to assess application-level logic or behavior.")
    doc.add_paragraph()
    doc.add_paragraph()

    # --- Device Details ---
    doc.add_heading("Device Details", level=2)
    doc.add_paragraph("The following table shows the general configuration from the devices that we have audited. "
                      "The date and time of the report generation is " + _device_date(c))
    table = doc.add_table(rows=9, cols=2)
    table.style = "Table Grid"
    table.cell(0, 0).merge(table.cell(0, 1)).paragraphs[0].add_run("Device Details").bold = True
    labels = ["Platform", "Hostname", "Version", "Chassis ID", "DNS Servers", "NTP Servers",
              "Time Zone", "Licensed Modules"]
    values = [
        _safe(hw.get("platform_name")),
        _safe(cm.get("hostname") or sysdb.get("hostname") or audit.device_name),
        _safe(cm.get("version") or (c.get("version_file") or {}).get("Version")),
        _safe(hw.get("system_chassis_serial")),
        _safe(sysdb.get("dns.nameservers")),
        _safe(sysdb.get("ntp.servers")),
        _safe(cm.get("time-zone")),
        "\n".join(str(m) for m in (lic.get("Active Modules") or [])) or "not configured",
    ]
    for i, (k, v) in enumerate(zip(labels, values), start=1):
        table.cell(i, 0).text = k
        table.cell(i, 1).text = v

    # --- System Details ---
    doc.add_heading("System Details", level=2)
    doc.add_paragraph("The following table shows the general configuration from the devices that have been configured.")
    prov = c.get("sys_provision") or []
    table = doc.add_table(rows=len(prov) + 31, cols=2)
    table.style = "Table Grid"
    table.cell(0, 0).merge(table.cell(0, 1)).paragraphs[0].add_run("Device").bold = True
    dev_rows = [
        ("    Failover State", _safe(sysdb.get("failover.state") or cm.get("failover-state"))),
        ("    Active CPUs", _safe(host.get("active_cpu_count"))),
        ("    Total Memory (MB)", _safe(host.get("memory_total"))),
        ("    Available Memory (MB)", _safe(host.get("memory_used"))),
    ]
    for i, (k, v) in enumerate(dev_rows, start=1):
        table.cell(i, 0).text = k
        table.cell(i, 1).text = str(v)
    table.cell(5, 0).merge(table.cell(5, 1)).paragraphs[0].add_run("Configuration Totals").bold = True
    totals = [
        ("    Pools", _cnt(c, "ltm_pools")),
        ("    HTTP(s) Monitors", _cnt(c, "http_monitors") + _cnt(c, "https_monitors")),
        ("    iRules", _cnt(c, "irule_names")),
        ("    Certificates", _cnt(c, "ssl_certs")),
        ("    TCP Profiles", _cnt(c, "tcp_profiles")),
        ("    UDP Profiles", _cnt(c, "udp_profiles")),
        ("    HTTP Profiles", _cnt(c, "http")),
        ("    HTTP2 Profiles", _cnt(c, "http2")),
        ("    Client SSL Profiles", _cnt(c, "client_ssl")),
        ("    Server SSL Profiles", _cnt(c, "server_ssl")),
        ("    Compression Profiles", _cnt(c, "compression")),
        ("    Web Acceleration Profiles", _cnt(c, "web_acceleration")),
        ("    Bot Policies", _cnt(c, "bot")),
        ("    Dos Policies", _cnt(c, "dos")),
        ("    ASM Policies", _cnt(c, "asm")),
    ]
    for i, (k, v) in enumerate(totals, start=6):
        table.cell(i, 0).text = k
        table.cell(i, 1).text = str(v)
    table.cell(21, 0).merge(table.cell(21, 1)).paragraphs[0].add_run("Virtual Servers Details").bold = True
    vrows = [
        ("    Virtual Servers Total", vsum.get("count_vs", 0)),
        ("    L7 Virtual Servers", vsum.get("count_vs_http", 0)),
        ("    L4 Virtual Servers ", vsum.get("count_vs_tcp", 0) + vsum.get("count_vs_udp", 0)),
        ("    Virtuals with SSL Offloading", vsum.get("count_vs_client_ssl", 0)),
        ("    Virtuals with Optimization", vsum.get("count_vs_web_acceleration", 0) + vsum.get("count_vs_compression", 0)),
        ("    Virtuals with WAF", vsum.get("count_vs_asm", 0)),
        ("    Virtuals with Bot", vsum.get("count_vs_bot", 0)),
        ("    Virtuals with DOS", vsum.get("count_vs_dos", 0)),
    ]
    for i, (k, v) in enumerate(vrows, start=22):
        table.cell(i, 0).text = k
        table.cell(i, 1).text = str(v)
    table.cell(30, 0).merge(table.cell(30, 1)).paragraphs[0].add_run("Provisioned Modules").bold = True
    for i, item in enumerate(prov):
        table.cell(31 + i, 0).text = "    " + str(item.get("module", "")).upper()
        table.cell(31 + i, 1).text = str(item.get("level", "")).capitalize()

    # --- Resources Utilization (section placeholders, as in the source script) ---
    doc.add_paragraph()
    doc.add_paragraph()
    doc.add_heading("Resources Utilization", level=2)
    doc.add_paragraph("This section provides a consolidated view of the BIG-IP system’s operational performance "
                      "across all key hardware and traffic indicators. By visualizing CPU load, memory usage, "
                      "bandwidth consumption, SSL offloading activity, connection volumes, and HTTP transaction "
                      "rates, we gain a clear understanding of both platform health and traffic behavior. These "
                      "insights help identify bottlenecks, verify capacity headroom, and validate that the system "
                      "is performing reliably under current workloads.")
    graphs = getattr(audit, "graphs", None) or {}
    for title, desc, key in [
        ("Throughput", "The image below shows the inbound and outbound bandwidth usage.", "throughput"),
        ("HTTP Requests", "The chart below shows the number of HTTP transactions processed.", "http_requests"),
        ("Memory Usage", "The chart below displays the memory usage per type.", "memory"),
        ("SSL Transactions", "The image below shows the device SSL processing levels.", "ssl"),
        ("CPU Utilization", "The image below shows the recorded CPU utilization for the system per CPU core.", "cpu"),
        ("Active Connections", "The image below shows the number of active connections of the device.", "active_connections"),
    ]:
        doc.add_paragraph()
        doc.add_paragraph().add_run(title).bold = True
        doc.add_paragraph(desc)
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        b64 = graphs.get(key)
        if b64:
            try:
                p.add_run().add_picture(io.BytesIO(base64.b64decode(b64)), width=Inches(6.5))
            except Exception:
                pass

    # --- Findings summary table ---
    problems_found = ltm_analyzer.run_audit(c)
    suggestions = f.get("ltm") or []
    diag = f.get("diag") or {}
    cve_list = diag.get("cve") or []
    other_list = diag.get("other") or []

    doc.add_heading("Health Check Findings", level=2)
    doc.add_paragraph("The following table provides the summary of all the Issues that have been identified on "
                      "the BIGIP Device during our audit.")
    stable = doc.add_table(rows=1, cols=3)
    stable.style = "Table Grid"
    for i, h in enumerate(["#", "Severity", "Issue details"]):
        stable.cell(0, i).text = h
    n = 0

    def _summary_row(sev, text):
        nonlocal n
        n += 1
        cells = stable.add_row().cells
        cells[0].text = str(n)
        cells[1].text = sev
        cells[2].text = text

    for sev in ("Critical", "High", "Medium", "Low", "Info"):
        for item in suggestions:
            if item.get("rating") == sev:
                _summary_row(sev, item.get("title") or item.get("name") or "")
        for d in other_list:
            if (d.get("h_importance") or "").upper() == sev.upper():
                _summary_row(sev, d.get("h_header") or "")
        if sev == "High" and cve_list:
            _summary_row("High", f"{len(cve_list)} CVE Vulnerabilities have been identified.")
    _set_col_width(stable.columns[2], Cm(13))
    doc.add_paragraph()
    doc.add_paragraph()

    # --- Health Check Findings (per-finding detail blocks) ---
    def pf(key):
        return problems_found.get(key) or {}

    def issue(key):
        return pf(key).get("issue") is True and key not in excluded_findings

    def _head(key):
        doc.add_paragraph()
        doc.add_heading(pf(key)["title"], level=3)
        _sev_paragraph(doc, pf(key)["rating"])
        doc.add_paragraph(pf(key)["details"])
        doc.add_paragraph()

    if issue("self_ips"):
        _head("self_ips")
        doc.add_paragraph("Review the configured selfIPs with the Allowed Services per interface.")
        doc.add_paragraph()
        t = doc.add_table(rows=1, cols=3)
        t.style = "Table Grid"
        for i, h in enumerate(["Self IP", "Address", "Allowed Services"]):
            t.cell(0, i).text = h
        for item in c.get("self_ips") or []:
            cells = t.add_row().cells
            cells[0].text = str(item.get("self_ip", ""))
            cells[1].text = str(item.get("address", ""))
            svc = item.get("allow-service")
            cells[2].text = ", ".join(svc) if isinstance(svc, list) and svc else (str(svc) if svc else "None")

    for key in ("ssh_allow", "httpd_allow", "password_max", "password_remember", "password_complex"):
        if issue(key):
            _head(key)
            if pf(key).get("additional"):
                doc.add_paragraph(pf(key)["additional"])
                doc.add_paragraph()

    if issue("memory"):
        _head("memory")

    if issue("sync"):
        _head("sync")
        doc.add_paragraph(_DASH)
        doc.add_paragraph(pf("sync").get("error") or "")
        doc.add_paragraph(_DASH_END)
        doc.add_paragraph()

    if issue("errors"):
        _head("errors")
        doc.add_paragraph("Review the interface statistics for the device.")
        doc.add_paragraph()
        ifaces = (c.get("interface_errors") or {}).get("interfaces") or {}
        t = doc.add_table(rows=1, cols=5)
        t.style = "Table Grid"
        for i, h in enumerate(["Interface", "Total Packets", "Total Errors", "Total Drops", "Total Collisions"]):
            t.cell(0, i).text = h
        for name, iv in ifaces.items():
            cells = t.add_row().cells
            cells[0].text = str(name)
            cells[1].text = _humanize_int(iv.get("packets_total"))
            cells[2].text = _humanize_int(iv.get("errors_total"))
            cells[3].text = _humanize_int(iv.get("drops_total"))
            cells[4].text = _humanize_int(iv.get("collisions"))

    if issue("arp"):
        _head("arp")

    if issue("irules"):
        _head("irules")
        doc.add_paragraph("Review the irules that had reported Failures.")
        doc.add_paragraph()
        t = doc.add_table(rows=1, cols=4)
        t.style = "Table Grid"
        for i, h in enumerate(["iRule Name", "Event", "Failures", "Total Executions"]):
            t.cell(0, i).text = h
        for item in c.get("irule_failures") or []:
            cells = t.add_row().cells
            cells[0].text = str(item.get("name", ""))
            cells[1].text = str(item.get("event", ""))
            cells[2].text = str(item.get("failures", ""))
            cells[3].text = str(item.get("total_executions", ""))

    if issue("expired_cert"):
        _head("expired_cert")
        doc.add_paragraph("Below you can find a list of Certificates Expiring Soon (< 60 days) or already expired: ")
        _add_expiring_certs_table(doc, c.get("ssl_certs"), threshold_days=60)
        doc.add_paragraph()
        doc.add_paragraph()

    if issue("disk"):
        _head("disk")
        t = doc.add_table(rows=1, cols=2)
        t.style = "Table Grid"
        t.cell(0, 0).text = "Path"
        t.cell(0, 1).text = "Utilization (%)"
        for item in (c.get("df_h_file") or {}).get("checks") or []:
            cells = t.add_row().cells
            cells[0].text = str(item.get("path", ""))
            cells[1].text = str(item.get("utilization_percent", ""))

    for key in ("ntp", "dns", "cpu"):
        if issue(key):
            _head(key)

    if issue("http_monitors"):
        _head("http_monitors")
        doc.add_paragraph("Review the configured HTTP(s) monitors and adjust them as per your application requirements.")
        doc.add_paragraph()
        t = doc.add_table(rows=1, cols=6)
        t.style = "Table Grid"
        for i, h in enumerate(["Name", "Type", "Interval", "Timeout", "Send String", "Receive String"]):
            t.cell(0, i).text = h
        for typ, items in (("HTTP", c.get("http_monitors") or []), ("HTTPS", c.get("https_monitors") or [])):
            for item in items:
                cells = t.add_row().cells
                cells[0].text = str(item.get("name", ""))
                cells[1].text = typ
                cells[2].text = str(item.get("interval", ""))
                cells[3].text = str(item.get("timeout", ""))
                cells[4].text = str(item.get("send", ""))
                cells[5].text = "N/A" if item.get("recv") is None else str(item.get("recv"))

    if issue("pool_monitor"):
        _head("pool_monitor")
        doc.add_paragraph(_DASH)
        doc.add_paragraph("Below you can find a list of pools (up to 10) that don't have assigned monitors: ")
        count = 0
        for m in c.get("ltm_pools") or []:
            if count >= 10:
                break
            if m.get("monitor") == "none":
                doc.add_paragraph("- " + str(m.get("pool")))
                count += 1
        doc.add_paragraph(_DASH_END)

    if issue("lb_mode"):
        _head("lb_mode")
        doc.add_paragraph(_DASH)
        doc.add_paragraph("Below you can find a list of pools (up to 10) that have Round Robin as the configured method: ")
        count = 0
        for m in c.get("ltm_pools") or []:
            if count >= 10:
                break
            if m.get("load-balancing-mode") == "round-robin":
                doc.add_paragraph("- " + str(m.get("pool")))
                count += 1
        doc.add_paragraph(_DASH_END)

    if issue("ssl"):
        _head("ssl")

    # Findings added by this app that aren't in the original hard-coded set.
    for item in suggestions:
        if item.get("name") not in problems_found:
            _finding_block(doc, item)

    # --- Security Diagnostics Summary (CVEs) ---
    if cve_list:
        doc.add_heading("Security Diagnostics Summary", level=3)
        doc.add_paragraph("Please find below all the CVEs that we have identified on your system.")
        t = doc.add_table(rows=1, cols=5)
        t.style = "Table Grid"
        for i, h in enumerate(["CVE", "Importance", "Solution ID", "Summary", "FixedInVer"]):
            t.rows[0].cells[i].text = h
        for d in cve_list:
            cells = t.add_row().cells
            cells[0].text = "\n ".join(d.get("h_cve_ids") or [])
            cells[1].text = (d.get("h_importance") or "").capitalize()
            cells[2].text = d.get("solution_id") or ""
            cells[3].text = d.get("h_header") or ""
            cells[4].text = "\n ".join(d.get("fixedInVersions") or [])
        for col, w in zip(t.columns, (3.5, 1.5, 2, 9, 0.6)):
            _set_col_width(col, Cm(w))

    # --- Non-CVE diagnostics, per importance ---
    for sev in ("Critical", "High", "Medium", "Low"):
        for d in other_list:
            if (d.get("h_importance") or "").upper() != sev.upper():
                continue
            output = list(d.get("output") or [])
            if len(output) > 25:
                output = output[:25] + [".............. Output truncated (More info on iHealth) .............."]
            solution_ids = " and ".join(d.get("solution_ids") or [])
            doc.add_paragraph()
            doc.add_heading(d.get("h_header") or "", level=3)
            _sev_paragraph(doc, sev)
            doc.add_paragraph(d.get("h_summary") or "")
            doc.add_paragraph()
            if output:
                doc.add_paragraph(_DASH)
                doc.add_paragraph("\n\n ".join(output))
                doc.add_paragraph(_DASH_END)
            doc.add_paragraph()
            if solution_ids:
                doc.add_paragraph("Please review the solution article for more information: " + solution_ids)
                doc.add_paragraph()

    _mark_update_fields(doc)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
