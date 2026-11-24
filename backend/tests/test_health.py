from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_health_is_real():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "rehabloop-api"
    assert "version" in body and "mode" in body


def test_stub_follows_error_contract():
    response = client.get("/api/v1/me")
    assert response.status_code == 501
    assert response.json()["code"] == "NOT_IMPLEMENTED"
    assert response.json()["detail"]


def test_validation_uses_error_contract():
    response = client.post("/api/v1/sessions", json={})
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
