from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from urllib.parse import urlparse

from app.config import settings
from app.db import engine, AsyncSessionLocal, Base
from app.models import user, audit_policy, reference, ltm_audit  # noqa: registers tables
from app.api import auth, audit_policies, reference as reference_api, devices_shim, settings as settings_api, templates as templates_api, ref_admin, ltm_audits as ltm_api
from app.services.auth_service import create_first_admin
from app.services.seed import seed_reference


@asynccontextmanager
async def lifespan(app: FastAPI):
    parsed = urlparse(str(settings.DATABASE_URL))
    print(f"Starting {settings.APP_NAME}")
    print(f"Database host: {parsed.hostname}  name: {parsed.path.lstrip('/')}")

    # Standalone audit app: own Postgres, two tables — users (login) and
    # audit_policies (uploaded policy JSON). Everything else is derived on read.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Additive columns on audit_policies (create_all makes tables, not columns).
        from sqlalchemy import text
        for stmt in (
            "ALTER TABLE audit_policies ADD COLUMN IF NOT EXISTS template VARCHAR(32) NOT NULL DEFAULT 'Level 1'",
            "ALTER TABLE audit_policies ADD COLUMN IF NOT EXISTS findings JSONB",
            "ALTER TABLE audit_policies ADD COLUMN IF NOT EXISTS analysis JSONB",
            "ALTER TABLE audit_policies ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ",
            "ALTER TABLE ltm_audits ADD COLUMN IF NOT EXISTS excluded JSONB",
            "ALTER TABLE ltm_audits ADD COLUMN IF NOT EXISTS graphs JSONB",
        ):
            await conn.execute(text(stmt))
    async with AsyncSessionLocal() as db:
        await create_first_admin(db)
        await seed_reference(db)

    yield


app = FastAPI(title=settings.APP_NAME, version="0.1.0", lifespan=lifespan)

# CORS: the dangerous combination is reflecting any origin *with* credentials.
# With "*" we allow any origin but WITHOUT credentials (fine — auth is a Bearer
# token in the Authorization header, not a cookie). An explicit origin list
# locks it down and re-enables credentials.
_origins = [o.strip() for o in settings.CORS_ORIGINS if o and o.strip()]
if "*" in _origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth.router)
app.include_router(audit_policies.router)
app.include_router(reference_api.router)
app.include_router(ref_admin.router)
app.include_router(devices_shim.router)
app.include_router(settings_api.router)
app.include_router(templates_api.router)
app.include_router(ltm_api.router)


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}
