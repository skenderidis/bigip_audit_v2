# Audit for BIGIP

A web application for auditing **F5 BIG-IP** devices and producing clear,
client-ready findings and reports. It covers two complementary review types:

- **WAF Policy Audit** — review an Advanced WAF / ASM policy against a target
  security posture and OWASP Top-10 coverage.
- **LTM Configuration Audit** — review a device's LTM/system configuration,
  health, CVEs and diagnostics pulled straight from an F5 **iHealth** QKView.

It's built for F5 administrators, security engineers, and consultants who need
to turn a raw policy export or a QKView into a prioritized, explainable set of
findings — and a polished **Word / Excel** report — in minutes rather than days.

```
┌──────────┐   :5175    ┌──────────────┐          ┌─────────────┐
│ browser  │ ─────────▶ │  web (nginx) │ ──/api──▶ │  backend    │ ──▶ Postgres
└──────────┘            │  serves SPA  │          │  FastAPI    │
                        └──────────────┘          └──────┬──────┘
                                                         │ (optional)
                                                   F5 iHealth API
```

---

## What it does at a glance

| | WAF Policy Audit | LTM Configuration Audit |
|---|---|---|
| **Input** | Declarative WAF/AS3 or iControl-REST policy JSON (uploaded) | QKView pulled from F5 iHealth by ID |
| **Analysis** | 20+ check groups, maturity templates, OWASP Top-10 scoring | Device inventory, config checks, CVEs, iHealth diagnostics |
| **Tuning** | Editable violation catalog (severity + score) | Editable diagnostics ignore-list; remove findings |
| **Reports** | OWASP report, summary, full "ASM Config Review" (Word) | Full "LTM Config Review" (Word, with graphs) + Excel |

---

## WAF Policy Audit

Turn an exported WAF/ASM policy into a prioritized findings list, a maturity
gap analysis, and an OWASP coverage score.

**Import** — Upload a policy as JSON. Both shapes are understood and normalized
automatically: the declarative **WAF Manager / AS3** form and a flat
**iControl-REST** BIG-IP export.

**Posture templates (Level 1 / 2 / 3)** — Compare the policy against a target
maturity level. The audit reports the **gap**: which controls are missing,
weaker than target, or in the wrong enforcement state. Templates are editable,
and you can save your own.

**Check coverage** — 20+ check groups across the whole policy, including:
policy builder / learning mode, blocking & enforcement settings, evasion
techniques, compliance, **attack-signature sets and signature overview**, URLs,
parameters, headers, cookies, HTTP methods, response codes, sensitive
parameters, trusted IPs, **IP Intelligence**, file types, redirection domains,
and **geolocation**. Each finding carries a severity (info / warning / error)
and a score pulled from the **Violation Catalog**, which you can tune in
Settings so results match your organization's risk weighting.

**OWASP Top-10 (2021) coverage** — A per-category score (A01 Broken Access
Control through A10 SSRF) computed from the signature sets and protections the
policy actually enforces. Controls that can't be derived from a declarative
policy (for example the virtual server's TLS posture, which lives on the LTM
side) are surfaced as **acknowledgement** items you accept per policy, so the
score reflects reality.

**Guided Template Wizard** — Don't have a policy yet, or want a recommended
baseline? Answer a short series of questions and the wizard produces the set of
checks/controls to enable. Two flows:
- **Web Application** — the standard interactive-app baseline.
- **API** — OpenAPI-driven: supplying an OpenAPI spec unlocks schema
  whitelisting, parameter and header enforcement, etc.; a JWT question enables
  the JWT validation checks in place of login-page protections.

  (Uses **allow list / block list** terminology throughout.)

**Bundled reference data** — ~9,300 attack signatures, 30 signature sets, and
~1,000 threat campaigns are seeded on first start and browsable/searchable in
Settings, so signature-set findings are explained in context.

**Outputs** — Per-policy **OWASP report**, a **download summary** of
suggestions, a **coverage-gap** report, and the full **"F5 ASM – Config
Review"** Word document. Individual findings can be removed, and removed items
are excluded from the report.

---

## LTM Configuration Audit

Pull a device's QKView from iHealth and get a structured review of its LTM and
system configuration, health, known CVEs, and iHealth diagnostics.

**One-time setup** — Enter your F5 iHealth API **client ID / secret** under
Settings → iHealth Credentials. The secret is **encrypted at rest** (never
stored or shown in plaintext). Then audit a device simply by its QKView ID.

**Device inventory** — A single panel summarizing the device: platform,
hostname, software version, chassis ID, DNS, NTP, time zone, licensed and
**provisioned modules** (ASM / AVR / LTM), **failover state**, active CPUs, and
total / available memory.

**Configuration findings** — Automated checks across:
- **Client SSL profiles** (weak/insecure settings)
- **Pools** and **virtual servers**
- **Remote syslog / logging** — is the device shipping logs off-box?
- **Security log profile** — a warning when *"Log all requests"* is enabled on a
  virtual server (it can exhaust the on-box DB and, being LIFO, overwrite useful
  logs)
- **Bot Defense** profiles
- **L7 (HTTP) DoS** profiles

