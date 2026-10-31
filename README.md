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
                        ─────────────────────────────────────────────────────────────
┌──────────┐   :5175    │  ┌──────────────┐           ┌─────────────┐
│ browser  │ ─────────▶ │  │  web (nginx) │ ──/api──▶ │  backend    │ ──▶ Postgres
└──────────┘            │  │  serves SPA  │           │  FastAPI    │
                        │  └──────────────┘           └──────┬──────┘
                        │                                    │ (optional)
                        │                              F5 iHealth API
                        ─────────────────────────────────────────────────────────────


```

---

## Contents

- [What it does at a glance](#what-it-does-at-a-glance)
- [How it helps](#how-it-helps)
- [WAF Policy Audit](#waf-policy-audit)
- [LTM Configuration Audit](#ltm-configuration-audit)
- [Getting started (Docker)](#getting-started-docker)
- [Configuration](#configuration)
- [Data & persistence](#data--persistence)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)
- [Tech stack](#tech-stack)

---

## What it does at a glance

| | WAF Policy Audit | LTM Configuration Audit |
|---|---|---|
| **Input** | ASM policy JSON (uploaded - Full Export) | QKView pulled from F5 iHealth by ID |
| **Analysis** | 20+ check groups, maturity templates, OWASP Top-10 scoring | Device inventory, config checks, CVEs, iHealth diagnostics |
| **Tuning** | Editable violation catalog (severity + score) | Editable diagnostics ignore-list; remove findings |
| **Reports** | OWASP report, summary, full "ASM Config Review" (Word) | Full "LTM Config Review" (Word, with graphs) + Excel |

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

## WAF Policy Audit

Turn an exported WAF/ASM policy into a prioritized findings list, a maturity gap
analysis, and an OWASP coverage score.

**Import** — Upload an ASM policy as JSON. Make sure you export it as a 
***Full Policy*** and not as ***Template-based***, as most of the configurations 
are not shown on the second option. 


**Templates** — A WAF policy can be set up loosely or
strictly. You pick a configuration ***template*** and the tool compares your 
policy against it and shows the **gaps**: protections that are missing, turned 
on but weaker than they should be, or set only to log instead of actually block. 
The levels are starting points you can edit, and you can save your own.

**Health check** — The tool inspects more than 20 areas of the policy and
flags anything that looks off. In plain terms it looks at: how the policy learns
your traffic and whether it is really blocking attacks; known evasion tricks;
the attack-signature sets that catch things like SQL injection and cross-site
scripting; and the rules around URLs, parameters, headers, cookies, allowed HTTP
methods, response codes, sensitive data, trusted IPs, IP reputation, file types,
redirects, and geolocation. Every issue is labelled **info**, **warning**, or
**error** and given a score. If your organization weighs risks differently, you
can change those severities and scores in **Settings → Violation Catalog**, and
every report updates to match.

**OWASP Top-10 coverage** — The OWASP Top-10 is the industry's standard list of
the most common web application risks. The tool gives you a score for each of
the ten categories (from **A01 Broken Access Control** to **A10 SSRF**) based on
what your policy actually enforces, so you can see your coverage at a glance. A
few controls can't be read from the policy file alone — for example TLS /
encryption, which is configured on the LTM side, not in the WAF policy. For
those, the tool simply asks you to confirm whether the control is in place, so
the score reflects your real environment instead of guessing.

**Guided setup wizard** — Don't have a policy yet, or want a solid starting
point? Answer a few plain-language questions and the wizard recommends which
protections to turn on. There are two paths:
- **Web application** — for a normal website or web app.
- **API** — for an API backend. If you upload its **OpenAPI specification** (the
  file that describes the API's endpoints and fields), the wizard enables
  precise checks on each parameter and header; and if the API uses **JWT**
  tokens to sign in users, it turns on the matching token-validation checks
  instead of login-page protections.

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

## Troubleshooting

- **Port 5175 in use** → set `WEB_PORT` in `.env`.
- **Backend keeps restarting** → `docker compose logs backend`; usually a bad
  `DATABASE_URL`/password or a missing `SECRET_KEY`.
- **Can't log in after changing `SECRET_KEY`** → expected; log in again, and
  re-enter the iHealth secret.
- **Reset everything (incl. admin password)** → `docker compose down -v` then
  `up` recreates the admin from `.env` (this also deletes all audits).

## Tech stack

**Backend** — Python / **FastAPI** with async **SQLAlchemy** over
**PostgreSQL**. JWT (HS256) auth with bcrypt-hashed passwords; the stored iHealth
secret is encrypted with Fernet. QKViews are fetched from the **F5 iHealth API**
with httpx, and **Word / Excel** reports are generated with `python-docx` and
`openpyxl`.

**Frontend** — **React** (Vite) with **Tailwind CSS**, built to static assets
and served by **nginx**, which also reverse-proxies the API to the backend.

**Packaging** — **Docker Compose**: three health-checked services (nginx web,
FastAPI backend, PostgreSQL), with all state kept in named volumes.
