"""Editable ignore-diagnostics list. The storage is the same plain-text file
`ltm_analyzer.load_ignore_list()` reads (one iHealth diagnostic header per
line), so edits made here take effect on the next analyze / reprocess."""
from pathlib import Path

STORE = Path(__file__).resolve().parent.parent / "data" / "ignore_diagnostics.txt"


def load_entries() -> list[str]:
    try:
        text = STORE.read_text(encoding="utf-8")
    except OSError:
        return []
    return [ln.strip() for ln in text.splitlines() if ln.strip()]


def save_text(text: str) -> list[str]:
    entries = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    try:
        STORE.write_text("\n".join(entries) + ("\n" if entries else ""), encoding="utf-8")
    except OSError:
        pass
    return entries
