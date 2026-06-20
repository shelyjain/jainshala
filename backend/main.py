import base64
import json
import logging
import os
import xml.sax.saxutils as xml_esc
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
try:
    from dotenv import load_dotenv

    load_dotenv(BASE_DIR / ".env")
    load_dotenv(BASE_DIR.parent / ".env")
except ImportError:
    pass

import httpx
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field


def _normalize_google_api_key(raw: str) -> str:
    """Strip whitespace/BOM and wrapping quotes often pasted by mistake."""
    k = (raw or "").strip().replace("\ufeff", "")
    if len(k) >= 2 and ((k[0] == k[-1] == '"') or (k[0] == k[-1] == "'")):
        k = k[1:-1].strip()
    return k


app = FastAPI()

# Google Cloud Text-to-Speech (not the Gemini SDK). Enable the "Cloud Text-to-Speech API"
# on your GCP project and use an API key that is allowed to call that API.
# Set in the environment (do not commit keys):
#   GOOGLE_CLOUD_TTS_API_KEY  (preferred)
# Optional:
#   GOOGLE_TTS_LANGUAGE_CODE       default hi-IN (closest accent for Devanagari mantra text; Sanskrit has no native GCP voice)
#   GOOGLE_TTS_VOICE_NAME        default hi-IN-Neural2-D (stable across all sutra lines)
#   GOOGLE_TTS_VOICE_FALLBACKS   comma-separated; default hi-IN-Wavenet-A
#   GOOGLE_TTS_SPEAKING_RATE     default 0.92
#   GOOGLE_TTS_PITCH             default 0.0
#   GOOGLE_TTS_EFFECTS_PROFILE_IDS  comma-separated; default optimizes playback on headphones then living-room speakers
#   GOOGLE_TTS_MANTRA_BREAK_MS       pause between words when mantra_style=true (default 70)
#   GOOGLE_TTS_SSML_PROSODY_RATE     e.g. medium, 95%, or slow (default 95%)
#   GOOGLE_TTS_MANTRA_SPEAKING_RATE audioConfig speed for mantra SSML (default 0.88)
#   GOOGLE_TTS_TAIL_BREAK_MS         silence after last syllable so final nasal (m/ं) is not clipped (default 160)
_GOOGLE_TTS_KEY = _normalize_google_api_key(
    os.environ.get("GOOGLE_CLOUD_TTS_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "",
)
_GOOGLE_TTS_LANG = os.environ.get("GOOGLE_TTS_LANGUAGE_CODE", "hi-IN").strip() or "hi-IN"
_GOOGLE_TTS_SYNTH_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"

_DEFAULT_PRIMARY_VOICE = "hi-IN-Neural2-D"
_DEFAULT_FALLBACK_VOICES = ("hi-IN-Wavenet-A",)

_pinned_voice: str | None = None
_pinned_attempt_label: str | None = None

logger = logging.getLogger("uvicorn.error")


def _tts_voice_candidates() -> list[str]:
    primary = (os.environ.get("GOOGLE_TTS_VOICE_NAME") or _DEFAULT_PRIMARY_VOICE).strip() or _DEFAULT_PRIMARY_VOICE
    raw_fb = os.environ.get("GOOGLE_TTS_VOICE_FALLBACKS", "").strip()
    if raw_fb:
        fallbacks = [v.strip() for v in raw_fb.split(",") if v.strip()]
    else:
        fallbacks = list(_DEFAULT_FALLBACK_VOICES)
    out: list[str] = []
    for v in [primary, *fallbacks]:
        if v and v not in out:
            out.append(v)
    return out


def _voices_for_request(candidates: list[str]) -> list[str]:
    if _pinned_voice:
        rest = [v for v in candidates if v != _pinned_voice]
        return [_pinned_voice, *rest]
    return candidates


def _pin_synthesis(voice_name: str, attempt_label: str) -> None:
    global _pinned_voice, _pinned_attempt_label
    if attempt_label != "tail_ssml":
        return
    if _pinned_voice != voice_name or _pinned_attempt_label != attempt_label:
        logger.info("Pinned Google TTS voice=%s profile=%s", voice_name, attempt_label)
    _pinned_voice = voice_name
    _pinned_attempt_label = attempt_label


def _order_attempts(
    attempts: list[tuple[str, dict, float, bool]],
) -> list[tuple[str, dict, float, bool]]:
    if not _pinned_attempt_label:
        return attempts
    preferred = [a for a in attempts if a[0] == _pinned_attempt_label]
    rest = [a for a in attempts if a[0] != _pinned_attempt_label]
    return preferred + rest if preferred else attempts


def _tts_effects_profile_ids() -> list[str]:
    raw = os.environ.get(
        "GOOGLE_TTS_EFFECTS_PROFILE_IDS",
        "headphone-class-device,large-home-entertainment-class-device",
    ).strip()
    return [x.strip() for x in raw.split(",") if x.strip()]


def _sanitize_ssml_prosody_rate(raw: str) -> str:
    s = raw.strip().lower()
    if s in {"slow", "x-slow", "medium", "fast", "default"}:
        return s
    t = raw.strip()
    if t.lower().endswith("%") and len(t) <= 12:
        stem = t[:-1].strip()
        try:
            if 40 <= float(stem) <= 130:
                return t
        except ValueError:
            pass
    return "slow"


def _google_error_summary(body: str) -> str:
    try:
        j = json.loads(body)
        err = j.get("error") or {}
        msg = err.get("message") or body
        code = err.get("status") or err.get("code")
        if code:
            return f"{code}: {msg}"[:900]
        return str(msg)[:900]
    except (json.JSONDecodeError, TypeError):
        return (body or "")[:900]


def _decode_tts_response(resp: httpx.Response) -> Response:
    try:
        data = resp.json()
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Invalid JSON from Google TTS") from None

    audio_b64 = data.get("audioContent")
    if not audio_b64:
        raise HTTPException(status_code=502, detail="No audioContent in Google response")

    try:
        raw = base64.b64decode(audio_b64)
    except (ValueError, TypeError):
        raise HTTPException(status_code=502, detail="Could not decode audio") from None

    return Response(content=raw, media_type="audio/mpeg")


def _has_indic_script(text: str) -> bool:
    return any("\u0900" <= c <= "\u097f" or "\u0a80" <= c <= "\u0aff" for c in text)


def _tail_break_ms() -> int:
    return max(50, min(400, int(os.environ.get("GOOGLE_TTS_TAIL_BREAK_MS", "180"))))


def _indic_tail_break_ms() -> int:
    return max(60, min(450, int(os.environ.get("GOOGLE_TTS_INDIC_TAIL_BREAK_MS", "200"))))


def _fix_indic_word_nasal(word: str) -> str:
    """Turn word-final anusvara (ं) into audible ma (म) for GCP hi-IN."""
    if not word.endswith("ं"):
        return word
    base = word[:-1]
    if not base:
        return word
    return base + "म"


def _indic_tts_nasal_fix(text: str) -> str:
    words = []
    for token in text.split():
        trailing = ""
        core = token
        while core and core[-1] in ".,;:!?":
            trailing = core[-1] + trailing
            core = core[:-1]
        if core:
            core = _fix_indic_word_nasal(core)
        words.append(core + trailing)
    return " ".join(words)


def _prepare_tts_text(text: str) -> str:
    cleaned = text.strip()
    if _has_indic_script(cleaned):
        return _indic_tts_nasal_fix(cleaned)
    return cleaned


def _ssml_with_tail(text: str) -> str:
    """Full line as one utterance; trailing silence only (no split nasal)."""
    tail_ms = _indic_tail_break_ms() if _has_indic_script(text) else _tail_break_ms()
    escaped = xml_esc.escape(text.rstrip())
    return f"<speak>{escaped}<break time=\"{tail_ms}ms\"/></speak>"


def _mantra_ssml(text: str) -> str:
    """Word-separated pauses for shloka cadence (roman transliteration)."""
    break_ms = max(40, min(400, int(os.environ.get("GOOGLE_TTS_MANTRA_BREAK_MS", "70"))))
    prosody_raw = os.environ.get("GOOGLE_TTS_SSML_PROSODY_RATE", "95%").strip() or "95%"
    prosody_safe = _sanitize_ssml_prosody_rate(prosody_raw)
    tail_ms = _tail_break_ms()
    tokens = [t for t in text.split() if t]
    if not tokens:
        raise ValueError("no tokens")
    parts: list[str] = []
    for i, tok in enumerate(tokens):
        parts.append(xml_esc.escape(tok))
        if i < len(tokens) - 1:
            parts.append(f'<break time="{break_ms}ms"/>')
    parts.append(f'<break time="{tail_ms}ms"/>')
    inner = "".join(parts)
    return f'<speak><prosody rate="{prosody_safe}">{inner}</prosody></speak>'


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from firestore_db import get_sutra_catalog


def _catalog() -> list[dict]:
    return get_sutra_catalog()


@app.get("/sutras")
def get_all_sutras():
    return _catalog()


@app.get("/sutra/{id}")
def get_sutra(id: str):
    sutra = next((s for s in _catalog() if str(s.get("id")) == id), None)
    if not sutra:
        return {"error": "Sutra not found"}
    return sutra


class GoogleTtsRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=8000)
    mantra_style: bool = True


