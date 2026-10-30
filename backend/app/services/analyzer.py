"""Policy analyzer — full check set ported from legacy f5_functions.py.

Handles both policy shapes:
  * WAF Manager / AS3 declarative:  {"policy": {"cookies": [...], "cookie-settings": {...}, ...}}
  * iControl REST BIG-IP export:    flat dict with the same fields but camelCase
    accessor variants
The `_normalize` function collapses both into a single dict the checks consume.

Every finding has:
    {"category", "severity", "message", "violation", "score"}
where "violation" is the catalog key when applicable (info/warning/error and
score are pulled from the violation catalog so users can tune them in Settings).
"""
from __future__ import annotations
import json
from pathlib import Path
from app.services import violations as vio


# ---------------------------------------------------------------------------
# Normalization: unwrap the top-level `policy` key and expose common accessors.
# ---------------------------------------------------------------------------

def _get(d: dict, *keys, default=None):
    """Return the first present key from d (supports hyphen/camel variants)."""
    for k in keys:
        if isinstance(d, dict) and k in d:
            return d[k]
    return default


def _normalize(raw: dict) -> dict:
    p = raw.get("policy", raw) if isinstance(raw, dict) else {}

    return {
        "raw": p,
        "name": p.get("name", ""),
        "enforcementMode": (p.get("enforcementMode") or "").lower(),
        "caseInsensitive": bool(p.get("caseInsensitive", False)),
        "virtualServers": p.get("virtualServers") or [],
        "urls": _get(p, "urls", default=[]) or [],
        "parameters": _get(p, "parameters", default=[]) or [],
        "filetypes": _get(p, "filetypes", "file-types", default=[]) or [],
        "headers": _get(p, "headers", default=[]) or [],
        "cookies": _get(p, "cookies", default=[]) or [],
        "methods": _get(p, "methods", default=[]) or [],
        "responseStatusCodes": _get(p, "response-status-codes", "responseStatusCodes", default=[]) or [],
        "signatureSets": _get(p, "signature-sets", "signatureSets", default=[]) or [],
        "signatures": _get(p, "signatures", default=[]) or [],
        "signatureSettings": _get(p, "signature-settings", "signatureSettings", default={}) or {},
        "cookieSettings": _get(p, "cookie-settings", "cookieSettings", default={}) or {},
        "headerSettings": _get(p, "header-settings", "headerSettings", default={}) or {},
        "policyBuilder": _get(p, "policy-builder", "policyBuilder", default={}) or {},
        # The per-entity learning settings live in their own sub-objects, NOT
        # under `policy-builder` (F5 v17.1 schema).
        "policyBuilderFiletype": _get(p, "policy-builder-filetype", "policyBuilderFiletype", default={}) or {},
        "policyBuilderUrl": _get(p, "policy-builder-url", "policyBuilderUrl", default={}) or {},
        "policyBuilderParameter": _get(p, "policy-builder-parameter", "policyBuilderParameter", default={}) or {},
        "policyBuilderCookie": _get(p, "policy-builder-cookie", "policyBuilderCookie", default={}) or {},
        "policyBuilderRedirection": _get(p, "policy-builder-redirection-protection", "policyBuilderRedirectionProtection", default={}) or {},
        "blockingSettings": (_get(p, "blocking-settings", "blockingSettings", default={}) or {}).get("violations", []),
        "evasions": (_get(p, "blocking-settings", "blockingSettings", default={}) or {}).get("evasions", []),
        "httpProtocols": (_get(p, "blocking-settings", "blockingSettings", default={}) or {}).get("http-protocols", []),
        "ipi": _get(p, "ip-intelligence", "ipIntelligence", default={}) or {},
        "trustedIps": _get(p, "whitelist-ips", "trustedIps", "trusted-ips", default=[]) or [],
        "sensitiveParameters": _get(p, "sensitive-parameters", "sensitiveParameters", default=[]) or [],
        "redirectionDomains": _get(p, "redirection-protection-domains", "domains", default=[]) or [],
        "brute": _get(p, "brute-force-attack-preventions", "bruteForce", default=[]) or [],
        "loginPages": _get(p, "login-pages", "loginPages", default=[]) or [],
        "antivirus": _get(p, "antivirus", default={}) or {},
        "dataGuard": _get(p, "data-guard", "dataGuard", default={}) or {},
        "general": _get(p, "general", default={}) or {},
    }


