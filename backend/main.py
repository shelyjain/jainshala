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
from fastapi import FastAPI, HTTPException
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
#   GOOGLE_TTS_VOICE_NAME        default hi-IN-Chirp3-HD-Leda (natural Hindi; less “robot” than Neural2)
#   GOOGLE_TTS_VOICE_FALLBACKS   comma-separated; default hi-IN-Neural2-D,hi-IN-Wavenet-A if Chirp3 unavailable
#   GOOGLE_TTS_SPEAKING_RATE     default 0.76 (slightly slower reads clearer for shloka-style lines)
#   GOOGLE_TTS_PITCH             default 0.0
#   GOOGLE_TTS_EFFECTS_PROFILE_IDS  comma-separated; default optimizes playback on headphones then living-room speakers
#   GOOGLE_TTS_MANTRA_BREAK_MS       pause between words when mantra_style=true (default 130)
#   GOOGLE_TTS_SSML_PROSODY_RATE     e.g. slow, x-slow, or 82% (default slow)
#   GOOGLE_TTS_MANTRA_SPEAKING_RATE audioConfig speed for mantra SSML (default 0.70)
_GOOGLE_TTS_KEY = _normalize_google_api_key(
    os.environ.get("GOOGLE_CLOUD_TTS_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "",
)
_GOOGLE_TTS_LANG = os.environ.get("GOOGLE_TTS_LANGUAGE_CODE", "hi-IN").strip() or "hi-IN"
_GOOGLE_TTS_SYNTH_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"

_DEFAULT_PRIMARY_VOICE = "hi-IN-Chirp3-HD-Leda"
_DEFAULT_FALLBACK_VOICES = ("hi-IN-Neural2-D", "hi-IN-Wavenet-A", "hi-IN-Standard-A")

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


def _mantra_ssml(text: str) -> str:
    """Word-separated pauses + slower SSML prosody — reads closer to shloka/mantra cadence."""
    break_ms = max(40, min(400, int(os.environ.get("GOOGLE_TTS_MANTRA_BREAK_MS", "130"))))
    prosody_raw = os.environ.get("GOOGLE_TTS_SSML_PROSODY_RATE", "slow").strip() or "slow"
    prosody_safe = _sanitize_ssml_prosody_rate(prosody_raw)
    tokens = [t for t in text.split() if t]
    if not tokens:
        raise ValueError("no tokens")
    parts: list[str] = []
    for i, tok in enumerate(tokens):
        parts.append(xml_esc.escape(tok))
        if i < len(tokens) - 1:
            parts.append(f'<break time="{break_ms}ms"/>')
    inner = "".join(parts)
    return f'<speak><prosody rate="{prosody_safe}">{inner}</prosody></speak>'


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

with open(BASE_DIR / "sutras.json", "r", encoding="utf-8") as f:
    sutras = json.load(f)

overlay_path = BASE_DIR / "sutra_tts_overlay.json"
if overlay_path.is_file():
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


@app.get("/sutras")
def get_all_sutras():
    return sutras


@app.get("/sutra/{id}")
def get_sutra(id: str):
    sutra = next((s for s in sutras if s["id"] == id), None)
    if not sutra:
        return {"error": "Sutra not found"}
    return sutra


@app.get("/sutra-audio-proxy/{sutra_number}")
async def proxy_sutra_audio(sutra_number: int):
    """Proxy the Drive zip download so web clients avoid CORS restrictions."""
    sutra = next((s for s in sutras if s.get("sutra_number") == sutra_number), None)
    if not sutra:
        raise HTTPException(status_code=404, detail="Sutra not found")
    drive_id = sutra.get("audio_zip_drive_id")
    if not drive_id:
        raise HTTPException(status_code=404, detail="No audio zip for this sutra")

    drive_url = f"https://drive.usercontent.google.com/download?id={drive_id}&export=download&confirm=t"
    async with httpx.AsyncClient(follow_redirects=True, timeout=120.0) as client:
        resp = await client.get(drive_url)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Drive returned {resp.status_code}")

    return Response(
        content=resp.content,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=sutra{sutra_number}_lines.zip"},
    )


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
        "setup_hint": _TTS_KEY_SETUP_HINT,
    }


@app.post("/tts/google")
def google_tts_synthesize(body: GoogleTtsRequest):
    """Synthesize speech via Google Cloud Text-to-Speech; returns MP3 bytes."""
    if not _GOOGLE_TTS_KEY:
        raise HTTPException(status_code=503, detail="Google TTS not configured")
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty text")

    pitch = float(os.environ.get("GOOGLE_TTS_PITCH", "0.0"))
    mantra_rate = float(os.environ.get("GOOGLE_TTS_MANTRA_SPEAKING_RATE", "0.68"))
    plain_rate = float(os.environ.get("GOOGLE_TTS_SPEAKING_RATE", "0.76"))
    fx = _tts_effects_profile_ids()
    candidates = _tts_voice_candidates()

    ssml: str | None = None
    if body.mantra_style:
        try:
            ssml = _mantra_ssml(text)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        if len(ssml) > 11000:
            raise HTTPException(status_code=400, detail="Line too long for mantra SSML")

    # (label, input dict, speaking_rate, include_effects_profile)
    attempts: list[tuple[str, dict, float, bool]] = []
    if ssml is not None:
        attempts.append(("mantra_ssml+fx", {"ssml": ssml}, mantra_rate, True))
        attempts.append(("mantra_ssml", {"ssml": ssml}, mantra_rate, False))
    attempts.append(("plain_text+fx", {"text": text}, plain_rate, True))
    attempts.append(("plain_text", {"text": text}, plain_rate, False))

    last_detail = ""
    for label, input_block, speaking_rate, use_fx in attempts:
        audio_config: dict = {
            "audioEncoding": "MP3",
            "speakingRate": speaking_rate,
            "pitch": pitch,
        }
        if use_fx and fx:
            audio_config["effectsProfileId"] = fx

        for voice_name in candidates:
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
                return _decode_tts_response(resp)

            last_detail = _google_error_summary(resp.text) if resp.text else f"HTTP {resp.status_code}"
            logger.warning(
                "Google TTS failed label=%s voice=%s http=%s detail=%s",
                label,
                voice_name,
                resp.status_code,
                last_detail[:500],
            )

    hint = " " + _TTS_KEY_SETUP_HINT
    raise HTTPException(
        status_code=502,
        detail=(last_detail or "Google TTS failed for all attempts.") + hint,
    )


@app.get("/search")
def search_sutras(q: str = ""):
    if not q:
        return sutras
    q = q.lower()
    results = []
    for s in sutras:
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