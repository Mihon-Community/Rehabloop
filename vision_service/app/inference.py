"""Pose inference engine with two explicit modes.

fixture (default): replays labelled synthetic keypoints. EVERY response is
marked simulated=True because the blueprint forbids presenting fake output as
real inference.
sapiens: requires approved checkpoints and a resolved keypoint mapping; fails
with a clear 'vision service unavailable' error otherwise.
"""

from __future__ import annotations

import base64
import time

from .config import VisionSettings
from .detector import PersonDetector, VisionUnavailableError
from .keypoint_adapter import KeypointMappingError, load_mapping, map_raw_keypoints
from .schemas import InferenceResponse, Landmark

# Labelled synthetic frames. Coordinates are illustrative, not clinical values.
_FIXTURE_SEQUENCE: list[dict[str, tuple[float, float, float]]] = [
    {
        "selected_hip": (0.42, 0.39, 0.94),
        "selected_knee": (0.58, 0.63, 0.92),
        "selected_ankle": (0.74, 0.68, 0.90),
    },
    {
        "selected_hip": (0.42, 0.39, 0.93),
        "selected_knee": (0.56, 0.58, 0.91),
        "selected_ankle": (0.76, 0.69, 0.89),
    },
    {
        "selected_hip": (0.42, 0.39, 0.92),
        "selected_knee": (0.54, 0.52, 0.90),
        "selected_ankle": (0.78, 0.70, 0.88),
    },
    {
        "selected_hip": (0.42, 0.39, 0.91),
        "selected_knee": (0.58, 0.63, 0.90),
        "selected_ankle": (0.74, 0.68, 0.87),
    },
]


class InferenceEngine:
    def __init__(self, settings: VisionSettings) -> None:
        self.settings = settings
        self.detector = PersonDetector(settings)
        self.mapping = load_mapping()
        self._cursor = 0
        if settings.mode not in ("fixture", "sapiens"):
            raise VisionUnavailableError(
                f"vision service unavailable: unsupported VISION_MODE={settings.mode!r}; "
                "use 'fixture' or 'sapiens'"
            )
        if settings.mode == "sapiens" and settings.sapiens_checkpoint_root == "":
            raise VisionUnavailableError(
                "vision service unavailable: SAPIENS_CHECKPOINT_ROOT must be set in sapiens mode"
            )

    @property
    def simulated(self) -> bool:
        return self.settings.mode == "fixture"

    def model_name(self) -> str:
        return "fixture-simulated" if self.simulated else self.settings.sapiens_pose_model

    def infer(self, sequence: int, timestamp_ms: int, image_b64: str) -> InferenceResponse:
        started = time.perf_counter()
        # Decode only to validate that a frame was supplied; never persist bytes.
        try:
            frame = base64.b64decode(image_b64, validate=True)
        except Exception as exc:  # noqa: BLE001
            raise VisionUnavailableError(
                "vision service unavailable: invalid frame payload"
            ) from exc
        person = self.detector.detect(frame)

        if self.simulated:
            sample = _FIXTURE_SEQUENCE[self._cursor % len(_FIXTURE_SEQUENCE)]
            self._cursor += 1
            landmarks = {
                name: Landmark(
                    x=x,
                    y=y,
                    x_px=x * 640,
                    y_px=y * 480,
                    confidence=confidence,
                    valid=True,
                )
                for name, (x, y, confidence) in sample.items()
            }
            quality = {"source": "labelled_synthetic_fixture", "person_detected": person}
        else:
            try:
                raw = self._sapiens_keypoints(frame)
                mapped = map_raw_keypoints(raw, self.mapping)
            except KeypointMappingError as exc:
                raise VisionUnavailableError(f"vision service unavailable: {exc}") from exc
            landmarks = {name: Landmark(**values) for name, values in mapped.items()}
            quality = {"source": "sapiens2", "person_detected": person}

        return InferenceResponse(
            frame_id=f"frame-{sequence:06d}",
            timestamp_ms=timestamp_ms,
            sequence=sequence,
            model=self.model_name(),
            mapping_version=self.mapping.version,
            landmarks=landmarks,
            inference_ms=round((time.perf_counter() - started) * 1000, 3),
            person_detected=person,
            simulated=self.simulated,
            quality=quality,
        )

    def _sapiens_keypoints(self, _frame: bytes) -> list[dict[str, float]]:
        raise VisionUnavailableError(
            "vision service unavailable: Sapiens2 runtime is not installed in this image; "
            "install the licensed package in the GPU override image and run the smoke test"
        )
