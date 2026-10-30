"""Presentation-ready summary of a WAF policy, for the Configuration Review
page. Handles both shapes ({"policy": {...}} and flat BIG-IP) and never throws
on a missing section — returns empty lists / None instead."""
from __future__ import annotations
from typing import Any


def _get(d: dict, *keys, default=None):
    for k in keys:
        if isinstance(d, dict) and k in d:
            return d[k]
    return default


def _staging(e: dict) -> bool:
    return bool(e.get("performStaging") or e.get("staging") in (True, "true", 1, "1"))


def _disabled(e: dict) -> bool:
    return e.get("enabled") is False


def _counts(items: list) -> dict:
    items = items or []
    return {
        "total": len(items),
        "staging": sum(1 for e in items if isinstance(e, dict) and _staging(e)),
        "disabled": sum(1 for e in items if isinstance(e, dict) and _disabled(e)),
    }


def build_summary(raw: dict) -> dict:
    p = raw.get("policy", raw) if isinstance(raw, dict) else {}

    filetypes   = _get(p, "filetypes", "file-types", default=[]) or []
    urls        = _get(p, "urls", default=[]) or []
    parameters  = _get(p, "parameters", default=[]) or []
    cookies     = _get(p, "cookies", default=[]) or []
    headers     = _get(p, "headers", default=[]) or []
    methods     = _get(p, "methods", default=[]) or []
    response_codes = _get(p, "response-status-codes", "responseStatusCodes", "allowed-response-codes", default=[]) or []
    sig_sets    = _get(p, "signature-sets", "signatureSets", default=[]) or []
    signatures  = _get(p, "signatures", default=[]) or []
    bs          = _get(p, "blocking-settings", "blockingSettings", default={}) or {}
    violations  = bs.get("violations", []) or []
    evasions    = bs.get("evasions", []) or []
    http_proto  = bs.get("http-protocols", bs.get("httpProtocols", [])) or []
    web_sec     = bs.get("web-services-securities", []) or []
    compliance  = http_proto  # HTTP compliance checks
    ipi         = _get(p, "ip-intelligence", "ipIntelligence", default={}) or {}
    trusted_ips = _get(p, "whitelist-ips", "trustedIps", "trusted-ips", default=[]) or []
    sens_params = _get(p, "sensitive-parameters", "sensitiveParameters", default=[]) or []
    login_pages = _get(p, "login-pages", "loginPages", default=[]) or []
    brute       = _get(p, "brute-force-attack-preventions", "bruteForce", default=[]) or []
    redir_doms  = _get(p, "redirection-protection-domains", default=[]) or \
        ((_get(p, "redirection-protection", default={}) or {}).get("redirectionDomains", []) or [])

    sig_settings = _get(p, "signature-settings", "signatureSettings", default={}) or {}
    header_set   = _get(p, "header-settings", "headerSettings", default={}) or {}
    cookie_set   = _get(p, "cookie-settings", "cookieSettings", default={}) or {}
    pb           = _get(p, "policy-builder", "policyBuilder", default={}) or {}
    data_guard   = _get(p, "data-guard", "dataGuard", default={}) or {}
    general_sec  = _get(p, "general", default={}) or {}

    counts = {
        "file_types": _counts(filetypes),
        "urls": _counts(urls),
        "parameters": _counts(parameters),
        "signatures": _counts(signatures),
        "cookies": _counts(cookies),
        "headers": _counts(headers),
        "compliance": {"total": len(http_proto), "staging": 0,
                       "disabled": sum(1 for e in http_proto if isinstance(e, dict) and e.get("enabled") is False)},
        "evasion": {"total": len(evasions), "staging": 0,
                    "disabled": sum(1 for e in evasions if isinstance(e, dict) and e.get("enabled") is False)},
        "methods": _counts(methods),
    }

    blocking_settings = [{
        "name": v.get("name"),
        "learn": v.get("learn"),
        "alarm": v.get("alarm"),
        "block": v.get("block"),
        "enabled": v.get("enabled", v.get("alarm")),
    } for v in violations if isinstance(v, dict)]

    general = {
        "name": p.get("name"),
        "template": (_get(p, "template", default={}) or {}).get("name") if isinstance(p.get("template"), dict) else p.get("template"),
        "enforcementMode": p.get("enforcementMode"),
        "caseInsensitive": p.get("caseInsensitive"),
        "applicationLanguage": p.get("applicationLanguage"),
        "virtualServers": p.get("virtualServers") or general_sec.get("virtualServers"),
        "trustXff": general_sec.get("trustXff"),
        "customXffHeaders": general_sec.get("customXffHeaders"),
        "maximumHttpHeaderLength": header_set.get("maximumHttpHeaderLength"),
        "maximumCookieHeaderLength": cookie_set.get("maximumCookieHeaderLength"),
        "signatureStaging": sig_settings.get("signatureStaging"),
        "policyBuilderMode": pb.get("learningMode"),
        "dataGuardEnabled": data_guard.get("enabled"),
    }

    lists: dict[str, Any] = {
        "file_types": filetypes, "urls": urls, "parameters": parameters,
        "cookies": cookies, "headers": headers, "methods": methods,
        "response_codes": response_codes, "redirection_domains": redir_doms,
        "signature_sets": sig_sets, "signatures": signatures,
        "evasions": evasions, "compliance": compliance,
        "ipi": ipi, "trusted_ips": trusted_ips,
        "sensitive_parameters": sens_params, "login_pages": login_pages,
        "brute_force": brute, "web_services_securities": web_sec,
    }

    return {"counts": counts, "blocking_settings": blocking_settings, "general": general, "lists": lists}
