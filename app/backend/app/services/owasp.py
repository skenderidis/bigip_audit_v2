"""OWASP Top-10 (2021) compliance scoring for a WAF policy.

Set-based: an attack-signature-type requirement is fulfilled when the policy
assigns and enforces (block) a signature set that covers that attack type —
either a broad/Basic detection set (covers all types) or the attack-type's
specific set. Protection and entity requirements read the policy directly.

Some requirements can't be derived from a declarative WAF policy (e.g. the
virtual server's TLS/encryption posture lives on the LTM side). Those are
`user_ack` requirements: the user accepts (or not) that the control is in
place, and the acceptance is persisted per policy (AuditPolicy.owasp_acks)
and passed in here as `acks`.

The CATEGORIES table is built up as each OWASP category's rules are defined.
Scoring: category % = fulfilled requirements / total; overall = mean of the
defined categories.
"""
from __future__ import annotations

# Enforced signature sets whose name contains one of these cover ALL attack
# types (the generic / accuracy-filtered Basic sets).
BROAD_SET_HINTS = [
    "all signatures", "generic detection", "high accuracy",
    "medium accuracy", "low accuracy", "all response",
]

# Attack-type -> substrings that an attack-type-specific set name would contain.
SIG_TYPE_SETS = {
    "Authentication/Authorization Attacks": ["authentication/authorization"],
    "Path Traversal": ["path traversal"],
    "Predictable Resource Location": ["predictable resource location"],
    "Information Leakage": ["information leakage"],
    "Buffer Overflow": ["buffer overflow"],
    "Command Execution": ["command execution"],
    "Cross Site Scripting (XSS)": ["cross site scripting", "xss"],
    "Denial of Service": ["denial of service"],
    "LDAP Injection": ["ldap injection"],
    "Remote File Include": ["remote file include"],
    "SQL-Injection": ["sql injection", "sql-injection"],
    "Server Side Code Injection": ["server side code injection"],
    "Vulnerability Scan": ["vulnerability scan"],
    "XPath Injection": ["xpath injection"],
    # SSRF has no distinct attack type in the reference set — it ships as its
    # own signature set (or is covered by a broad detection set).
    "SSRF": ["ssrf", "server side request forgery", "server-side request forgery"],
}

# Order the requirement groups render in (UI iterates these).
GROUPS = ["Attack Signatures", "Protections", "Policy Entities", "Best Practices", "Virtual Server Protection"]


