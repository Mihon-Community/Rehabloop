"""Offline full-COCO-17 keypoint-sequence extraction, reusing production MoveNet.

Training-serving consistency
----------------------------
This module does **not** reimplement model loading, preprocessing or decoding.
It imports ``vision_service.app.movenet_runner.MoveNetRunner`` - the exact class
the live ``/infer`` endpoint uses - and calls the exact same entry point
(``MoveNetRunner.infer(image_b64)``) on the exact same ``.tflite`` weights. The
frame path mirrors the production client too: OpenCV read -> ``cv2.imencode('.jpg')``
-> base64, which is what ``vision_service/scripts/video_file_replay.py`` sends to
the running service. Identical model, identical preprocessing, identical decode.

The only difference from the live API is what we *keep*. ``/infer`` applies
``map_raw_keypoints()`` and exposes only ``selected_hip``/``selected_knee``/
``selected_ankle`` - correct for RehabLoop's knee-extension product. MoveNet's
own output is the full COCO-17 set, and MobiPhysio's nine exercises span upper
limb, trunk and lower limb, so this offline path consumes all 17 points. Nothing
under ``vision_service/app/`` is modified, forked or re-exported; it is imported
read-only.

Per-keypoint confidence is always preserved. No confidence threshold is applied
here - the production gate value (``required_confidence`` from the mapping YAML)
is recorded as metadata so a later phase can apply the same gate explicitly.

Scope: this produces numeric keypoint coordinates for dataset-defined movement
categories. It makes no clinical, diagnostic, injury, recovery or progression
claim of any kind.
"""

from __future__ import annotations

import base64
import sys
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[3]
VISION_SERVICE_ROOT = REPO_ROOT / "vision_service"
if str(VISION_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(VISION_SERVICE_ROOT))

from app.config import VisionSettings  # noqa: E402  (read-only import of live code)
from app.keypoint_adapter import MOVENET_MAPPING_PATH, load_mapping  # noqa: E402
from app.movenet_runner import EXPECTED_KEYPOINTS, MoveNetRunner  # noqa: E402

# COCO-17 order as published in Google's MoveNet SinglePose model card and used
# by vision_service/config/movenet_keypoint_mapping.yaml (hip 11/12, knee 13/14,
# ankle 15/16).
COCO17_KEYPOINT_NAMES: tuple[str, ...] = (
    "nose",
    "left_eye",
    "right_eye",
    "left_ear",
    "right_ear",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
)

# Frame sampling. The live service caps ingestion at MAX_FRAME_RATE=8 fps and
# vision_service/scripts/video_file_replay.py replays recorded clips at
# --sample-fps 8.0 by default, so 8 fps is the production-consistent choice and
# not an arbitrary guess. MobiPhysio clips for the selected participants run
# ~30 s at ~30 fps (~900 frames); 8 fps gives ~240 samples per clip, which is
# well above the Nyquist rate for AROM physiotherapy movement (limb motion is
# comfortably below 4 Hz) while keeping CPU-only extraction tractable.
DEFAULT_SAMPLE_FPS = 8.0
DEFAULT_MAX_FRAMES = 320  # ~40 s at 8 fps; bounds cost on any unexpectedly long clip
JPEG_QUALITY = 95  # cv2.imencode('.jpg') default, as used by video_file_replay.py


@dataclass
class PoseSequence:
    """Full COCO-17 keypoint sequence extracted from one video."""

    keypoints: np.ndarray  # float32 [T, 17, 3] -> (x_norm, y_norm, confidence)
    frame_indices: np.ndarray  # int32 [T] index in the source video
    timestamps_ms: np.ndarray  # int32 [T] source presentation timestamps
    source_fps: float
    frame_width: int
    frame_height: int
    source_frame_count: int
    decode_failures: int

    @property
    def length(self) -> int:
        return int(self.keypoints.shape[0])

    @property
    def mean_confidence(self) -> float:
        if self.length == 0:
            return 0.0
        return float(np.mean(self.keypoints[:, :, 2]))


