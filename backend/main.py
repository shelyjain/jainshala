import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent

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