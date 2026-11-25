"""Supabase access-token verification and trusted profile-role tests."""

from __future__ import annotations

import asyncio
import json
import time
from uuid import uuid4

import httpx
import jwt
import pytest
from app.core.auth import SupabaseJWTAuthVerifier
from app.core.config import Settings
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException


def _settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "app_env": "production",
        "auth_mode": "supabase",
        "supabase_url": "https://project.test",
        "supabase_service_role_key": "test-service-role",
        "supabase_anon_key": "test-publishable-key",
    }
    values.update(overrides)
    return Settings(**values)


def _ec_key_pair() -> tuple[ec.EllipticCurvePrivateKey, dict[str, object]]:
    private_key = ec.generate_private_key(ec.SECP256R1())
    jwk = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(private_key.public_key()))
    jwk.update({"kid": "test-key", "alg": "ES256", "use": "sig", "key_ops": ["verify"]})
    return private_key, jwk


def _access_token(private_key: ec.EllipticCurvePrivateKey, subject: str, **claims: object) -> str:
    payload: dict[str, object] = {
        "iss": "https://project.test/auth/v1",
        "aud": "authenticated",
        "sub": subject,
        "role": "authenticated",
        "exp": int(time.time()) + 300,
        "iat": int(time.time()),
        "is_anonymous": False,
        "app_metadata": {"role": "admin"},
        "user_metadata": {"role": "admin"},
    }
    payload.update(claims)
    return jwt.encode(payload, private_key, algorithm="ES256", headers={"kid": "test-key"})


def test_asymmetric_token_uses_profile_role_not_jwt_metadata() -> None:
    subject = str(uuid4())
    private_key, jwk = _ec_key_pair()
    token = _access_token(private_key, subject)

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/auth/v1/.well-known/jwks.json"
        return httpx.Response(200, json={"keys": [jwk]})

    async def profile_lookup(user_id: str) -> dict[str, object] | None:
        assert user_id == subject
        return {"id": user_id, "role": "patient", "display_name": "Test Patient"}

    async def run() -> None:
        verifier = SupabaseJWTAuthVerifier(
            _settings(), profile_lookup, transport=httpx.MockTransport(handler)
        )
        try:
            user = await verifier.verify(f"Bearer {token}")
            assert user.user_id == subject
            assert user.role == "patient"
            assert user.display_name == "Test Patient"
        finally:
            await verifier.aclose()

    asyncio.run(run())


def test_asymmetric_verifier_rejects_invalid_signature_and_anonymous_tokens() -> None:
    subject = str(uuid4())
    trusted_key, jwk = _ec_key_pair()
    attacker_key, _ = _ec_key_pair()

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"keys": [jwk]})

    async def profile_lookup(user_id: str) -> dict[str, object] | None:
        return {"id": user_id, "role": "patient", "display_name": "Test Patient"}

    async def reject(token: str) -> None:
        verifier = SupabaseJWTAuthVerifier(
            _settings(), profile_lookup, transport=httpx.MockTransport(handler)
        )
        try:
            with pytest.raises(HTTPException) as error:
                await verifier.verify(f"Bearer {token}")
            assert error.value.status_code == 401
        finally:
            await verifier.aclose()

    bad_signature = _access_token(attacker_key, subject)
    anonymous = _access_token(trusted_key, subject, is_anonymous=True)
    asyncio.run(reject(bad_signature))
    asyncio.run(reject(anonymous))


def test_legacy_hs256_token_is_verified_by_auth_with_publishable_key() -> None:
    subject = str(uuid4())
    token = jwt.encode(
        {"sub": subject, "role": "authenticated", "exp": int(time.time()) + 300},
        "legacy-test-secret-for-unit-tests-only-32bytes",
        algorithm="HS256",
    )

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/auth/v1/user"
        assert request.headers["apikey"] == "test-publishable-key"
        assert request.headers["authorization"] == f"Bearer {token}"
        return httpx.Response(200, json={"id": subject, "app_metadata": {"role": "admin"}})

    async def profile_lookup(user_id: str) -> dict[str, object] | None:
        return {"id": user_id, "role": "clinician", "display_name": "Trusted Clinician"}

    async def run() -> None:
        verifier = SupabaseJWTAuthVerifier(
            _settings(), profile_lookup, transport=httpx.MockTransport(handler)
        )
        try:
            user = await verifier.verify(f"Bearer {token}")
            assert user.user_id == subject
            assert user.role == "clinician"
        finally:
            await verifier.aclose()

    asyncio.run(run())


def test_legacy_hs256_token_rejects_anonymous_auth_user() -> None:
    subject = str(uuid4())
    token = jwt.encode(
        {"sub": subject, "role": "authenticated", "exp": int(time.time()) + 300},
        "legacy-test-secret-for-unit-tests-only-32bytes",
        algorithm="HS256",
    )
    profile_calls = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"id": subject, "is_anonymous": True})

    async def profile_lookup(_user_id: str) -> dict[str, object] | None:
        nonlocal profile_calls
        profile_calls += 1
        return {"role": "patient"}

    async def run() -> None:
        verifier = SupabaseJWTAuthVerifier(
            _settings(), profile_lookup, transport=httpx.MockTransport(handler)
        )
        try:
            with pytest.raises(HTTPException) as error:
                await verifier.verify(f"Bearer {token}")
            assert error.value.status_code == 401
        finally:
            await verifier.aclose()

    asyncio.run(run())
    assert profile_calls == 0
