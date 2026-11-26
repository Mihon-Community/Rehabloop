"""Generate deterministic, labelled synthetic lower-body keypoint sequences."""

from __future__ import annotations

import json
import math
import random
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "fixtures" / "synthetic_keypoint_sequences"
MODEL = "fixture-simulated"
MAPPING = "rehabloop-knee-map-1.0"
CYCLE = (
    90.0,
    105.0,
    115.0,
    120.0,
    120.0,
    120.0,
    120.0,
    115.0,
    100.0,
    85.0,
    75.0,
    75.0,
    75.0,
    75.0,
)


def landmarks_for_angle(angle_deg: float, jitter: random.Random | None = None) -> dict[str, Any]:
    """Construct three named points with a known projected angle."""
    angle = math.radians(angle_deg)
    knee_x, knee_y = 0.5, 0.5
    ankle_angle = math.pi - angle
    noise = (lambda: jitter.uniform(-0.0008, 0.0008)) if jitter is not None else (lambda: 0.0)
    return {
        "selected_hip": {
            "x": round(0.2 + noise(), 6),
            "y": round(0.5 + noise(), 6),
            "confidence": 0.94,
            "valid": True,
        },
        "selected_knee": {
            "x": round(knee_x + noise(), 6),
            "y": round(knee_y + noise(), 6),
            "confidence": 0.93,
            "valid": True,
        },
        "selected_ankle": {
            "x": round(knee_x + 0.3 * math.cos(ankle_angle) + noise(), 6),
            "y": round(knee_y + 0.3 * math.sin(ankle_angle) + noise(), 6),
            "confidence": 0.92,
            "valid": True,
        },
    }


def build_frames(
    angles: list[float], *, noise_seed: int | None = None, person_count: int = 1
) -> list[dict[str, Any]]:
    jitter = random.Random(noise_seed) if noise_seed is not None else None
    frames: list[dict[str, Any]] = []
    for sequence, angle in enumerate(angles, start=1):
        measured_angle = angle + (jitter.uniform(-0.6, 0.6) if jitter is not None else 0.0)
        frames.append(
            {
                "sequence": sequence,
                "timestamp_ms": (sequence - 1) * 200,
                "expected_projected_angle_deg": round(measured_angle, 1),
                "person_count": person_count,
                "landmarks": landmarks_for_angle(measured_angle, jitter),
            }
        )
    return frames


def apply_camera_drift(
    frames: list[dict[str, Any]], *, drift_per_frame: tuple[float, float] = (0.0015, 0.0008)
) -> list[dict[str, Any]]:
    """Add a constant per-frame translation to every landmark in place.

    The projected angle depends only on the relative hip->knee->ankle vectors,
    so translating all three landmarks together by the same growing offset
    must not change `expected_projected_angle_deg` or rep counting if the
    engine's angle math is truly translation-invariant.
    """
    dx, dy = drift_per_frame
    for frame in frames:
        offset_x = dx * (frame["sequence"] - 1)
        offset_y = dy * (frame["sequence"] - 1)
        for point in frame["landmarks"].values():
            point["x"] = round(point["x"] + offset_x, 6)
            point["y"] = round(point["y"] + offset_y, 6)
    return frames


def build_variable_speed_frames(segments: list[tuple[list[float], int]]) -> list[dict[str, Any]]:
    """Build frames from (angles, step_ms) segments with per-segment sample intervals.

    Unlike `build_frames`, the timestamp delta between samples can vary from
    one segment to the next, so the same CYCLE shape can be replayed at
    different sampling speeds while keeping the measured angles identical.
    """
    frames: list[dict[str, Any]] = []
    timestamp_ms = 0
    for angles, step_ms in segments:
        for angle in angles:
            frames.append(
                {
                    "sequence": len(frames) + 1,
                    "timestamp_ms": timestamp_ms,
                    "expected_projected_angle_deg": round(angle, 1),
                    "person_count": 1,
                    "landmarks": landmarks_for_angle(angle),
                }
            )
            timestamp_ms += step_ms
    return frames


def fixture(
    name: str,
    frames: list[dict[str, Any]],
    expected_reps: int,
    note: str,
    *,
    smoothing_alpha: float = 0.4,
) -> dict[str, Any]:
    return {
        "fixture_id": name,
        "simulated": True,
        "warning": "Synthetic keypoints only; not live model output or clinical data.",
        "model": MODEL,
        "mapping_version": MAPPING,
        "engine_settings": {"smoothing_alpha": smoothing_alpha},
        "expected_completed_reps": expected_reps,
        "note": note,
        "frames": frames,
    }