# ---------------------------------------------------------------------------
# Catalog helpers
# ---------------------------------------------------------------------------

def _emit(catalog: dict, name: str, extra_text: str = "") -> dict | None:
    v = catalog.get(name)
    if not v:
        return None
    msg = v.get("txt", "")
    if extra_text:
        msg = f"{msg} {extra_text}".strip()
    return {
        "category": v.get("section", "Other"),
        "severity": v.get("severity", "info"),
        "message": msg,
        "violation": name,
        "score": v.get("score", 0),
    }


def _push(out: list, item: dict | None):
    if item:
        out.append(item)


def _violation_enforced(pol: dict, *names: str) -> bool:
    """True if any named violation is enforced on the policy — block or alarm
    on, or listed with no explicit flags (at policy default). Absent or
    explicitly-off violations count as not enforced. Used to skip checks whose
    findings are meaningless when the governing violation is not enforced."""
    bs = {v.get("name"): v for v in pol["blockingSettings"]
          if isinstance(v, dict) and v.get("name")}
    for n in names:
        v = bs.get(n)
        if v is None:
            continue
        if v.get("block") is True or v.get("alarm") is True:
            return True
        if "block" not in v and "alarm" not in v:
            return True   # listed at policy default -> enforced
    return False


def _violation_blocking(pol: dict, name: str) -> bool:
    """True only if the named violation is set to BLOCK (not merely alarming)."""
    for v in pol["blockingSettings"]:
        if isinstance(v, dict) and v.get("name") == name:
            return v.get("block") is True
    return False


def _cur(val) -> str:
    """Render a policy value for the `(currently: …)` note on a suggestion."""
    if val is None or val == "":
        return "not set"
    if val is True:
        return "yes"
    if val is False:
        return "no"
    return str(val)


# ---------------------------------------------------------------------------
# Per-section checks
# ---------------------------------------------------------------------------

def check_overview(pol: dict, cat: dict) -> list[dict]:
    out: list[dict] = []
    if pol["enforcementMode"] == "transparent":
        _push(out, _emit(cat, "enforcementMode"))
    if pol["caseInsensitive"]:
        _push(out, _emit(cat, "caseInsensitive"))

    brute = pol["brute"]
    if not brute:
        _push(out, _emit(cat, "brute_force"))
    elif not pol["loginPages"]:
        _push(out, _emit(cat, "brute_force_login"))

    # Antivirus/ICAP only matters if the Virus violation is enforced.
    if _violation_enforced(pol, "VIOL_VIRUS"):
        av = pol["antivirus"]
        if not av or not av.get("hostname"):
            _push(out, _emit(cat, "icap"))
        if av and not av.get("hostname"):
            _push(out, _emit(cat, "icap_server"))
    return out


