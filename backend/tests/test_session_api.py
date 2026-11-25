"""Local-only lifecycle, authorization, consent, and persistence metadata checks."""

from __future__ import annotations

import asyncio

import httpx
from app.core.auth import DEV_CLINICIAN_ID, DEV_PATIENT_ID
from app.core.config import Settings
from app.main import create_app
from app.services.in_memory_repository import DEMO_CONSENT_ID, InMemoryRepository
from app.services.supabase_repository import (
    CAMERA_CONSENT_PURPOSE,
    CAMERA_CONSENT_VERSION,
    SupabaseRepository,
)
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
        cached_summary = client.post(f"/api/v1/sessions/{session_id}/summary", headers=PATIENT)
        assert cached_summary.status_code == 200
        assert cached_summary.json() == summary.json()


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


def test_supabase_consent_requires_camera_scope_and_version() -> None:
    settings = _settings(
        app_env="staging",
        auth_mode="supabase",
        supabase_url="https://supabase.test",
        supabase_service_role_key="unit-test-key",
    )
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200, json=[{"id": "33333333-3333-4333-8333-333333333333"}])

    repo = SupabaseRepository(settings, transport=httpx.MockTransport(handler))
    consent_id = "33333333-3333-4333-8333-333333333333"
    valid = asyncio.run(repo.consent_is_valid(consent_id, DEV_PATIENT_ID))

    assert valid is True
    assert len(calls) == 1
    params = dict(calls[0].url.params)
    assert params["purpose"] == f"eq.{CAMERA_CONSENT_PURPOSE}"
    assert params["consent_version"] == f"eq.{CAMERA_CONSENT_VERSION}"
    assert params["revoked_at"] == "is.null"


def test_supabase_repository_uses_atomic_backend_write_functions() -> None:
    settings = _settings(
        app_env="staging",
        auth_mode="supabase",
        supabase_url="https://supabase.test",
        supabase_service_role_key="unit-test-key",
    )
    protocol = {
        "id": "11111111-1111-4111-8111-111111111112",
        "patient_id": DEV_PATIENT_ID,
        "clinician_id": DEV_CLINICIAN_ID,
        "protocol_name": "test",
        "version": 2,
        "parameters": PROTOCOL_PARAMETERS,
        "approved_at": None,
        "active": True,
    }
    session = {
        "id": "22222222-2222-4222-8222-222222222222",
        "patient_id": DEV_PATIENT_ID,
        "protocol_id": protocol["id"],
        "status": "completed",
        "model_version": "fixture-simulated",
        "mapping_version": "rehabloop-knee-map-1.0",
        "analytics_version": "knee-extension-engine-0.1.0",
        "raw_video_stored": False,
    }
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if request.url.path.endswith("/rpc/backend_update_protocol_version"):
            return httpx.Response(200, json=[protocol])
        if request.url.path.endswith("/rpc/backend_complete_session"):
            return httpx.Response(200, json=[session])
        if request.url.path.endswith("/sessions"):
            return httpx.Response(200, json=[session])
        if request.url.path.endswith("/exercise_protocols"):
            return httpx.Response(200, json=[protocol])
        if request.url.path.endswith("/session_metrics"):
            return httpx.Response(200, json=[])
        if request.url.path.endswith("/session_flags"):
            return httpx.Response(200, json=[])
        raise AssertionError(f"Unexpected PostgREST path: {request.url.path}")

    repo = SupabaseRepository(settings, transport=httpx.MockTransport(handler))

    async def run() -> tuple[dict[str, object] | None, dict[str, object] | None]:
        updated_protocol = await repo.update_protocol_version(
            "11111111-1111-4111-8111-111111111111",
            {**protocol, "version": 2, "id": protocol["id"]},
        )
        completed_session = await repo.complete_session(
            session["id"],
            "2026-11-24T10:00:00+00:00",
            {"completed_reps": 4, "usable_frame_pct": 80.0},
            ["SYNTHETIC_INPUT"],
        )
        return updated_protocol, completed_session

    updated_protocol, completed_session = asyncio.run(run())
    assert updated_protocol is not None and updated_protocol["version"] == 2
    assert completed_session is not None and completed_session["status"] == "completed"
    assert completed_session["metrics"]["completed_reps"] == 4
    assert "SYNTHETIC_INPUT" in completed_session["quality_flags"]
    assert calls[-1].url.path.endswith("/rpc/backend_complete_session")
    rpc_paths = [call.url.path for call in calls if "/rpc/" in call.url.path]
    assert rpc_paths == [
        "/rest/v1/rpc/backend_update_protocol_version",
        "/rest/v1/rpc/backend_complete_session",
    ]