def generated_fixtures() -> dict[str, dict[str, Any]]:
    clean_angles = [75.0] + list(CYCLE) * 8
    noisy = build_frames(clean_angles, noise_seed=20261124)

    dropout_angles = [75.0, 90.0, 115.0, 120.0, 75.0, 75.0, 75.0, 75.0] + list(CYCLE)
    dropout = build_frames(dropout_angles)
    dropout[3]["timestamp_ms"] = 1800
    dropout[3]["landmarks"]["selected_knee"]["confidence"] = 0.2
    for index in range(4, len(dropout)):
        dropout[index]["timestamp_ms"] = 2000 + (index - 4) * 200

    low_confidence = build_frames([75.0] + list(CYCLE))
    for frame in low_confidence:
        frame["landmarks"]["selected_knee"]["confidence"] = 0.3

    partial = build_frames([75.0, 120.0, 100.0, 75.0])
    two_people = build_frames([75.0] + list(CYCLE), person_count=2)

    camera_drift = apply_camera_drift(build_frames(clean_angles))

    persistent_partial_visibility = build_frames([75.0] + list(CYCLE) * 2)
    for frame in persistent_partial_visibility:
        frame["landmarks"]["selected_ankle"]["confidence"] = 0.3

    # Rep 1: normal 200ms sampling (counts). Rep 2: the same cycle compressed
    # to a 50ms step, so the in-target dwell (6 samples * 50ms = 300ms) falls
    # below RepConfig.hold_ms=400ms used in tests, so TARGET_HOLD exits
    # without clearing the hold and the rep is discarded (does not count).
    # Rep 3: the same cycle stretched to a 400ms step (2x the normal rate),
    # comfortably clearing hold_ms/dwell_ms/min_rep_duration_ms, so it counts.
    variable_speed = build_variable_speed_frames(
        [
            ([75.0], 200),
            (list(CYCLE), 200),
            (list(CYCLE), 50),
            (list(CYCLE), 400),
        ]
    )

    return {
        "clean_8_reps.json": fixture(
            "synthetic-clean-8-reps",
            build_frames(clean_angles),
            8,
            "Eight complete cycles at a steady sample interval.",
        ),
        "noisy.json": fixture(
            "synthetic-noisy-8-reps",
            noisy,
            8,
            "Seeded sub-degree coordinate and angle jitter; output is repeatable.",
        ),
        "dropout.json": fixture(
            "synthetic-dropout",
            dropout,
            1,
            "A long occlusion interrupts a partial cycle; only the later full cycle may count.",
        ),
        "low_confidence.json": fixture(
            "synthetic-low-confidence",
            low_confidence,
            0,
            "Required knee landmarks remain below the configured confidence gate.",
        ),
        "partial_reps.json": fixture(
            "synthetic-partial-reps",
            partial,
            0,
            "The target range is reached briefly but not held long enough.",
            smoothing_alpha=0.8,
        ),
        "second_person_in_frame.json": fixture(
            "synthetic-second-person",
            two_people,
            0,
            "The person-count gate rejects every frame containing two people.",
        ),
        "camera_drift.json": fixture(
            "synthetic-camera-drift",
            camera_drift,
            8,
            "A slow constant per-frame translation is added to hip, knee, and "
            "ankle together, simulating camera drift; the projected angle only "
            "depends on relative joint vectors, so all 8 reps should still "
            "count if the engine's angle math is translation-invariant.",
        ),
        "persistent_partial_visibility.json": fixture(
            "synthetic-persistent-partial-visibility",
            persistent_partial_visibility,
            0,
            "The ankle landmark's confidence stays below the configured gate "
            "for the entire sequence (not a transient dropout). The engine "
            "requires every REQUIRED_LANDMARK (hip, knee, and ankle) to clear "
            "min_confidence on every frame, so this is fully gated rather than "
            "degraded gracefully: no reps count and every frame is unusable.",
        ),
        "variable_speed.json": fixture(
            "synthetic-variable-speed",
            variable_speed,
            2,
            "The same cycle shape repeats at three different sample intervals: "
            "normal (200ms), compressed (50ms), and stretched (400ms). The "
            "compressed cycle's in-target dwell is too short to satisfy "
            "RepConfig.hold_ms, so it is discarded; the normal and stretched "
            "cycles both satisfy hold_ms/dwell_ms/min_rep_duration_ms and count.",
        ),
    }


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for filename, data in generated_fixtures().items():
        (OUTPUT / filename).write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(generated_fixtures())} labelled fixtures in {OUTPUT}")


if __name__ == "__main__":
    main()
