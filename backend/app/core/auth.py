"""Request authentication and short-lived, session-bound streaming tokens."""

from __future__ import annotations

import asyncio
import secrets
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Literal, Protocol
from uuid import UUID

import httpx
import jwt
from fastapi import Header, HTTPException, Request

from .config import Settings

DEV_PATIENT_ID = "00000000-0000-0000-0000-000000000001"
DEV_CLINICIAN_ID = "00000000-0000-0000-0000-000000000002"


@dataclass(frozen=True)
class AuthUser:
    user_id: str
    role: Literal["patient", "clinician", "admin"]
    display_name: str


class AuthVerifier(Protocol):
    async def verify(self, authorization: str | None) -> AuthUser: ...


class DevAuthVerifier:
    """Two synthetic accounts for local integration only."""

    _users = {
        "demo-patient-token": AuthUser(DEV_PATIENT_ID, "patient", "Demo Patient"),
        "demo-clinician-token": AuthUser(DEV_CLINICIAN_ID, "clinician", "Demo Clinician"),
    }

    def __init__(self, app_env: str) -> None:
        if app_env != "local":
            raise RuntimeError("development auth requires APP_ENV=local")

    async def verify(self, authorization: str | None) -> AuthUser:
        token = _bearer_token(authorization)
        user = self._users.get(token)
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid local demo token")
        return user


