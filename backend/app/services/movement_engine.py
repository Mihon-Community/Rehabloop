"""Deterministic 2D projected knee-angle analytics.

Blueprint sections 7 and Appendix A3. All thresholds are protocol-specific and
clinically configured; nothing here diagnoses or prescribes.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from math import acos, degrees


@dataclass(frozen=True)
class ProjectedPoint:
    x: float
    y: float
    confidence: float = 1.0
    valid: bool = True


def projected_joint_angle(a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint) -> float | None:
    """Angle at b formed by a-b-c in the image plane (hip, knee, ankle).

    Returns None for zero-length vectors or invalid landmarks. This is a
    projected estimate, not an anatomical or clinical measurement.
    """
    if not (a.valid and b.valid and c.valid):
        return None
    ux, uy = a.x - b.x, a.y - b.y
    vx, vy = c.x - b.x, c.y - b.y
    nu = (ux * ux + uy * uy) ** 0.5
    nv = (vx * vx + vy * vy) ** 0.5
    if nu == 0 or nv == 0:
        return None
    cosine = (ux * vx + uy * vy) / (nu * nv)
    cosine = max(-1.0, min(1.0, cosine))
    return degrees(acos(cosine))


def landmarks_usable(
    landmarks: dict[str, ProjectedPoint], min_confidence: float, required: Iterable[str]
) -> bool:
    """Confidence gate applied BEFORE smoothing — never smooth invalid points."""
    for name in required:
        point = landmarks.get(name)
        if point is None or not point.valid or point.confidence < min_confidence:
            return False
    return True


class ExponentialSmoother:
    def __init__(self, alpha: float) -> None:
        if not 0 < alpha <= 1:
            raise ValueError("alpha must be in (0, 1]")
        self.alpha = alpha
        self._value: float | None = None

    def update(self, sample: float | None) -> float | None:
        if sample is None:
            return self._value
        if self._value is None:
            self._value = sample
        else:
            self._value = self.alpha * sample + (1 - self.alpha) * self._value
        return self._value

    def reset(self) -> None:
        self._value = None


RepState = str  # REST | EXTENDING | TARGET_HOLD | RETURNING | INVALID | PAUSED


@dataclass
class RepConfig:
    rest_min_deg: float
    rest_max_deg: float
    target_min_deg: float
    target_max_deg: float
    dwell_ms: int = 200
    hold_ms: int = 400


class RepStateMachine:
    """Deterministic, confidence-aware repetition counter.

    Thresholds come from the clinician-approved protocol. Low-quality frames
    move the machine to INVALID and never produce a rep.
    """

    def __init__(self, config: RepConfig) -> None:
        self.config = config
        self.state: RepState = "REST"
        self.rep_count = 0
        self._state_since: int | None = None
        self._valid_frames = 0
        self._total_frames = 0

    def process(self, angle: float | None, timestamp_ms: int, valid: bool = True) -> RepState:
        self._total_frames += 1
        if not valid or angle is None:
            self._transition("INVALID", timestamp_ms)
            return self.state
        self._valid_frames += 1

        cfg = self.config
        in_rest = cfg.rest_min_deg <= angle <= cfg.rest_max_deg
        in_target = cfg.target_min_deg <= angle <= cfg.target_max_deg

        if self.state in ("INVALID", "PAUSED"):
            self._transition("REST" if in_rest else "EXTENDING", timestamp_ms)
        elif self.state == "REST" and not in_rest and angle > cfg.rest_max_deg:
            self._transition("EXTENDING", timestamp_ms)
        elif self.state == "EXTENDING" and in_target:
            self._transition("TARGET_HOLD", timestamp_ms)
        elif self.state == "TARGET_HOLD":
            if not in_target:
                if self._held_long_enough(timestamp_ms):
                    self._transition("RETURNING", timestamp_ms)
                else:
                    # Target reached but not held: no valid rep.
                    self._transition("INVALID", timestamp_ms)
        elif self.state == "RETURNING" and in_rest and self._held_long_enough(timestamp_ms):
            self.rep_count += 1
            self._transition("REST", timestamp_ms)
        return self.state

    def _held_long_enough(self, timestamp_ms: int) -> bool:
        if self._state_since is None:
            return False
        required = self.config.hold_ms if self.state == "TARGET_HOLD" else self.config.dwell_ms
        return timestamp_ms - self._state_since >= required

    def _transition(self, new_state: RepState, timestamp_ms: int) -> None:
        if new_state != self.state:
            self.state = new_state
            self._state_since = timestamp_ms

    @property
    def usable_frame_pct(self) -> float:
        if self._total_frames == 0:
            return 0.0
        return 100.0 * self._valid_frames / self._total_frames