# ── category definitions (extended as we go) ──────────────────────────────
CATEGORIES = [
    {
        "id": "A1",
        "name": "Broken Access Control",
        "description": (
            "Access control enforces policy such that users cannot act outside of "
            "their intended permissions. Failure of access control typically leads "
            "to unauthorized information disclosure, modification, or destruction of "
            "all data or performing a business function outside the user's limits."
        ),
        "requirements": [
            {"group": "Attack Signatures", "type": "sig_type", "label": "Authentication/Authorization Attacks", "attack_type": "Authentication/Authorization Attacks"},
            {"group": "Attack Signatures", "type": "sig_type", "label": "Path Traversal", "attack_type": "Path Traversal"},
            {"group": "Attack Signatures", "type": "sig_type", "label": "Predictable Resource Location", "attack_type": "Predictable Resource Location"},
            {"group": "Protections", "type": "login_enforcement", "label": "Login Enforcement"},
            {"group": "Policy Entities", "type": "disallowed_filetypes", "label": "Disallowed File types"},
            {"group": "Policy Entities", "type": "disallowed_urls", "label": "Disallowed URLs"},
        ],
    },
    {
        "id": "A2",
        "name": "Cryptographic Failures",
        "description": (
            "Many web applications and APIs do not properly protect sensitive data, "
            "such as financial, healthcare, and Personally Identifiable Information "
            "(PII). Attackers can steal or modify such weakly protected data to "
            "conduct credit card fraud, identity theft, or other crimes. Sensitive "
            "data can be compromised without extra protection, such as encryption at "
            "rest or in transit, and requires special precautions when exchanged with "
            "the browser."
        ),
        "requirements": [
            {"group": "Attack Signatures", "type": "sig_type", "label": "Predictable Resource Location", "attack_type": "Predictable Resource Location"},
            {"group": "Attack Signatures", "type": "sig_type", "label": "Information Leakage", "attack_type": "Information Leakage"},
            {"group": "Protections", "type": "data_guard", "label": "Data Guard"},
            {"group": "Protections", "type": "mask_credit_card", "label": "Mask Credit Card Numbers in Request Log"},
            {"group": "Policy Entities", "type": "masked_parameters", "label": "Masked Parameters"},
            {"group": "Policy Entities", "type": "masked_headers", "label": "Masked Headers"},
            {"group": "Policy Entities", "type": "masked_cookies", "label": "Masked Cookies"},
            {"group": "Virtual Server Protection", "type": "user_ack", "key": "client_side_encryption", "label": "Client-side encryption"},
            {"group": "Virtual Server Protection", "type": "user_ack", "key": "server_side_encryption", "label": "Server-side encryption"},
        ],
    },
    {
        "id": "A3",
        "name": "Injection",
        "description": (
            "Injection flaws such as SQL, NoSQL, OS, and LDAP injection occur when "
            "untrusted data is sent to an interpreter as part of a command or query. "
            "The attacker's hostile data can trick the interpreter into executing "
            "unintended commands or accessing data without proper authorization. XSS "
            "flaws occur whenever an application includes untrusted data in a new web "
            "page without proper validation or escaping, or updates an existing web "
            "page with user-supplied data using a browser API that can create HTML or "
            "JavaScript. XSS allows attackers to execute scripts in the victim's "
            "browser which can hijack user sessions, deface web sites, or redirect the "
            "user to malicious sites."
        ),
        "requirements": [
            {"group": "Attack Signatures", "type": "sig_type", "label": "Buffer Overflow", "attack_type": "Buffer Overflow"},
            {"group": "Attack Signatures", "type": "sig_type", "label": "Command Execution", "attack_type": "Command Execution"},
            {"group": "Attack Signatures", "type": "sig_type", "label": "Cross Site Scripting (XSS)", "attack_type": "Cross Site Scripting (XSS)"},
            {"group": "Attack Signatures", "type": "sig_type", "label": "Denial of Service", "attack_type": "Denial of Service"},
            {"group": "Attack Signatures", "type": "sig_type", "label": "LDAP Injection", "attack_type": "LDAP Injection"},
            {"group": "Attack Signatures", "type": "sig_type", "label": "Path Traversal", "attack_type": "Path Traversal"},
            {"group": "Attack Signatures", "type": "sig_type", "label": "Remote File Include", "attack_type": "Remote File Include"},
            {"group": "Attack Signatures", "type": "sig_type", "label": "SQL-Injection", "attack_type": "SQL-Injection"},
            {"group": "Attack Signatures", "type": "sig_type", "label": "Server Side Code Injection", "attack_type": "Server Side Code Injection"},
            {"group": "Attack Signatures", "type": "sig_type", "label": "Vulnerability Scan", "attack_type": "Vulnerability Scan"},
            {"group": "Attack Signatures", "type": "sig_type", "label": "XPath Injection", "attack_type": "XPath Injection"},
            {"group": "Protections", "type": "evasion", "label": "Evasion Techniques"},
            {"group": "Protections", "type": "param_metachars", "label": "Disallowed Meta Characters In Parameters"},
            {"group": "Protections", "type": "httponly_cookies", "label": "HttpOnly Cookie Attribute Enforcement"},
        ],
    },
    {
        "id": "A4",
        "name": "Insecure Design",
        "description": (
            "Insecure design represents different weaknesses, expressed as 'missing "
            "or ineffective control design'. Secure design is a culture and "
            "methodology that constantly evaluates threats and ensures that code is "
            "robustly designed and tested to prevent known attack methods. Threat "
            "modeling should be integrated into refinement sessions or similar "
            "activities."
        ),
        "requirements": [
            {"group": "Attack Signatures", "type": "sig_type", "label": "Predictable Resource Location", "attack_type": "Predictable Resource Location"},
            {"group": "Attack Signatures", "type": "sig_type", "label": "Information Leakage", "attack_type": "Information Leakage"},
            {"group": "Best Practices", "type": "user_ack", "key": "use_cases_analysis", "label": "Use cases Analysis"},
            {"group": "Best Practices", "type": "user_ack", "key": "security_rules_definitions", "label": "Security rules Definitions"},
            {"group": "Best Practices", "type": "user_ack", "key": "threat_modelling_assessments", "label": "Threat modelling assessments"},
            {"group": "Best Practices", "type": "user_ack", "key": "threat_modelling_testing", "label": "Threat modelling testing"},
            {"group": "Best Practices", "type": "user_ack", "key": "tenant_isolation_design", "label": "Tenant isolation Design"},
            {"group": "Best Practices", "type": "user_ack", "key": "resource_consumption_limitation", "label": "Resource consumption limitation"},
        ],
    },
    {
        "id": "A5",
        "name": "Security Misconfiguration",
        "description": (
            "Security misconfiguration is the most commonly seen issue. This is a "
            "result of insecure default configurations, unnecessary components "
            "installed or enabled, incomplete or ad hoc configurations, open cloud "
            "storage, an XML processor that interprets external references, and "
            "verbose error messages containing sensitive information. Not only must "
            "all operating systems, frameworks, libraries, and applications be "
            "securely configured, but also they must be patched and upgraded in a "
            "timely fashion."
        ),
        "requirements": [
            {"group": "Attack Signatures", "type": "sig_type", "label": "Information Leakage", "attack_type": "Information Leakage"},
            {"group": "Attack Signatures", "type": "sig_type", "label": "Vulnerability Scan", "attack_type": "Vulnerability Scan"},
            {"group": "Required Signatures", "type": "signature", "label": "XML External Entity (XXE) injection attempt in Comment",
             "signature_id": "200015136", "signature_name": 'XML External Entity injection attempt in "comment"'},
            {"group": "Protections", "type": "xml_dtd", "label": "Disallow DTDs in XML content profile"},
            {"group": "Protections", "type": "attack_signatures", "label": "Attack Signatures"},
            {"group": "Protections", "type": "server_technologies", "label": "Server Technologies"},
            {"group": "Protections", "type": "allowed_methods", "label": "Allowed Methods"},
            {"group": "Protections", "type": "samesite_cookies", "label": "SameSite Cookie Attribute Enforcement"},
            {"group": "Policy Entities", "type": "cors_urls", "label": "CORS enabled in URLs"},
            {"group": "Policy Entities", "type": "clickjacking_urls", "label": "Clickjacking protection URLs"},
            {"group": "Best Practices", "type": "user_ack", "key": "application_vulnerability_scanning", "label": "Application vulnerability scanning"},
            {"group": "Best Practices", "type": "user_ack", "key": "vulnerability_scanner_integration", "label": "Vulnerability scanner integration"},
            {"group": "Best Practices", "type": "user_ack", "key": "application_system_patching", "label": "Application and system patching"},
            {"group": "Best Practices", "type": "user_ack", "key": "application_system_hardening", "label": "Application and system hardening"},
        ],
    },
    {
        "id": "A6",
        "name": "Vulnerable and Outdated Components",
        "description": (
            "Components such as libraries, frameworks, and other software modules run "
            "with the same privileges as the application. If a vulnerable component is "
            "exploited, such an attack can facilitate serious data loss or server "
            "takeover. Applications and APIs using components with known "
            "vulnerabilities may undermine application defenses and enable various "
            "attacks and impacts."
        ),
        "requirements": [
            {"group": "Protections", "type": "attack_signatures", "label": "Attack Signatures"},
            {"group": "Protections", "type": "server_technologies", "label": "Server Technologies"},
            # Same ack keys as A5 — accepting once satisfies both categories.
            {"group": "Best Practices", "type": "user_ack", "key": "application_vulnerability_scanning", "label": "Application vulnerability scanning"},
            {"group": "Best Practices", "type": "user_ack", "key": "vulnerability_scanner_integration", "label": "Vulnerability scanner integration"},
            {"group": "Best Practices", "type": "user_ack", "key": "application_system_patching", "label": "Application and system patching"},
            {"group": "Best Practices", "type": "user_ack", "key": "application_system_hardening", "label": "Application and system hardening"},
        ],
    },
    {
        "id": "A7",
        "name": "Identification and Authentication Failures",
        "description": (
            "Application functions related to authentication and session management "
            "are often implemented incorrectly, allowing attackers to compromise "
            "passwords, keys, or session tokens, or to exploit other implementation "
            "flaws to assume other users' identities temporarily or permanently."
        ),
        "requirements": [
            {"group": "Attack Signatures", "type": "sig_type", "label": "Authentication/Authorization Attacks", "attack_type": "Authentication/Authorization Attacks"},
            {"group": "Protections", "type": "asm_cookie_tampering", "label": "ASM cookie tampering protection"},
            {"group": "Protections", "type": "session_hijacking", "label": "Session Hijacking protection"},
            {"group": "Protections", "type": "brute_force", "label": "Brute Force protection"},
            {"group": "Protections", "type": "login_enforcement", "label": "Login Enforcement"},
        ],
    },
    {
        "id": "A8",
        "name": "Software and Data Integrity Failures",
        "description": (
            "Software and data integrity failures relate to code and infrastructure "
            "that does not protect against integrity violations. For example, an "
            "application relies upon plugins, libraries, or modules from untrusted "
            "sources, repositories, and content delivery networks (CDNs). An insecure "
            "CI/CD pipeline can introduce the potential for unauthorized access, "
            "malicious code, or system compromise. Many applications now include "
            "auto-update functionality, where updates are downloaded without "
            "sufficient integrity verification and applied to the previously trusted "
            "application — attackers could potentially upload their own updates to be "
            "distributed and run on all installations. Another example is where "
            "objects or data are encoded or serialized into a structure that an "
            "attacker can see and modify, which is vulnerable to insecure "
            "deserialization."
        ),
        "requirements": [
            {"group": "Attack Signatures", "type": "sig_type", "label": "Buffer Overflow", "attack_type": "Buffer Overflow"},
            {"group": "Attack Signatures", "type": "sig_type", "label": "Command Execution", "attack_type": "Command Execution"},
            {"group": "Attack Signatures", "type": "sig_type", "label": "Denial of Service", "attack_type": "Denial of Service"},
            {"group": "Attack Signatures", "type": "sig_type", "label": "Server Side Code Injection", "attack_type": "Server Side Code Injection"},
            {"group": "Policy Entities", "type": "enforced_cookies", "label": "Enforced cookies"},
            {"group": "Best Practices", "type": "user_ack", "key": "use_trusted_repositories", "label": "Use trusted repositories"},
            {"group": "Best Practices", "type": "user_ack", "key": "packages_digitally_signed_verified", "label": "Packages digitally signed and verified"},
            {"group": "Best Practices", "type": "user_ack", "key": "secure_cicd_pipeline", "label": "Secure CI/CD pipeline"},
            {"group": "Best Practices", "type": "user_ack", "key": "component_inventory_tool", "label": "Component inventory tool"},
        ],
    },
    {
        "id": "A9",
        "name": "Security Logging and Monitoring Failures",
        "description": (
            "Security logging and monitoring failures, coupled with missing or "
            "ineffective integration with incident response, allow attackers to "
            "further attack systems, maintain persistence, pivot to more systems, and "
            "tamper, extract, or destroy data. Most breach studies show time to detect "
            "a breach is over 200 days, typically detected by external parties rather "
            "than internal processes or monitoring."
        ),
        "requirements": [
            {"group": "Best Practices", "type": "user_ack", "key": "log_illegal_requests", "label": "Log Illegal Requests"},
            {"group": "Best Practices", "type": "user_ack", "key": "remote_logging", "label": "Remote Logging"},
        ],
    },
    {
        "id": "A10",
        "name": "Server-Side Request Forgery (SSRF)",
        "description": (
            "SSRF flaws occur whenever a web application is fetching a remote resource "
            "without validating the user-supplied URL. It allows an attacker to coerce "
            "the application to send a crafted request to an unexpected destination, "
            "even when protected by a firewall, VPN, or another type of network Access "
            "Control List (ACL)."
        ),
        "requirements": [
            {"group": "Attack Signatures", "type": "sig_name_group", "label": "SSRF Attack Signatures", "name_group": "SSRF"},
            {"group": "Policy Entities", "type": "ssrf_hosts", "label": "SSRF Hosts"},
            {"group": "Policy Entities", "type": "uri_autodetect_params", "label": "URI or Auto-detected Parameters"},
        ],
    },
]


