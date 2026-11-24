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