def check_policy_builder(pol: dict, cat: dict) -> list[dict]:
    out: list[dict] = []
    # Per-entity learning settings live in their own sub-objects (see _normalize),
    # not under `policy-builder`. The global learning mode does live there.
    pb = pol["policyBuilder"]
    ft = pol["policyBuilderFiletype"]
    url = pol["policyBuilderUrl"]
    par = pol["policyBuilderParameter"]
    ck = pol["policyBuilderCookie"]
    redir = pol["policyBuilderRedirection"]

    lm = (pb.get("learningMode") or "")
    if lm.lower() != "manual":
        _push(out, _emit(cat, "learningMode", f"(currently: {_cur(lm)})"))

    # Learn New File Types is only meaningful when Illegal File Type is blocking —
    # only recommend it then.
    if _violation_blocking(pol, "VIOL_FILETYPE"):
        v = ft.get("learnExplicitFiletypes") or ft.get("filetypesLearningMode") or ""
        if v.lower() != "always":
            _push(out, _emit(cat, "learnExplicitFiletypes", f"(currently: {_cur(v)})"))

    v = url.get("learnExplicitUrls") or url.get("urlLearningMode") or ""
    if v.lower() != "selective":
        _push(out, _emit(cat, "learnExplicitUrls", f"(currently: {_cur(v)})"))
    v = par.get("learnExplicitParameters") or par.get("parameterLearningMode") or ""
    if v.lower() != "selective":
        _push(out, _emit(cat, "learnExplicitParameters", f"(currently: {_cur(v)})"))
    v = ck.get("learnExplicitCookies") or ck.get("cookieLearningMode") or ""
    if v.lower() != "selective":
        _push(out, _emit(cat, "learnExplicitCookies", f"(currently: {_cur(v)})"))
    v = par.get("parameterLearningLevel") or ""
    if v.lower() != "global":
        _push(out, _emit(cat, "parameterLearningLevel", f"(currently: {_cur(v)})"))
    if par.get("parametersIntegerValue"):
        _push(out, _emit(cat, "parametersIntegerValue"))
    # Learn New Redirection Domains only matters when Illegal Redirect
    # (VIOL_REDIRECT) is blocking — only recommend it then.
    if (_violation_blocking(pol, "VIOL_REDIRECT")
            and (redir.get("learnExplicitRedirectionDomains") or "").lower() == "always"):
        _push(out, _emit(cat, "learnExplicitRedirectionDomains"))

    tt = pb.get("trustedTrafficLoosen") or {}
    ut = pb.get("untrustedTrafficLoosen") or {}
    # "Untrusted sources" recommendation reads the untrusted-traffic loosen config;
    # show only when it differs from the recommended 100.
    if isinstance(ut.get("differentSources"), int) and ut["differentSources"] != 100:
        _push(out, _emit(cat, "trusted_loosen_source", f"(currently: {ut['differentSources']})"))
    if isinstance(tt.get("minHoursBetweenSamples"), int) and tt["minHoursBetweenSamples"] != 0:
        _push(out, _emit(cat, "trusted_loosen_hours", f"(currently: {tt['minHoursBetweenSamples']} hour(s))"))
    # Only recommend when the untrusted time isn't already 1 hour or 30 minutes.
    uh = ut.get("minHoursBetweenSamples")
    if isinstance(uh, (int, float)) and not isinstance(uh, bool) and uh not in (1, 0.5):
        cur = f"{int(round(uh * 60))} min" if uh < 1 else f"{uh:g} hour(s)"
        _push(out, _emit(cat, "untrusted_loosen_hours", f"(currently: {cur})"))
    return out


def check_blocking_settings(pol: dict, cat: dict) -> list[dict]:
    out: list[dict] = []
    transparent = pol["enforcementMode"] == "transparent"
    for v in pol["blockingSettings"]:
        name = v.get("name") or v.get("description") or "violation"
        # There is no `enabled` flag on a violation — only block / alarm / learn,
        # and some violations don't carry all three. Look at the flags actually
        # present on this entry.
        present = {k: v[k] for k in ("block", "alarm", "learn") if k in v}
        if not present:
            continue

        # (1) Every present flag is off → the violation is intentionally turned
        #     off entirely. That's the operator's choice, not a misconfiguration,
        #     so don't emit any suggestion for it.
        if all(val is False for val in present.values()):
            continue

        alarm_off = present.get("alarm") is False
        block_off = present.get("block") is False

        # (2) It's at least partly active (something else is on, e.g. learn) but
        #     both alarm AND block are off → the violation neither logs nor
        #     blocks. One finding naming both covers it.
        if alarm_off and block_off:
            _push(out, _emit(cat, "violation_alarm_block", f"({name})"))
            continue

        # (3) Alarm off (but block on) → acts silently without logging.
        if alarm_off:
            _push(out, _emit(cat, "violation_alarm", f"({name})"))
            continue

        # (4) Alarm on. Flag alarming-but-not-blocking WHILE the policy enforces.
        #     In transparent mode nothing blocks anyway — already surfaced once
        #     by the Overview check — so don't repeat it per violation.
        if block_off and not transparent:
            _push(out, _emit(cat, "violation_block", f"({name})"))
        if present.get("learn") is False:
            _push(out, _emit(cat, "violation_learn", f"({name})"))
    return out


def check_evasions(pol: dict, cat: dict) -> list[dict]:
    out: list[dict] = []
    if not _violation_enforced(pol, "VIOL_EVASION"):
        return out
    evasions = pol["evasions"]
    if not evasions:
        return out
    total = len(evasions)
    disabled = sum(1 for e in evasions if e.get("enabled") is False)
    if 0 < disabled < total and disabled >= total / 2:
        _push(out, _emit(cat, "evasions_disabled", f"({disabled}/{total} disabled)"))
    if disabled == total:
        _push(out, _emit(cat, "all_evasions_disabled"))
    return out


