import pytest
from app.config import VisionSettings
from app.detector import VisionUnavailableError
from app.inference import InferenceEngine
from app.keypoint_adapter import KeypointMappingError, load_mapping, map_raw_keypoints
from app.schemas import FrameRequest
from fastapi.testclient import TestClient

FRAME = FrameRequest(sequence=1, timestamp_ms=100, image_b64="aGVsbG8=").model_dump()


def fixture_settings(**overrides: object) -> VisionSettings:
    values = {"vision_mode": "fixture", "sapiens_checkpoint_root": ""}
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
        assert set(result.landmarks) == {
            "selected_hip",
            "selected_knee",
            "selected_ankle",
        }
        assert all(landmark.valid for landmark in result.landmarks.values())


def test_fixture_sequence_cycles():
    engine = InferenceEngine(fixture_settings())
    first = engine.infer(0, 0, "aGVsbG8=")
    engine.infer(1, 100, "aGVsbG8=")
    engine.infer(2, 200, "aGVsbG8=")
    engine.infer(3, 300, "aGVsbG8=")
    fifth = engine.infer(4, 400, "aGVsbG8=")
    assert first.landmarks == fifth.landmarks


def test_sapiens_mode_without_weights_fails_clearly():
    with pytest.raises(VisionUnavailableError, match="vision service unavailable"):
        InferenceEngine(fixture_settings(vision_mode="sapiens"))


def test_placeholder_mapping_is_refused():
    mapping = load_mapping()
    assert mapping.is_placeholder
    with pytest.raises(KeypointMappingError, match="placeholders"):
        map_raw_keypoints([{"x": 0.1, "y": 0.2}], mapping)


def test_invalid_mode_fails_clearly():
    with pytest.raises(VisionUnavailableError, match="unsupported VISION_MODE"):
        InferenceEngine(fixture_settings(vision_mode="bogus"))
