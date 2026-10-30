# syntax=docker/dockerfile:1
# ──────────────────────────────────────────────────────────────────────────
# Audit for BIGIP — backend (FastAPI + uvicorn).
# The app owns its schema: on startup it create_all's its tables, applies a
# few additive ALTERs, bootstraps the first admin, and seeds reference data.
# No Alembic/Celery. Postgres is a separate service (see docker-compose.yml).
# ──────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# curl is only for the container HEALTHCHECK; wheels cover every Python dep.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Keep a pristine copy of app/data so the entrypoint can seed the persistent
# volume mounted over app/data on first boot (the volume starts empty).
RUN cp -a app/data app/data_seed

RUN chmod +x docker-entrypoint.sh

EXPOSE 8002

# Single worker: the login rate-limiter keeps its counters in-process.
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