class SupabaseJWTAuthVerifier:
    """Verify Supabase access tokens and load authorization from trusted profiles."""

    _ASYMMETRIC_ALGORITHMS = {"ES256", "RS256"}
    _JWKS_TTL_SECONDS = 600

    def __init__(
        self,
        settings: Settings,
        profile_lookup: Callable[[str], Awaitable[dict[str, object] | None]],
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._supabase_url = settings.supabase_url.rstrip("/")
        self._issuer = f"{self._supabase_url}/auth/v1" if self._supabase_url else ""
        self._jwks_url = settings.supabase_jwks_url or (
            f"{self._issuer}/.well-known/jwks.json" if self._issuer else ""
        )
        self._anon_key = settings.supabase_anon_key.get_secret_value()
        self._profile_lookup = profile_lookup
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=3.0, read=5.0, write=3.0, pool=3.0),
            transport=transport,
        )
        self._jwks: dict[str, object] | None = None
        self._jwks_loaded_at = 0.0
        self._jwks_lock = asyncio.Lock()

    async def verify(self, authorization: str | None) -> AuthUser:
        token = _bearer_token(authorization)
        if not self._supabase_url:
            raise HTTPException(status_code=503, detail="Supabase authentication is unavailable")

        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError as exc:
            raise HTTPException(status_code=401, detail="Invalid access token") from exc

        algorithm = header.get("alg")
        if algorithm == "HS256":
            user_id = await self._verify_legacy_token(token)
        elif algorithm in self._ASYMMETRIC_ALGORITHMS:
            claims = await self._verify_asymmetric_token(token, header, algorithm)
            if claims.get("role") != "authenticated" or claims.get("is_anonymous") is True:
                raise HTTPException(status_code=401, detail="Invalid access token")
            user_id = _user_id(claims.get("sub"))
        else:
            raise HTTPException(status_code=401, detail="Invalid access token")

        try:
            profile = await self._profile_lookup(user_id)
        except (httpx.HTTPError, RuntimeError) as exc:
            raise HTTPException(
                status_code=503, detail="Supabase profile lookup is unavailable"
            ) from exc
        if profile is None:
            raise HTTPException(status_code=401, detail="Invalid access token")

        role = profile.get("role")
        if not isinstance(role, str) or role not in {"patient", "clinician", "admin"}:
            raise HTTPException(status_code=401, detail="Invalid access token")
        display_name = profile.get("display_name")
        return AuthUser(
            user_id=user_id,
            role=role,  # type: ignore[arg-type]
            display_name=display_name if isinstance(display_name, str) and display_name else "User",
        )

    async def _verify_asymmetric_token(
        self, token: str, header: dict[str, object], algorithm: str
    ) -> dict[str, object]:
        kid = header.get("kid")
        if not isinstance(kid, str) or not kid:
            raise HTTPException(status_code=401, detail="Invalid access token")

        jwk_data = await self._find_jwk(kid, algorithm)
        if jwk_data is None:
            jwk_data = await self._find_jwk(kid, algorithm, refresh=True)
        if jwk_data is None:
            raise HTTPException(status_code=401, detail="Invalid access token")

        try:
            signing_key = jwt.PyJWK.from_dict(jwk_data).key
            claims = jwt.decode(
                token,
                signing_key,
                algorithms=[algorithm],
                audience="authenticated",
                issuer=self._issuer,
                options={"require": ["aud", "exp", "iss", "role", "sub"]},
            )
        except jwt.PyJWKError as exc:
            raise HTTPException(
                status_code=503, detail="Supabase signing key is unavailable"
            ) from exc
        except jwt.PyJWTError as exc:
            raise HTTPException(status_code=401, detail="Invalid access token") from exc
        return claims

    async def _find_jwk(
        self, kid: str, algorithm: str, *, refresh: bool = False
    ) -> dict[str, object] | None:
        jwks = await self._load_jwks(force=refresh)
        keys = jwks.get("keys")
        if not isinstance(keys, list):
            raise HTTPException(status_code=503, detail="Supabase signing keys are unavailable")
        for key in keys:
            if not isinstance(key, dict):
                continue
            if key.get("kid") != kid or key.get("alg") != algorithm:
                continue
            if key.get("use") not in (None, "sig"):
                continue
            key_ops = key.get("key_ops")
            if isinstance(key_ops, list) and "verify" not in key_ops:
                continue
            return key
        return None

    async def _load_jwks(self, *, force: bool = False) -> dict[str, object]:
        now = time.monotonic()
        if (
            not force
            and self._jwks is not None
            and now - self._jwks_loaded_at < self._JWKS_TTL_SECONDS
        ):
            return self._jwks
        async with self._jwks_lock:
            now = time.monotonic()
            if (
                not force
                and self._jwks is not None
                and now - self._jwks_loaded_at < self._JWKS_TTL_SECONDS
            ):
                return self._jwks
            if not self._jwks_url:
                raise HTTPException(status_code=503, detail="Supabase signing keys are unavailable")
            try:
                response = await self._client.get(self._jwks_url)
                response.raise_for_status()
                payload = response.json()
            except (httpx.HTTPError, ValueError) as exc:
                raise HTTPException(
                    status_code=503, detail="Supabase signing keys are unavailable"
                ) from exc
            if not isinstance(payload, dict) or not isinstance(payload.get("keys"), list):
                raise HTTPException(status_code=503, detail="Supabase signing keys are unavailable")
            self._jwks = payload
            self._jwks_loaded_at = time.monotonic()
            return payload

    async def _verify_legacy_token(self, token: str) -> str:
        if not self._anon_key:
            raise HTTPException(
                status_code=503,
                detail="Legacy Supabase tokens require SUPABASE_ANON_KEY for remote verification",
            )
        try:
            response = await self._client.get(
                f"{self._supabase_url}/auth/v1/user",
                headers={"apikey": self._anon_key, "Authorization": f"Bearer {token}"},
            )
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=503, detail="Supabase authentication is unavailable"
            ) from exc
        if response.status_code in {401, 403}:
            raise HTTPException(status_code=401, detail="Invalid access token")
        if response.status_code != 200:
            raise HTTPException(status_code=503, detail="Supabase authentication is unavailable")
        try:
            user = response.json()
        except ValueError as exc:
            raise HTTPException(
                status_code=503, detail="Supabase authentication returned an invalid response"
            ) from exc
        if not isinstance(user, dict):
            raise HTTPException(
                status_code=503, detail="Supabase authentication returned an invalid response"
            )
        if user.get("is_anonymous") is True:
            raise HTTPException(status_code=401, detail="Invalid access token")
        return _user_id(user.get("id"))

    async def aclose(self) -> None:
        await self._client.aclose()


def _bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    scheme, separator, token = authorization.partition(" ")
    if not separator or scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Bearer authentication required")
    return token.strip()


async def current_user(
    request: Request, authorization: str | None = Header(default=None)
) -> AuthUser:
    verifier: AuthVerifier = request.app.state.auth_verifier
    return await verifier.verify(authorization)


def _user_id(value: object) -> str:
    try:
        return str(UUID(str(value)))
    except (AttributeError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid access token") from exc


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