def check_compliance(pol: dict, cat: dict) -> list[dict]:
    out: list[dict] = []
    if not _violation_enforced(pol, "VIOL_HTTP_PROTOCOL"):
        return out
    protos = pol["httpProtocols"]
    if not protos:
        return out
    total = len(protos)
    disabled = sum(1 for e in protos if e.get("enabled") is False)
    if 0 < disabled < total and disabled >= total / 2:
        _push(out, _emit(cat, "compliance_disabled", f"({disabled}/{total} disabled)"))
    if disabled == total:
        _push(out, _emit(cat, "all_compliance_disabled"))
    return out


def check_signature_sets(pol: dict, cat: dict) -> list[dict]:
    out: list[dict] = []
    for s in pol["signatureSets"]:
        name = s.get("name") or ""
        if s.get("block") is False:
            _push(out, _emit(cat, "sig_set_block", f"({name})"))
        if s.get("alarm") is False:
            _push(out, _emit(cat, "sig_set_alarm", f"({name})"))
        if s.get("learn") is False:
            _push(out, _emit(cat, "sig_set_learn", f"({name})"))
    return out


def check_signature_overview(pol: dict, cat: dict) -> list[dict]:
    """Emits sig_disabled_* / sig_staging_* / signatureStaging findings.

    The legacy tool computes disabled/staging counts by querying `signatures`
    endpoints; here we count entries in the policy's `signatures` block when
    present and fall back to the `enabled` flag on `signature-settings`.
    """
    out: list[dict] = []
    settings_ss = pol["signatureSettings"]
    if settings_ss.get("signatureStaging") is False:
        _push(out, _emit(cat, "signatureStaging"))

    sigs = pol["signatures"]
    if not sigs:
        return out
    total = len(sigs)
    disabled = sum(1 for s in sigs if s.get("enabled") is False)
    staging = sum(1 for s in sigs if s.get("performStaging") is True)

    if 0 < disabled < 10:
        _push(out, _emit(cat, "sig_disabled_low", f"({disabled} disabled)"))
    elif 10 <= disabled < 30:
        _push(out, _emit(cat, "sig_disabled_medium", f"({disabled} disabled)"))
    elif 30 <= disabled < total:
        _push(out, _emit(cat, "sig_disabled_high", f"({disabled} disabled)"))
    if disabled and disabled == total:
        _push(out, _emit(cat, "sig_disabled_all"))

    if 0 < staging < 10:
        _push(out, _emit(cat, "sig_staging_low", f"({staging} in staging)"))
    elif 10 <= staging < 30:
        _push(out, _emit(cat, "sig_staging_medium", f"({staging} in staging)"))
    elif 30 <= staging < total:
        _push(out, _emit(cat, "sig_staging_high", f"({staging} in staging)"))
    if staging and staging == total:
        _push(out, _emit(cat, "sig_staging_all"))
    return out


def check_urls(pol: dict, cat: dict) -> list[dict]:
    out: list[dict] = []
    star_staging = star_sig_disabled = 0
    staging = sig_disabled = overrides = 0
    for u in pol["urls"]:
        is_star = u.get("name") == "*"
        if u.get("performStaging"):
            if is_star: star_staging += 1
            else:       staging += 1
        if u.get("attackSignaturesCheck") is False:
            if is_star: star_sig_disabled += 1
            else:       sig_disabled += 1
        if u.get("signatureOverrides"):
            overrides += 1
    if star_staging:
        _push(out, _emit(cat, "url_star_staging"))
    if star_sig_disabled:
        _push(out, _emit(cat, "url_star_sig_disabled"))
    if staging:
        _push(out, _emit(cat, "url_staging", f"({staging} URL(s))"))
    if sig_disabled:
        _push(out, _emit(cat, "url_sig_disabled", f"({sig_disabled} URL(s))"))
    if overrides:
        _push(out, _emit(cat, "url_sig_overrides", f"({overrides} URL(s))"))
    return out


