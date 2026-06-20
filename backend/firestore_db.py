"""Firestore access for sutra catalog (optional — falls back to sutras.json)."""

from __future__ import annotations

import json
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

_db = None


def _load_env() -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv(BASE_DIR / ".env")
        load_dotenv(BASE_DIR.parent / ".env")
    except ImportError:
        pass


def _resolve_cred_path(raw: str) -> str:
    p = Path(raw.strip().strip('"').strip("'"))
    if p.is_file():
        return str(p.resolve())
    if not p.is_absolute():
        for base in (BASE_DIR, BASE_DIR.parent):
            candidate = (base / p).resolve()
            if candidate.is_file():
                return str(candidate)
    return raw.strip()


def _credential_source() -> tuple[str, str] | tuple[None, None]:
    """Returns ('path', absolute_path) or ('json', json_string)."""
    _load_env()

    cred_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    if cred_json:
        return "json", cred_json

    cred_path = (
        os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()
        or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    )
    if cred_path:
        resolved = _resolve_cred_path(cred_path)
        if Path(resolved).is_file():
            return "path", resolved

    return None, None


def _init_firestore():
    global _db
    if _db is not None:
        return _db

    kind, value = _credential_source()
    if not kind:
        return None

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError:
        return None

    if not firebase_admin._apps:
        if kind == "json":
            cred = credentials.Certificate(json.loads(value))
        else:
            cred = credentials.Certificate(value)
        firebase_admin.initialize_app(cred)

    _db = firestore.client()
    return _db


def load_sutras_from_firestore() -> list[dict] | None:
    db = _init_firestore()
    if db is None:
        return None

    docs = db.collection("sutras").stream()
    items = []
    for doc in docs:
        data = doc.to_dict() or {}
        data["id"] = doc.id
        items.append(data)

    if not items:
        return None

    items.sort(key=lambda s: (s.get("sutra_number") is None, s.get("sutra_number", 0)))
    return items


def _apply_tts_overlay(sutras: list[dict]) -> list[dict]:
    overlay_path = BASE_DIR / "sutra_tts_overlay.json"
    if not overlay_path.is_file():
        return sutras
    with open(overlay_path, "r", encoding="utf-8") as f:
        tts_overlay = json.load(f)
    for sutra in sutras:
        sid = str(sutra.get("id"))
        overlay_lines = tts_overlay.get(sid)
        if not isinstance(overlay_lines, list):
            continue
        for i, line in enumerate(sutra.get("lines", [])):
            if i >= len(overlay_lines):
                break
            tts_text = str(overlay_lines[i]).strip()
            if tts_text:
                line["tts_devanagari"] = tts_text
    return sutras


def load_sutras_from_json() -> list[dict]:
    with open(BASE_DIR / "sutras.json", "r", encoding="utf-8") as f:
        return json.load(f)


def get_sutra_catalog() -> list[dict]:
    from_firestore = load_sutras_from_firestore()
    catalog = from_firestore if from_firestore else load_sutras_from_json()
    return _apply_tts_overlay(catalog)
