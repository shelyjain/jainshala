"""
Upload sutras.json (+ TTS overlay) to Firestore collection `sutras`.

Requires:
  FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccount.json
  or FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

Run from repo root:
  cd backend && python seed_sutras.py
"""

from __future__ import annotations

import sys

from firestore_db import BASE_DIR, _init_firestore, load_sutras_from_json


_SETUP = f"""
Firestore credentials are missing.

1. Firebase Console → Project settings → Service accounts
2. Click "Generate new private key" and save the JSON file
   (e.g. {BASE_DIR / 'firebase-service-account.json'})

3. Create {BASE_DIR / '.env'} with ONE of:

   FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json

   (or use the standard Google variable)

   GOOGLE_APPLICATION_CREDENTIALS=firebase-service-account.json

4. Run again:  python seed_sutras.py

Do not commit the JSON key file to git.
"""


def main() -> int:
    db = _init_firestore()
    if db is None:
        print(_SETUP.strip(), file=sys.stderr)
        return 1

    sutras = load_sutras_from_json()
    batch = db.batch()
    col = db.collection("sutras")

    for sutra in sutras:
        sid = str(sutra["id"])
        payload = {k: v for k, v in sutra.items() if k != "id"}
        batch.set(col.document(sid), payload, merge=True)

    batch.commit()
    print(f"Seeded {len(sutras)} sutras into Firestore (collection: sutras).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
