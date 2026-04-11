from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

with open("sutras.json", "r") as f:
    sutras = json.load(f)


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