def check_parameters(pol: dict, cat: dict) -> list[dict]:
    out: list[dict] = []
    star_staging = star_sig_disabled = 0
    staging = sig_disabled = overrides = file_uploads = 0
    for p in pol["parameters"]:
        is_star = p.get("name") == "*"
        vt = (p.get("valueType") or "").lower()
        if p.get("performStaging"):
            if is_star: star_staging += 1
            else:       staging += 1
        if p.get("attackSignaturesCheck") is False and vt not in ("ignore", "xml", "json", "dynamic-content", "static-content"):
            if is_star: star_sig_disabled += 1
            else:       sig_disabled += 1
        if p.get("signatureOverrides"):
            overrides += 1
        if vt == "user-input" and p.get("dataType") == "file":
            file_uploads += 1
    if star_staging:
        _push(out, _emit(cat, "param_star_staging"))
    if star_sig_disabled:
        _push(out, _emit(cat, "param_star_sig_disabled"))
    if staging:
        _push(out, _emit(cat, "param_staging", f"({staging} parameter(s))"))
    if sig_disabled:
        _push(out, _emit(cat, "param_sig_disabled", f"({sig_disabled} parameter(s))"))
    if overrides:
        _push(out, _emit(cat, "param_sig_overrides", f"({overrides} parameter(s))"))
    if not file_uploads:
        _push(out, _emit(cat, "param_file_uploads"))
    return out


def check_headers(pol: dict, cat: dict) -> list[dict]:
    out: list[dict] = []
    hs = pol["headerSettings"]
    max_hlen = hs.get("maximumHttpHeaderLength")
    if max_hlen in (None, 0, "any") and _violation_enforced(pol, "VIOL_HEADER_LENGTH"):
        _push(out, _emit(cat, "maximumHttpHeaderLength"))

    sig_disabled = overrides = 0
    for h in pol["headers"]:
        if h.get("name") == "cookie":
            continue
        if h.get("checkSignatures") is False:
            sig_disabled += 1
        if h.get("signatureOverrides"):
            overrides += 1
    if sig_disabled:
        _push(out, _emit(cat, "header_sig_disabled", f"({sig_disabled} header(s))"))
    if overrides:
        _push(out, _emit(cat, "header_sig_overrides", f"({overrides} header(s))"))
    return out


def check_cookies(pol: dict, cat: dict) -> list[dict]:
    out: list[dict] = []
    cookies = pol["cookies"]
    cs = pol["cookieSettings"]
    if cs.get("maximumCookieHeaderLength") in (None, 0, "any") and _violation_enforced(pol, "VIOL_COOKIE_LENGTH"):
        _push(out, _emit(cat, "maximumCookieHeaderLength"))

    enforced = [c for c in cookies if (c.get("type") or "").lower() == "enforced" or (c.get("enforcementType") or "").lower() == "enforced"]
    if not enforced and _violation_enforced(pol, "VIOL_ASM_COOKIE_MODIFIED"):
        _push(out, _emit(cat, "enforced_cookies"))

    staging = sig_disabled = overrides = 0
    star_staging = star_sig_disabled = 0
    same_site = secure = http_only = 0
    for c in cookies:
        is_star = c.get("name") == "*"
        if c.get("performStaging"):
            if is_star: star_staging += 1
            else:       staging += 1
        if c.get("attackSignaturesCheck") is False:
            if is_star: star_sig_disabled += 1
            else:       sig_disabled += 1
        if c.get("signatureOverrides"):
            overrides += 1
        if (c.get("insertSameSiteAttribute") or "none").lower() == "none":
            same_site += 1
        if c.get("securedOverHttpsConnection") is False:
            secure += 1
        if c.get("accessibleOnlyThroughTheHttpProtocol") is False:
            http_only += 1
    if star_staging:
        _push(out, _emit(cat, "cookie_star_staging"))
    if star_sig_disabled:
        _push(out, _emit(cat, "cookie_star_sig_disabled"))
    if staging:
        _push(out, _emit(cat, "staged_cookies", f"({staging} cookie(s))"))
    if sig_disabled:
        _push(out, _emit(cat, "cookie_sig_disabled", f"({sig_disabled} cookie(s))"))
    if overrides:
        _push(out, _emit(cat, "cookie_sig_overrides", f"({overrides} cookie(s))"))
    if same_site:
        _push(out, _emit(cat, "insertSameSiteAttribute", f"({same_site} cookie(s))"))
    if secure:
        _push(out, _emit(cat, "securedOverHttpsConnection", f"({secure} cookie(s))"))
    if http_only:
        _push(out, _emit(cat, "accessibleOnlyThroughTheHttpProtocol", f"({http_only} cookie(s))"))
    return out