_TTS_KEY_SETUP_HINT = (
    "Gemini / Google AI Studio keys do not work with Cloud Text-to-Speech. "
    "In Google Cloud Console: enable the Cloud Text-to-Speech API for your project, "
    "then APIs & Credentials → Create credentials → API key, "
    "and under API restrictions allow “Cloud Text-to-Speech API” (or unrestricted for testing)."
)


@app.get("/tts/google/status")
def google_tts_status():
    return {
        "enabled": bool(_GOOGLE_TTS_KEY),
        "key_length": len(_GOOGLE_TTS_KEY),
        "language_code": _GOOGLE_TTS_LANG,
        "voice_candidates": _tts_voice_candidates(),
        "pinned_voice": _pinned_voice,
        "pinned_profile": _pinned_attempt_label,
        "setup_hint": _TTS_KEY_SETUP_HINT,
        "enable_api_url": "https://console.cloud.google.com/apis/library/texttospeech.googleapis.com",
    }


@app.post("/tts/google")
def google_tts_synthesize(body: GoogleTtsRequest, _allow_pin_retry: bool = True):
    """Synthesize speech via Google Cloud Text-to-Speech; returns MP3 bytes."""
    global _pinned_voice, _pinned_attempt_label
    if _pinned_attempt_label == "plain_text":
        _pinned_voice = None
        _pinned_attempt_label = None
    if not _GOOGLE_TTS_KEY:
        raise HTTPException(status_code=503, detail="Google TTS not configured")
    text = _prepare_tts_text(body.text.strip())
    if not text:
        raise HTTPException(status_code=400, detail="Empty text")

    pitch = float(os.environ.get("GOOGLE_TTS_PITCH", "0.0"))
    speaking_rate = float(os.environ.get("GOOGLE_TTS_SPEAKING_RATE", "0.92"))
    fx = _tts_effects_profile_ids()
    candidates = _tts_voice_candidates()
    voices = _voices_for_request(candidates)

    tail_ssml: str | None = None
    try:
        tail_ssml = _ssml_with_tail(text)
    except ValueError:
        pass

    if not tail_ssml:
        raise HTTPException(status_code=400, detail="Could not build TTS SSML")

    # Always tail_ssml — plain text clips final nasals and must not be pinned.
    attempts: list[tuple[str, dict, float, bool]] = [
        ("tail_ssml", {"ssml": tail_ssml}, speaking_rate, False),
    ]
    attempts = _order_attempts(attempts)

    last_detail = ""
    for label, input_block, attempt_rate, use_fx in attempts:
        audio_config: dict = {
            "audioEncoding": "MP3",
            "speakingRate": attempt_rate,
            "pitch": pitch,
        }
        if use_fx and fx:
            audio_config["effectsProfileId"] = fx

        for voice_name in voices:
            payload = {
                "input": input_block,
                "voice": {"languageCode": _GOOGLE_TTS_LANG, "name": voice_name},
                "audioConfig": audio_config,
            }
            try:
                resp = httpx.post(
                    _GOOGLE_TTS_SYNTH_URL,
                    headers={"x-goog-api-key": _GOOGLE_TTS_KEY},
                    json=payload,
                    timeout=60.0,
                )
            except httpx.HTTPError as e:
                raise HTTPException(status_code=502, detail=f"TTS request failed: {e}") from e

            if resp.status_code == 200:
                _pin_synthesis(voice_name, label)
                return _decode_tts_response(resp)

            last_detail = _google_error_summary(resp.text) if resp.text else f"HTTP {resp.status_code}"
            logger.warning(
                "Google TTS failed label=%s voice=%s http=%s detail=%s",
                label,
                voice_name,
                resp.status_code,
                last_detail[:500],
            )

    # Last resort: plain text (never pinned — clips final nasal on some lines).
    for voice_name in voices:
        payload = {
            "input": {"text": text},
            "voice": {"languageCode": _GOOGLE_TTS_LANG, "name": voice_name},
            "audioConfig": {
                "audioEncoding": "MP3",
                "speakingRate": speaking_rate,
                "pitch": pitch,
            },
        }
        try:
            resp = httpx.post(
                _GOOGLE_TTS_SYNTH_URL,
                headers={"x-goog-api-key": _GOOGLE_TTS_KEY},
                json=payload,
                timeout=60.0,
            )
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"TTS request failed: {e}") from e
        if resp.status_code == 200:
            logger.warning("Google TTS plain_text fallback used for line (no pin)")
            return _decode_tts_response(resp)
        last_detail = _google_error_summary(resp.text) if resp.text else f"HTTP {resp.status_code}"

    # Pinned combo failed — clear pin and retry once with full candidate list.
    if _pinned_voice is not None and _allow_pin_retry:
        logger.warning("Pinned Google TTS voice failed; clearing pin and retrying")
        _pinned_voice = None
        _pinned_attempt_label = None
        return google_tts_synthesize(body, _allow_pin_retry=False)

    hint = " " + _TTS_KEY_SETUP_HINT
    raise HTTPException(
        status_code=502,
        detail=(last_detail or "Google TTS failed for all attempts.") + hint,
    )


