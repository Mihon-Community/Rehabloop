"""Local-only lifecycle, authorization, consent, and persistence metadata checks."""

from __future__ import annotations

import asyncio

import httpx
from app.core.auth import DEV_CLINICIAN_ID, DEV_PATIENT_ID
from app.core.config import Settings
from app.main import create_app
from app.services.in_memory_repository import DEMO_CONSENT_ID, InMemoryRepository
from app.services.supabase_repository import SupabaseRepository
from fastapi.testclient import TestClient

PATIENT = {"Authorization": "Bearer demo-patient-token"}
CLINICIAN = {"Authorization": "Bearer demo-clinician-token"}
PROTOCOL_PARAMETERS = {
    "rest_min_deg": 70,
    "rest_max_deg": 80,
    "target_min_deg": 110,
    "target_max_deg": 125,
    "target_reps": 8,
    "hold_ms": 400,
}


def _settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "app_env": "local",
        "auth_mode": "dev",
        "vision_mode": "fixture",
        "supabase_url": "",
        "supabase_service_role_key": "",
        "nvidia_api_key": "",
        "nvidia_model_id": "",
    }
    values.update(overrides)
    return Settings(**values)


def _client() -> TestClient:
    app = create_app(_settings(), repository=InMemoryRepository())
    return TestClient(app)


def _create_protocol(client: TestClient) -> str:
    response = client.post(
        "/api/v1/protocols",
        headers=CLINICIAN,
        json={
            "patient_id": DEV_PATIENT_ID,
            "protocol_name": "Synthetic knee extension",
            "parameters": PROTOCOL_PARAMETERS,
        },
    )
    assert response.status_code == 200
    assert response.json()["persisted"] is False
    return response.json()["id"]


def test_in_memory_session_lifecycle_and_safe_summary() -> None:
    with _client() as client:
        health = client.get("/api/v1/health")
        assert health.json()["storage_mode"] == "memory"
        assert client.get("/api/v1/me").status_code == 401
        assert client.get("/api/v1/me", headers=PATIENT).json()["id"] == DEV_PATIENT_ID

        protocol_id = _create_protocol(client)
        assert len(client.get("/api/v1/patients/me/protocols", headers=PATIENT).json()) == 1
        assert (
            client.post(
                "/api/v1/protocols",
                headers=PATIENT,
                json={
                    "patient_id": DEV_PATIENT_ID,
                    "protocol_name": "Not authorized",
                    "parameters": PROTOCOL_PARAMETERS,
                },
            ).status_code
            == 403
        )

        created = client.post(
            "/api/v1/sessions", headers=PATIENT, json={"protocol_id": protocol_id}
        )
        assert created.status_code == 200
        session = created.json()
        assert session["status"] == "draft"
        assert session["persisted"] is False
        assert session["raw_video_stored"] is False
        session_id = session["session_id"]

        started = client.post(
            f"/api/v1/sessions/{session_id}/start",
            headers=PATIENT,
            json={"consent_record_id": DEMO_CONSENT_ID, "camera_checks_passed": True},
        )
        assert started.status_code == 200
        assert started.json()["status"] == "active"
        assert started.json()["persisted"] is False
        assert started.json()["stream_token"]
        assert (
            client.post(
                f"/api/v1/sessions/{session_id}/start",
                headers=PATIENT,
                json={"consent_record_id": DEMO_CONSENT_ID, "camera_checks_passed": True},
            ).status_code
            == 409
        )

        completed = client.post(f"/api/v1/sessions/{session_id}/complete", headers=PATIENT, json={})
        assert completed.status_code == 200
        assert completed.json()["status"] == "completed"
        assert completed.json()["persisted"] is False
        assert "NO_VALID_FRAMES" in completed.json()["quality_flags"]
        assert client.get(f"/api/v1/sessions/{session_id}", headers=PATIENT).status_code == 200
        assert (
            client.get(f"/api/v1/patients/{DEV_PATIENT_ID}/progress", headers=PATIENT).json()[
                "persisted"
            ]
            is False
        )

        summary = client.post(
            f"/api/v1/sessions/{session_id}/summary",
            headers=PATIENT,
            json={"regenerate": False},
        )
        assert summary.status_code == 200
        assert summary.json()["source"] == "deterministic_fallback"
        assert summary.json()["model_id"] is None
        assert summary.json()["persisted"] is False
        assert "non-clinical" in summary.json()["disclaimer"]


def test_consent_is_required_before_start_and_demo_auth_is_local_only() -> None:
    with _client() as client:
        protocol_id = _create_protocol(client)
        session = client.post(
            "/api/v1/sessions", headers=PATIENT, json={"protocol_id": protocol_id}
        ).json()
        response = client.post(
            f"/api/v1/sessions/{session['session_id']}/start",
            headers=PATIENT,
            json={"consent_record_id": "unknown-consent", "camera_checks_passed": True},
        )
        assert response.status_code == 403

    try:
        Settings(app_env="production", auth_mode="dev")
    except ValueError as exc:
        assert "APP_ENV=local" in str(exc)
    else:
        raise AssertionError("development auth must fail outside local environment")


def test_protocol_update_creates_new_version() -> None:
    with _client() as client:
        protocol_id = _create_protocol(client)
        response = client.patch(
            f"/api/v1/protocols/{protocol_id}",
            headers=CLINICIAN,
            json={"parameters": {**PROTOCOL_PARAMETERS, "target_reps": 6}},
        )
        assert response.status_code == 200
        assert response.json()["id"] != protocol_id
        assert response.json()["version"] == 2
        assert response.json()["parameters"]["target_reps"] == 6
        assert len(client.get("/api/v1/patients/me/protocols", headers=PATIENT).json()) == 1


def test_protocol_requires_clinician_configured_angle_ranges() -> None:
    with _client() as client:
        response = client.post(
            "/api/v1/protocols",
            headers=CLINICIAN,
            json={
                "patient_id": DEV_PATIENT_ID,
                "protocol_name": "Incomplete protocol",
                "parameters": {"target_reps": 8},
            },
        )
        assert response.status_code == 422


def test_supabase_repository_uses_mocked_postgrest_calls() -> None:
    settings = _settings(
        app_env="staging",
        auth_mode="supabase",
        supabase_url="https://supabase.test",
        supabase_service_role_key="unit-test-key",
    )
    protocol = {
        "id": "11111111-1111-4111-8111-111111111111",
        "patient_id": DEV_PATIENT_ID,
        "clinician_id": DEV_CLINICIAN_ID,
        "protocol_name": "test",
        "version": 1,
        "parameters": PROTOCOL_PARAMETERS,
        "approved_at": None,
        "active": True,
    }
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if request.method == "POST":
            return httpx.Response(201, json=[protocol])
        return httpx.Response(200, json=[protocol])

    repo = SupabaseRepository(settings, transport=httpx.MockTransport(handler))
    created = asyncio.run(repo.create_protocol(protocol))
    loaded = asyncio.run(repo.get_protocol(protocol["id"]))
    assert repo.storage_mode == "supabase"
    assert created["persisted"] is True
    assert loaded is not None and loaded["id"] == protocol["id"]
    assert len(calls) == 2
    assert calls[0].url.path.endswith("/rest/v1/exercise_protocols")
    assert calls[0].headers["Authorization"].startswith("Bearer ")
