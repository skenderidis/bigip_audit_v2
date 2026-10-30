#!/bin/sh
set -e

# app/data holds both shipped defaults (reference JSON, the Word template) and a
# handful of user-editable files (violation catalog, custom templates, the
# diagnostics ignore-list, report cover settings). When a named volume is
# mounted over app/data it starts empty, so seed it once from the baked copy.
DATA=/app/app/data
SEED=/app/app/data_seed
if [ -d "$SEED" ] && [ -z "$(ls -A "$DATA" 2>/dev/null)" ]; then
  echo "[entrypoint] seeding $DATA from defaults"
  cp -a "$SEED"/. "$DATA"/
fi

exec "$@"