def check_methods(pol: dict, cat: dict) -> list[dict]:
    out: list[dict] = []
    if not _violation_enforced(pol, "VIOL_METHOD"):
        return out
    names = [m.get("name") for m in pol["methods"] if m.get("name")]
    if "DELETE" in names:
        _push(out, _emit(cat, "delete_method"))
    if len(names) > 6:
        _push(out, _emit(cat, "methods_count", f"({len(names)} configured)"))
    return out


def check_response_codes(pol: dict, cat: dict) -> list[dict]:
    out: list[dict] = []
    if len(pol["responseStatusCodes"]) > 10:
        _push(out, _emit(cat, "methods_count", f"({len(pol['responseStatusCodes'])} response codes)"))
    return out


def check_sensitive_parameters(pol: dict, cat: dict) -> list[dict]:
    out: list[dict] = []
    sp = pol["sensitiveParameters"]
    if len(sp) <= 1 and (not sp or (sp[0].get("name", "").lower() == "password")):
        _push(out, _emit(cat, "sensitive_param"))
    return out


def check_trusted_ips(pol: dict, cat: dict) -> list[dict]:
    if not pol["trustedIps"]:
        v = _emit(cat, "trusted_ips")
        return [v] if v else []
    return []


def check_ipi(pol: dict, cat: dict) -> list[dict]:
    out: list[dict] = []
    ipi = pol["ipi"]
    if not ipi or ipi.get("enabled") is False:
        _push(out, _emit(cat, "ipi_enabled"))
        return out
    cats = ipi.get("ipIntelligenceCategories") or ipi.get("categories") or []
    if not cats:
        return out
    total = len(cats)
    disabled = sum(1 for c in cats if c.get("block") is False)
    if 0 < disabled < total:
        _push(out, _emit(cat, "ipi_services_disabled", f"({disabled}/{total} disabled)"))
    if disabled == total:
        _push(out, _emit(cat, "all_ipi_services_disabled"))
    return out


def check_file_types(pol: dict, cat: dict) -> list[dict]:
    out: list[dict] = []
    if not _violation_enforced(pol, "VIOL_FILETYPE"):
        return out
    ft = pol["filetypes"]
    types = {(f.get("type") or "").lower() for f in ft}
    star = [f for f in ft if f.get("name") == "*"]
    if star:
        _push(out, _emit(cat, "file_type_star"))
    if "allowed" in types and "disallowed" in types:
        _push(out, _emit(cat, "both_file_types"))
    staged = [f for f in ft if f.get("performStaging")]
    if staged:
        _push(out, _emit(cat, "file_type_staging", f"({len(staged)} in staging)"))
    return out


def check_redirection_domains(pol: dict, cat: dict) -> list[dict]:
    out: list[dict] = []
    domains = pol["redirectionDomains"]
    if not pol["general"].get("redirectionProtectionEnabled", True) and pol["general"]:
        _push(out, _emit(cat, "redirectionProtectionEnabled"))
    if _violation_enforced(pol, "VIOL_REDIRECT"):
        for d in domains:
            if d.get("domainName") == "*" or d.get("name") == "*":
                _push(out, _emit(cat, "wildcard_domain"))
                break
    return out


def check_geolocation(pol: dict, cat: dict) -> list[dict]:
    if not _violation_enforced(pol, "VIOL_GEOLOCATION"):
        return []
    raw = pol["raw"]
    geos = raw.get("disallowed-geolocations") or raw.get("disallowedGeolocations") or []
    if not geos:
        v = _emit(cat, "geo_count")
        return [v] if v else []
    return []


ALL_CHECKS = [
    check_overview,
    check_policy_builder,
    check_blocking_settings,
    check_evasions,
    check_compliance,
    check_signature_sets,
    check_signature_overview,
    check_urls,
    check_parameters,
    check_headers,
    check_cookies,
    check_methods,
    check_response_codes,
    check_sensitive_parameters,
    check_trusted_ips,
    check_ipi,
    check_file_types,
    check_redirection_domains,
    check_geolocation,
]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyze_policy(raw: dict) -> list[dict]:
    """Run the full check set against a policy JSON (the DB-stored content).
    Content-based (no disk I/O) — this app keeps policies in Postgres."""
    pol = _normalize(raw)
    cat = vio.load_catalog()
    findings: list[dict] = []
    for fn in ALL_CHECKS:
        try:
            findings.extend(fn(pol, cat))
        except Exception as e:
            findings.append({
                "category": "Analyzer", "severity": "info",
                "message": f"{fn.__name__} failed: {e}", "violation": fn.__name__, "score": 0,
            })
    return findings


