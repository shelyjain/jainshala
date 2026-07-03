"""
Fetches file IDs for sutra zip files from a public Google Drive folder
and writes them into sutras.json as an `audio_zip_drive_id` field.

Requires the Google Drive API to be enabled on your Google Cloud project.
Uses the same API key as the TTS backend (GOOGLE_CLOUD_TTS_API_KEY or GOOGLE_API_KEY).

Usage:
    python3 fetch_drive_ids.py
"""

import json
import os
import re
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("Installing requests...")
    os.system(f"{sys.executable} -m pip install requests")
    import requests

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

FOLDER_ID = "1lMa2yo0veWfeZEXDb56GnTXAsJF7Rv48"
API_KEY = os.environ.get("GOOGLE_CLOUD_TTS_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""

if not API_KEY:
    print("ERROR: No Google API key found. Set GOOGLE_CLOUD_TTS_API_KEY or GOOGLE_API_KEY in your .env file.")
    sys.exit(1)

url = "https://www.googleapis.com/drive/v3/files"
params = {
    "q": f"'{FOLDER_ID}' in parents and trashed=false",
    "fields": "files(id,name)",
    "key": API_KEY,
    "pageSize": 100,
}

resp = requests.get(url, params=params)
if resp.status_code != 200:
    print(f"ERROR: Drive API returned {resp.status_code}: {resp.text}")
    print("Make sure the Google Drive API is enabled for your project.")
    sys.exit(1)

files = resp.json().get("files", [])
print(f"Found {len(files)} files in folder:")
for f in files:
    print(f"  {f['name']} -> {f['id']}")

# Build mapping: sutra number -> drive file id
# Expects filenames like sutra1_lines.zip, sutra2_lines.zip, etc.
id_map = {}
for f in files:
    m = re.match(r"sutra(\d+)_lines\.zip", f["name"])
    if m:
        sutra_num = int(m.group(1))
        id_map[sutra_num] = f["id"]

print(f"\nMapped {len(id_map)} sutras: {sorted(id_map.keys())}")

# Update sutras.json
sutras_path = Path(__file__).parent / "sutras.json"
with open(sutras_path, "r", encoding="utf-8") as fh:
    sutras = json.load(fh)

updated = 0
for sutra in sutras:
    num = sutra.get("sutra_number")
    if num in id_map:
        sutra["audio_zip_drive_id"] = id_map[num]
        updated += 1

with open(sutras_path, "w", encoding="utf-8") as fh:
    json.dump(sutras, fh, ensure_ascii=False, indent=2)

print(f"\n✓ Updated {updated} sutras in sutras.json with audio_zip_drive_id")
print("\nNext: restart the backend server so the app picks up the new field.")