# ── signature-set coverage ────────────────────────────────────────────────
def _enforced_sets(policy: dict) -> list[dict]:
    sets = policy.get("signature-sets") or policy.get("signatureSets") or []
    return [s for s in sets if isinstance(s, dict) and s.get("block") is True]


def _logonly_sets(policy: dict) -> list[dict]:
    """Sets that log (alarm) but don't block — partial protection (detect only)."""
    sets = policy.get("signature-sets") or policy.get("signatureSets") or []
    return [s for s in sets if isinstance(s, dict)
            and s.get("block") is not True and s.get("alarm") is True]


def enforced_set_names(raw: dict) -> list[str]:
    policy = raw.get("policy", raw) if isinstance(raw, dict) else {}
    return [(s.get("name") or "").lower() for s in _enforced_sets(policy)]


def named_signature_names() -> list[str]:
    return sorted({r["signature_name"] for c in CATEGORIES for r in c["requirements"]
                   if r.get("type") == "signature" and r.get("signature_name")})


def _is_staged(policy: dict) -> bool:
    """Whether the policy's attack signatures are in staging (not yet enforced).

    The real per-signature truth is signatures[].performStaging — the global
    signature-settings flags (signatureStaging / placeSignaturesInStaging) only
    enable the staging *feature* and govern *newly added* signatures; they do
    NOT mean the existing enforced signatures are staged. So when the policy
    enumerates signatures we trust performStaging (staged only if staged
    signatures outnumber enforced ones); we fall back to the feature flags only
    when the policy carries no per-signature data."""
    sigs = [s for s in (policy.get("signatures") or []) if isinstance(s, dict)]
    staged = sum(1 for s in sigs if s.get("performStaging") is True)
    enforced = sum(1 for s in sigs if s.get("performStaging") is False)
    if staged or enforced:
        return staged > enforced
    ss = policy.get("signature-settings") or policy.get("signatureSettings") or {}
    return bool(ss.get("signatureStaging") and ss.get("placeSignaturesInStaging"))


