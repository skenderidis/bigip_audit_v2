"""Violation catalog storage. Files on disk are the storage — no DB.

  violation_list.json          the live catalog (edited through the UI)
  violation_list_default.json  pristine copy; source for "restore defaults"
"""
import json
import shutil
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
LIVE = DATA_DIR / "violation_list.json"
DEFAULTS = DATA_DIR / "violation_list_default.json"

_FIELDS = ("severity", "section", "score", "txt")


def load_catalog() -> dict:
    with open(LIVE, encoding="utf-8") as f:
        return json.load(f)


def save_catalog(catalog: dict) -> None:
    with open(LIVE, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)


def restore_defaults() -> dict:
    shutil.copyfile(DEFAULTS, LIVE)
    return load_catalog()


def update_entry(name: str, patch: dict) -> dict:
    """Partial update; creates the entry if it doesn't exist."""
    catalog = load_catalog()
    entry = catalog.get(name) or {"name": name, "severity": "info", "section": "", "score": 0, "txt": ""}
    for k in _FIELDS:
        if k in patch and patch[k] is not None:
            entry[k] = patch[k]
    entry["name"] = name
    catalog[name] = entry
    save_catalog(catalog)
    return entry


def import_catalog(raw: bytes) -> int:
    """Validate and overwrite the live catalog. Raises ValueError on bad input."""
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise ValueError("File is not valid JSON")
    if not isinstance(data, dict):
        raise ValueError("Expected a JSON object (violation-name → entry), not an array or scalar")
    if not all(isinstance(v, dict) for v in data.values()):
        raise ValueError("Every value must be an object")
    save_catalog(data)
    return len(data)

# Alias used by the analyzer.
load = load_catalog
