import os
import datetime
import re
import json
import html
from pathlib import Path
from collections import defaultdict


def dict_to_list(problems_dict: dict) -> list:
    """
    Convert problems_found = {key: {...}} into a list of dicts,
    keeping the key as 'name' in each item.
    """
    result = []
    for key, value in problems_dict.items():
        entry = value.copy()     # avoid modifying original dict
        entry["name"] = key      # keep the key
        result.append(entry)
    return result


def parse_vs_stats(text):
    """
    Parse BIG-IP virtual server statistics table output.

    Only lines starting with '/' are considered valid VS entries.
    """
    results = []

    lines = text.splitlines()

    for line in lines:
        line = line.strip()

        # Only real VS entries start with '/'
        if not line.startswith("/"):
            continue

        parts = line.split()

        # First column is the VS name, remaining are counters
        name = parts[0]
        values = parts[1:]

        if len(values) != 8:
            # Defensive: skip malformed rows
            continue

        results.append({
            "virtual": name,
            "clientside_bits_in": values[0],
            "clientside_bits_out": values[1],
            "clientside_packets_in": values[2],
            "clientside_packets_out": values[3],
            "clientside_current_connections": values[4],
            "clientside_total_connections": values[5],
            "total_requests": values[6],
            "cpu_usage_ratio_1min": values[7],
        })

    return results

def get_field(block: str, key: str):
    """
    Extract simple 'key value' lines, either unquoted or quoted.
    """
    # Unquoted
    m = re.search(rf'\b{re.escape(key)}\s+([^\s{{}}"]+)\b', block, re.IGNORECASE)
    if m:
        return m.group(1)

    # Quoted
    m = re.search(rf'\b{re.escape(key)}\s+"([^"]+)"', block, re.IGNORECASE)
    if m:
        return m.group(1)

    return None

def parse_host_info(text):
    data = {
        "cpu_count": None,
        "active_cpu_count": None,
        "memory_total": None,
        "memory_used": None
    }

    for line in text.splitlines():
        line = line.strip()

        # CPU Count
        if line.startswith("CPU Count"):
            m = re.search(r"CPU Count\s+(\d+)", line)
            if m:
                data["cpu_count"] = int(m.group(1))
        elif line.startswith("Active CPU Count"):
            m = re.search(r"Active CPU Count\s+(\d+)", line)
            if m:
                data["active_cpu_count"] = int(m.group(1))

        # Memory
        elif line.startswith("Total"):
            m = re.search(r"Total\s+([\d.]+\w?)", line)
            if m:
                data["memory_total"] = m.group(1)
        elif line.startswith("Used"):
            m = re.search(r"Used\s+([\d.]+\w?)", line)
            if m:
                data["memory_used"] = m.group(1)

    return data

def parse_sysdb_file(text):
    
    TARGETS = [
        "dns.nameservers",
        "failover.activetime",
        "failover.state",
        "hostname",
        "ntp.servers",
        "ntp.timezone",
        "password.maxloginfailures",
        "password.minlen",
        "password.maxdays",
        "password.mindays",
        "password.remember",
        "password.ucredit",
        "password.lcredit",
        "password.dcredit",
        "service.httpd.allow",
        "service.snmp.allow",
        "service.ssh.allow",
        "provision.tmmcountactual",
        "provisioned.memory.gtm",
        "provisioned.memory.asm",
        "provisioned.memory.asm.host",
        "provisioned.memory.apm",
        "provisioned.memory.apm.host",
        "provisioned.memory.avr",
        "provisioned.memory.avr.host",                
        "provisioned.memory.fps",
        "provisioned.memory.fps.host",
        "provisioned.memory.host",
        "provisioned.memory.tmos",
        "provisioned.memory.tmos.host",
        "provisioned.memory.ui"
   ]

    result = {k: None for k in TARGETS}
    text

    # --- First pass: table lines (Variable ... Value ... Default)
    table_pattern = re.compile(r'^(\S+)\s{2,}(.+?)\s{2,}\S+',re.MULTILINE)

    for match in table_pattern.finditer(text):
        var, val = match.groups()
        if var in result:
            result[var] = val

    # --- Second pass: sys db blocks (sys db var { value "X" ... })
    for key in result.keys():
        if result[key] is not None:
            continue  # already found
        # match sys db <key> { ... value "SOMETHING" ... }
        block_pattern = re.compile(
            rf"sys db {re.escape(key)} .*?value\s+&quot;([^&]+?)&quot;",
            re.IGNORECASE | re.DOTALL)
        m = block_pattern.search(text)
        if m:
            result[key] = m.group(1).strip()

    return result

def parse_version_file(text):
    
    FIELDS = {"Version", "Build", "Edition", "Date"}
    result = {k: None for k in FIELDS}

    lines = text.splitlines()

    in_main = False
    for line in lines:
        # Detect start of "Main Package" section
        if line.strip().lower() == "main package":
            in_main = True
            continue

        # If we were in Main Package, detect section end on a new non-indented header
        if in_main:
            if line and not line.startswith(" "):  # new top-level header like "Kernel"
                in_main = False

        if not in_main:
            continue

        # Lines inside Main Package look like: "  Version     17.1.2.1"
        m = re.match(r"^\s*(Version|Build|Edition|Date)\s+(.+?)\s*$", line)
        if m:
            key, val = m.group(1), m.group(2)
            result[key] = val

    return result

def parse_rst_cause(text):
    data = {}
    for line in text.splitlines():
        line = line.strip()
        # Match "MetricName   Number"
        m = re.match(r"(.+?)\s+(\d+)$", line)
        if m:
            cause = m.group(1).strip()
            count = int(m.group(2))
            data[cause] = count

    total = sum(data.values()) if data else 0

    return {
        "rst_cause_summary": {
            **data,
            "total_resets": total
        }
    }

def parse_arp(text):
    total = 0
    incomplete = 0

    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("Name") or line.startswith("-"):
            continue

        parts = line.split()
        if len(parts) < 6:
            continue

        total += 1
        if "incomplete" in line.lower():
            incomplete += 1

    return {
        "arp_summary": {
            "total_entries": total,
            "incomplete_entries": incomplete
        }
    }

def parse_date(text):
    """Reads the first non-empty line and returns it as date string."""
    for line in text.splitlines():
        line = line.strip()
        if line:
            return line
    return None

def parse_tmctl_stats(text):

    TARGETS = [
        "free_ram",
        "free_swap",
        "tmm_free_ram",
        "tmm_total_ram",
        "tmm_used_ram",
        "total_ram",
        "total_swap",
        "used_ram",
        "used_swap",
        "other_free_ram",
        "other_total_ram",
        "other_used_ram"
    ]

    data = {key: None for key in TARGETS}
    for line in text.splitlines():
        line = line.strip()
        # Only match lines like "free_ram = 123456"
        m = re.match(r"([a-zA-Z0-9_]+)\s*=\s*([0-9]+)", line)
        if not m:
            continue
        key, val = m.groups()
        if key in data:
            data[key] = int(val)
    return data

def parse_client_ssl_stats(text):

    SECTIONS_WANTED = {
        "Certificates/Handshakes",
        "Protocol",
        "Key Exchange Method"
    }

    VALUE_LINE_RE = re.compile(r'^\s+(.+?)\s+(\d+|none)\s*$', re.IGNORECASE)

    out: dict[str, dict] = {}
    current: str | None = None

    for raw in text.splitlines():
        line = raw.rstrip("\n")
        stripped = line.strip()

        if not stripped:
            continue
        # skip separators and the title
        if set(stripped) == {"-"} or stripped == "ClientSSL Profile":
            continue

        # Section header (non-indented)
        if not line.startswith(" "):
            current = stripped if stripped in SECTIONS_WANTED else None
            if current and current not in out:
                out[current] = {}
            continue

        # Metric line inside a wanted section
        if current:
            m = VALUE_LINE_RE.match(line)
            if not m:
                continue
            label, val = m.groups()
            label = label.strip()
            out[current][label] = None if val.lower() == "none" else int(val)

    return out

def parse_failures_execs_by_event(text):

    # Example header: "Ltm::Rule Event: /Common/foo:HTTP_REQUEST"
    RULE_HEADER_RE = re.compile(r'^Ltm::Rule Event:\s+(\S+):(\S+)\s*$', re.IGNORECASE)

    # Common metric lines inside a block
    FAILURES_RE = re.compile(r'^\s*Failures\s+([\d\.]+[KMGTP]?)\s*$', re.IGNORECASE)

    EXEC_RE = re.compile(r'^\s*Total\s+([\d\.]+[KMGTP]?)\s*$', re.IGNORECASE)


    per_rule_event = defaultdict(lambda: {"failures": 0, "total_executions": 0})
    current_key = None  # (rule_name, event_name)

    for raw in text.splitlines():
        line = raw.rstrip()

        m_header = RULE_HEADER_RE.match(line)
        if m_header:
            current_key = (m_header.group(1), m_header.group(2))  # (name, event)
            per_rule_event[current_key]  # ensure entry
            continue

        if current_key:
            m_fail = FAILURES_RE.match(line)
            if m_fail:
                per_rule_event[current_key]["failures"] += parse_human_int(m_fail.group(1))
                continue

            m_exec = EXEC_RE.match(line)
            if m_exec:
                per_rule_event[current_key]["total_executions"] += parse_human_int(m_exec.group(1))
                continue

    # Keep only those with failures > 0
    irules = []
    failures = []
    
    for (rule_name, event_name), stats in per_rule_event.items():
        if stats["failures"] > 0:
            failures.append({
                "name": rule_name,
                "event": event_name,
                "failures": humanize_int(stats["failures"]),
                "total_executions": humanize_int(stats["total_executions"])
                })
        irules.append({
            "name": rule_name,
            "event": event_name,
            "failures": humanize_int(stats["failures"]),
            "total_executions": humanize_int(stats["total_executions"])
            })
    return irules, failures

def parse_http_profile_global(text):
    sections = {}
    current_section = None

    for raw in text.splitlines():
        line = raw.rstrip()

        # Skip separators and empty lines
        if not line.strip():
            continue
        if set(line.strip()) == {"-"}:
            continue
        if line.strip() == "HTTP Profile":
            continue

        # Section headers: "Requests", "Responses", "Response Size", "Miscellaneous"
        if not line.startswith(" ") and line.strip():
            current_section = line.strip()
            sections[current_section] = {}
            continue

        # Metric lines: "  Some Label        123"
        if current_section:
            m = re.match(r"^\s*(.+?)\s+(\d+)\s*$", line)
            if m:
                label = m.group(1).strip()
                value = int(m.group(2))
                sections[current_section][label] = value

    return {"http_profile_global": sections}

