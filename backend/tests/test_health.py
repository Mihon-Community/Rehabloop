import logging

from app.core.config import Settings
from app.main import _warn_on_dev_auth_with_supabase_credentials, app, create_app
from app.services.in_memory_repository import InMemoryRepository
from app.services.supabase_repository import SupabaseRepository
from fastapi.testclient import TestClient

client = TestClient(app)


def test_health_is_real():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "rehabloop-api"
    assert "version" in body and "mode" in body
    assert body["storage_mode"] in {"memory", "supabase"}


def test_protected_route_requires_authentication():
    response = client.get("/api/v1/me")
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHENTICATED"
    assert response.json()["detail"]


def test_validation_uses_error_contract():
    local_app = create_app(
        Settings(
            app_env="local",
            auth_mode="dev",
            supabase_url="",
            supabase_service_role_key="",
        ),
        repository=InMemoryRepository(),
    )
    local_client = TestClient(local_app)
    response = local_client.post(
        "/api/v1/sessions",
        headers={"Authorization": "Bearer demo-patient-token"},
        json={},
    )
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_unexpected_error_returns_sanitized_contract_response():
    local_app = create_app(
        Settings(app_env="local", auth_mode="dev"),
        repository=InMemoryRepository(),
    )

    def fail() -> None:
        raise RuntimeError("private dependency detail")

    local_app.add_api_route("/test-error", fail, methods=["GET"])
    response = TestClient(local_app, raise_server_exceptions=False).get("/test-error")
    assert response.status_code == 500
    assert response.json() == {
        "detail": "Internal server error",
        "code": "INTERNAL_SERVER_ERROR",
    }
    assert "private dependency detail" not in response.text


def test_supabase_auth_mode_uses_supabase_profile_lookup_despite_memory_storage() -> None:
    """Regression test: AUTH_MODE=supabase with an incomplete Supabase
    storage configuration (empty SUPABASE_SERVICE_ROLE_KEY) must not wire
    SupabaseJWTAuthVerifier's profile lookup to InMemoryRepository, which
    would only ever recognise its two hardcoded dev UUIDs."""
    config = Settings(
        app_env="local",
        auth_mode="supabase",
        supabase_url="https://project.test",
        supabase_jwks_url="https://project.test/auth/v1/.well-known/jwks.json",
        supabase_service_role_key="",
    )
    assert config.storage_mode == "memory"
    local_app = create_app(config, repository=InMemoryRepository())
    lookup = local_app.state.auth_verifier._profile_lookup
    assert isinstance(lookup.__self__, SupabaseRepository)


def test_supabase_auth_mode_reuses_configured_supabase_repository() -> None:
    """When storage is already Supabase-backed, profile lookup must reuse
    that same instance rather than constructing a redundant second one."""
    config = Settings(
        app_env="local",
        auth_mode="supabase",
        supabase_url="https://project.test",
        supabase_service_role_key="unit-test-key",
    )
    local_app = create_app(config)
    lookup = local_app.state.auth_verifier._profile_lookup
    assert lookup.__self__ is local_app.state.repository


def test_warns_when_dev_auth_active_despite_supabase_credentials(caplog) -> None:
    config = Settings(
        app_env="local",
        auth_mode="dev",
        supabase_url="https://project.test",
        supabase_jwks_url="https://project.test/auth/v1/.well-known/jwks.json",
        supabase_service_role_key="",
    )
    with caplog.at_level(logging.WARNING, logger="app.main"):
        _warn_on_dev_auth_with_supabase_credentials(config)
    assert "AUTH_MODE=dev is active" in caplog.text


def test_no_warning_for_plain_local_dev_auth_without_supabase_credentials(caplog) -> None:
    # Every Supabase-related field is pinned explicitly (not left to default)
    # because a real deployment's container environment can have real
    # SUPABASE_* values set as process env vars, which pydantic-settings
    # would otherwise pick up ahead of the field default -- exactly the kind
    # of env-dependent leakage this fix is about.
    config = Settings(
        app_env="local",
        auth_mode="dev",
        supabase_url="",
        supabase_jwks_url="",
        supabase_service_role_key="",
    )
    with caplog.at_level(logging.WARNING, logger="app.main"):
        _warn_on_dev_auth_with_supabase_credentials(config)
    assert caplog.text == ""


def test_malformed_uuid_path_uses_validation_error_contract():
    local_app = create_app(
        Settings(app_env="local", auth_mode="dev"),
        repository=InMemoryRepository(),
    )
    response = TestClient(local_app).get(
        "/api/v1/sessions/not-a-uuid",
        headers={"Authorization": "Bearer demo-patient-token"},
    )
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
