"""Audit template (preset) storage. Files on disk — no DB.

  level1.json / level2.json / level3.json   the built-in presets
  templates_default.json                    bundled fallback used to seed a
                                            missing level file on first access
  custom_templates.json                     user-created presets (e.g. from the
                                            Guided Configuration wizard), keyed
                                            by a generated slug
"""
import json
import re
from pathlib import Path

LEVELS = ("level1", "level2", "level3")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DEFAULTS = DATA_DIR / "templates_default.json"
CUSTOM = DATA_DIR / "custom_templates.json"


def _path(level: str) -> Path:
    return DATA_DIR / f"{level}.json"


def is_builtin(key: str) -> bool:
    return key in LEVELS


def _defaults() -> dict:
    try:
        with open(DEFAULTS, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def _load_custom() -> dict:
    try:
        with open(CUSTOM, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _save_custom(data: dict) -> None:
    with open(CUSTOM, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def save(key: str, data: dict) -> dict:
    """Persist a template. Built-in levels live in their own file; everything
    else is a custom template kept in custom_templates.json. Written as-is so
    extra keys in the posted body are preserved."""
    if key in LEVELS:
        with open(_path(key), "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    else:
        custom = _load_custom()
        custom[key] = data
        _save_custom(custom)
    return data


def load(key: str) -> dict:
    if key in LEVELS:
        p = _path(key)
        if not p.exists():
            # Missing on disk → seed from the bundled default and persist it.
            data = _defaults().get(key, {})
            save(key, data)
            return data
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    return _load_custom().get(key, {})


def load_all() -> dict:
    out = {lv: load(lv) for lv in LEVELS}
    out.update(_load_custom())
    return out


def _slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return s or "template"


def create(name: str, data: dict) -> tuple[str, dict]:
    """Create a new custom template under a unique slug derived from its name."""
    custom = _load_custom()
    base = _slug(name)
    key = base
    i = 2
    while key in custom or key in LEVELS:
        key = f"{base}-{i}"
        i += 1
    body = dict(data)
    body["name"] = name
    custom[key] = body
    _save_custom(custom)
    return key, body


def delete(key: str) -> bool:
    """Delete a custom template. Built-in levels cannot be deleted."""
    if key in LEVELS:
        raise ValueError("built-in levels cannot be deleted")
    custom = _load_custom()
    if key in custom:
        del custom[key]
        _save_custom(custom)
        return True
    return False
