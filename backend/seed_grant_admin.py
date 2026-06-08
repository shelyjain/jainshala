"""
Grant all existing Firestore users both 'user' and 'admin' roles.

Run once after deploying admin rules:
  cd backend && python seed_grant_admin.py
"""

from __future__ import annotations

import sys

from firestore_db import _init_firestore
from seed_sutras import _SETUP


def main() -> int:
    db = _init_firestore()
    if db is None:
        print(_SETUP.strip(), file=sys.stderr)
        return 1

    users = list(db.collection("users").stream())
    if not users:
        print("No users found in Firestore.")
        return 0

    batch = db.batch()
    for doc in users:
        data = doc.to_dict() or {}
        roles = data.get("roles")
        if isinstance(roles, list) and "admin" in roles:
            continue
        batch.set(doc.reference, {"roles": ["user", "admin"]}, merge=True)

    batch.commit()
    print(f"Granted admin to {len(users)} user document(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
