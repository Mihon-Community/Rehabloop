"""Vision HTTP client transport and unavailable-state checks."""

from __future__ import annotations

import asyncio

import httpx
import pytest
from app.schemas.stream import FrameEvent
from app.services.vision_client import VisionClient, VisionUnavailableError

VISION_BODY = {
    "frame_id": "frame-000001",
    "timestamp_ms": 125,
    "sequence": 1,
    "model": "fixture-simulated",
    "mapping_version": "rehabloop-knee-map-1.0",
    "landmarks": {
        "selected_hip": {"x": 0.2, "y": 0.5, "confidence": 0.9, "valid": True},
        "selected_knee": {"x": 0.5, "y": 0.5, "confidence": 0.9, "valid": True},
        "selected_ankle": {"x": 0.6, "y": 0.8, "confidence": 0.9, "valid": True},
    },
    "inference_ms": 1.0,
    "person_detected": True,
    "simulated": True,
    "quality": {"source": "labelled_synthetic_fixture"},
}


def test_vision_client_posts_frame_without_session_metadata() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=VISION_BODY)

    client = VisionClient(
        "http://vision.test/",
        transport=httpx.MockTransport(handler),
    )
    frame = FrameEvent(
        session_id="session-id",
        sequence=1,
        timestamp_ms=125,
        image_b64="c3ludGhldGlj",
    )
    result = asyncio.run(client.infer(frame))
    assert client.state == "available"
    assert result.simulated is True
    assert seen[0].url.path == "/infer"
    assert b"session_id" not in seen[0].content


def test_vision_client_exposes_unavailable_state_on_dependency_failure() -> None:
    client = VisionClient(
        "http://vision.test",
        transport=httpx.MockTransport(lambda _request: httpx.Response(503)),
    )
    frame = FrameEvent(session_id="session-id", sequence=1, timestamp_ms=125, image_b64="aGVsbG8=")
    with pytest.raises(VisionUnavailableError, match="vision service unavailable"):
        asyncio.run(client.infer(frame))
    assert client.state == "unavailable"