def _coverage(policy: dict, set_coverage: dict | None = None,
              named_coverage: dict | None = None,
              name_group_ids: dict | None = None) -> dict:
    """Resolve attack-type coverage from the signature-sets the policy enforces
    (block). `set_coverage` maps set-name -> {"types": {attack_type: count},
    "exactType": name|None} resolved from the set filters. A type is 'exact'
    when every enforcing set that covers it is that type's dedicated set; broad
    sets (Generic Detection, accuracy sets) cover the type but contribute no
    trustworthy count."""
    sc = set_coverage or {}
    blocking = [(s.get("name") or "").lower() for s in _enforced_sets(policy)]
    logonly = [(s.get("name") or "").lower() for s in _logonly_sets(policy)]
    names = blocking + logonly
    resolved = any(n in sc for n in names)
    types: dict[str, dict] = {}
    # Blocking sets first, then log-only. Per type we track whether a *blocking*
    # set covers it; a type covered only by a log-only (alarm) set is partial.
    for is_blocking, name_list in ((True, blocking), (False, logonly)):
        for n in name_list:
            entry = sc.get(n)
            if not entry:
                continue
            exact_type = entry.get("exactType")
            for at, cnt in (entry.get("types") or {}).items():
                t = types.setdefault(at, {"count": 0, "exact": True, "blocking": False})
                t["count"] += cnt
                if exact_type != at:          # contributed by a broad set
                    t["exact"] = False
                if is_blocking:
                    t["blocking"] = True
    return {
        "names": names,
        "blocking_names": blocking,
        "enforced_any": bool(names),
        "resolved": resolved,
        "types": types,
        "staged": _is_staged(policy),
        "named": named_coverage or {},
        "nameGroups": name_group_ids or {},
    }


# ── raw-policy violation enforcement (declarative blocking-settings shape) ──
def _violations_map(policy: dict) -> dict:
    bs = policy.get("blocking-settings") or policy.get("blockingSettings") or {}
    out = {}
    for v in bs.get("violations", []) or []:
        if isinstance(v, dict) and v.get("name"):
            out[v["name"]] = v
    return out


def _viol_enforced(vmap: dict, *names: str) -> bool:
    """True if any named violation is enforced — block or alarm on, or listed
    with no explicit flags (at policy default). Mirrors analyzer semantics."""
    for n in names:
        v = vmap.get(n)
        if v is None:
            continue
        if v.get("block") is True or v.get("alarm") is True:
            return True
        if "block" not in v and "alarm" not in v:
            return True
    return False


def _sig_covered(cov: dict, attack_type: str) -> tuple[bool, str]:
    if cov["broad"]:
        return True, "broad detection set"
    subs = SIG_TYPE_SETS.get(attack_type, [attack_type.lower()])
    for n in cov["names"]:
        if any(sub in n for sub in subs):
            return True, n
    return False, ""


# ── requirement evaluators: (req, policy, cov, avail, acks) -> (status, detail)
def _ev_sig_type(req, policy, cov, avail, acks):
    at = req["attack_type"]
    total = avail.get(at)
    if not cov["enforced_any"]:
        return "not", "No enforced signature set", {"available": total, "applied": 0, "staging": 0, "exact": True}
    if not cov["resolved"]:
        return "unknown", "Enforced set not in reference data — import/pull to measure", {"available": total}
    info = cov["types"].get(at)
    in_set = info["count"] if info else 0
    exact = bool(info and info["exact"])
    # Enforced sets overlap (e.g. "All Signatures" + an accuracy set), so the
    # per-set filter counts sum past the catalog. The number of this type's
    # signatures actually covered can't exceed the catalog total, so cap it —
    # otherwise Staging/Applied read higher than Total.
    if total is not None:
        in_set = min(in_set, total)
    if in_set <= 0:
        return "not", "Not covered by the enforced signature set(s)", {
            "available": total, "applied": 0, "staging": 0, "exact": exact}
    blocking = bool(info and info.get("blocking"))
    if not blocking:
        # Covered only by a set that logs (alarm) but does not block → partial.
        extras = {"available": total, "applied": 0, "staging": 0, "logOnly": in_set, "exact": exact}
        return "partial", f"Log only · {in_set} of {total if total is not None else '—'}", extras
    staged = cov["staged"]
    # Staging is policy-wide: when on, enforced signatures alarm but don't block.
    applied = 0 if staged else in_set
    staging = in_set if staged else 0
    extras = {"available": total, "applied": applied, "staging": staging, "exact": exact}
    detail = f"Applied {applied} · Staging {staging} · Total {total if total is not None else '—'}"
    if staged:
        return "partial", detail, extras
    return "fulfilled", detail, extras


