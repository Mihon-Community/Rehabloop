"""Pose inference engine with fixture and MoveNet modes.

fixture (default): replays labelled synthetic keypoints. EVERY response is
marked simulated=True so fixture output cannot be presented as real inference.
movenet: CPU MoveNet SinglePose Lightning with a locally mounted LiteRT model.
"""

from __future__ import annotations

import base64
import time
from typing import Any, Protocol

from .config import VisionSettings
from .errors import VisionUnavailableError
from .keypoint_adapter import (
    MOVENET_MAPPING_PATH,
    KeypointMappingError,
    load_mapping,
    map_raw_keypoints,
)
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


class PoseRunner(Protocol):
    def infer(self, image_b64: str) -> list[dict[str, Any]]: ...


class InferenceEngine:
    def __init__(self, settings: VisionSettings) -> None:
        self.settings = settings
        self.mapping = load_mapping(MOVENET_MAPPING_PATH)
        self.runner: PoseRunner | None = None
        if settings.mode == "movenet":
            from .movenet_runner import MoveNetRunner

            self.runner = MoveNetRunner(settings)
        self._cursor = 0
        if settings.mode not in ("fixture", "movenet"):
            raise VisionUnavailableError(
                f"vision service unavailable: unsupported VISION_MODE={settings.mode!r}; "
                "use 'fixture' or 'movenet'"
            )
        if settings.mode == "movenet" and settings.movenet_target_side not in ("left", "right"):
            raise VisionUnavailableError(
                "vision service unavailable: MOVENET_TARGET_SIDE must be left or right"
            )

    @property
    def simulated(self) -> bool:
        return self.settings.mode == "fixture"

    def model_name(self) -> str:
        if self.simulated:
            return "fixture-simulated"
        return self.settings.movenet_model_name

    def infer(self, sequence: int, timestamp_ms: int, image_b64: str) -> InferenceResponse:
        started = time.perf_counter()
        # Decode only to validate that a frame was supplied; never persist bytes.
        try:
            base64.b64decode(image_b64, validate=True)
        except Exception as exc:  # noqa: BLE001
            raise VisionUnavailableError(
                "vision service unavailable: invalid frame payload"
            ) from exc
        person = self.simulated

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
            assert self.runner is not None
            try:
                raw = self.runner.infer(image_b64)
                side = self.settings.movenet_target_side
                mapped = map_raw_keypoints(raw, self.mapping, side)
            except KeypointMappingError as exc:
                raise VisionUnavailableError(f"vision service unavailable: {exc}") from exc
            for values in mapped.values():
                values["valid"] = (
                    float(values["confidence"]) >= self.mapping.required_confidence
                    and 0.0 <= float(values["x"]) <= 1.0
                    and 0.0 <= float(values["y"]) <= 1.0
                )
            landmarks = {name: Landmark(**values) for name, values in mapped.items()}
            if self.settings.mode == "movenet":
                person = any(values["valid"] for values in mapped.values())
            quality = {
                "source": "movenet-singlepose-lightning",
                "person_detected": person,
                "side": side,
                "mapping_source": self.mapping.source,
            }

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