def parse_interface_table(text):
    results = {}

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        # Skip separator line of ====
        if set(line) == {"="}:
            continue

        # Split columns by 2+ spaces to keep values aligned with header
        parts = re.split(r"\s{2,}", line)
        # Need at least: Name, Interface Status, Mac, MTU, Bits In, Bits Out,
        # Pkts In, Pkts Out, Mcast In, Mcast Out, Errs In, Errs Out,
        # Drops In, Drops Out, Collisions (15 columns)
        if len(parts) < 15:
            continue

        name = parts[0]

        # Use helper that supports K/M/G suffixes
        try:
            # If you later want packets, you can uncomment these:
            pkts_in    = parse_human_int(parts[6])
            pkts_out   = parse_human_int(parts[7])
            errs_in    = parse_human_int(parts[10])
            errs_out   = parse_human_int(parts[11])
            drops_in   = parse_human_int(parts[12])
            drops_out  = parse_human_int(parts[13])
            collisions = parse_human_int(parts[14])
        except (ValueError, TypeError):
            continue

        # If any failed to parse, skip this row
        if None in (errs_in, errs_out, drops_in, drops_out, collisions):
            continue

        results[name] = {
            "packets_in": pkts_in,
            "packets_out": pkts_out,
            "packets_total": pkts_in + pkts_out,
            "errors_in": errs_in,
            "errors_out": errs_out,
            "errors_total": errs_in + errs_out,
            "drops_in": drops_in,
            "drops_out": drops_out,
            "drops_total": drops_in + drops_out,
            "collisions": collisions,
        }

    return results

def build_interface_summary(per_if: dict):
    summary = {
        "interfaces_count": len(per_if),
        "packets_in": 0,
        "packets_out": 0,
        "packets_total": 0,
        "errors_in": 0,
        "errors_out": 0,
        "errors_total": 0,
        "drops_in": 0,
        "drops_out": 0,
        "drops_total": 0,
        "collisions": 0,
    }

    for stats in per_if.values():
#        summary["packets_in"]    += stats.get("packets_in", 0)
#        summary["packets_out"]   += stats.get("packets_out", 0)
#        summary["packets_total"] += stats.get("packets_total", 0)
        summary["errors_in"]    += stats.get("errors_in", 0)
        summary["errors_out"]   += stats.get("errors_out", 0)
        summary["errors_total"] += stats.get("errors_total", 0)
        summary["drops_in"]     += stats.get("drops_in", 0)
        summary["drops_out"]    += stats.get("drops_out", 0)
        summary["drops_total"]  += stats.get("drops_total", 0)
        summary["collisions"]   += stats.get("collisions", 0)

    return summary

def parse_license_file(text):
    data = {
        "Service Check Date": None,
        "Active Modules": [],
        "Platform ID": None
    }

    lines = text.splitlines()
    in_active_modules = False

    for line in lines:
        stripped = line.strip()

        # Detect Service Check Date
        if stripped.lower().startswith("service check date"):
            m = re.search(r"service check date\s+([0-9/]+)", stripped, re.IGNORECASE)
            if m:
                data["Service Check Date"] = m.group(1)

        # Detect Platform ID
        elif stripped.lower().startswith("platform id"):
            m = re.search(r"platform id\s+(\S+)", stripped, re.IGNORECASE)
            if m:
                data["Platform ID"] = m.group(1)

        # Detect Active Modules section start
        elif stripped.lower().startswith("active modules"):
            in_active_modules = True
            continue

        # Detect end of Active Modules when next non-indented header appears
        elif in_active_modules and stripped and not line.startswith(" "):
            in_active_modules = False

        # Collect active modules EXACTLY as shown (do NOT split commas)
        elif in_active_modules and stripped:
            data["Active Modules"].append(stripped)

    return data

def parse_df_h_file(text):

    threshold = 95
    targets = ["/var", "/var/log", "/shared", "/config", "/usr"]
    mount_to_use = {}

    # Parse raw df -h text
    for line in text.splitlines():
        line = line.strip()
        if not line or line.lower().startswith("filesystem"):
            continue

        # Match "... 85% /var/log"
        m = re.search(r"(\d+)%\s+(\S+)$", line)
        if not m:
            continue

        try:
            pct = int(m.group(1))
        except ValueError:
            continue

        mount_point = m.group(2)
        mount_to_use[mount_point] = pct

    # Prepare final JSON structure
    checks = []
    for tgt in targets:
        pct = mount_to_use.get(tgt)
        if pct is None:
            status = "not found"
        else:
            status = "needs attention" if pct >= threshold else "ok"

        checks.append({
            "path": tgt,
            "utilization_percent": pct,
            "status": status
        })

    return {
        "threshold_percent": threshold,
        "checks": checks
    }

def parse_http_monitors(text):
    """
    Parse HTTP/HTTPS monitors into a list of dictionaries.
    Each monitor is one dict with fields: name, recv, timeout, interval, send.
    """

    # Block start: ltm monitor http <full_name> {
    START_RE = re.compile(r'^ltm\s+monitor\s+https?\s+(\S+)\s*\{', re.IGNORECASE)
    # Fields we care about (simple "key value" pairs inside the block)
    FIELD_RE = re.compile(r'^\s*(recv|timeout|interval|send)\s+(.*)$', re.IGNORECASE)

    results = []

    cur_name = None
    cur = None

    for raw in text.splitlines():
        line = raw.rstrip()

        # Start of a monitor block
        m = START_RE.match(line)
        if m:
            cur_name = m.group(1)  # e.g., /Common/http_head_f5
            cur = {
                "name": cur_name,
                "recv": None,
                "timeout": None,
                "interval": None,
                "send": None,
            }
            continue

        # End of a monitor block
        if cur_name and line.strip() == "}":
            if cur is not None:
                results.append(cur)
            cur_name, cur = None, None
            continue

        # Field lines inside a block
        if cur_name and cur is not None:
            fm = FIELD_RE.match(line)
            if not fm:
                continue
            key, val = fm.groups()
            key = key.lower()
            val = val.strip()

            # Unescape HTML entities (&quot; -> ")
            val = html.unescape(val)

            # Strip surrounding quotes for send if present
            if val.startswith('"') and val.endswith('"') and len(val) >= 2:
                val = val[1:-1]

            # Normalize values
            if key in ("timeout", "interval"):
                # "16" -> 16; "none" -> None
                cur[key] = int(val) if val.isdigit() else None
            else:
                cur[key] = None if val.lower() == "none" else val

    return results

def parse_other_monitors(text):
    """
    Parse tcp/udp/icmp/tcp-half-open monitors into a list of dictionaries.
    Each monitor is one dict with: name, interval, timeout.
    """

    START_RE = re.compile(
        r'^ltm\s+monitor\s+(?:tcp|icmp|tcp-half-open|udp)\s+(\S+)\s*\{',
        re.IGNORECASE
    )

    FIELD_RE = re.compile(
        r'^\s*(timeout|interval)\s+(\S+)\s*$',
        re.IGNORECASE
    )

    results = []

    cur_name = None
    cur = None

    for raw in text.splitlines():
        line = raw.rstrip("\n")

        # Start of a monitor block
        m = START_RE.match(line)
        if m:
            cur_name = m.group(1)
            cur = {
                "name": cur_name,
                "interval": None,
                "timeout": None
            }
            continue

        # End of block
        if cur_name and line.strip() == "}":
            if cur:
                results.append(cur)
            cur_name, cur = None, None
            continue

        # Key/value fields inside block
        if cur_name:
            fm = FIELD_RE.match(line)
            if not fm:
                continue
            key, val = fm.groups()
            key = key.lower()

            if val.lower() == "none":
                cur[key] = None
            elif val.isdigit():
                cur[key] = int(val)
            else:
                cur[key] = None

    return results

def parse_list_cm_device(text):
    
    FIELDS = {
        "hostname",
        "failover-state",
        "management-ip",
        "platform-id",
        "time-zone",
        "version",
    }

    # Read file here
    # Patterns (kept inside function like your version parser)
    DEVICE_SPLIT_RE = re.compile(r'(?m)^(?=cm\s+device\s+)', re.IGNORECASE)
    SELF_RE = re.compile(r'\bself[- ]?device\b\s*(true|enabled|yes|1)\b', re.IGNORECASE)

    # Split device blocks
    blocks = [
        b for b in DEVICE_SPLIT_RE.split(text)
        if b.strip().lower().startswith("cm device")
    ]

    # Initialize output like your version parser (None for all keys)
    result = {k: None for k in FIELDS}

    # Find the self device block
    for block in blocks:
        if SELF_RE.search(block):  # This is the self device
            for key in FIELDS:
                result[key] = get_field(block, key)
            return result

    # If no self-device found
    return {"note": "No device with self-device true/enabled found."}

def parse_show_cm_device(text):
    FIELDS = [
        "Configsync Ip",
        "Mgmt Ip",
        "Hostname",
        "Failover Unicast IP(s)",
        "Mirroring IP",
        "Mirroring Secondary IP",
        "Device HA State",
    ]
    """
    Parse 'show cm device' output and extract fields per device
    using the same function style as parse_version_file().
    """

    lines = text.splitlines()

    devices: list[dict] = []
    current: dict | None = None

    for line in lines:
        stripped = line.strip()

        # Detect device start
        if stripped.startswith("CentMgmt::Device:"):
            # flush previous
            if current is not None:
                devices.append(current)

            device_name = stripped.split(":", 1)[1].strip()
            current = {"Device": device_name}

            # initialize all fields to None just like parse_version_file
            for f in FIELDS:
                current[f] = None

            continue

        # Skip until inside a device block
        if current is None:
            continue

        # Skip separator lines
        if stripped.startswith("-"):
            continue

        # Key-value format:
        #   <label>   <value>
        m = re.match(r"(.+?\S)\s{2,}(.*\S)?", line)
        if not m:
            continue

        key = m.group(1).strip()
        val = (m.group(2) or "").strip()

        if key in FIELDS:
            current[key] = val

    # Flush last block
    if current is not None:
        devices.append(current)

    # --- REMOVE "Device" from the final results ---
    for dev in devices:
        dev.pop("Device", None)


    return devices

def parse_self_ips(text):
    """
    Parse show running-config net self and return list of dictionaries.
    """
    blocks = re.split(r'\bnet self\b', text)[1:]  # remove header before first block
    results = []

    for blk in blocks:
        blk = blk.strip()
        # extract name (self IP identifier)
        m_name = re.match(r'([^\s]+)\s*\{', blk)
        if not m_name:
            continue
        name = m_name.group(1)

        # extract entire content inside curly braces
        m_body = re.search(r'\{(.*)\}', blk, re.DOTALL)
        if not m_body:
            continue
        body = m_body.group(1)

        # address
        m_addr = re.search(r'\baddress\s+([^\s]+)', body)
        address = m_addr.group(1) if m_addr else None

        # vlan
        m_vlan = re.search(r'\bvlan\s+([^\s]+)', body)
        vlan = m_vlan.group(1) if m_vlan else None

        # traffic-group
        m_tg = re.search(r'\btraffic-group\s+([^\s]+)', body)
        traffic_group = m_tg.group(1) if m_tg else None

        # ---- allow-service (fixed) ----
        allow: list[str] = []

        # case 1: multi-line block
        # allow-service {
        #     udp:ssh
        #     udp:any
        # }
        m_allow_block = re.search(
            r'allow-service\s*\{([^}]*)\}',
            body,
            re.DOTALL
        )
        if m_allow_block:
            lines = m_allow_block.group(1).strip().splitlines()
            for line in lines:
                line = line.strip()
                if line:
                    allow.append(line)
        else:
            # case 2: simple single value, e.g.:
            # allow-service all
            m_allow_single = re.search(
                r'\ballow-service\s+(?!\{)(\S+)',
                body
            )
            if m_allow_single:
                allow.append(m_allow_single.group(1))

        results.append({
            "self_ip": name,
            "address": address,
            "allow-service": allow,
            "vlan": vlan,
            "traffic-group": traffic_group,
        })

    return results

