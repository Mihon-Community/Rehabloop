"""Movement math and labelled fixture sequence checks."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from app.services.movement_engine import (
    ExponentialSmoother,
    MovementEngine,
    ProjectedPoint,
    RepConfig,
    RepStateMachine,
    landmarks_usable,
    projected_joint_angle,
)
from scripts.generate_synthetic_fixtures import generated_fixtures

FIXTURE_ROOT = Path(__file__).resolve().parents[2] / "fixtures" / "synthetic_keypoint_sequences"


def _load_fixture(filename: str, *, root: Path = FIXTURE_ROOT) -> dict[str, Any]:
    """Load a labelled fixture from disk, falling back to the deterministic
    generator when the repo-root fixtures/ directory isn't available.

    Locally and in CI the repo root is checked out whole, so `root` resolves
    via the two-parents-up path above. Inside the backend Docker container
    only backend/ itself is bind-mounted (docker-compose.yml's backend
    service has no /fixtures volume, unlike vision_service), so that path
    doesn't exist there. `generated_fixtures()` is the actual source of
    truth the on-disk JSON files are a generated snapshot of (see
    backend/scripts/generate_synthetic_fixtures.py), so falling back to it
    keeps a single source of truth instead of checking in a duplicate copy.
    """
    path = root / filename
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    try:
        return generated_fixtures()[filename]
    except KeyError as exc:
        raise FileNotFoundError(
            f"No on-disk fixture at {path} and no generated fixture named {filename!r}"
        ) from exc


def _run_fixture(filename: str) -> tuple[MovementEngine, list[Any], dict[str, Any]]:
    data = _load_fixture(filename)
    settings = data.get("engine_settings", {})
    engine = MovementEngine(
        rep_config=RepConfig(
            rest_min_deg=70,
            rest_max_deg=80,
            target_min_deg=110,
            target_max_deg=125,
            dwell_ms=200,
            hold_ms=400,
            min_rep_duration_ms=250,
        ),
        target_reps=8,
        smoothing_alpha=settings.get("smoothing_alpha", 0.4),
        model_version=data["model"],
        mapping_version=data["mapping_version"],
    )
    results = []
    for frame in data["frames"]:
        landmarks = {
            name: ProjectedPoint(**point) for name, point in frame.get("landmarks", {}).items()
        }
        results.append(
            engine.process(
                landmarks,
                frame["timestamp_ms"],
                person_count=frame["person_count"],
                model_version=data["model"],
                mapping_version=data["mapping_version"],
                simulated=data["simulated"],
            )
        )
    return engine, results, data


def test_right_angle_is_rounded_projected_estimate() -> None:
    angle = projected_joint_angle(ProjectedPoint(0, 1), ProjectedPoint(0, 0), ProjectedPoint(1, 0))
    assert angle == pytest.approx(90.0, abs=1e-6)


def test_straight_line_is_180_degrees() -> None:
    angle = projected_joint_angle(ProjectedPoint(-1, 0), ProjectedPoint(0, 0), ProjectedPoint(1, 0))
    assert angle == pytest.approx(180.0, abs=1e-6)


def test_zero_length_or_invalid_landmark_returns_none() -> None:
    assert (
        projected_joint_angle(ProjectedPoint(0, 0), ProjectedPoint(0, 0), ProjectedPoint(1, 0))
        is None
    )
    assert (
        projected_joint_angle(
            ProjectedPoint(0, 1, valid=False), ProjectedPoint(0, 0), ProjectedPoint(1, 0)
        )
        is None
    )


def test_confidence_gate_precedes_smoothing() -> None:
    points = {
        "selected_hip": ProjectedPoint(0, 1, 0.9),
        "selected_knee": ProjectedPoint(0, 0, 0.2),
        "selected_ankle": ProjectedPoint(1, 0, 0.9),
    }
    assert not landmarks_usable(points, 0.6, points.keys())


def test_exponential_smoother_is_bounded_and_resets() -> None:
    smoother = ExponentialSmoother(0.5)
    assert smoother.update(100) == 100
    assert smoother.update(120) == 110
    smoother.reset()
    assert smoother.update(80) == 80


def test_rep_state_machine_enforces_hold_and_minimum_duration() -> None:
    machine = RepStateMachine(
        RepConfig(70, 80, 110, 125, dwell_ms=50, hold_ms=80, min_rep_duration_ms=250)
    )
    trace = [(75, 0), (115, 100), (115, 200), (75, 300), (75, 400)]
    for angle, timestamp in trace:
        machine.process(angle, timestamp)
    assert machine.rep_count == 1
    assert machine.events[0].duration_ms == 300


def test_clean_fixture_counts_eight_reps_and_reports_aggregates() -> None:
    engine, results, data = _run_fixture("clean_8_reps.json")
    metrics = engine.metrics()
    assert engine.rep_count == data["expected_completed_reps"] == 8
    assert all(result.simulated for result in results)
    assert metrics["projected_range_deg"] is not None
    assert metrics["median_rep_duration_seconds"] is not None
    assert engine.quality_flags == ["CAMERA_SIDE_VIEW_ASSUMED", "SIMULATED_INPUT"]


def test_seeded_noisy_fixture_is_deterministic_and_counts_eight_reps() -> None:
    assert generated_fixtures() == generated_fixtures()
    engine, _results, data = _run_fixture("noisy.json")
    assert engine.rep_count == data["expected_completed_reps"] == 8


def test_dropout_never_completes_partial_cycle_across_long_gap() -> None:
    engine, results, data = _run_fixture("dropout.json")
    assert engine.rep_count == data["expected_completed_reps"] == 1
    assert any("TEMPORAL_GAP" in result.quality_flags for result in results)


def test_low_confidence_partial_and_second_person_sequences_count_nothing() -> None:
    for filename in (
        "low_confidence.json",
        "partial_reps.json",
        "second_person_in_frame.json",
    ):
        engine, _results, data = _run_fixture(filename)
        assert engine.rep_count == data["expected_completed_reps"] == 0

    engine, _results, _data = _run_fixture("low_confidence.json")
    assert "LANDMARK_CONFIDENCE_LOW" in engine.quality_flags
    engine, _results, _data = _run_fixture("second_person_in_frame.json")
    assert "PERSON_COUNT_NOT_ONE" in engine.quality_flags


def test_camera_drift_does_not_break_rep_counting() -> None:
    """Angle math only depends on relative joint vectors, so a slow uniform
    translation of hip/knee/ankle together must not change the rep count."""
    engine, results, data = _run_fixture("camera_drift.json")
    assert engine.rep_count == data["expected_completed_reps"] == 8
    assert all(result.usable for result in results)


def test_persistent_single_landmark_low_confidence_counts_zero_reps() -> None:
    """Unlike dropout.json's transient confidence drop, the ankle here stays
    below the confidence gate for every frame. landmarks_usable() requires
    every REQUIRED_LANDMARK (hip, knee, and ankle) to clear min_confidence,
    so this is fully gated rather than degraded gracefully: no frame is ever
    usable and no reps are counted."""
    engine, results, data = _run_fixture("persistent_partial_visibility.json")
    assert engine.rep_count == data["expected_completed_reps"] == 0
    assert "LANDMARK_CONFIDENCE_LOW" in engine.quality_flags
    assert not any(result.usable for result in results)


def test_variable_sample_rate_only_counts_cycles_that_satisfy_hold_duration() -> None:
    """The same cycle shape repeats at a normal, a compressed, and a
    stretched sample interval. Only the compressed cycle's in-target dwell
    is too short to satisfy RepConfig.hold_ms (configured at 400ms in
    _run_fixture), so it is discarded while the normal and stretched cycles
    both count."""
    engine, _results, data = _run_fixture("variable_speed.json")
    assert engine.rep_count == data["expected_completed_reps"] == 2


def test_load_fixture_falls_back_to_generator_when_fixture_root_is_absent(
    tmp_path: Path,
) -> None:
    """Regression test for the backend container's missing /fixtures mount:
    every fixture these tests load must still be reachable without the
    repo-root fixtures/ directory present on disk."""
    for filename in generated_fixtures():
        assert (
            _load_fixture(filename, root=tmp_path / "does-not-exist")
            == generated_fixtures()[filename]
        )


def test_model_and_mapping_changes_are_rejected() -> None:
    engine = MovementEngine(
        RepConfig(70, 80, 110, 125), target_reps=8, model_version="fixture-simulated"
    )
    points = {
        "selected_hip": ProjectedPoint(0.2, 0.5),
        "selected_knee": ProjectedPoint(0.5, 0.5),
        "selected_ankle": ProjectedPoint(0.6, 0.8),
    }
    result = engine.process(points, 0, model_version="different-model")
    assert not result.usable
    assert result.projected_knee_angle_deg is None
    assert "MODEL_VERSION_MISMATCH" in result.quality_flags
