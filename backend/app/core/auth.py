"""Request authentication and short-lived, session-bound streaming tokens."""

from __future__ import annotations

import secrets
import time
from dataclasses import dataclass
from typing import Literal, Protocol

from fastapi import Header, HTTPException, Request

DEV_PATIENT_ID = "00000000-0000-0000-0000-000000000001"
DEV_CLINICIAN_ID = "00000000-0000-0000-0000-000000000002"


@dataclass(frozen=True)
class AuthUser:
    user_id: str
    role: Literal["patient", "clinician", "admin"]
    display_name: str


class AuthVerifier(Protocol):
    def verify(self, authorization: str | None) -> AuthUser: ...


class DevAuthVerifier:
    """Two synthetic accounts for local integration only."""

    _users = {
        "demo-patient-token": AuthUser(DEV_PATIENT_ID, "patient", "Demo Patient"),
        "demo-clinician-token": AuthUser(DEV_CLINICIAN_ID, "clinician", "Demo Clinician"),
    }

    def __init__(self, app_env: str) -> None:
        if app_env != "local":
            raise RuntimeError("development auth requires APP_ENV=local")

    def verify(self, authorization: str | None) -> AuthUser:
        token = _bearer_token(authorization)
        user = self._users.get(token)
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid local demo token")
        return user


class SupabaseJWTAuthVerifier:
    """Fail closed until a JWKS-backed verifier is configured and implemented."""

    def verify(self, authorization: str | None) -> AuthUser:
        _bearer_token(authorization)
        raise HTTPException(
            status_code=401,
            detail="Supabase JWT verification is not configured in this build",
        )


def _bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    scheme, separator, token = authorization.partition(" ")
    if not separator or scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Bearer authentication required")
    return token.strip()


def current_user(request: Request, authorization: str | None = Header(default=None)) -> AuthUser:
    verifier: AuthVerifier = request.app.state.auth_verifier
    return verifier.verify(authorization)


@dataclass(frozen=True)
class StreamGrant:
    user_id: str
    role: Literal["patient", "clinician", "admin"]
    display_name: str
    session_id: str
    expires_at: float


class SessionTokenStore:
    def __init__(self) -> None:
        self._tokens: dict[str, StreamGrant] = {}

    def issue(self, user: AuthUser, session_id: str, ttl_seconds: int) -> str:
        token = secrets.token_urlsafe(32)
        self._tokens[token] = StreamGrant(
            user_id=user.user_id,
            role=user.role,
            display_name=user.display_name,
            session_id=session_id,
            expires_at=time.time() + ttl_seconds,
        )
        return token

    def resolve(self, token: str, session_id: str) -> StreamGrant | None:
        grant = self._tokens.get(token)
        if grant is None or grant.expires_at <= time.time() or grant.session_id != session_id:
            self._tokens.pop(token, None)
            return None
        return grant

    def revoke(self, token: str) -> None:
        self._tokens.pop(token, None)

    def revoke_session(self, session_id: str) -> None:
        for token in [
            token for token, grant in self._tokens.items() if grant.session_id == session_id
        ]:
            self._tokens.pop(token, None)
