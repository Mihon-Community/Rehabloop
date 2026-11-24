"""Angle geometry tests from blueprint Appendix A3 (math only, not model accuracy)."""

import pytest
from app.services.movement_engine import (
    ExponentialSmoother,
    ProjectedPoint,
    RepConfig,
    RepStateMachine,
    landmarks_usable,
    projected_joint_angle,
)


def test_right_angle():
    angle = projected_joint_angle(ProjectedPoint(0, 1), ProjectedPoint(0, 0), ProjectedPoint(1, 0))
    assert angle is not None and angle == pytest.approx(90.0, abs=1e-6)


def test_straight_line_is_180():
    angle = projected_joint_angle(ProjectedPoint(-1, 0), ProjectedPoint(0, 0), ProjectedPoint(1, 0))
    assert angle is not None and angle == pytest.approx(180.0, abs=1e-6)


def test_zero_length_vector_returns_none():
    assert (
        projected_joint_angle(ProjectedPoint(0, 0), ProjectedPoint(0, 0), ProjectedPoint(1, 0))
        is None
    )


def test_invalid_landmark_returns_none():
    assert (
        projected_joint_angle(
            ProjectedPoint(0, 1, valid=False), ProjectedPoint(0, 0), ProjectedPoint(1, 0)
        )
        is None
    )


def test_confidence_gate_before_smoothing():
    points = {
        "selected_hip": ProjectedPoint(0, 1, 0.9),
        "selected_knee": ProjectedPoint(0, 0, 0.2),
        "selected_ankle": ProjectedPoint(1, 0, 0.9),
    }
    assert not landmarks_usable(points, 0.6, points.keys())


def test_smoother_stays_bounded():
    smoother = ExponentialSmoother(0.5)
    assert smoother.update(100) == 100
    assert 100 < smoother.update(120) <= 120
    smoother.reset()
    assert smoother.update(80) == 80


def test_one_full_rep_counts():
    machine = RepStateMachine(RepConfig(70, 80, 110, 125, dwell_ms=50, hold_ms=80))
    trace = [
        (75, 0, True),
        (115, 100, True),
        (115, 200, True),
        (75, 300, True),
        (75, 400, True),
    ]
    for angle, ts, valid in trace:
        machine.process(angle, ts, valid)
    assert machine.rep_count == 1
    assert machine.usable_frame_pct == pytest.approx(100.0)


def test_low_confidence_frame_never_counts():
    machine = RepStateMachine(RepConfig(70, 80, 110, 125, dwell_ms=0, hold_ms=0))
    machine.process(75, 0, True)
    machine.process(115, 100, False)
    assert machine.state == "INVALID"
    assert machine.rep_count == 0
