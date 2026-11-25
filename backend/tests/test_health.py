from app.core.config import Settings
from app.main import app, create_app
from app.services.in_memory_repository import InMemoryRepository
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