**CVEs & diagnostics** — Known-issue **CVEs** and **"Other diagnostics"**
straight from iHealth, each shown as Severity / Finding / Detail with an
expandable detail drawer. A per-deployment, editable **ignore-list** suppresses
known-noise diagnostics.

**Inventory browser** — Drill into **virtual servers** and **pools** to see
their profiles, iRules, and raw configuration in a drawer; separate **Bot** and
**DoS** inventory sections show each profile's configuration the same way.

**Resource graphs** — Drag-and-drop the six iHealth *Resources-Utilization*
graphs (Throughput, HTTP Requests, Memory Usage, SSL Transactions, CPU
Utilization, Active Connections). They're recognized by filename and embedded
into the Word report.

**Device list** — Every audited device listed by its **FQDN**, with at-a-glance
**LTM / CVE / Other** finding counts and one-click **Word / Excel** export per
device.

**Curate before you report** — Remove any finding, CVE, or diagnostic (it drops
into a collapsible *Removed* section and is excluded from the Word report).

**Outputs** — A faithful **"F5 LTM – Config Review"** Word document (cover page,
populated table of contents, per-finding sections, an expiring-certificates
table, and the resource graphs) plus an **Excel** workbook. The detail view is
organized into **Device Info / Inventory / LTM Findings / Diagnostics** tabs.

---

## How it helps

- **Faster reviews** — a raw export or QKView becomes a structured, prioritized
  report in minutes.
- **Consistent & explainable** — every finding maps to a tunable catalog entry
  or an iHealth diagnostic, so results are defensible and repeatable.
- **Actionable** — maturity-level gaps and OWASP coverage tell you exactly what
  to fix next.
- **Client-ready** — professional Word/Excel deliverables, with the ability to
  curate findings before export.

---

## Getting started (Docker)

> The runnable stack (backend, frontend, `docker-compose.yml`) lives in the
> **`app/`** folder — adjust the path below if you named it differently.

Prerequisites: Docker Engine 24+ with the Compose plugin.

```bash
cd app
cp .env.example .env
# Edit .env and set: POSTGRES_PASSWORD, SECRET_KEY, FIRST_ADMIN_PASSWORD
#   generate a SECRET_KEY:  python3 -c "import secrets; print(secrets.token_urlsafe(48))"

docker compose up -d --build
```

Open **http://localhost:5175** and sign in with `FIRST_ADMIN_USERNAME` /
`FIRST_ADMIN_PASSWORD`. Change the password in-app (user menu → Change
password), then add your iHealth credentials under Settings to enable LTM pulls.

Only the web port (`5175`) is published; the browser talks to a single origin
and nginx proxies `/api` to the backend. The backend and Postgres stay on the
internal Compose network.

```bash
docker compose logs -f backend   # follow logs
docker compose down              # stop (keeps data)
docker compose down -v           # stop and WIPE all data
```

## Configuration

All settings come from `app/.env` (see `.env.example`). Key variables:

| Variable | Purpose |
|---|---|
| `POSTGRES_PASSWORD` | Database password (**required**). |
| `SECRET_KEY` | **Required.** Signs JWTs *and* derives the key that encrypts the stored iHealth secret. Keep it stable — changing it invalidates all logins and the saved iHealth credential. |
| `FIRST_ADMIN_USERNAME` / `FIRST_ADMIN_PASSWORD` / `FIRST_ADMIN_EMAIL` | Admin account created once, on an empty database. |
| `CORS_ORIGINS` | `["*"]` by default (any origin, no credentials — safe, auth is a Bearer token). Lock down with a JSON list if you like. |
| `WEB_PORT` | Host port for the UI (default `5175`). |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Session lifetime (default 480 = 8h). |

## Data & persistence

Two named volumes hold all state and survive `docker compose down`:

- **`pgdata`** — Postgres: users, audits, findings, uploaded graphs, and the
  (encrypted) iHealth credential.
- **`backend-data`** — user-editable settings: the violation catalog, custom
  wizard templates, the diagnostics ignore-list, and the report cover details.
  Seeded from shipped defaults on first boot.

`docker compose down -v` deletes both (full reset).

## Security notes

- Backend and database ports are **not** published to the host — only the web
  UI port is.
- The iHealth client secret is **encrypted at rest** (Fernet, key derived from
  `SECRET_KEY`).
- Login is **rate-limited per client IP** (10 free attempts, then 1 per 10s);
  nginx forwards the real client IP so the limit is per-client, not global.
- Put a TLS-terminating proxy in front of the web container for any non-local
  deployment, and use strong, unique values for `SECRET_KEY` and the passwords.

## Troubleshooting

- **Port 5175 in use** → set `WEB_PORT` in `.env`.
- **Backend keeps restarting** → `docker compose logs backend`; usually a bad
  `DATABASE_URL`/password or a missing `SECRET_KEY`.
- **Can't log in after changing `SECRET_KEY`** → expected; log in again, and
  re-enter the iHealth secret.
- **Reset everything (incl. admin password)** → `docker compose down -v` then
  `up` recreates the admin from `.env` (this also deletes all audits).

## Tech stack

FastAPI (async SQLAlchemy) + Postgres on the backend; React + Vite + Tailwind
on the frontend, served by nginx. Reports via `python-docx` and `openpyxl`.