def _ev_login_enforcement(req, policy, cov, avail, acks):
    # Login Enforcement is effective only when all three are present:
    #  - login pages (how a valid login is detected),
    #  - authenticated URLs (the URLs that require a prior login; wildcards ok),
    #  - the 'Login URL bypassed' (VIOL_LOGIN_URL_BYPASSED) violation blocking,
    #    which is what actually blocks access that skips the login page.
    le = policy.get("login-enforcement") or policy.get("loginEnforcement") or {}
    pages = [p for p in (policy.get("login-pages") or policy.get("loginPages") or [])
             if isinstance(p, dict)]
    auth_urls = [u for u in (le.get("authenticatedUrls") or le.get("authenticated-urls") or []) if u]
    blocking = (_violations_map(policy).get("VIOL_LOGIN_URL_BYPASSED") or {}).get("block") is True
    extras = {"loginPages": len(pages), "authenticatedUrls": len(auth_urls), "blocking": blocking}
    reasons = []
    if not pages:
        reasons.append("no login pages")
    if not auth_urls:
        reasons.append("no authenticated URLs")
    if not blocking:
        reasons.append("'Login URL bypassed' not blocking")
    if reasons:
        return "not", "; ".join(reasons), extras
    return ("fulfilled",
            f"Blocking · {len(pages)} login page(s), {len(auth_urls)} authenticated URL(s)", extras)


def _viol_mode(policy: dict, *names: str):
    """Status for a protection backed by one or more blocking-settings
    violations. Enforced (block or alarm) → fulfilled, naming the mode;
    present but off → not; absent → not."""
    vmap = _violations_map(policy)
    present = [n for n in names if n in vmap]
    if any((vmap.get(n) or {}).get("block") is True for n in names):
        return "fulfilled", "Blocking"
    if any((vmap.get(n) or {}).get("alarm") is True for n in names):
        return "fulfilled", "Alarm only (log)"
    return "not", ("Not enforced" if present else "Violation not present")


def _ev_asm_cookie_tampering(req, policy, cov, avail, acks):
    # Modified ASM cookie — the system verifies the ASM cookie was not tampered
    # with and blocks modified requests.
    return _viol_mode(policy, "VIOL_ASM_COOKIE_MODIFIED")


def _ev_session_hijacking(req, policy, cov, avail, acks):
    # ASM cookie hijacking — the ASM cookie was created in another session
    # (session-cookie consistency / Device-ID match).
    return _viol_mode(policy, "VIOL_ASM_COOKIE_HIJACKING")


# Per-source brute-force toggles (each a sub-object with an `enabled` flag).
_BF_TOGGLES = ("loginAttemptsFromTheSameIp", "loginAttemptsFromTheSameUser",
               "loginAttemptsFromTheSameDeviceId", "clientSideIntegrityBypassCriteria",
               "captchaBypassCriteria", "leakedCredentialsCriteria")


def _bf_config_enabled(cfg: dict) -> bool:
    """A brute-force config is 'enabled' when any of its detection methods is on."""
    if not isinstance(cfg, dict):
        return False
    for k in _BF_TOGGLES:
        sub = cfg.get(k)
        if isinstance(sub, dict) and sub.get("enabled") is True:
            return True
    dc = cfg.get("detectionCriteria")
    if isinstance(dc, dict) and (dc.get("detectDistributedBruteForceAttack") is True
                                 or dc.get("detectCredentialsStuffingAttack") is True):
        return True
    return False


def _bf_config_applies(cfg: dict) -> bool:
    """A config is actually applied when it protects all login pages
    (bruteForceProtectionForAllLoginPages) or targets a specific login URL
    (url). A default config with neither applies to nothing (schema)."""
    return (cfg.get("bruteForceProtectionForAllLoginPages") is True
            or bool(cfg.get("url")))


def _ev_brute_force(req, policy, cov, avail, acks):
    # Strict: VIOL_BRUTE_FORCE must be blocking, Brute Force Protection must be
    # enabled (a detection method on), AND the config must actually apply — to
    # all login pages, or to a specific login URL. A default config with
    # bruteForceProtectionForAllLoginPages=false and no url protects nothing.
    cfgs = [c for c in (policy.get("brute-force-attack-preventions")
                        or policy.get("bruteForceAttackPreventions") or [])
            if isinstance(c, dict)]
    enabled_cfgs = [c for c in cfgs if _bf_config_enabled(c)]
    active_cfgs = [c for c in enabled_cfgs if _bf_config_applies(c)]
    blocking = (_violations_map(policy).get("VIOL_BRUTE_FORCE") or {}).get("block") is True
    extras = {"bruteForceConfigs": len(cfgs), "bruteForceEnabled": len(enabled_cfgs),
              "bruteForceActive": len(active_cfgs), "blocking": blocking}
    reasons = []
    if not blocking:
        reasons.append("violation not blocking")
    if not active_cfgs:
        if not cfgs:
            reasons.append("not configured")
        elif not enabled_cfgs:
            reasons.append("protection not enabled")
        else:
            reasons.append("not applied to any login page")
    if reasons:
        return "not", "; ".join(reasons), extras
    return "fulfilled", f"Blocking · {len(active_cfgs)} config applied", extras


def _ev_disallowed_filetypes(req, policy, cov, avail, acks):
    # A disallowed file type is one with allowed=false (schema: filetypes[].allowed).
    # There is no type=="disallowed"; `type` is explicit|wildcard.
    ft = [f for f in (policy.get("filetypes") or policy.get("file-types") or [])
          if isinstance(f, dict) and f.get("allowed") is False]
    n = len(ft)
    names = ", ".join(str(f.get("name")) for f in ft[:5])
    detail = f"{n} disallowed file type{'' if n == 1 else 's'}" + (f" ({names})" if names else "")
    return ("fulfilled" if n else "not", detail)


def _ev_disallowed_urls(req, policy, cov, avail, acks):
    # A disallowed URL has isAllowed=false (schema: urls[].isAllowed).
    urls = [u for u in (policy.get("urls") or [])
            if isinstance(u, dict) and (u.get("isAllowed") is False or u.get("allowed") is False)]
    n = len(urls)
    names = ", ".join(str(u.get("name")) for u in urls[:5])
    detail = f"{n} disallowed URL{'' if n == 1 else 's'}" + (f" ({names})" if names else "")
    return ("fulfilled" if n else "not", detail)


