"""Verify Firebase ID tokens and admin role for protected admin API routes."""

from __future__ import annotations

from fastapi import Header, HTTPException

from firestore_db import _init_firestore


def _ensure_firebase_auth():
    db = _init_firestore()
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Server Firestore not configured (service account missing).",
        )
    try:
        from firebase_admin import auth
    except ImportError as e:
        raise HTTPException(status_code=503, detail="firebase-admin not installed") from e
    return db, auth


def require_admin(authorization: str | None = Header(default=None)) -> str:
    """Returns authenticated admin uid."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization: Bearer <token>")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty bearer token")

    db, auth_module = _ensure_firebase_auth()

    try:
        decoded = auth_module.verify_id_token(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}") from e

    uid = decoded.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Token missing uid")

    doc = db.collection("users").document(uid).get()
    data = doc.to_dict() or {}
    roles = data.get("roles")
    if not isinstance(roles, list) or "admin" not in roles:
        raise HTTPException(status_code=403, detail="Admin role required")

    return uid