def _gap_weight(state: str) -> float:
    """Weight a template-wanted violation contributes to Risk by its coverage
    state. v1 weights every violation equally; replace this with a per-violation
    severity lookup to make high-impact gaps dominate the Risk number."""
    return {"missing": 1.0, "partial": 0.5, "covered": 0.0}.get(state, 0.0)


def compare_to_template(raw: dict, template_checks: dict) -> dict:
    """Coverage gap between a policy and the violations its template intends to
    block. Risk is the percentage of that intended protection that is absent.

      - covered (0.0): the violation blocks — either block:true, or it is listed
                       with no explicit block/alarm flags (at policy default).
      - partial (0.5): the policy enables it but only alarms (block off).
      - missing (1.0): the template wants it, but the policy has it explicitly
                       turned off, or it is absent entirely.

    Risk reads each violation's own block/alarm flags only. Policy-wide
    transparent mode is a configuration-quality issue (the WAF Score), not a
    coverage gap, so it is deliberately ignored here.

    risk = 100 * sum(weights) / count(template-wanted violations).
    """
    pol = _normalize(raw)
    bs = {v.get("name"): v for v in pol["blockingSettings"]
          if isinstance(v, dict) and v.get("name")}

    wanted = [name for name, val in (template_checks or {}).items()
              if isinstance(name, str) and name.startswith("VIOL_")
              and str(val).lower() == "yes"]

    buckets = {"missing": [], "partial": [], "covered": []}
    weight = 0.0
    for name in wanted:
        v = bs.get(name)
        if v is None:
            state = "missing"                       # not in the policy at all
        elif v.get("block") is True:
            state = "covered"
        elif v.get("alarm") is True:
            state = "partial"                        # enabled but only alarms
        elif "block" not in v and "alarm" not in v:
            state = "covered"                        # listed at policy default
        else:
            state = "missing"                        # explicitly turned off
        buckets[state].append(name)
        weight += _gap_weight(state)

    total = len(wanted)
    risk = round(100.0 * weight / total, 1) if total else 0.0
    return {
        "risk": risk, "total": total,
        "missing": sorted(buckets["missing"]),
        "partial": sorted(buckets["partial"]),
        "covered": sorted(buckets["covered"]),
    }


def strengths(raw: dict) -> list[str]:
    """Positive highlights — what the policy already gets right. Only true
    statements are returned, so the summary can show what's working, not just
    the gaps."""
    pol = _normalize(raw)
    out: list[str] = []

    if pol["enforcementMode"] == "blocking":
        out.append("Policy is in blocking (enforcement) mode")
    vs = pol["virtualServers"]
    if vs:
        out.append(f"Applied to {len(vs)} virtual server(s)")

    bs = [v for v in pol["blockingSettings"] if isinstance(v, dict)]
    blocked = [v for v in bs if v.get("block") is True]
    if bs and blocked:
        out.append(f"{len(blocked)} of {len(bs)} violations set to block")

    if pol["signatureSets"]:
        out.append(f"{len(pol['signatureSets'])} attack-signature set(s) configured")
    if not pol["caseInsensitive"]:
        out.append("Policy is case-sensitive")
    if (pol["policyBuilder"].get("learningMode") or "").lower() == "manual":
        out.append("Policy Builder is in manual mode")
    if pol["general"].get("dataGuardEnabled") or pol["dataGuard"].get("enabled"):
        out.append("Data Guard is enabled")
    if pol["brute"]:
        out.append("Brute-force protection is configured")
    if pol["loginPages"]:
        out.append(f"{len(pol['loginPages'])} login page(s) defined")
    if pol["trustedIps"]:
        out.append(f"{len(pol['trustedIps'])} trusted IP(s) configured")
    return out


def summarize(findings: list[dict]) -> dict:
    """Severity counts + total weighted score + distinct flagged areas."""
    sev = {"error": 0, "warning": 0, "info": 0}
    score = 0.0
    areas = set()
    for f in findings:
        s = f.get("severity", "info")
        if s in sev:
            sev[s] += 1
        score += float(f.get("score") or 0)
        if s in ("error", "warning") and f.get("category"):
            areas.add(f["category"])
    return {
        "error": sev["error"], "warning": sev["warning"], "info": sev["info"],
        "score": round(score, 2), "areas": len(areas), "total": len(findings),
    }
