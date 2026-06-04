"""Grant admin role to a user by email. Usage: python grant_admin_by_email.py user@example.com"""

from __future__ import annotations

import sys

from firestore_db import _init_firestore
from seed_sutras import _SETUP


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python grant_admin_by_email.py <email>", file=sys.stderr)
        return 1

    email = sys.argv[1].strip().lower()
    db = _init_firestore()
    if db is None:
        print(_SETUP.strip(), file=sys.stderr)
        return 1

    # Firestore users store email on the profile doc
    matches = (
        db.collection("users")
        .where("email", "==", email)
        .limit(5)
        .stream()
    )
    docs = list(matches)

    if not docs:
        # Try original casing from argv
        raw = sys.argv[1].strip()
        if raw.lower() != raw:
            docs = list(
                db.collection("users").where("email", "==", raw).limit(5).stream()
            )

    if not docs:
        print(f"No Firestore user found with email: {sys.argv[1]}", file=sys.stderr)
        print("User must sign in at least once so their profile exists in users/{uid}.", file=sys.stderr)
        return 1

    for doc in docs:
        doc.reference.set({"roles": ["user", "admin"]}, merge=True)
        data = doc.to_dict() or {}
        print(
            f"Granted admin to uid={doc.id} "
            f"email={data.get('email', email)} "
            f"name={data.get('displayName', '')}"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