def _data_guard(policy: dict) -> dict:
    return policy.get("data-guard") or policy.get("dataGuard") or {}


def _ev_data_guard(req, policy, cov, avail, acks):
    dg = _data_guard(policy)
    return ("fulfilled", "Enabled") if dg.get("enabled") else ("not", "Disabled")


def _ev_mask_credit_card(req, policy, cov, avail, acks):
    # Request-log CCN masking is general.maskCreditCardNumbersInRequest — a
    # distinct feature from Data Guard (which masks *responses*). It is
    # enabled by default in F5, so an absent flag counts as on; only an
    # explicit false is "not masked".
    g = policy.get("general") or {}
    ok = g.get("maskCreditCardNumbersInRequest") is not False
    return ("fulfilled", "Masked in request log") if ok else ("not", "Not masked")


def _count_masked(items, flag) -> int:
    return sum(1 for x in (items or []) if isinstance(x, dict) and x.get(flag) is True)


def _ev_masked_parameters(req, policy, cov, avail, acks):
    # Two sources, unioned by name so a parameter listed in both counts once:
    #  1. individual parameter config — parameters[].sensitiveParameter = true
    #     (a sensitive parameter is masked in logs / the UI);
    #  2. the dedicated sensitive-parameters[] section (by name).
    names = {p.get("name") for p in (policy.get("parameters") or [])
             if isinstance(p, dict) and p.get("sensitiveParameter") is True}
    names |= {s.get("name") for s in (policy.get("sensitive-parameters") or [])
              if isinstance(s, dict) and s.get("name")}
    names.discard(None)
    n = len(names)
    return ("fulfilled" if n else "not", f"{n} Masked")


def _ev_masked_headers(req, policy, cov, avail, acks):
    n = _count_masked(policy.get("headers"), "maskValueInLogs")
    return ("fulfilled" if n else "not", f"{n} Masked")


def _ev_masked_cookies(req, policy, cov, avail, acks):
    n = _count_masked(policy.get("cookies"), "maskValueInLogs")
    return ("fulfilled" if n else "not", f"{n} Masked")


# The evasion sub-techniques we require to be enabled (schema enum names under
# blocking-settings.evasions[].description).
EVASION_REQUIRED = ["Bad unescape", "Bare byte decoding", "IIS backslashes"]


def _evasion_enabled(policy: dict, name: str) -> bool:
    """True if the named evasion sub-technique is enabled. A sub-technique is
    enabled unless it is explicitly listed with enabled=false; one not listed
    sits at the F5 default (enabled)."""
    bs = policy.get("blocking-settings") or policy.get("blockingSettings") or {}
    for e in bs.get("evasions", []) or []:
        if isinstance(e, dict) and (e.get("description") or "").strip().lower() == name.lower():
            return e.get("enabled") is not False
    return True


def _ev_evasion(req, policy, cov, avail, acks):
    # Strict: the 'Evasion technique detected' (VIOL_EVASION) violation must be
    # blocking, and the required sub-techniques (Bad unescape, Bare byte
    # decoding, IIS backslashes) must be enabled. Alarm-only is log (partial),
    # a disabled sub-technique is partial, neither enforced is not.
    vmap = _violations_map(policy)
    v = vmap.get("VIOL_EVASION") or {}
    block = v.get("block") is True
    missing = [n for n in EVASION_REQUIRED if not _evasion_enabled(policy, n)]
    enabled = [n for n in EVASION_REQUIRED if n not in missing]
    extras = {"evasionEnabled": enabled, "evasionDisabled": missing}
    if block and not missing:
        return "fulfilled", f"Blocking · {len(enabled)} of {len(EVASION_REQUIRED)} techniques enabled", extras
    reasons = []
    if not block:
        reasons.append("not blocking" if "VIOL_EVASION" in vmap else "violation not enforced")
    if missing:
        reasons.append(f"{len(missing)} technique(s) disabled")
    return "not", "; ".join(reasons), extras


def _ev_param_metachars(req, policy, cov, avail, acks):
    # Disallowed metacharacters apply to both parameter names and values —
    # two separate violations. Both enforced → fulfilled; one → partial.
    vmap = _violations_map(policy)
    name_ok = _viol_enforced(vmap, "VIOL_PARAMETER_NAME_METACHAR")
    value_ok = _viol_enforced(vmap, "VIOL_PARAMETER_VALUE_METACHAR")
    if name_ok and value_ok:
        return "fulfilled", "Enforced (names & values)"
    if name_ok or value_ok:
        return "partial", f"Enforced ({'names' if name_ok else 'values'} only)"
    return "not", "Not enforced"


def _ev_httponly_cookies(req, policy, cov, avail, acks):
    n = _count_masked(policy.get("cookies"), "accessibleOnlyThroughTheHttpProtocol")
    return ("fulfilled" if n else "not", f"{n} Enforced")


def _ev_signature(req, policy, cov, avail, acks):
    """A specific signature — matched by signatureId (preferred) or name against
    the policy's enumerated signatures, then falling back to enforced-set
    membership from the reference catalogue."""
    want_id = str(req["signature_id"]) if req.get("signature_id") is not None else None
    want = (req.get("signature_name") or req["label"]).lower()
    staged = cov["staged"]
    # Explicit per-signature entry in the policy wins — match by id or name, and
    # use that signature's own performStaging (more precise than the policy-wide
    # staging flag).
    for s in policy.get("signatures") or []:
        if not isinstance(s, dict):
            continue
        sid = str(s.get("signatureId")) if s.get("signatureId") is not None else None
        nm = (s.get("name") or (s.get("signatureReference") or {}).get("name") or "").lower()
        if (want_id and sid == want_id) or (not want_id and nm and nm == want):
            if s.get("enabled") is False:
                return "not", "Explicitly disabled", {"available": 1, "exact": True}
            st = s.get("performStaging") is True
            applied, staging = (0, 1) if st else (1, 0)
            return ("partial" if st else "fulfilled",
                    f"Enabled · Applied {applied} · Staging {staging}",
                    {"applied": applied, "staging": staging, "available": 1, "exact": True})
    nc = cov["named"].get(want)
    if not nc or not nc.get("found"):
        return "not", "Signature not in reference data", {}
    if not cov["enforced_any"]:
        return "not", "No enforced signature set", {"available": nc.get("available")}
    if not nc.get("inSet"):
        return "not", "Not in the enforced signature set(s)", {"available": nc.get("available")}
    applied, staging = (0, 1) if staged else (1, 0)
    extras = {"applied": applied, "staging": staging, "available": nc.get("available"), "exact": True}
    return ("partial" if staged else "fulfilled", f"Applied {applied} · Staging {staging}", extras)


