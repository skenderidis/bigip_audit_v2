"""F5 iHealth QKView Analyzer client — pulls a device's configuration and
diagnostics for a given QKView ID and assembles the merged `results` dict the
LTM analyzer consumes.

Ported from skenderidis/bigip-audit (create_ltm.py), rewritten on httpx (the
backend's HTTP client) and refactored from ~40 near-identical `get_*` functions
into one declarative command→parser map. The parsers live in `ltm_analyzer`.

The pull is synchronous and slow (many authenticated requests with retry), so
callers should run `pull_qkview()` in a worker thread (e.g. asyncio.to_thread).
"""
from __future__ import annotations

import base64
import hashlib
import re
import time

import httpx

from app.services import ltm_analyzer as la

TOKEN_URL = "https://identity.account.f5.com/oauth2/ausp95ykc80HOU7SQ357/v1/token"


# ---------------------------------------------------------------------------
# auth + low-level fetch
# ---------------------------------------------------------------------------
def get_token(client_id: str, client_secret: str) -> str:
    resp = httpx.post(
        TOKEN_URL,
        headers={"Accept": "application/json",
                 "Content-Type": "application/x-www-form-urlencoded"},
        data={"grant_type": "client_credentials", "scope": "ihealth"},
        auth=(client_id, client_secret),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json().get("access_token")


def _decode_output(b64text: str) -> str:
    cleaned = re.sub(r"[%\n]", "", b64text or "")
    pad = (-len(cleaned)) % 4
    if pad:
        cleaned += "=" * pad
    return base64.b64decode(cleaned).decode("utf-8", errors="ignore")


class IHealthClient:
    def __init__(self, qkview_id: str, token: str):
        self.qkview_id = str(qkview_id)
        self.headers = {"Authorization": f"Bearer {token}",
                        "Accept": "application/vnd.f5.ihealth.api+json"}
        self.command_base = f"https://ihealth-api.f5.com/qkview-analyzer/api/qkviews/{self.qkview_id}/commands/"
        self.diag_url = f"https://ihealth2-api.f5.com/qkview-analyzer/api/qkviews/{self.qkview_id}/diagnostics"
        self.files_url = f"https://ihealth2-api.f5.com/qkview-analyzer/api/qkviews/{self.qkview_id}/files"

    def _get(self, url: str, timeout: int = 60, retries: int = 3, delay: int = 5):
        for attempt in range(1, retries + 1):
            try:
                r = httpx.get(url, headers=self.headers, timeout=timeout)
                if r.status_code in (200, 404):
                    return r
            except Exception:
                pass
            time.sleep(delay)
        return None

    def command_text(self, command: str) -> str | None:
        """Fetch a command's base64 output and decode it to text."""
        url = self.command_base + hashlib.sha1(command.encode("utf-8")).hexdigest()
        r = self._get(url)
        if not r or r.status_code == 404:
            return None
        try:
            data = r.json()
        except Exception:
            return None
        output = data[0].get("output") if isinstance(data, list) and data and isinstance(data[0], dict) else None
        if not output:
            return None
        try:
            return _decode_output(output)
        except Exception:
            return None

    def file_text(self, path: str) -> str | None:
        """Fetch a raw config file (e.g. bigip.conf) by its path."""
        b64 = base64.b64encode(path.encode("utf-8")).decode("utf-8").rstrip("=")
        r = self._get(self.files_url + "/" + b64)
        if not r or r.status_code == 404:
            return None
        return r.text

    def diagnostics(self) -> dict:
        r = self._get(self.diag_url)
        if not r or r.status_code != 200:
            return {}
        try:
            return r.json()
        except Exception:
            return {}


# ---------------------------------------------------------------------------
# command → parser map (key in results : (tmsh command, parser(decoded)))
# ---------------------------------------------------------------------------
_COMMANDS = {
    "web_acceleration":       ("list /ltm profile web-acceleration all-properties", lambda t: la.parse_profiles(t, "ltm profile web-acceleration")),
    "udp_profiles":           ("list /ltm profile udp all-properties",              lambda t: la.parse_profiles(t, "ltm profile udp")),
    "tcp_profiles":           ("list /ltm profile tcp all-properties",              lambda t: la.parse_profiles(t, "ltm profile tcp")),
    "server_ssl":             ("list /ltm profile server-ssl all-properties",       lambda t: la.parse_profiles(t, "ltm profile server-ssl")),
    "http2":                  ("list /ltm profile http2 all-properties",            lambda t: la.parse_profiles(t, "ltm profile http2")),
    "compression":            ("list /ltm profile http-compression all-properties", lambda t: la.parse_profiles(t, "ltm profile http-compression")),
    "http":                   ("list /ltm profile http all-properties",             la.parse_http_profiles),
    "client_ssl":             ("list /ltm profile client-ssl all-properties",       la.parse_client_ssl_profiles),
    "sys_hardware":           ("show /sys hardware",                                la.parse_sys_hardware),
    "sync_status":            ("show /cm sync-status",                              la.parse_sync_status),
    "ssl_certs":              ("Public SSL Certificates",                           la.parse_ssl_certificates),
    "sys_provision":          ("list /sys provision all-properties",                la.parse_sys_provision),
    "ltm_pools":              ("list /ltm pool all-properties",                     la.parse_ltm_pools),
    "ltm_virtuals":           ("list /ltm virtual all-properties",                  la.parse_ltm_virtuals),
    "ltm_policies":           ("list /ltm policy all-properties",                   la.parse_ltm_policies),
    "self_ips":               ("show running-config /net self",                     la.parse_self_ips),
    "syslog":                 ("list /sys syslog all-properties",                   la.parse_syslog),
    "show_cm_device":         ("show /cm device",                                   la.parse_show_cm_device),
    "list_cm_device":         ("list /cm device",                                   la.parse_list_cm_device),
    "icmp_monitors":          ("list /ltm monitor icmp all-properties",             la.parse_other_monitors),
    "udp_monitors":           ("list /ltm monitor udp all-properties",              la.parse_other_monitors),
    "tcp_monitors":           ("list /ltm monitor tcp all-properties",              la.parse_other_monitors),
    "tcp_half_open_monitors": ("list /ltm monitor tcp-half-open all-properties",    la.parse_other_monitors),
    "http_monitors":          ("list /ltm monitor http all-properties",             la.parse_http_monitors),
    "https_monitors":         ("list /ltm monitor https all-properties",            la.parse_http_monitors),
    "df_h_file":              ("df -h",                                             la.parse_df_h_file),
    "license_file":           ("show /sys license detail",                          la.parse_license_file),
    "http_profile_global":    ("show /ltm profile http global",                     la.parse_http_profile_global),
    "irule_names":            ("list /ltm rule",                                    lambda t: la.parse_profiles(t, "ltm rule")),
    "client_ssl_stats":       ("show /ltm profile client-ssl global",               la.parse_client_ssl_stats),
    "tmctl_stats":            ("tmctl (global stats)",                              la.parse_tmctl_stats),
    "host_info":              ("show /sys host-info global",                        la.parse_host_info),
    "sysdb_file":             ("list /sys db all-properties (non-default values)",  la.parse_sysdb_file),
    "version_file":           ("show /sys version detail",                          la.parse_version_file),
    "arp_table":              ("show /net arp",                                     la.parse_arp),
    "vs_traffic":             ("Virtual Server Traffic",                            la.parse_vs_stats),
    "date_info":              ("date",                                              la.parse_date),
}


# ---------------------------------------------------------------------------
# partitions + security (DoS / Bot / ASM) profiles from bigip.conf
# ---------------------------------------------------------------------------
def _partitions(c: IHealthClient) -> list[str]:
    text = c.command_text("list /auth partition all-properties")
    parts = re.findall(r"\bauth\s+partition\s+([^\s]+)\s*\{", text or "")
    return parts or ["Common"]


def _security_profiles(c: IHealthClient):
    """Collect DoS / Bot-defense / ASM profiles from every partition's
    bigip.conf. Returns name lists (dos, bot, asm) plus full config blocks for
    DoS and Bot (needed for the Bot/DDoS audit checks)."""
    dos, bot, asm = [], [], []
    dos_profiles, bot_profiles = [], []
    for partition in _partitions(c):
        path = "config/bigip.conf" if partition == "Common" else f"config/partitions/{partition}/bigip.conf"
        text = c.file_text(path)
        if not text:
            continue
        dos.extend(la.parse_profiles(text, "security dos profile"))
        bot.extend(la.parse_profiles(text, "security bot-defense profile"))
        asm.extend(la.parse_profiles(text, "asm policy"))
        for b in la.parse_profile_blocks(text, "security dos profile"):
            b["partition"] = partition
            dos_profiles.append(b)
        for b in la.parse_profile_blocks(text, "security bot-defense profile"):
            b["partition"] = partition
            bot_profiles.append(b)
    return dos, bot, asm, dos_profiles, bot_profiles


# ---------------------------------------------------------------------------
# orchestration
# ---------------------------------------------------------------------------
def pull_qkview(qkview_id: str, client_id: str, client_secret: str,
                progress=None) -> tuple[dict, dict]:
    """Authenticate, pull every command/file for the QKView, and assemble the
    merged `results` dict + raw diagnostics. Returns (results, diagnostics).

    `progress`, if given, is called as progress(label, i, n) before each
    individual iHealth call so the caller can surface live step-by-step status
    (label is the actual tmsh command where there is one). It runs in this
    worker thread, so a caller on an event loop must marshal it back itself."""
    # total discrete calls: auth + every command + interface + irule + security + summary
    total = 1 + len(_COMMANDS) + 4
    _i = 0

    def _step(label: str):
        nonlocal _i
        _i += 1
        if progress:
            try:
                progress(label, _i, total)
            except Exception:
                pass

    _step("Authenticating to F5 iHealth")
    token = get_token(client_id, client_secret)
    c = IHealthClient(qkview_id, token)

    results: dict = {}
    for key, (command, parser) in _COMMANDS.items():
        _step(command)
        text = c.command_text(command)
        try:
            results[key] = parser(text) if text else None
        except Exception:
            results[key] = None

    # interface errors: per-interface + summary
    _step("show /net interface all-properties -hidden")
    iface_text = c.command_text("show /net interface all-properties -hidden")
    if iface_text:
        per_iface = la.parse_interface_table(iface_text)
        results["interface_errors"] = {"interfaces": per_iface,
                                       "summary": la.build_interface_summary(per_iface)}
    else:
        results["interface_errors"] = {"interfaces": {}, "summary": {}}

    # iRule stats + failures (one command → two outputs)
    _step("show /ltm rule all")
    rule_text = c.command_text("show /ltm rule all")
    if rule_text:
        stats, failures = la.parse_failures_execs_by_event(rule_text)
    else:
        stats, failures = {}, {}
    results["irule_stats"] = stats
    results["irule_failures"] = failures

    # security (DoS / Bot / ASM)
    _step("Reading security profiles from bigip.conf (DoS / Bot)")
    dos, bot, asm, dos_profiles, bot_profiles = _security_profiles(c)
    results["dos"] = dos
    results["bot"] = bot
    results["asm"] = asm
    results["dos_profiles"] = dos_profiles
    results["bot_profiles"] = bot_profiles

    # per-VS profile attachment summary (ASM resolved via LTM traffic policies)
    _step("Building virtual-server profile summary")
    vdetails, vsum = la.build_vs_summary(
        results.get("ltm_virtuals") or [], dos, bot,
        results.get("tcp_profiles") or [], results.get("udp_profiles") or [],
        results.get("http") or [], results.get("http2") or [],
        results.get("compression") or [], results.get("client_ssl") or [],
        results.get("server_ssl") or [], results.get("web_acceleration") or [],
        results.get("ltm_policies") or [],
    )
    results["virtual_details"] = vdetails
    results["virtual_summary"] = vsum
    results["asm_mapping"] = la.build_asm_mapping(
        results.get("ltm_virtuals") or [], results.get("ltm_policies") or [])

    return results, c.diagnostics()
