import sys
from types import SimpleNamespace

import pytest
from app.config import VisionSettings
from app.errors import VisionUnavailableError
from app.inference import InferenceEngine
from app.keypoint_adapter import (
    MOVENET_MAPPING_PATH,
    KeypointMappingError,
    Mapping,
    load_mapping,
    map_raw_keypoints,
)
from app.schemas import FrameRequest
from fastapi.testclient import TestClient

FRAME = FrameRequest(sequence=1, timestamp_ms=100, image_b64="aGVsbG8=").model_dump()


def fixture_settings(**overrides: object) -> VisionSettings:
    values = {"vision_mode": "fixture"}
    values.update(overrides)
    return VisionSettings(**values)  # type: ignore[arg-type]


def test_health_is_simulated_in_fixture_mode():
    from app.main import app

    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json()["simulated"] is True
    assert response.json()["mode"] == "fixture"


def test_every_fixture_inference_is_labelled_simulated():
    engine = InferenceEngine(fixture_settings())
    for sequence in range(8):
        result = engine.infer(sequence, sequence * 100, "aGVsbG8=")
        assert result.simulated is True
        assert result.model == "fixture-simulated"
        assert set(result.landmarks) == {"selected_hip", "selected_knee", "selected_ankle"}
        assert all(landmark.valid for landmark in result.landmarks.values())


def test_fixture_mapping_version_is_distinct_from_movenet_mapping():
    """Regression: the backend expects a different mapping_version for fixture
    sessions than for real MoveNet sessions; fixture output must not report the
    MoveNet YAML's version or every backend frame fails MAPPING_VERSION_MISMATCH."""
    engine = InferenceEngine(fixture_settings())
    result = engine.infer(0, 0, "aGVsbG8=")
    assert result.mapping_version == "rehabloop-knee-map-1.0"
    assert result.mapping_version != load_mapping(MOVENET_MAPPING_PATH).version


def test_fixture_sequence_cycles():
    engine = InferenceEngine(fixture_settings())
    first = engine.infer(0, 0, "aGVsbG8=")
    for i in range(1, 4):
        engine.infer(i, i * 100, "aGVsbG8=")
    fifth = engine.infer(4, 400, "aGVsbG8=")
    assert first.landmarks == fifth.landmarks


def test_placeholder_mapping_is_refused():
    placeholder = Mapping(
        version="test",
        status="PLACEHOLDER_INDICES_NOT_RESOLVED",
        landmarks={
            name: {"index": None} for name in ("selected_hip", "selected_knee", "selected_ankle")
        },
    )
    with pytest.raises(KeypointMappingError, match="placeholders"):
        map_raw_keypoints([{"x": 0.1, "y": 0.2}], placeholder)


def test_movenet_mapping_uses_published_coco17_side_indices():
    mapping = load_mapping(MOVENET_MAPPING_PATH)
    assert mapping.version == "rehabloop-movenet-knee-map-1.0"
    assert not mapping.is_placeholder
    raw = [
        {"x": i / 17, "y": 0.5, "x_px": float(i), "y_px": 0.0, "confidence": 0.9, "valid": True}
        for i in range(17)
    ]
    left = map_raw_keypoints(raw, mapping, "left")
    right = map_raw_keypoints(raw, mapping, "right")
    assert [left[n]["x_px"] for n in ("selected_hip", "selected_knee", "selected_ankle")] == [
        11,
        13,
        15,
    ]
    assert [right[n]["x_px"] for n in ("selected_hip", "selected_knee", "selected_ankle")] == [
        12,
        14,
        16,
    ]


def test_movenet_inference_engine_uses_model_specific_runner(monkeypatch):
    class FakeMoveNetRunner:
        def __init__(self, _settings):
            pass

        def infer(self, _image_b64):
            return [
                {
                    "x": i / 17,
                    "y": 0.5,
                    "x_px": float(i),
                    "y_px": 20.0,
                    "confidence": 0.9,
                    "valid": True,
                }
                for i in range(17)
            ]

    monkeypatch.setitem(
        sys.modules,
        "app.movenet_runner",
        SimpleNamespace(MoveNetRunner=FakeMoveNetRunner),
    )
    engine = InferenceEngine(fixture_settings(vision_mode="movenet", movenet_target_side="right"))
    result = engine.infer(1, 100, "aGVsbG8=")
    assert result.model == "movenet-singlepose-lightning"
    assert result.simulated is False
    assert result.person_detected is True
    assert result.quality["source"] == "movenet-singlepose-lightning"
    assert [
        result.landmarks[name].x_px for name in ("selected_hip", "selected_knee", "selected_ankle")
    ] == [12, 14, 16]


def test_movenet_mode_without_model_path_fails_clearly():
    with pytest.raises(VisionUnavailableError, match="MOVENET_MODEL_PATH"):
        InferenceEngine(fixture_settings(vision_mode="movenet"))


def test_invalid_mode_fails_clearly():
    with pytest.raises(VisionUnavailableError, match="unsupported VISION_MODE"):
        InferenceEngine(fixture_settings(vision_mode="bogus"))