def extract_block_values(block_text):
    """
    Extracts persistence profiles from:
    persist {
        /Common/source_addr {
            default yes
        }
    }
    """
    items = re.findall(r'([/\w]+)\s*\{', block_text)
    return items

def find_block(text: str, keyword: str) -> str | None:
    """
    Return the content inside:  <keyword> { ... }
    Handles nested braces correctly.
    """
    # Find: keyword {   (allow whitespace/newlines)
    m = re.search(rf'(?m)^\s*{re.escape(keyword)}\s*\{{', text)
    if not m:
        return None

    # Position at the opening '{'
    start = m.end() - 1  # points to '{'
    i = start
    depth = 0
    n = len(text)

    while i < n:
        ch = text[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                # return inside the outermost braces
                return text[start + 1 : i]
        i += 1

    # Unbalanced braces
    return None

def extract_top_level_names_from_block(block: str) -> list[str]:
    """
    Extract entries like:
      /Common/http { ... }
      /Common/tcp-lan-optimized { ... }

    We only capture names at *top-level* inside the block.
    """
    names = []
    depth = 0

    for raw_line in block.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        # Track depth transitions *after* potential name capture on this line
        # We only want lines at depth==0 like: /Common/http {
        if depth == 0:
            m = re.match(r'^([^\s\{]+)\s*\{', line)
            if m:
                name = m.group(1)
                if name not in names:
                    names.append(name)

        # Update depth for braces in the line
        depth += line.count("{")
        depth -= line.count("}")

    return names

def parse_ltm_virtuals(text: str):
    TARGETS = [
        "persist",
        "partition",
        "fallback-persistence",
        "policies",
        "profiles",
        "security-log-profiles",
        "rules",
    ]

    # Split on start of each virtual
    blocks = re.split(r'\bltm virtual\b', text)[1:]
    results = []

    for blk in blocks:
        blk = blk.strip()

        # Virtual name
        m_name = re.match(r'([^\s]+)\s*\{', blk)
        if not m_name:
            continue
        name = m_name.group(1)

        # IMPORTANT: don't do greedy {.*} here (it can over-capture).
        # Extract body from first "{" to the matching closing brace.
        outer = find_block(blk, name)  # tries: "<name> { ... }"
        if outer is None:
            # Fallback: match first "{" after name, then brace-walk to end
            # (in case name contains weird chars)
            m = re.search(r'\{', blk)
            if not m:
                continue
            start = m.start()
            # brace-walk from start
            i = start
            depth = 0
            while i < len(blk):
                if blk[i] == "{":
                    depth += 1
                elif blk[i] == "}":
                    depth -= 1
                    if depth == 0:
                        outer = blk[start + 1 : i]
                        break
                i += 1

        if outer is None:
            continue

        body = outer
        entry = {"virtual": name}

        for key in TARGETS:

            # ---------- persist ----------
            if key == "persist":
                if re.search(r'^\s*persist\s+none\b', body, re.MULTILINE):
                    entry[key] = ["none"]
                    continue

                persist_block = find_block(body, "persist")
                if persist_block:
                    # If you want just the top-level persistence profile names:
                    # e.g. /Common/myCookie
                    entry[key] = extract_top_level_names_from_block(persist_block) or None
                else:
                    entry[key] = None
                continue

            # ---------- policies ----------
            if key == "policies":
                if re.search(r'^\s*policies\s+none\b', body, re.MULTILINE):
                    entry[key] = ["none"]
                    continue

                policies_block = find_block(body, "policies")
                if policies_block:
                    # policies are often just paths (no nested blocks), but safe anyway:
                    lines = [ln.strip() for ln in policies_block.splitlines() if ln.strip()]
                    entry[key] = lines or None
                else:
                    entry[key] = None
                continue

            # ---------- profiles ----------
            if key == "profiles":
                if re.search(r'^\s*profiles\s+none\b', body, re.MULTILINE):
                    entry[key] = ["none"]
                    continue

                profiles_block = find_block(body, "profiles")
                if profiles_block:
                    entry[key] = extract_top_level_names_from_block(profiles_block) or None
                else:
                    entry[key] = None
                continue

            # ---------- security-log-profiles ----------
            if key == "security-log-profiles":
                if re.search(r'^\s*security-log-profiles\s+none\b', body, re.MULTILINE):
                    entry[key] = ["none"]
                    continue

                sec_block = find_block(body, "security-log-profiles")
                if sec_block:
                    lines = [ln.strip() for ln in sec_block.splitlines() if ln.strip()]
                    entry[key] = lines or None
                else:
                    entry[key] = None
                continue

            # ---------- rules ----------
            if key == "rules":
                if re.search(r'^\s*rules\s+none\b', body, re.MULTILINE):
                    entry[key] = ["none"]
                    continue

                rules_block = find_block(body, "rules")
                if rules_block:
                    lines = [ln.strip() for ln in rules_block.splitlines() if ln.strip()]
                    entry[key] = lines or None
                else:
                    entry[key] = None
                continue

            # ---------- General single-line keys ----------
            # anchor to line start to avoid picking up inner "context ..." etc.
            m = re.search(rf'(?m)^\s*{re.escape(key)}\s+(.+)$', body)
            entry[key] = m.group(1).strip() if m else None

        # destination + default pool: top-level keys only (4-space indent), so
        # the nested "pool none" inside source-address-translation is ignored.
        dm = re.search(r'(?m)^    destination\s+(\S+)', body)
        entry["destination"] = dm.group(1) if dm else None
        pm = re.search(r'(?m)^    pool\s+(\S+)', body)
        entry["pool"] = pm.group(1) if pm else None

        # full tmsh config block, for the inventory detail drawer
        entry["raw"] = body.strip()

        results.append(entry)

    return results

def strip_members_block(body):
    """
    Remove the entire 'members { ... }' block from the pool body, while
    keeping everything before and after it (pool-level config only).
    This avoids accidentally matching member-level monitors.
    """
    m = re.search(r'\bmembers\s*\{', body)
    if not m:
        return body

    start = m.start()
    # find the '{' that starts the members block
    brace_index = body.find('{', m.end() - 1)
    if brace_index == -1:
        return body

    depth = 1
    i = brace_index + 1
    while i < len(body) and depth > 0:
        if body[i] == '{':
            depth += 1
        elif body[i] == '}':
            depth -= 1
        i += 1

    # i is just after the closing '}' of the members block
    return body[:start] + body[i:]

def parse_ltm_pools(text):

    TARGETS = [
        "monitor",
        "partition",
        "load-balancing-mode",
    ]

    # Split into blocks after "ltm pool"
    blocks = re.split(r'\bltm pool\b', text)[1:]
    results = []

    for blk in blocks:
        blk = blk.strip()
        if not blk:
            continue

        # Pool name: first token before '{'
        m_name = re.match(r'([^\s]+)\s*\{', blk)
        if not m_name:
            continue
        name = m_name.group(1)

        # Body between first '{' and last '}' of this block
        if "{" not in blk or "}" not in blk:
            continue
        body = blk[blk.find("{") + 1 : blk.rfind("}")]

        # Pool-level portion without members { ... }
        header_part = strip_members_block(body)

        entry = {"pool": name}

        for key in TARGETS:
            # ---- monitor: only from pool-level (header_part) ----
            if key == "monitor":
                pattern = rf'\b{re.escape(key)}\s+([^\n]+)'
                m = re.search(pattern, header_part)
                entry[key] = m.group(1).strip() if m else None
                continue

            # ---- other keys: safe to search entire body ----
            pattern = rf'\b{re.escape(key)}\s+([^\n]+)'
            m = re.search(pattern, body)
            entry[key] = m.group(1).strip() if m else None

        entry["members"] = _parse_pool_members(body)
        entry["member_count"] = len(entry["members"])
        # full tmsh config block, for the inventory detail drawer
        entry["raw"] = body.strip()

        results.append(entry)

    return results

def parse_sys_provision(text):
    """
    Parse BIG-IP 'list sys provision all-properties' output and return only
    modules where level != none.
    """
    # Split into blocks after "sys provision"
    blocks = re.split(r'\bsys provision\b', text)[1:]

    results = []

    for blk in blocks:
        blk = blk.strip()
        if not blk:
            continue

        # Module name: the token after "sys provision"
        m_name = re.match(r'([^\s]+)\s*\{', blk)
        if not m_name:
            continue
        module = m_name.group(1)

        # Extract body inside { ... }
        m_body = re.search(r'\{(.*)\}', blk, re.DOTALL)
        if not m_body:
            continue
        body = m_body.group(1)

        # Extract level
        m_level = re.search(r'\blevel\s+([^\s]+)', body)
        level = m_level.group(1) if m_level else None

        # Skip unprovisioned modules
        if not level or level.lower() == "none":
            continue

        results.append({
            "module": module,
            "level": level
        })

    return results

def compute_days_to_expiry(not_after):
    """
    Parse 'Not After' string like 'Feb 18 16:06:36 2032 GMT'
    and return days until expiry (can be negative if already expired).
    """

    if not not_after:
        return -1

    try:
        # Normalize whitespace: 'Mar  4' -> 'Mar 4'
        s = re.sub(r"\s+", " ", not_after.strip())
        dt = datetime.datetime.strptime(s, "%b %d %H:%M:%S %Y %Z")
        dt = dt.replace(tzinfo=datetime.timezone.utc)
        now = datetime.datetime.now(datetime.timezone.utc)
        delta = dt - now
        return delta.days
    except Exception:
        print(f"Warning: failed to parse Not After date: {not_after}")
        return -10

def parse_ssl_certificates(text):
    VALID_PREFIXES = (
        "/config/filestore/files_d/Common_d/certificate_d/",
        "/config/ssl/ssl.crt/"
    )
    # Split on the long separator lines of dashes
    blocks = re.split(r'-{10,}\s*', text)
    results = []

    for blk in blocks:
        blk = blk.strip()
        if not blk:
            continue

        # Cert file line is like:
        # Cert file:
        #
        # /config/...
        #
        # Be tolerant to CRLF, extra spaces, and case (File/file)
        m_file = re.search(r'Cert [Ff]ile:\s*(?:\r?\n)+\s*(\S.+)', blk)
        if not m_file:
            continue

        cert_file = m_file.group(1).strip()

        # Only keep certificates in the requested locations
        if not cert_file.startswith(VALID_PREFIXES):
            continue

        # Not After (expiry)
        m_not_after = re.search(r'Not After\s*:\s*(.+)', blk)
        not_after = m_not_after.group(1).strip() if m_not_after else None

        days_to_expiry = compute_days_to_expiry(not_after)

        usages = []
        # Profiles / virtuals table is present when this text exists
        if "Used in these profiles and virtuals" in blk:
            after = blk.split("Used in these profiles and virtuals:", 1)[1]
            lines = after.splitlines()

            started = False
            for line in lines:
                if not started:
                    # Find header: Type   Profile name   Virtual Server
                    if re.search(r'Type\s+Profile name', line):
                        started = True
                    continue

                # Stop on blank line or start of "Certificate:"
                if not line.strip() or line.strip().startswith("Certificate:"):
                    break

                # Table row: type, profile, vs, with lots of spaces
                parts = re.split(r'\s{2,}', line.strip())
                if len(parts) >= 2:
                    cert_type = parts[0].strip()
                    profile = parts[1].strip()
                    vs = parts[2].strip() if len(parts) >= 3 else None
                    usages.append({
                        "type": cert_type,
                        "profile": profile,
                        "virtual_server": vs,
                    })

        results.append({
            "certificate": cert_file,
            "not_after": not_after,
            "days_to_expiry": days_to_expiry,
            "usages": usages,
        })

    return results

def parse_sync_status(text):
    # Extract Status
    m = re.search(r'^Status\s+(.*)$', text, flags=re.MULTILINE)
    status = m.group(1).strip() if m else None

    # Extract Color
    m = re.search(r'^Color\s+(.*)$', text, flags=re.MULTILINE)
    color = m.group(1).strip() if m else None

    # Extract everything after "Details"
    details = None
    m = re.search(r'^Details\s*\n(.+)$', text, flags=re.MULTILINE | re.DOTALL)
    if m:
        # Clean whitespace and keep all lines after Details
        details = m.group(1).strip()

    result = {
        "status": status,
        "color": color,
        "details": details
    }
    
    return result

def extract(regex, text):
    m = re.search(regex, text, re.IGNORECASE)
    return m.group(1).strip() if m else None

def parse_sys_hardware(text):
    """
    Parse 'sys hardware' output and extract:    
      - platform_name
      - system_type
      - system_chassis_serial
    """
    result = {
        "platform_name": extract(r"Platform\s+Name\s+(.*)", text),
        "system_type": extract(r"System Information\s+.*?Type\s+([^\n]+)", text),
        "system_chassis_serial": extract(r"Chassis Serial\s+([^\n]+)", text)
    }

    return result

def parse_client_ssl_profiles(text):
    """
    Parse 'ltm profile client-ssl' blocks and extract:
      - cipher-group
      - ciphers
      - options (as a list)
      - defaults-from
    """
    TARGETS = [
        "cipher-group",
        "ciphers",
        "options",
        "defaults-from",
    ]

    # Split into blocks after "ltm profile client-ssl"
    blocks = re.split(r'\bltm profile client-ssl\b', text)[1:]
    results = []

    for blk in blocks:
        blk = blk.strip()
        if not blk:
            continue

        # Profile name: first token before '{'
        # e.g. "/Common/Exchange_MailBox_Monitoring.app/Exchange_MailBox_Monitoring_clientssl"
        m_name = re.match(r'([^\s]+)\s*\{', blk)
        if not m_name:
            continue
        name = m_name.group(1)

        # Body between first '{' and last '}' of this block
        if "{" not in blk or "}" not in blk:
            continue
        body = blk[blk.find("{") + 1 : blk.rfind("}")]

        entry = {"profile": name}

        for key in TARGETS:
            # ---- options { ... } is a block ----
            if key == "options":
                # Example: options { dont-insert-empty-fragments no-tlsv1.3 cipher-server-preference }
                m_opt = re.search(r'\boptions\s*\{([^}]*)\}', body, re.DOTALL)
                if m_opt:
                    inner = m_opt.group(1)
                    # flatten newlines and split on whitespace
                    tokens = [t for t in inner.replace("\n", " ").split() if t]
                    entry["options"] = tokens if tokens else None
                else:
                    entry["options"] = None
                continue

            # ---- other keys are single-line: key <value...> ----
            # e.g. "cipher-group none", "ciphers DEFAULT:SSLV3:NONE", "defaults-from /Common/clientssl"
            pattern = rf'\b{re.escape(key)}\s+([^\n]+)'
            m = re.search(pattern, body)
            entry[key] = m.group(1).strip() if m else None

        results.append(entry)

    return results

def parse_http_profiles(text):
    """
    Parse 'ltm profile http' blocks and extract:
      - encrypt-cookies (list or 'none')
      - server-agent-name (string)
      - insert-xforwarded-for (enabled/disabled)
      - xff-alternative-names (list or 'none')
    """

    # Split into blocks after "ltm profile http"
    blocks = re.split(r'\bltm profile http\b', text)[1:]
    results = []

    for blk in blocks:
        blk = blk.strip()
        if not blk:
            continue

        # Profile name: first token before '{'
        # e.g. "/Common/APP_MS-Exchange-2016.app/APP_MS-Exchange-2016_http_profile"
        m_name = re.match(r'([^\s]+)\s*\{', blk)
        if not m_name:
            continue
        name = m_name.group(1)

        # Body between first '{' and last '}' of this block
        if "{" not in blk or "}" not in blk:
            continue
        body = blk[blk.find("{") + 1 : blk.rfind("}")]

        entry = {"profile": name}

        # -----------------------------
        # encrypt-cookies
        # -----------------------------
        # Case 1: encrypt-cookies none
        if re.search(r'^\s*encrypt-cookies\s+none\b', body, re.MULTILINE):
            entry["encrypt-cookies"] = "none"
        else:
            m_enc = re.search(r'\bencrypt-cookies\s*\{([^}]*)\}', body, re.DOTALL)
            if m_enc:
                inner = m_enc.group(1)
                cookies = [t for t in inner.replace("\n", " ").split() if t]
                entry["encrypt-cookies"] = cookies if cookies else None
            else:
                entry["encrypt-cookies"] = None

        # -----------------------------
        # server-agent-name (single line)
        # -----------------------------
        m_server = re.search(r'\bserver-agent-name\s+([^\n]+)', body)
        entry["server-agent-name"] = m_server.group(1).strip() if m_server else None

        # -----------------------------
        # insert-xforwarded-for (single line)
        # -----------------------------
        m_xff = re.search(r'\binsert-xforwarded-for\s+([^\n]+)', body)
        entry["insert-xforwarded-for"] = m_xff.group(1).strip() if m_xff else None

        # -----------------------------
        # xff-alternative-names
        # -----------------------------
        # Case 1: xff-alternative-names none
        if re.search(r'^\s*xff-alternative-names\s+none\b', body, re.MULTILINE):
            entry["xff-alternative-names"] = "none"
        else:
            m_xff_alt = re.search(
                r'\bxff-alternative-names\s*\{([^}]*)\}', body, re.DOTALL
            )
            if m_xff_alt:
                inner = m_xff_alt.group(1)
                names = [t for t in inner.replace("\n", " ").split() if t]
                entry["xff-alternative-names"] = names if names else None
            else:
                entry["xff-alternative-names"] = None

        results.append(entry)

    return results

def parse_profiles(text, profile_type: str) :
    """
    Extract only the names of a specific LTM profile type
    (e.g. 'bot-defense', 'http', 'http-compression', etc.).
    """

    # Split after each occurrence of "ltm profile <profile_type>"
    pattern = rf'\b{re.escape(profile_type)}\b'
    blocks = re.split(pattern, text)[1:]

    names = []

    for blk in blocks:
        blk = blk.strip()
        if not blk:
            continue

        # Extract the name (first token before '{')
        m_name = re.match(r'([^\s]+)\s*\{', blk)
        if m_name:
            names.append(m_name.group(1))

    return names

def simplify_non_cve(raw: dict, ignore_set) -> dict:
    simplified = []

    for diag in raw.get("diagnostics", {}).get("diagnostic", []):
        results = diag.get("results", {})
        
        # --- SKIP IF IN IGNORE LIST ---
        if results.get("h_header") in ignore_set:
            continue
        # ---- FILTER: keep ONLY entries WITHOUT CVE ----
        cve_ids = results.get("h_cve_ids")
        if cve_ids:  # non-empty list
            continue
        # cve_ids might be null or missing, which is what we want to KEEP

        run_data = diag.get("run_data", {})
        fixed = diag.get("fixedInVersions", {})

        solution_list = results.get("solution", []) or []
        solution_ids = [
            s.get("value") for s in solution_list
            if isinstance(s, dict) and s.get("value")
        ]

        simplified.append({
            "h_importance": run_data.get("h_importance"),
            "solution_ids": solution_ids,          # <-- list, not single value
            "output": diag.get("output", []),
            "h_header": results.get("h_header"),
            "h_summary": results.get("h_summary"),
            "h_action": results.get("h_action"),
            "fixedInVersions": format_fixed_versions(fixed)
        })

    return {"diagnostics_simplified": simplified}

def format_fixed_versions(fixed_obj: dict) -> list:
    """Convert fixedInVersions.version list to normal version strings."""
    versions = fixed_obj.get("version", []) if fixed_obj else []
    formatted = []

    for v in versions:
        major = v.get("major")
        minor = v.get("minor")
        maint = v.get("maintenance")
        point = v.get("point")
        fix = v.get("fix") or ""

        version = f"{major}.{minor}.{maint}.{point}"
        if fix:
            version = f"{version}-{fix}"

        formatted.append(version)

    return formatted

def simplify_diagnostics(raw: dict, ignore_set) -> dict:
    simplified = []

    for diag in raw.get("diagnostics", {}).get("diagnostic", []):
        results = diag.get("results", {})
        
        # --- SKIP IF IN IGNORE LIST ---
        if results.get("h_header") in ignore_set:
            continue

        # ---- FILTER: must contain CVE IDs ----
        cve_ids = results.get("h_cve_ids", [])
        if not cve_ids:
            continue  # skip entries without CVEs

        run_data = diag.get("run_data", {})
        fixed = diag.get("fixedInVersions", {})

        # Extract solution ID(s): keep the first for the table link + the full
        # list for the detail drawer.
        solution_list = results.get("solution", []) or []
        solution_id = solution_list[0].get("id") if solution_list else None
        solution_ids = [
            s.get("id") for s in solution_list
            if isinstance(s, dict) and s.get("id")
        ]

        simplified.append({
            "h_importance": run_data.get("h_importance"),
            "solution_id": solution_id,
            "solution_ids": solution_ids,
            "h_cve_ids": cve_ids,
            "h_header": results.get("h_header"),
            "h_summary": results.get("h_summary"),
            "h_action": results.get("h_action"),
            "output": diag.get("output", []),
            "fixedInVersions": format_fixed_versions(fixed)
        })

    return {"diagnostics_simplified": simplified}

def count_weak_monitors(monitors: dict) -> int:
    """
    Count monitors under 'f5_https_monitors' that:
      - recv is None or 'Server\\:'
      - send is 'GET /\\r\\n' or 'HEAD / HTTP/1.0\\r\\n\\r\\n'
    """
    count = 0

    # Values exactly as they appear in your JSON
    allowed_recv_values = {None, "Server\\:"}
    allowed_send_values = {
        "GET /\\r\\n",
        "HEAD / HTTP/1.0\\r\\n\\r\\n",
    }

    for m in monitors:
        recv_val = m.get("recv")
        send_val = m.get("send")

        if recv_val in allowed_recv_values and send_val in allowed_send_values:
            count += 1

    return count

def count_disk_problems(disk: dict) -> int:
    count = 0

    for m in disk['checks']:
        if m.get("status") == "needs attention":
            count += 1

    return count

def count_rr_lb_mode(pool: dict) -> int:
    count = 0

    for m in pool:
        if m.get("load-balancing-mode") == "round-robin":
            count += 1

    return count

def count_no_monitor_pools(pool: dict) -> int:
    count = 0

    for m in pool:
        if m.get("monitor") == "none":
            count += 1

    return count

def count_expired_certs(certs: dict) -> int:
    count = 0

    for m in certs:
        days = m.get("days_to_expiry")
        if days < 60:
            count += 1

    return count

def humanize_int(value: int) -> str:
    """
    Convert an integer to a human-readable format like:
      1200 -> '1.2K'
      2000000 -> '2.0M'
      3500000000 -> '3.5G'
    Supports K, M, G, T, P.
    """
    if value is None:
        return "0"

    num = float(value)

    for unit in ["", "K", "M", "G", "T", "P"]:
        if num < 1000:
            return f"{num:.1f}{unit}" if unit else str(int(num))
        num /= 1000.0

    # fallback for insanely large numbers
    return f"{num:.1f}E"   # Exa (beyond Peta)

def parse_human_int(s: str):
    """
    Parse values like:
      '716.6K', '7.1M', '1.2G', '452', '0', '3.4T', '9.2P'
    into integers (in units, not bits/bytes).
    Returns None if it can't parse.
    """

    s = s.replace(",", "").strip()
    m = re.match(r'^([\d.]+)\s*([KMGTP])?$', s, re.IGNORECASE)
    if not m:
        return None

    number = float(m.group(1))
    suffix = (m.group(2) or "").upper()

    multiplier = {
        "": 1,
        "K": 1_000,
        "M": 1_000_000,
        "G": 1_000_000_000,
        "T": 1_000_000_000_000,
        "P": 1_000_000_000_000_000,
    }.get(suffix)

    if multiplier is None:
        return None

    return int(number * multiplier)

def find_self_ip_allow_services(self_ips: list[dict]) -> int:
    """
    Take the parsed self IP list and build human-readable warnings
    for any self IP that has allowed services configured.
    """
    output = 0

    for entry in self_ips:
        name = entry.get("self_ip")
        address = entry.get("address")
        services = entry.get("allow-service", []) or []

        # If there are any services configured, raise a warning
        if services:
            if services != ["udp:1026"]:
                output = 1

    return output

def load_and_merge_json(folder_path):
    folder = Path(folder_path)
    json_files = list(folder.glob("*.json"))

    if not json_files:
        print("No JSON files found.")
        return {}

    merged_data = {}

    for json_file in json_files:
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            key = json_file.stem   # filename without extension
            merged_data[key] = data

        except Exception as e:
            print(f"Error reading {json_file.name}: {e}")

    return merged_data

def safe_get(value, default="not configured"):
    if value is None or value == "" or str(value).strip() == "":
        return default
    return str(value)

def run_audit(results):
        
    problems_found = {}
    problems_found['ntp'] = {"details": "", "title":"", "rating": "", "issue": False}
    problems_found['dns'] = {"details": "", "title":"", "rating": "", "issue": False}
    problems_found['cpu'] = {"details": "", "title":"", "rating": "", "issue": False}
    problems_found['memory'] = {"details": "", "title":"", "rating": "", "issue": False}
    problems_found['sync'] = {"details": "", "title":"", "rating": "", "issue": False, "error": ""}
    problems_found['errors'] = {"details": "", "title":"", "rating": "", "issue": False, "error": ""}
    problems_found['self_ips'] = {"details": "", "title":"", "rating": "", "issue": False}
    problems_found['ssh_allow'] = {"details": "", "title":"", "rating": "", "issue": False}
    problems_found['httpd_allow'] = {"details": "", "title":"", "rating": "", "issue": False}
    problems_found['password_max'] = {"details": "", "title":"", "rating": "", "issue": False}
    problems_found['password_remember'] = {"details": "", "title":"", "rating": "", "issue": False}
    problems_found['password_complex'] = {"details": "", "title":"", "rating": "", "issue": False}
    problems_found['http_monitors'] = {"details": "", "title":"", "rating": "", "issue": False}
    problems_found['arp'] = {"details": "", "title":"", "rating": "", "issue": False}
    problems_found['disk'] = {"details": "", "title":"", "rating": "", "issue": False}
    problems_found['pool_monitor'] = {"details": "", "title":"", "rating": "", "issue": False}
    problems_found['lb_mode'] = {"details": "", "title":"", "rating": "", "issue": False}
    problems_found['ssl'] = {"details": "", "title":"", "rating": "", "issue": False}
    problems_found['irules'] = {"details": "", "title":"", "rating": "", "issue": False}
    problems_found['expired_cert'] = {"details": "", "title":"", "rating": "", "issue": False}


    if results['sysdb_file'].get('ntp.servers') is None:
        problems_found['ntp']['details'] = 'NTP servers are not configured on the device. It is recommended to configure NTP servers to ensure accurate time synchronization.'
        problems_found['ntp']['title'] = "Missing NTP Servers"
        problems_found['ntp']['rating'] = "Medium"
        problems_found['ntp']['issue'] = True

    if results['sysdb_file'].get('dns.nameservers') is None:
        problems_found['dns']['details'] = 'DNS nameservers is not configured on the device. It is recommended to configure DNS nameservers to ensure proper name resolution.'
        problems_found['dns']['title'] = "Missing DNS Configuration"
        problems_found['dns']['rating'] = "Medium"
        problems_found['dns']['issue'] = True

    #if results['host_info']['cpu_count'] > results['host_info']['active_cpu_count']:
    #    problems_found['cpu']['details'] = f"The device has {results['host_info']['cpu_count']} CPUs configured, but only {results['host_info']['active_cpu_count']} are active due to its licensing."
    #    problems_found['cpu']['title'] = "More CPU assigned than licensed"
    #    problems_found['cpu']['rating'] = "Low"
    #    problems_found['cpu']['issue'] = True


    mem_available=parse_human_int(results['host_info']['memory_total'])-parse_human_int(results['host_info']['memory_used'])


    if mem_available < 500000000:
        problems_found['memory']['details'] = f"The device has only {humanize_int(mem_available)}B of memory availble. Review the utilization of the memory to ensure optimal performance."
        problems_found['memory']['title'] = "Available memory"
        problems_found['memory']['rating'] = "Medium"
        problems_found['memory']['issue'] = True

    if results['sync_status']['color']=="red":
        problems_found['sync']['issue'] = True
        problems_found['sync']['title'] = 'HA Synchronization Issue'
        problems_found['sync']['rating'] = 'High'
        problems_found['sync']['details'] = 'The device shows a warning on the "Sync Status". Please review the Synchronization Warning details and mitigate the issue. A device out of sync may lead to configuration inconsistencies and potential service disruptions.'
        problems_found['sync']['error'] = results['sync_status']['details']


    if int(results['interface_errors']['summary']['errors_total']) > 5 or int(results['interface_errors']['summary']['drops_total'])>500 or int(results['interface_errors']['summary']['collisions'])>500:
        problems_found['errors']['issue'] = True
        problems_found['errors']['title'] = 'Interface Errors'
        problems_found['errors']['rating'] = 'Low'
        problems_found['errors']['details'] = 'The device has reported interface errors, drops, or collisions. It is important to investigate and resolve these issues to ensure optimal network performance and reliability.'
        problems_found['errors']['error'] = f"Total Errors: {results['interface_errors']['summary']['errors_total']}, Total Drops: {results['interface_errors']['summary']['drops_total']}, Total Collisions: {results['interface_errors']['summary']['collisions']}"


    if find_self_ip_allow_services(results['self_ips']) == 1:
        problems_found['self_ips']['issue'] = True
        problems_found['self_ips']['title'] = 'Access to F5 BIGIP Mgmt Interface via Self IPs'
        problems_found['self_ips']['rating'] = 'High'
        problems_found['self_ips']['details'] = 'During our review we identified that some of the self IPs have allowed services configured that could allow access to management services from unintended networks. Please review the self IP configurations to ensure that only necessary services are allowed and that access is restricted to trusted sources.'
        problems_found['self_ips']['additional'] = 'Please review the KB article regarding self IPs Port Lockdown: https://my.f5.com/manage/s/article/K17333'
        
    if results['sysdb_file'].get('service.ssh.allow') is None:
        problems_found['ssh_allow']['issue'] = True
        problems_found['ssh_allow']['title'] = 'Unrestricted SSH Access'
        problems_found['ssh_allow']['rating'] = 'High'
        problems_found['ssh_allow']['details'] = 'During our review we identified that SSH management service is not restricted or is open to all networks. It is recommended to restrict access to this service to trusted IP addresses or networks only to enhance security.'
        problems_found['ssh_allow']['additional'] = 'Please review the KB article regarding securing SSH access: https://my.f5.com/manage/s/article/K5380'
    
    if results['sysdb_file'].get('service.httpd.allow').lower() == 'all':
        problems_found['httpd_allow']['issue'] = True
        problems_found['httpd_allow']['rating'] = 'Medium'
        problems_found['httpd_allow']['title'] = 'Unrestricted HTTPD Access'
        problems_found['httpd_allow']['details'] = 'During our review we identified that HTTP management service is not restricted or is open to all networks. It is recommended to restrict access to this service to trusted IP addresses or networks only to enhance security.'
        problems_found['httpd_allow']['additional'] = 'Please review the KB article regarding securing HTTPD access: https://my.f5.com/manage/s/article/K13309'

    if results['sysdb_file'].get('password.maxloginfailures') is None:
        problems_found['password_max']['issue'] = True
        problems_found['password_max']['rating'] = 'Medium'
        problems_found['password_max']['title'] = 'Password security (Maximum Login Failures not set)'
        problems_found['password_max']['details'] = 'During our review we identified that Maximum Login Failures policies are not fully configured on the device. It is recommended to set a maximum number of login failures to enhance account security.'
        problems_found['password_max']['additional'] = 'Please review the KB article regarding recommended password policy settings: https://my.f5.com/manage/s/article/K15497'

    if results['sysdb_file'].get('password.remember') is None:
        problems_found['password_remember']['issue'] = True
        problems_found['password_remember']['rating'] = 'Medium'
        problems_found['password_remember']['title'] = 'Password security (History not set)'
        problems_found['password_remember']['details'] = 'During our review we identified that Password History policies are not fully configured on the device. It is recommended to set a password history to enhance account security.'
        problems_found['password_remember']['additional'] = 'Please review the KB article regarding recommended password policy settings: https://my.f5.com/manage/s/article/K15497'

    if results['sysdb_file'].get('password.minlen') is None or results['sysdb_file'].get('password.ucredit') is None or results['sysdb_file'].get('password.lcredit') is None:
        problems_found['password_complex']['issue'] = True
        problems_found['password_complex']['rating'] = 'Medium'
        problems_found['password_complex']['title'] = 'Password security (Complexity)'
        problems_found['password_complex']['details'] = 'During our review we identified that password policies are not fully configured on the device. It is recommended to set parameters such as minimum password length and character complexity requirements to enhance account security.'
        problems_found['password_complex']['additional'] = 'Please review the KB article regarding recommended password policy settings: https://my.f5.com/manage/s/article/K15497'

    l7_monitors=len(results['http_monitors'])+len(results['https_monitors'])
    total_monitors=len(results['http_monitors'])+len(results['https_monitors'])+len(results['tcp_half_open_monitors'])+len(results['udp_monitors'])+len(results['tcp_monitors'])
    l7_weak_monitors=count_weak_monitors(results['https_monitors'])+count_weak_monitors(results['http_monitors'])

    if l7_monitors==5:
        problems_found['http_monitors']['issue'] = True
        problems_found['http_monitors']['title'] = 'Only default HTTP(s) Monitors'
        problems_found['http_monitors']['rating'] = 'Medium'
        problems_found['http_monitors']['details'] = "The device is using only the default monitors and you have not customized any HTTP or HTTPS monitors. It is recommended to create custom monitors tailored to your specific application needs to ensure accurate health monitoring and optimal performance."
    else:
        if l7_weak_monitors-l7_monitors>0:
            problems_found['http_monitors']['issue'] = True
            problems_found['http_monitors']['rating'] = 'Medium'
            problems_found['http_monitors']['title'] = 'Default settings on HTTP(s) Monitors'
            problems_found['http_monitors']['details'] = f"The device has {l7_weak_monitors-l7_monitors} custom HTTP(S) monitors with weak or default send/recv strings. It is recommended to customize these strings to enhance security and ensure proper monitoring of HTTPS services."


    if results['arp_table']['arp_summary'].get('incomplete_entries') is None and results['arp_table']['arp_summary']['incomplete_entries'] > 0:
        problems_found['arp']['issue'] = True
        problems_found['arp']['title'] = 'ARP Issues'
        problems_found['arp']['rating'] = 'Low'
        problems_found['arp']['details'] = f"The device has {results['arp_table']['arp_summary']['incomplete_entries']} incomplete ARP entries out of the total of {results['arp_table']['arp_summary']['total_entries']}. It is recommended to review and resolve these entries to enhance network reliability and security."


    disk_problems= count_disk_problems(results['df_h_file'])

    if disk_problems>0:
        problems_found['disk']['issue'] = True
        problems_found['disk']['title'] = 'Disk volume available space'
        problems_found['disk']['rating'] = 'High'
        problems_found['disk']['details'] = f"The device has {disk_problems} disk volume(s) that need attention. It is crucial to address these issues promptly to prevent potential data loss or system failures."


    no_monitor_pools=count_no_monitor_pools(results['ltm_pools'])
    if no_monitor_pools>0:
        problems_found['pool_monitor']['issue'] = True
        problems_found['pool_monitor']['title'] = 'Pools without Monitors'
        problems_found['pool_monitor']['rating'] = 'Medium'
        problems_found['pool_monitor']['details'] = f"{no_monitor_pools}  out of {len(results['ltm_pools'])} pools have been identified that have no monitor assined. It is recommended to assign appropriate monitors to all pools to ensure proper health monitoring and optimal performance."


    lb_mode=count_rr_lb_mode(results['ltm_pools'])
    if lb_mode>0:
        problems_found['lb_mode']['issue'] = True
        problems_found['lb_mode']['title'] = 'Pools with default LB Algorithm (Round Robin)'
        problems_found['lb_mode']['rating'] = 'Low'
        problems_found['lb_mode']['details'] = f"{lb_mode} out of {len(results['ltm_pools'])} pools have been identified that they are using 'round-robin' as load balancing mode. It is recommended to review the load balancing methods used and consider more advanced algorithms that better suit the application requirements."



    if results['client_ssl_stats']['Protocol'].get('TLS Protocol Version 1.1') >0 or results['client_ssl_stats']['Protocol'].get('TLS Protocol Version 1')>0 or results['client_ssl_stats']['Protocol'].get('SSL Protocol Version 3')>0 or results['client_ssl_stats']['Protocol'].get('SSL Protocol Version 2')>0:
        problems_found['ssl']['issue'] = True
        problems_found['ssl']['title'] = 'Weak TLS Protocol discovered'
        problems_found['ssl']['rating'] = 'High'
        problems_found['ssl']['details'] = 'We have identified that some Client SSL profiles are configured to use deprecated SSL/TLS protocols (SSLv2, SSLv3, TLS 1.0, TLS 1.1). It is strongly recommended to update these profiles to use only secure protocols (TLS 1.2 and above) to enhance security and protect against vulnerabilities associated with older protocols.'


    if len(results['irule_failures']) >0 :
        problems_found['irules']['issue'] = True
        problems_found['irules']['title'] = 'iRule execution failures'
        problems_found['irules']['rating'] = 'High'
        problems_found['irules']['details'] = 'The device has recorded iRule execution failures. It is important to review and address these failures to ensure that iRules function correctly and do not impact application performance or availability.'


    certs=count_expired_certs(results['ssl_certs'])

    if certs > 0 :
        problems_found['expired_cert']['issue'] = True
        problems_found['expired_cert']['title'] = 'Expired or about to expire SSL certificates'
        problems_found['expired_cert']['rating'] = 'High'
        problems_found['expired_cert']['details'] = f"The device has {certs} SSL certificates that are expired or about to expire (60 days). It is crucial to renew or replace these certificates promptly to maintain secure communications and prevent service disruptions due to invalid certificates."

    return problems_found


# ===========================================================================
# Additions for the adsp-audit app: VS-attachment summary, security-profile
# block parsing, Bot/DoS audit checks, and a top-level analyze() entry point.
# (The repo kept create_vs_summary in create_ltm.py; it lives here now.)
# ===========================================================================
def _profiles_from_dict_list(items, key="profile"):
    return {item.get(key) for item in (items or [])
            if isinstance(item, dict) and item.get(key)}


def build_vs_summary(virtuals, dos, bot, tcp_profiles, udp_profiles, http_profiles,
                     http2_profiles, compression_profiles, client_ssl_profiles,
                     server_ssl_profiles, web_acceleration_profiles, ltm_policies=None):
    """Per-virtual-server profile attachment + fleet counts. Ported from
    create_ltm.create_vs_summary. When `ltm_policies` (from parse_ltm_policies)
    is supplied, has_asm is resolved via the attached LTM traffic policy and the
    matched ASM policy name is recorded per VS."""
    http_set = _profiles_from_dict_list(http_profiles)
    clientssl_set = _profiles_from_dict_list(client_ssl_profiles)
    dos_set, bot_set = set(dos or []), set(bot or [])
    pol_by_name = {p.get("policy"): p for p in (ltm_policies or []) if p.get("controls_asm")}

    vs_details = []
    keys = ["dos", "bot", "web_acceleration", "udp", "tcp", "compression",
            "server_ssl", "http", "client_ssl", "asm"]
    counts = {f"count_vs_{k}": 0 for k in keys}
    counts["count_vs"] = 0

    for v in virtuals or []:
        v_profiles = set(v.get("profiles") or [])
        v_policies = [p for p in (v.get("policies") or []) if isinstance(p, str)]
        asm_policy = None
        if pol_by_name:
            for p in v_policies:
                if p in pol_by_name:
                    asm_policy = pol_by_name[p].get("asm_policy") or asm_policy
            has_asm = any(p in pol_by_name for p in v_policies)
        else:
            # fallback when policy data wasn't pulled: detect the auto policy
            has_asm = any("asm_auto_l7_policy" in p for p in v_policies)
        item = {
            "virtual": v.get("virtual"),
            "partition": v.get("partition"),
            "has_dos": bool(v_profiles & dos_set),
            "has_bot": bool(v_profiles & bot_set),
            "has_web_acceleration": bool(v_profiles & set(web_acceleration_profiles or [])),
            "has_udp": bool(v_profiles & set(udp_profiles or [])),
            "has_tcp": bool(v_profiles & set(tcp_profiles or [])),
            "has_compression": bool(v_profiles & set(compression_profiles or [])),
            "has_server_ssl": bool(v_profiles & set(server_ssl_profiles or [])),
            "has_http": bool(v_profiles & http_set),
            "has_client_ssl": bool(v_profiles & clientssl_set),
            "has_asm": has_asm,
            "asm_policy": asm_policy,
        }
        counts["count_vs"] += 1
        for k in keys:
            if item[f"has_{k}"]:
                counts[f"count_vs_{k}"] += 1
        vs_details.append(item)

    return vs_details, counts


def parse_profile_blocks(text: str, profile_type: str) -> list[dict]:
    """Extract each `<profile_type> <name> { ... }` block (balanced braces) from
    a bigip.conf, returning {name, raw}. Used for the Bot/DoS audits, which need
    the profile body, not just its name."""
    out = []
    pat = re.compile(rf"\b{re.escape(profile_type)}\s+(\S+)\s*\{{")
    for m in pat.finditer(text or ""):
        name = m.group(1)
        i = m.end() - 1          # at the opening brace
        depth, j = 0, i
        while j < len(text):
            ch = text[j]
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        body = text[i + 1:j]
        out.append({"name": name, "raw": body.strip()})
    return out


def _attached_profile_names(results: dict) -> set:
    used = set()
    for v in results.get("ltm_virtuals") or []:
        used |= set(v.get("profiles") or [])
    return used


def _finding(name, title, rating, details, **extra):
    f = {"name": name, "title": title, "rating": rating, "details": details, "issue": True}
    f.update(extra)
    return f


def _brace_block(text: str, open_match: re.Match) -> str:
    """Given a regex match whose end sits at (or just before) an opening brace,
    return the balanced `{ ... }` body (brace contents, braces excluded)."""
    i = text.find("{", open_match.end() - 1)
    if i == -1:
        return ""
    depth, j = 0, i
    while j < len(text):
        ch = text[j]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                break
        j += 1
    return text[i + 1:j]


def parse_syslog(text: str) -> dict:
    """Parse `list /sys syslog all-properties`. We only need the remote-logging
    posture: the `remote-servers` entries (host / port), plus a couple of
    context fields. `remote-servers` is either the literal `none` or a block of
    `<name> { host <ip> remote-port <n> local-ip <ip> }` entries."""
    text = text or ""
    data = {
        "remote_servers": [],
        "console_log": get_field(text, "console-log"),
        "iso_date": get_field(text, "iso-date"),
    }
    m = re.search(r"\bremote-servers\s*\{", text)
    if m:
        block = _brace_block(text, m)
        for sm in re.finditer(r"(\S+)\s*\{([^{}]*)\}", block):
            body = sm.group(2)
            data["remote_servers"].append({
                "name": sm.group(1),
                "host": get_field(body, "host"),
                "remote_port": get_field(body, "remote-port"),
                "local_ip": get_field(body, "local-ip"),
            })
    return data


def audit_syslog(results: dict) -> list[dict]:
    """Remote-logging check based solely on `list /sys syslog all-properties`:
    flag when the device forwards no system logs off-box via syslog. Silent when
    the command wasn't pulled (older audits) so it never guesses."""
    syslog = results.get("syslog")
    if not syslog:
        return []
    if syslog.get("remote_servers"):
        return []  # at least one remote syslog destination — good
    return [_finding(
        "syslog_no_remote",
        "No remote syslog server configured",
        "Medium",
        "The device has no remote syslog destination (sys syslog remote-servers is empty), so "
        "system and audit logs live only on the box. If the unit fails or is replaced that "
        "history is lost, and central monitoring/SIEM alerting has no feed from this device. "
        "Configure one or more remote syslog servers (or an equivalent off-box log stream).",
        additional="tmsh: modify /sys syslog remote-servers add { <name> { host <ip> remote-port 514 } }",
    )]


# Bot-Defense template strictness (weakest first). 'relaxed' applies minimal
# mitigation, so it's worth surfacing.
_BOT_WEAK_TEMPLATES = {"relaxed"}


def audit_bot_profiles(results: dict) -> list[dict]:
    """Best-practice checks for Bot-Defense profiles, read from the raw profile
    body captured in the QKView config (no re-pull). Checks: attachment,
    enforcement mode, template strictness, and per-class mitigation posture.
    Each check is token-guarded, so it stays silent when a key isn't present."""
    out = []
    used = _attached_profile_names(results)
    for p in results.get("bot_profiles") or []:
        nm = p.get("name")
        raw = p.get("raw") or ""
        if nm and nm not in used:
            out.append(_finding(
                nm, "Bot-Defense profile not attached to any virtual server", "Low",
                f"Bot-Defense profile '{nm}' is configured but not applied to any virtual server, so it provides no protection.",
                additional="Attach the profile to the relevant virtual server(s), or remove it if unused."))

        if re.search(r"\benforcement-mode\s+transparent\b", raw):
            out.append(_finding(
                nm, "Bot-Defense profile in transparent (report-only) mode", "Medium",
                f"Bot-Defense profile '{nm}' is in transparent mode — bot traffic is logged but not mitigated. Set enforcement to blocking once validated.",
                additional="modify security bot-defense profile <name> enforcement-mode blocking"))

        tmpl = get_field(raw, "template")
        if tmpl and tmpl.lower() in _BOT_WEAK_TEMPLATES:
            out.append(_finding(
                nm, "Bot-Defense profile uses the 'relaxed' template", "Low",
                f"Bot-Defense profile '{nm}' is built on the '{tmpl}' template, which applies minimal mitigation "
                f"(mostly benign-bot handling). Consider 'balanced' or 'strict' for meaningful bot protection.",
                additional="Review the template under Security ›› Bot Defense, or set a stricter template."))

        # Browser verification / challenge disabled leaves automated clients
        # effectively unchallenged.
        if re.search(r"\bbrowser-verification\s+none\b", raw):
            out.append(_finding(
                nm, "Bot-Defense browser verification disabled", "Low",
                f"Bot-Defense profile '{nm}' has browser verification set to 'none', so clients are not challenged "
                f"to prove they are real browsers — automated tools are harder to distinguish from users.",
                additional="Enable a browser-verification challenge appropriate to the application."))
    return out


def audit_dos_profiles(results: dict) -> list[dict]:
    """Best-practice checks for DoS profiles, with a deeper look at the L7
    (application) section read from the raw profile body (no re-pull). Checks:
    attachment, presence of an application (L7) section, and whether the L7
    detections are mitigating or merely in transparent/detection-only mode.
    Token-guarded so unknown layouts never produce a false positive."""
    out = []
    used = _attached_profile_names(results)
    for p in results.get("dos_profiles") or []:
        nm = p.get("name")
        raw = p.get("raw") or ""
        if nm and nm not in used:
            out.append(_finding(
                nm, "DoS profile not attached to any virtual server", "Low",
                f"DoS profile '{nm}' is configured but not applied to any virtual server, so it provides no protection.",
                additional="Attach the profile to the relevant virtual server(s), or remove it if unused."))

        am = re.search(r"\bapplication\s*\{", raw)
        if not am:
            # No L7 section — only network / protocol DoS. Informational.
            if raw:
                out.append(_finding(
                    nm, "DoS profile has no application (L7) protection", "Low",
                    f"DoS profile '{nm}' defines no application section, so it provides only network/protocol-layer "
                    f"DoS protection — HTTP/L7 flood and behavioral detection are not configured.",
                    additional="Add an application DoS section if this profile fronts HTTP virtual servers."))
            continue

        app = _brace_block(raw, am)
        has_blocking = re.search(r"\b(?:mode|operation-mode)\s+(?:blocking|blocked)\b", app) \
            or re.search(r"\bmitigation-mode\s+\w", app)
        has_transparent = re.search(r"\b(?:mode|operation-mode)\s+transparent\b", app)
        if has_transparent and not has_blocking:
            out.append(_finding(
                nm, "Application-layer DoS is detection-only (transparent)", "Medium",
                f"DoS profile '{nm}' has its application (L7) detection in transparent mode — attacks are detected "
                f"and logged but not mitigated. Move to blocking once thresholds are validated.",
                additional="Set the application DoS detection modes to blocking after a learning period."))

        # Behavioral DoS is F5's strongest L7 signal; flag when clearly off.
        if re.search(r"\bbehavioral[\s-]?detection\b", app) and re.search(r"\bbehavioral[\s-]?detection\s*\{[^{}]*\bmode\s+off\b", app):
            out.append(_finding(
                nm, "Behavioral DoS detection disabled", "Low",
                f"DoS profile '{nm}' has behavioral detection turned off, so the dynamic, ML-based L7 DoS signal "
                f"is not in use.",
                additional="Enable behavioral detection for adaptive application-layer DoS protection."))
    return out


# Minimum BIG-IP version for hybrid post-quantum (ML-KEM) key exchange.
# Per F5: X25519MLKEM768 client/server-side support lands in TMOS 17.5.1 and
# requires TLS 1.3, configured via a cipher rule/group (not a cipher string).
_PQC_MIN_VERSION = (17, 5, 1)

# weak cipher-string tokens (OpenSSL/F5 keywords) that materially weaken a
# client-SSL profile when present and not negated with a leading '!'.
_WEAK_CIPHER_TOKENS = {
    "rc4": "RC4", "3des": "3DES", "des": "DES", "des-cbc3": "3DES", "md5": "MD5",
    "exp": "export-grade", "export": "export-grade", "null": "NULL encryption",
    "adh": "anonymous DH", "anull": "anonymous (no auth)", "enull": "NULL encryption",
    "low": "LOW-strength", "ssonly": "weak", "all": "ALL (unrestricted)", "@speed": "speed-ordered",
}


def _version_tuple(v) -> tuple:
    parts = re.findall(r"\d+", str(v or ""))
    return tuple(int(p) for p in parts[:4])


def _cipher_tokens(ciphers: str) -> list[str]:
    return [t.strip().lower() for t in re.split(r"[:\s,]+", ciphers or "") if t.strip()]


def audit_client_ssl(results: dict) -> list[dict]:
    """Static best-practice audit of Client-SSL profiles: legacy protocol
    exposure, TLS 1.3 enablement, weak cipher strings, and post-quantum (PQC)
    readiness. Works from the stored profile config (no re-pull). DEFAULT /
    cipher-group profiles are not flagged on ciphers alone (their contents
    aren't enumerable here), but their protocol options still are."""
    out = []
    profiles = results.get("client_ssl") or []
    if not profiles:
        return out
    attached = _attached_profile_names(results)
    version = _version_tuple((results.get("version_file") or {}).get("Version")
                             or (results.get("list_cm_device") or {}).get("version"))

    legacy, no_tls13, weak = [], [], []
    tls13_anywhere = False

    for p in profiles:
        nm = p.get("profile") or p.get("name") or "?"
        opts = {str(o).strip().lower() for o in (p.get("options") or [])}
        ciphers = p.get("ciphers") or ""
        in_use = nm in attached
        tag = nm + (" (in use)" if in_use else "")

        sslv3_off = "no-sslv3" in opts or "no-ssl" in opts
        tls10_off = "no-tlsv1" in opts
        tls11_off = "no-tlsv1.1" in opts
        tls13_off = "no-tlsv1.3" in opts
        if not tls13_off:
            tls13_anywhere = True

        if not (sslv3_off and tls10_off and tls11_off):
            legacy.append(tag)
        if tls13_off:
            no_tls13.append(tag)

        # weak cipher tokens only when an explicit cipher string is set
        cl = ciphers.strip().lower()
        if cl and cl not in ("none", "default"):
            hits = []
            for tok in _cipher_tokens(ciphers):
                if tok.startswith("!"):
                    continue
                label = _WEAK_CIPHER_TOKENS.get(tok)
                if label:
                    hits.append(label)
            if hits:
                weak.append(f"{tag}: {ciphers} → {', '.join(sorted(set(hits)))}")

    kb = "https://my.f5.com/manage/s/article/K000149577"
    if legacy:
        out.append(_finding(
            "clientssl_legacy_protocols",
            "Client-SSL profiles allow legacy SSL/TLS protocols", "High",
            "These Client-SSL profiles do not explicitly disable SSLv3 / TLS 1.0 / TLS 1.1, so "
            "down-level clients may negotiate deprecated protocols: " + "; ".join(legacy)
            + ". Add the no-sslv3, no-tlsv1 and no-tlsv1.1 options (TLS 1.2 minimum).",
            additional="Protocol hardening: https://my.f5.com/manage/s/article/K13171"))
    if weak:
        out.append(_finding(
            "clientssl_weak_ciphers",
            "Client-SSL profiles with weak cipher configuration", "High",
            "These Client-SSL profiles permit weak or non-forward-secret ciphers: " + "; ".join(weak)
            + ". Move to a curated cipher group (ECDHE + AES-GCM/ChaCha20) and exclude RC4/3DES/DES/MD5/export/NULL/anonymous."))
    if no_tls13:
        out.append(_finding(
            "clientssl_no_tls13",
            "TLS 1.3 disabled on Client-SSL profiles", "Medium",
            "TLS 1.3 is disabled (no-tlsv1.3) on: " + "; ".join(no_tls13)
            + ". TLS 1.3 brings stronger, faster handshakes and is a prerequisite for post-quantum key exchange."))

    # --- PQC readiness ---
    if version and version < _PQC_MIN_VERSION:
        out.append(_finding(
            "clientssl_pqc_upgrade",
            "Not ready for post-quantum cryptography (PQC)", "Low",
            f"The device runs {'.'.join(map(str, version))}. Hybrid post-quantum key exchange "
            f"(X25519MLKEM768) requires BIG-IP 17.5.1 or later and TLS 1.3. Plan an upgrade to "
            f"17.5.1+ to begin adopting PQC and protect against 'harvest-now, decrypt-later' attacks.",
            additional=f"Enable PQC in BIG-IP: {kb}"))
    elif version:  # 17.5.1+ — capable; recommend enabling it
        detail = ("The device is PQC-capable. Enable hybrid post-quantum key exchange "
                  "(X25519MLKEM768) via a cipher rule/group on your TLS 1.3 Client-SSL profiles.")
        if not tls13_anywhere:
            detail += " First enable TLS 1.3 — every Client-SSL profile currently disables it."
        out.append(_finding(
            "clientssl_pqc_enable",
            "Adopt post-quantum cryptography (PQC) key exchange", "Low",
            detail, additional=f"Enable PQC in BIG-IP: {kb}"))
    return out


def _iter_top_level_blocks(text: str):
    """Yield (name, inner) for each `name { ... }` at the top level of `text`,
    skipping nested blocks. Used for pool members / policy actions."""
    i, n = 0, len(text)
    while i < n:
        if text[i] == "{":
            # name = token immediately before this brace
            j = i - 1
            while j >= 0 and text[j] in " \t":
                j -= 1
            k = j
            while k >= 0 and text[k] not in " \t\n{}":
                k -= 1
            name = text[k + 1:j + 1]
            depth, p = 0, i
            while p < n:
                if text[p] == "{":
                    depth += 1
                elif text[p] == "}":
                    depth -= 1
                    if depth == 0:
                        break
                p += 1
            yield name, text[i + 1:p]
            i = p + 1
            continue
        i += 1


def _parse_pool_members(pool_body: str) -> list[dict]:
    """Parse the members { ... } block of one pool into a list of member dicts
    {name, address, state, session}."""
    inner = find_block(pool_body, "members")
    if inner is None:
        return []
    members = []
    for name, blk in _iter_top_level_blocks(inner):
        if not name:
            continue
        def g(key):
            m = re.search(rf'(?m)^\s*{key}\s+(\S+)', blk)
            return m.group(1) if m else None
        members.append({"name": name, "address": g("address"),
                        "state": g("state"), "session": g("session")})
    return members


def parse_ltm_policies(text: str) -> list[dict]:
    """Parse `list /ltm policy all-properties`. Returns one dict per LTM traffic
    policy: {policy, partition, controls_asm, asm_policy}. asm_policy is the ASM
    policy name attached by the policy's rule action (the VS↔ASM link)."""
    out = []
    for m in re.finditer(r'(?m)^ltm policy\s+(\S+)\s*\{', text or ""):
        name = m.group(1)
        start = (text or "").find("{", m.end() - 1)
        depth, p, s = 0, start, text or ""
        while p < len(s):
            if s[p] == "{":
                depth += 1
            elif s[p] == "}":
                depth -= 1
                if depth == 0:
                    break
            p += 1
        inner = s[start + 1:p]
        controls_asm = bool(re.search(r'controls\s*\{[^}]*\basm\b', inner))
        asm_names = [x for x in re.findall(r'(?m)^\s*policy\s+(\S+)', inner)
                     if x and x.lower() != "none"]
        part = re.search(r'(?m)^\s*partition\s+(\S+)', inner)
        out.append({
            "policy": name,
            "partition": part.group(1) if part else None,
            "controls_asm": controls_asm,
            "asm_policy": asm_names[0] if (controls_asm and asm_names) else None,
        })
    return out


def build_asm_mapping(virtuals: list, policies: list) -> list[dict]:
    """Resolve which ASM policy is applied to each virtual server, via the LTM
    traffic policy attached to the VS. Returns [{virtual, ltm_policy, asm_policy}]
    for every VS that has an ASM-controlling policy."""
    by_name = {p.get("policy"): p for p in policies or []}
    out = []
    for v in virtuals or []:
        for pol in v.get("policies") or []:
            if not isinstance(pol, str) or pol.lower() == "none":
                continue
            info = by_name.get(pol)
            if info and info.get("controls_asm"):
                out.append({"virtual": v.get("virtual"), "ltm_policy": pol,
                            "asm_policy": info.get("asm_policy")})
    return out


def audit_pools(results: dict) -> list[dict]:
    """Pool health checks from the enriched pool data (members, state)."""
    out = []
    pools = results.get("ltm_pools") or []
    no_members, single, down = [], [], []
    for p in pools:
        if "member_count" not in p:   # pre-enrichment audit data; skip silently
            continue
        name = p.get("pool")
        mc = p.get("member_count") or 0
        if mc == 0:
            no_members.append(name)
        elif mc == 1:
            single.append(name)
        for mb in p.get("members") or []:
            st, sess = (mb.get("state") or "").lower(), (mb.get("session") or "").lower()
            if st in ("down", "user-down", "checking", "unchecked") or "disabled" in sess:
                down.append(f"{name} → {mb.get('name')} (state={mb.get('state')}, session={mb.get('session')})")
    if no_members:
        out.append(_finding("pool_no_members", "Pools with no members", "Medium",
                            "These pools have no members and cannot serve traffic: " + ", ".join(no_members) + "."))
    if single:
        out.append(_finding("pool_single_member", "Pools with a single member (no redundancy)", "Low",
                            "These pools have only one member, so there is no redundancy if it fails: " + ", ".join(single) + "."))
    if down:
        out.append(_finding("pool_members_down", "Pool members down or disabled", "Medium",
                            "These pool members were down or administratively disabled at capture time: " + "; ".join(down) + "."))
    return out


def audit_virtuals(results: dict) -> list[dict]:
    """Virtual-server hygiene from the enriched VS data (destination, pool)."""
    out = []
    virtuals = results.get("ltm_virtuals") or []
    wildcard, orphan = [], []
    for v in virtuals:
        if "destination" not in v:    # pre-enrichment audit data; skip silently
            continue
        name = v.get("virtual")
        dest = v.get("destination") or ""
        ip = dest.rsplit(":", 1)[0].lstrip("/").split("/")[-1] if dest else ""
        if ip in ("0.0.0.0", "any", "::", "any6"):
            wildcard.append(f"{name} ({dest})")
        pool = (v.get("pool") or "none").lower()
        rules = [r for r in (v.get("rules") or []) if str(r).lower() != "none"]
        if pool == "none" and not rules:
            orphan.append(name)
    if wildcard:
        out.append(_finding("vs_wildcard_destination", "Virtual servers with a wildcard destination", "Low",
                            "These virtual servers listen on a wildcard address/port — confirm this is intended and not overly broad: "
                            + "; ".join(wildcard) + "."))
    if orphan:
        out.append(_finding("vs_orphan", "Virtual servers with no pool and no iRule", "Low",
                            "These virtual servers have neither a default pool nor an iRule, so they may be orphaned/misconfigured: "
                            + ", ".join(orphan) + "."))
    return out


def audit_security_logging(results: dict) -> list[dict]:
    """Flag virtual servers whose attached security logging profile logs *every*
    request (the built-in 'Log all requests', or a profile named likewise)."""
    offenders = []
    for v in results.get("ltm_virtuals") or []:
        for lp in v.get("security-log-profiles") or []:
            if lp and str(lp).rsplit("/", 1)[-1].strip().lower() == "log all requests":
                offenders.append(v.get("virtual"))
                break
    if not offenders:
        return []
    return [_finding(
        "seclog_log_all_requests",
        "Security logging profile 'Log all requests' enabled",
        "Medium",
        "The 'Log all requests' security logging profile is attached to the following virtual server(s), so "
        "every request — not just policy violations — is written to the logging database: "
        + "; ".join(offenders) + ". Logging all requests quickly overruns the available log storage, and "
        "because the log store is a LIFO buffer, once it fills the useful log entries (such as real "
        "violations) are overwritten and lost. Use 'Log illegal requests' (or a filtered profile) in "
        "production, and reserve 'Log all requests' for short, deliberate troubleshooting windows.",
        additional="Attach 'Log illegal requests' instead, or a custom profile that logs only violations; "
                   "keep 'Log all requests' only for brief troubleshooting.",
    )]


_IGNORE_PATH = os.path.join(os.path.dirname(__file__), os.pardir, "data", "ignore_diagnostics.txt")


def load_ignore_list(path: str | None = None) -> set:
    """Diagnostic headers (h_header) to suppress as known noise. Ported from
    create_ltm.load_ignore_list; defaults to the bundled ignore_diagnostics.txt."""
    ignored: set[str] = set()
    try:
        with open(path or _IGNORE_PATH, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    ignored.add(line)
    except FileNotFoundError:
        pass
    return ignored


def apply_exclusions(findings: dict, excluded: dict | None) -> dict:
    """Return a copy of `findings` with user-removed items dropped: ltm/bot/dos
    findings whose `name` is in excluded['findings'], and CVE/other diagnostics
    whose `h_header` is in excluded['diag']."""
    if not findings or not excluded:
        return findings or {}
    fset = set(excluded.get("findings") or [])
    dset = set(excluded.get("diag") or [])
    out = dict(findings)
    for dom in ("ltm", "bot", "dos"):
        out[dom] = [f for f in (findings.get(dom) or []) if f.get("name") not in fset]
    diag = findings.get("diag") or {}
    out["diag"] = {
        "cve": [d for d in (diag.get("cve") or []) if d.get("h_header") not in dset],
        "other": [d for d in (diag.get("other") or []) if d.get("h_header") not in dset],
    }
    return out


def analyze_diagnostics(diagnostics: dict) -> dict:
    """Process the raw iHealth diagnostics into the two simplified, ignore-list
    filtered lists the original report used: CVE vulnerabilities and other
    (non-CVE) heuristic findings. Returns {cve:[...], other:[...]} plus a
    severity rollup. Resilient to a missing/odd diagnostics payload."""
    ignore_set = load_ignore_list()
    try:
        cve = simplify_diagnostics(diagnostics or {}, ignore_set).get("diagnostics_simplified", [])
    except Exception:
        cve = []
    try:
        other = simplify_non_cve(diagnostics or {}, ignore_set).get("diagnostics_simplified", [])
    except Exception:
        other = []
    return {"cve": cve, "other": other}


def analyze(results: dict, diagnostics: dict | None = None) -> dict:
    """Top-level LTM analysis. Returns findings grouped by domain:
    {ltm:[...], bot:[...], dos:[...], diag:{cve,other}} — each domain a list of
    issue dicts; `diag` holds the processed iHealth diagnostics."""
    try:
        ltm = [f for f in dict_to_list(run_audit(results)) if f.get("issue")]
    except Exception as e:
        # A 404'd command leaves a None in `results` that run_audit may not
        # expect. Don't let one gap sink the whole review.
        ltm = [_finding("audit_error", "LTM best-practice audit incomplete", "Low",
                        f"Some device data was unavailable from the QKView, so parts of the "
                        f"LTM audit could not run ({e}).")]
    for extra in (audit_client_ssl, audit_pools, audit_virtuals, audit_syslog, audit_security_logging):
        try:
            ltm += extra(results)
        except Exception:
            pass
    return {
        "ltm": ltm,
        "bot": audit_bot_profiles(results),
        "dos": audit_dos_profiles(results),
        "diag": analyze_diagnostics(diagnostics or {}),
    }