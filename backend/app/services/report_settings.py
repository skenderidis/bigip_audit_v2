"""Report settings storage. A single small JSON file on disk is the storage —
no DB. Holds the cover-page details (customer name + location) that every
generated report (summary, full, OWASP) is stamped with."""
import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
STORE = DATA_DIR / "report_settings.json"

_FIELDS = ("customer_name", "location")
_DEFAULTS = {"customer_name": "", "location": ""}


def load() -> dict:
    try:
        with open(STORE, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        data = {}
    return {k: (data.get(k) or "") for k in _FIELDS}


def save(patch: dict) -> dict:
    current = load()
    for k in _FIELDS:
        if k in patch and patch[k] is not None:
            current[k] = str(patch[k])
    try:
        with open(STORE, "w", encoding="utf-8") as f:
            json.dump(current, f, indent=2, ensure_ascii=False)
    except OSError:
        pass
    return current
