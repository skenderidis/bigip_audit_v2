# Audit for BIGIP

Web app for auditing F5 BIG-IP devices (WAF/ASM policy review and LTM
configuration review) from iHealth QKViews. FastAPI backend + React/Vite
single-page UI, packaged to run with Docker Compose.

```
┌──────────┐   :5175    ┌──────────────┐          ┌─────────────┐
│ browser  │ ─────────▶ │  web (nginx) │ ──/api──▶ │  backend    │
└──────────┘            │  serves SPA  │          │  FastAPI    │
                        └──────────────┘          │  uvicorn    │
                                                   └──────┬──────┘
                                                          │
                                                   ┌──────▼──────┐
                                                   │  db         │
                                                   │  Postgres   │
                                                   └─────────────┘
```

Only the **web** port (`5175`) is published. The browser talks to a single
origin; nginx reverse-proxies `/api` to the backend, which is not exposed to
the host. Postgres is reachable only on the internal Compose network.

---

## Prerequisites

- Docker Engine 24+ and the Docker Compose plugin (`docker compose`).

## Quick start

```bash
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, SECRET_KEY, FIRST_ADMIN_PASSWORD.
# Generate a SECRET_KEY:
#   python3 -c "import secrets; print(secrets.token_urlsafe(48))"

docker compose up -d --build
```

Open **http://localhost:5175** and sign in with the admin credentials from
`.env` (`FIRST_ADMIN_USERNAME` / `FIRST_ADMIN_PASSWORD`). Change the password
in-app after first login (user menu → **Change password**).

Then, under **Settings → iHealth Credentials**, enter your F5 iHealth API
client ID and secret so the app can pull QKViews.

Stop / start / view logs:

```bash
docker compose down            # stop (keeps data volumes)
docker compose up -d           # start again
docker compose logs -f backend # follow backend logs
```

## Configuration

All settings come from `.env` (read automatically by Compose). See
`.env.example` for the full list. The important ones:

| Variable | Purpose |
|---|---|
| `POSTGRES_PASSWORD` | Database password (**required**). |
| `SECRET_KEY` | **Required.** Signs JWTs *and* derives the key that encrypts the stored iHealth secret. Keep it stable — changing it invalidates all logins and the saved iHealth credential. |
| `FIRST_ADMIN_USERNAME` / `FIRST_ADMIN_PASSWORD` / `FIRST_ADMIN_EMAIL` | The admin account created once, on an empty database. |
| `CORS_ORIGINS` | `["*"]` by default (any origin, no credentials — safe, auth is a Bearer token). Lock down with a JSON list if you like. |
| `WEB_PORT` | Host port for the UI (default `5175`). |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Session lifetime (default 480 = 8h). |

## Data & persistence

Two named volumes hold all state (survive `docker compose down`):

- **`pgdata`** — Postgres: users, audits, findings, uploaded graphs, and the
  (encrypted) iHealth credential.
- **`backend-data`** — mounted at `/app/app/data`: user-editable settings —
  the violation catalog, custom wizard templates, the diagnostics ignore-list,
  and the report cover details. Seeded from shipped defaults on first boot.

Back them up with `docker run --rm -v adsp-audit_pgdata:/v -v "$PWD":/b alpine
tar czf /b/pgdata.tgz -C /v .` (same pattern for `adsp-audit_backend-data`).

Wipe everything and start fresh (⚠ destroys all data):

```bash
docker compose down -v
```

## Updating / making changes

The source lives in this repo, so you can change anything and rebuild:

```bash
# after editing backend/ or frontend/ code:
docker compose up -d --build
```

- **Backend** changes rebuild the `backend` image (Python).
- **Frontend** changes rebuild the `web` image (Vite build → nginx).
- Schema changes are handled automatically at startup (the app create_all's its
  tables and applies additive column migrations itself — no Alembic step).

### Local development without Docker

```bash
# backend
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
export $(grep -v '^#' ../.env | xargs)   # or set env vars yourself
# point at a local Postgres:
export DATABASE_URL=postgresql+asyncpg://waf:PASS@localhost:5432/adsp_audit
uvicorn app.main:app --reload --port 8002

# frontend (separate shell)
cd frontend
npm install
VITE_API_TARGET=http://localhost:8002 npm run dev -- --port 5175
```

In dev the Vite server proxies `/api` to the backend (see `vite.config.js`);
in Docker, nginx does the same job (see `frontend/nginx.conf`).

## Security notes

- The backend and database ports are **not** published to the host — only the
  web UI port is. Keep it that way unless you have a reason to expose them.
- The iHealth client secret is encrypted at rest (Fernet, key derived from
  `SECRET_KEY`); it is never stored or returned in plaintext.
- Login is rate-limited per client IP (10 free attempts, then 1 per 10s); nginx
  forwards the real client IP so the limit is per-client, not global.
- Put a TLS-terminating proxy in front of `web` for any non-local deployment,
  and use strong, unique values for `SECRET_KEY` and the passwords.

## Troubleshooting

- **Port 5175 already in use** → set `WEB_PORT` to something else in `.env`.
- **Backend keeps restarting** → `docker compose logs backend`; usually a bad
  `DATABASE_URL`/password or a missing `SECRET_KEY`.
- **Can't log in after changing `SECRET_KEY`** → expected; existing sessions are
  invalid. Log in again. The stored iHealth secret must also be re-entered.
- **Reset the admin password** → stop the stack, `docker compose down -v` wipes
  the DB and recreates the admin from `.env` on next `up` (this also deletes all
  audits).
