"""Fixture-backed end-to-end stream tests through real HTTP and WebSocket routes."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from app.core.auth import DEV_PATIENT_ID
from app.core.config import Settings
from app.main import create_app
from app.schemas.stream import FrameEvent, VisionResponse
from app.services.in_memory_repository import DEMO_CONSENT_ID, InMemoryRepository
from fastapi.testclient import TestClient

PATIENT = {"Authorization": "Bearer demo-patient-token"}
PARAMETERS = {
    "rest_min_deg": 70,
    "rest_max_deg": 80,
    "target_min_deg": 110,
    "target_max_deg": 125,
    "target_reps": 8,
}
FIXTURE_ROOT = Path(__file__).resolve().parents[2] / "fixtures" / "synthetic_keypoint_sequences"


class SyntheticVisionClient:
    def __init__(self, frames: list[dict[str, Any]], model: str, mapping: str) -> None:
        self.frames = frames
        self.model = model
        self.mapping = mapping
        self.calls = 0

    async def infer(self, frame: FrameEvent) -> VisionResponse:
        source = self.frames[self.calls]
        self.calls += 1
        return VisionResponse(
            frame_id=f"frame-{frame.sequence:06d}",
            timestamp_ms=frame.timestamp_ms,
            sequence=frame.sequence,
            model=self.model,
            mapping_version=self.mapping,
            landmarks=source["landmarks"],
            inference_ms=0.1,
            person_detected=source["person_count"] == 1,
            simulated=True,
            quality={"source": "labelled_synthetic_fixture"},
        )


def _make_client(vision: SyntheticVisionClient, *, max_frame_rate: int = 60) -> TestClient:
    settings = Settings(
        app_env="local",
        auth_mode="dev",
        vision_mode="fixture",
        max_frame_rate=max_frame_rate,
        supabase_url="",
        supabase_service_role_key="",
        nvidia_api_key="",
        nvidia_model_id="",
    )
    app = create_app(settings, repository=InMemoryRepository(), vision_client=vision)
    return TestClient(app)


def _fixture_frames() -> tuple[dict[str, Any], SyntheticVisionClient]:
    data = json.loads((FIXTURE_ROOT / "clean_8_reps.json").read_text(encoding="utf-8"))
    client = SyntheticVisionClient(data["frames"], data["model"], data["mapping_version"])
    return data, client


def _create_and_start(client: TestClient) -> tuple[str, str]:
    protocol = client.post(
        "/api/v1/protocols",
        headers={"Authorization": "Bearer demo-clinician-token"},
        json={
            "patient_id": DEV_PATIENT_ID,
            "protocol_name": "Synthetic fixture protocol",
            "parameters": PARAMETERS,
        },
    )
    assert protocol.status_code == 200
    session = client.post(
        "/api/v1/sessions", headers=PATIENT, json={"protocol_id": protocol.json()["id"]}
    )
    assert session.status_code == 200
    session_id = session.json()["session_id"]
    started = client.post(
        f"/api/v1/sessions/{session_id}/start",
        headers=PATIENT,
        json={"consent_record_id": DEMO_CONSENT_ID, "camera_checks_passed": True},
    )
    assert started.status_code == 200
    return session_id, started.json()["stream_token"]


def test_session_runs_through_real_routes_and_fixture_stream() -> None:
    data, vision = _fixture_frames()
    with _make_client(vision) as client:
        session_id, token = _create_and_start(client)
        event = {}
        with client.websocket_connect(
            f"/api/v1/sessions/{session_id}/stream?token={token}"
        ) as websocket:
            for source in data["frames"]:
                frame = {
                    "type": "frame",
                    "session_id": session_id,
                    "sequence": source["sequence"],
                    "timestamp_ms": source["timestamp_ms"],
                    "image_b64": "c3ludGhldGlj",
                }
                websocket.send_json(frame)
                event = websocket.receive_json()
                assert event["type"] == "measurement"
                assert event["simulated"] is True
                assert event["model_version"].startswith("fixture-")
                time.sleep(0.02)

        assert event["rep_count"] == 8
        assert vision.calls == len(data["frames"])
        paused = client.get(f"/api/v1/sessions/{session_id}", headers=PATIENT).json()
        assert paused["status"] == "paused"
        assert paused["persisted"] is False

        completed = client.post(f"/api/v1/sessions/{session_id}/complete", headers=PATIENT, json={})
        assert completed.status_code == 200
        assert completed.json()["status"] == "completed"
        assert completed.json()["metrics"]["completed_reps"] == 8
        assert completed.json()["raw_video_stored"] is False

        summary = client.post(f"/api/v1/sessions/{session_id}/summary", headers=PATIENT, json={})
        assert summary.status_code == 200
        assert summary.json()["source"] == "deterministic_fallback"
        assert summary.json()["persisted"] is False


def test_stream_requires_valid_session_bound_token() -> None:
    _data, vision = _fixture_frames()
    with _make_client(vision) as client:
        session_id, _token = _create_and_start(client)
        with client.websocket_connect(
            f"/api/v1/sessions/{session_id}/stream?token=invalid"
        ) as websocket:
            event = websocket.receive_json()
            assert event["type"] == "error"
            assert event["code"] == "UNAUTHENTICATED"


def test_server_drops_frames_that_exceed_configured_rate() -> None:
    data, vision = _fixture_frames()
    with _make_client(vision, max_frame_rate=1) as client:
        session_id, token = _create_and_start(client)
        with client.websocket_connect(
            f"/api/v1/sessions/{session_id}/stream?token={token}"
        ) as websocket:
            for source in data["frames"][:2]:
                websocket.send_json(
                    {
                        "type": "frame",
                        "session_id": session_id,
                        "sequence": source["sequence"],
                        "timestamp_ms": source["timestamp_ms"],
                        "image_b64": "c3ludGhldGlj",
                    }
                )
                event = websocket.receive_json()
        assert event["type"] == "error"
        assert event["code"] == "RATE_LIMITED"
        assert vision.calls == 1