def _ev_sig_name_group(req, policy, cov, avail, acks):
    """Coverage for a cross-cutting signature group that F5 doesn't model as an
    attack type (e.g. SSRF). The group's catalogue ids come in via
    cov['nameGroups']; enforcement is read from the policy's enumerated
    signatures (enabled + not staging)."""
    key = req.get("name_group")
    ids = (cov.get("nameGroups") or {}).get(key) or set()
    available = len(ids)
    if not ids:
        return "unknown", "No reference data — import/pull to measure", {}
    polsigs = {str(s.get("signatureId")): s for s in (policy.get("signatures") or [])
               if isinstance(s, dict) and s.get("signatureId") is not None}
    applied = staging = 0
    for sid in ids:
        s = polsigs.get(sid)
        if not s or s.get("enabled") is False:
            continue
        if s.get("performStaging") is True:
            staging += 1
        else:
            applied += 1
    extras = {"applied": applied, "staging": staging, "available": available, "exact": True}
    if applied == 0 and staging == 0:
        return "not", f"0 of {available} signatures enforced", extras
    if applied == 0:
        return "partial", f"{staging} of {available} in staging", extras
    detail = f"{applied} of {available} enforced" + (f" · {staging} staging" if staging else "")
    status = "fulfilled" if applied >= available else "partial"
    return status, detail, extras


def _ev_xml_dtd(req, policy, cov, avail, acks):
    profs = policy.get("xml-profiles") or policy.get("xmlProfiles") or []
    n = sum(1 for x in profs if isinstance(x, dict)
            and (x.get("defenseAttributes") or {}).get("allowDTDs") is False)
    return ("fulfilled", f"{n} profile(s) disallow DTDs") if n else ("not", "No XML profile disallows DTDs")


def _ev_attack_signatures(req, policy, cov, avail, acks):
    sets = policy.get("signature-sets") or policy.get("signatureSets") or []
    total = len([s for s in sets if isinstance(s, dict)])
    blocking = len(_enforced_sets(policy))
    logonly = len(_logonly_sets(policy))
    extras = {"signatureSets": total, "blockingSets": blocking, "logOnlySets": logonly}
    ok = blocking > 0 or _viol_enforced(_violations_map(policy), "VIOL_ATTACK_SIGNATURE")
    if not ok:
        return "not", (f"{total} signature-set{'' if total == 1 else 's'}, none blocking"
                       if total else "No signature-sets"), extras
    detail = f"{total} signature-set{'' if total == 1 else 's'} · {blocking} blocking"
    if logonly:
        detail += f" · {logonly} log-only"
    return "fulfilled", detail, extras


def _ev_server_technologies(req, policy, cov, avail, acks):
    st = policy.get("server-technologies") or policy.get("serverTechnologies") or []
    n = len([x for x in st if isinstance(x, dict)])
    return ("fulfilled" if n else "not",
            f"{n} server technolog{'y' if n == 1 else 'ies'}", {"serverTechnologies": n})


def _ev_allowed_methods(req, policy, cov, avail, acks):
    methods = [m for m in (policy.get("methods") or []) if isinstance(m, dict)]
    n = len(methods)
    extras = {"methods": n}
    ok = n > 0 or _viol_enforced(_violations_map(policy), "VIOL_METHOD")
    if not ok:
        return "not", "Not enforced", extras
    return "fulfilled", f"{n} allowed method{'' if n == 1 else 's'}", extras


def _ev_samesite_cookies(req, policy, cov, avail, acks):
    vals = {"strict", "lax"}
    n = sum(1 for c in (policy.get("cookies") or []) if isinstance(c, dict)
            and (c.get("insertSameSiteAttribute") or "").lower() in vals)
    return ("fulfilled" if n else "not", f"{n} Enforced")


def _ev_cors_urls(req, policy, cov, avail, acks):
    # CORS is enabled on a URL when html5CrossOriginRequestsEnforcement.
    # enforcementMode is anything other than 'disabled' (enum: disabled,
    # enforce, remove-all-headers, replace-headers).
    n = 0
    for u in policy.get("urls") or []:
        if not isinstance(u, dict):
            continue
        c = u.get("html5CrossOriginRequestsEnforcement")
        if isinstance(c, dict) and (c.get("enforcementMode") or "disabled").lower() != "disabled":
            n += 1
    return ("fulfilled" if n else "not", f"{n} URL{'' if n == 1 else 's'}", {"corsUrls": n})


def _ev_clickjacking_urls(req, policy, cov, avail, acks):
    # Clickjacking protection adds the X-Frame-Options header — toggled per URL
    # by clickjackingProtection (boolean). The allowRenderingInFrames enum only
    # refines the condition once protection is on.
    n = sum(1 for u in (policy.get("urls") or []) if isinstance(u, dict)
            and u.get("clickjackingProtection") is True)
    return ("fulfilled" if n else "not", f"{n} URL{'' if n == 1 else 's'}", {"clickjackingUrls": n})


