"""
Deploy firestore.rules to Firebase without the Firebase CLI.

Uses the same service account as seed_sutras.py.

  cd backend
  python deploy_firestore_rules.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx

from firestore_db import BASE_DIR, _credential_source, _load_env
from seed_sutras import _SETUP

RULES_FILE = BASE_DIR.parent / "firestore.rules"
RULES_API = "https://firebaserules.googleapis.com/v1"


def _access_token() -> tuple[str, str] | tuple[None, None]:
    kind, value = _credential_source()
    if not kind:
        return None, None

    if kind == "json":
        info = json.loads(value)
    else:
        with open(value, encoding="utf-8") as f:
            info = json.load(f)

    project_id = info.get("project_id", "")
    if not project_id:
        return None, None

    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
    except ImportError:
        print("Install: pip install google-auth", file=sys.stderr)
        return None, None

    creds = service_account.Credentials.from_service_account_info(
        info,
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )
    creds.refresh(Request())
    return project_id, creds.token


def main() -> int:
    _load_env()

    if not RULES_FILE.is_file():
        print(f"Missing {RULES_FILE}", file=sys.stderr)
        return 1

    project_id, token = _access_token()
    if not project_id or not token:
        print(_SETUP.strip(), file=sys.stderr)
        return 1

    rules_text = RULES_FILE.read_text(encoding="utf-8")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    ruleset_body = {
        "source": {
            "files": [
                {
                    "name": "firestore.rules",
                    "content": rules_text,
                }
            ]
        }
    }

    with httpx.Client(timeout=60.0) as client:
        create = client.post(
            f"{RULES_API}/projects/{project_id}/rulesets",
            headers=headers,
            json=ruleset_body,
        )
        if create.status_code >= 400:
            print(f"Create ruleset failed ({create.status_code}): {create.text}", file=sys.stderr)
            return 1

        ruleset_name = create.json().get("name")
        if not ruleset_name:
            print("No ruleset name in response.", file=sys.stderr)
            return 1

        release_body = {
            "release": {
                "name": f"projects/{project_id}/releases/cloud.firestore",
                "rulesetName": ruleset_name,
            }
        }
        patch = client.patch(
            f"{RULES_API}/projects/{project_id}/releases/cloud.firestore",
            headers=headers,
            json=release_body,
        )
        if patch.status_code >= 400:
            print(f"Release rules failed ({patch.status_code}): {patch.text}", file=sys.stderr)
            return 1

    print(f"Deployed Firestore rules to project: {project_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