def build_runner(model_path: Path | str | None = None) -> MoveNetRunner:
    """Instantiate the production MoveNetRunner against a local .tflite file.

    ``VisionSettings`` normally resolves ``MOVENET_MODEL_PATH`` from the
    container environment. Offline extraction runs on the host, so the host path
    is passed explicitly; the model file itself is the same artifact the service
    mounts.
    """
    resolved = str(model_path) if model_path else ""
    settings = VisionSettings(vision_mode="movenet", movenet_model_path=resolved)
    return MoveNetRunner(settings)


def production_confidence_gate() -> float:
    """The confidence threshold the live service applies, recorded as metadata."""
    return float(load_mapping(MOVENET_MAPPING_PATH).required_confidence)


def iter_sampled_frames(
    video_path: Path, sample_fps: float, max_frames: int
) -> Iterator[tuple[int, int, bytes]]:
    """Yield ``(frame_index, timestamp_ms, jpeg_bytes)`` at a fixed sample rate.

    Same sampling pattern as vision_service/scripts/video_file_replay.py, but it
    yields the source frame index (rather than a send counter) so a sequence can
    be aligned back to the original video.
    """
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise RuntimeError(f"could not open video file: {video_path}")
    source_fps = capture.get(cv2.CAP_PROP_FPS) or 0.0
    if source_fps <= 0:
        source_fps = 30.0
    interval = max(1, round(source_fps / sample_fps)) if sample_fps > 0 else 1
    index = 0
    sent = 0
    try:
        while sent < max_frames:
            ok, frame = capture.read()
            if not ok:
                break
            if index % interval == 0:
                timestamp_ms = round(capture.get(cv2.CAP_PROP_POS_MSEC))
                ok_encode, buffer = cv2.imencode(
                    ".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
                )
                if not ok_encode:
                    index += 1
                    continue
                yield index, timestamp_ms, buffer.tobytes()
                sent += 1
            index += 1
    finally:
        capture.release()


def probe_video(video_path: Path) -> dict[str, float | int]:
    """Read basic container properties; raises if OpenCV cannot open the file."""
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise RuntimeError(f"could not open video file: {video_path}")
    try:
        return {
            "fps": float(capture.get(cv2.CAP_PROP_FPS) or 0.0),
            "frame_count": int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0),
            "width": int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0),
            "height": int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0),
        }
    finally:
        capture.release()


def extract_sequence(
    runner: MoveNetRunner,
    video_path: Path,
    sample_fps: float = DEFAULT_SAMPLE_FPS,
    max_frames: int = DEFAULT_MAX_FRAMES,
) -> PoseSequence:
    """Run the production MoveNet runner over sampled frames of one video."""
    properties = probe_video(video_path)
    rows: list[np.ndarray] = []
    indices: list[int] = []
    timestamps: list[int] = []
    decode_failures = 0

    for frame_index, timestamp_ms, jpeg_bytes in iter_sampled_frames(
        video_path, sample_fps, max_frames
    ):
        encoded = base64.b64encode(jpeg_bytes).decode("ascii")
        try:
            raw = runner.infer(encoded)
        except Exception:  # noqa: BLE001 - one bad frame must not lose the clip
            decode_failures += 1
            continue
        if len(raw) != EXPECTED_KEYPOINTS:
            decode_failures += 1
            continue
        rows.append(
            np.array(
                [[point["x"], point["y"], point["confidence"]] for point in raw],
                dtype=np.float32,
            )
        )
        indices.append(frame_index)
        timestamps.append(int(timestamp_ms))

    keypoints = (
        np.stack(rows).astype(np.float32)
        if rows
        else np.zeros((0, EXPECTED_KEYPOINTS, 3), dtype=np.float32)
    )
    return PoseSequence(
        keypoints=keypoints,
        frame_indices=np.asarray(indices, dtype=np.int32),
        timestamps_ms=np.asarray(timestamps, dtype=np.int32),
        source_fps=float(properties["fps"]),
        frame_width=int(properties["width"]),
        frame_height=int(properties["height"]),
        source_frame_count=int(properties["frame_count"]),
        decode_failures=decode_failures,
    )