@app.get("/search")
def search_sutras(q: str = ""):
    catalog = _catalog()
    if not q:
        return catalog
    q = q.lower()
    results = []
    for s in catalog:
        if (
            q in s["title"].lower()
            or q in s["interpretation"].lower()
            or any(q in t for t in s["tags"])
            or any(
                q in line["transliteration"].lower() or q in line["translation_en"].lower()
                for line in s["lines"]
            )
        ):
            results.append(s)
    return results


# --- Admin user management (service account; client sends Firebase ID token) ---

from admin_auth import require_admin
from firestore_db import _init_firestore


class SetRolesBody(BaseModel):
    roles: list[str] = Field(..., min_length=1)


@app.get("/admin/users")
def admin_list_users(_admin_uid: str = Depends(require_admin)):
    db = _init_firestore()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore not configured")

    rows = []
    for doc in db.collection("users").stream():
        data = doc.to_dict() or {}
        roles = data.get("roles")
        if not isinstance(roles, list):
            roles = ["user"]
        rows.append(
            {
                "uid": doc.id,
                "email": data.get("email", ""),
                "displayName": data.get("displayName", ""),
                "roles": roles,
            }
        )
    rows.sort(key=lambda r: (str(r.get("email", "")), str(r.get("displayName", ""))))
    return rows


@app.post("/admin/users/{uid}/roles")
def admin_set_user_roles(
    uid: str,
    body: SetRolesBody,
    _admin_uid: str = Depends(require_admin),
):
    db = _init_firestore()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore not configured")

    roles = [r for r in body.roles if r in ("user", "admin")]
    if "user" not in roles:
        roles = ["user", *roles]

    db.collection("users").document(uid).set({"roles": roles}, merge=True)
    return {"uid": uid, "roles": roles}


@app.post("/admin/users/{uid}/grant-admin")
def admin_grant(uid: str, _admin_uid: str = Depends(require_admin)):
    db = _init_firestore()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore not configured")
    db.collection("users").document(uid).set({"roles": ["user", "admin"]}, merge=True)
    return {"uid": uid, "roles": ["user", "admin"]}


@app.post("/admin/users/{uid}/revoke-admin")
def admin_revoke(uid: str, _admin_uid: str = Depends(require_admin)):
    db = _init_firestore()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore not configured")
    db.collection("users").document(uid).set({"roles": ["user"]}, merge=True)
    return {"uid": uid, "roles": ["user"]}