def _ev_ssrf_hosts(req, policy, cov, avail, acks):
    hosts = policy.get("ssrf-hosts") or policy.get("ssrfHosts") or []
    n = sum(1 for h in hosts if isinstance(h, dict) and h.get("host"))
    return ("fulfilled" if n else "not", f"{n} Hosts")


def _ev_uri_autodetect_params(req, policy, cov, avail, acks):
    """Parameters SSRF inspection targets: URI-typed or auto-detected."""
    n = sum(1 for p in (policy.get("parameters") or []) if isinstance(p, dict)
            and ((p.get("dataType") or "").lower() == "uri"
                 or (p.get("valueType") or "").lower() == "auto-detect"))
    return ("fulfilled" if n else "not", f"{n} Parameters")


def _ev_enforced_cookies(req, policy, cov, avail, acks):
    n = sum(1 for c in (policy.get("cookies") or []) if isinstance(c, dict)
            and ((c.get("enforcementType") or "").lower() == "enforce"
                 or (c.get("cookieType") or "").lower() == "enforced"))
    return ("fulfilled" if n else "not", f"{n} Enforced")


def _ev_user_ack(req, policy, cov, avail, acks):
    accepted = bool((acks or {}).get(req["key"]))
    return ("fulfilled", "Accepted") if accepted else ("not", "Not accepted")


EVALUATORS = {
    "sig_type": _ev_sig_type,
    "sig_name_group": _ev_sig_name_group,
    "login_enforcement": _ev_login_enforcement,
    "asm_cookie_tampering": _ev_asm_cookie_tampering,
    "session_hijacking": _ev_session_hijacking,
    "brute_force": _ev_brute_force,
    "disallowed_filetypes": _ev_disallowed_filetypes,
    "disallowed_urls": _ev_disallowed_urls,
    "data_guard": _ev_data_guard,
    "mask_credit_card": _ev_mask_credit_card,
    "masked_parameters": _ev_masked_parameters,
    "masked_headers": _ev_masked_headers,
    "masked_cookies": _ev_masked_cookies,
    "evasion": _ev_evasion,
    "param_metachars": _ev_param_metachars,
    "httponly_cookies": _ev_httponly_cookies,
    "signature": _ev_signature,
    "xml_dtd": _ev_xml_dtd,
    "attack_signatures": _ev_attack_signatures,
    "server_technologies": _ev_server_technologies,
    "allowed_methods": _ev_allowed_methods,
    "samesite_cookies": _ev_samesite_cookies,
    "cors_urls": _ev_cors_urls,
    "clickjacking_urls": _ev_clickjacking_urls,
    "enforced_cookies": _ev_enforced_cookies,
    "ssrf_hosts": _ev_ssrf_hosts,
    "uri_autodetect_params": _ev_uri_autodetect_params,
    "user_ack": _ev_user_ack,
}


# ── scoring ───────────────────────────────────────────────────────────────
def _req_weight(status: str) -> float:
    return {"fulfilled": 1.0, "partial": 0.5}.get(status, 0.0)


def evaluate(raw: dict, available_counts: dict | None = None,
             acks: dict | None = None, set_coverage: dict | None = None,
             named_coverage: dict | None = None,
             name_group_ids: dict | None = None) -> dict:
    """Full evaluation: overall score + per-category requirements/details.

    Attack-type coverage is measured from the enforced signature-sets, resolved
    from their F5 filters (`set_coverage`). A requirement we can't resolve
    (enforced set absent from the reference data) has status 'unknown' and is
    excluded from the score denominator."""
    policy = raw.get("policy", raw) if isinstance(raw, dict) else {}
    cov = _coverage(policy, set_coverage, named_coverage, name_group_ids)
    avail = available_counts or {}
    acks = acks or {}

    cats = []
    for c in CATEGORIES:
        reqs = []
        for r in c["requirements"]:
            res = EVALUATORS[r["type"]](r, policy, cov, avail, acks)
            status, detail = res[0], res[1]
            extras = res[2] if len(res) > 2 else {}
            item = {"group": r["group"], "label": r["label"], "status": status, "detail": detail}
            item.update(extras)
            if r.get("key"):            # user-acknowledged requirement (Accept)
                item["ackKey"] = r["key"]
            else:
                # Any derived requirement can be manually overridden to "met"
                # (e.g. the control is handled outside this policy). The override
                # is a per-policy ack keyed by category + label.
                ov = f"override:{c['id']}:{r['label']}"
                item["ovKey"] = ov
                if (acks or {}).get(ov):
                    item["overridden"] = True
                    item["baseStatus"] = status
                    item["baseDetail"] = detail
                    item["status"] = "fulfilled"
            reqs.append(item)
        measurable = [r for r in reqs if r["status"] != "unknown"]
        score = round(100 * sum(_req_weight(r["status"]) for r in measurable) / len(measurable)) if measurable else None
        cats.append({
            "id": c["id"], "name": c["name"], "description": c["description"],
            "score": score, "staged": any(r.get("staged") for r in reqs),
            "unknown": len(reqs) - len(measurable), "requirements": reqs,
        })

    numeric = [c["score"] for c in cats if isinstance(c["score"], int)]
    overall = round(sum(numeric) / len(numeric)) if numeric else None
    return {"score": overall, "defined": len(cats), "total_categories": 10, "categories": cats}


def summary(raw: dict, available_counts: dict | None = None,
            acks: dict | None = None, set_coverage: dict | None = None,
            named_coverage: dict | None = None,
            name_group_ids: dict | None = None) -> dict:
    """Compact form stored on the policy analysis (no per-requirement detail)."""
    full = evaluate(raw, available_counts, acks, set_coverage, named_coverage, name_group_ids)
    return {
        "score": full["score"],
        "defined": full["defined"],
        "total_categories": full["total_categories"],
        "staged": any(c["staged"] for c in full["categories"]),
        "categories": [{"id": c["id"], "name": c["name"], "score": c["score"],
                        "staged": c["staged"], "unknown": c["unknown"]}
                       for c in full["categories"]],
    }
