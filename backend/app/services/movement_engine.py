"""Deterministic, confidence-gated 2D projected knee movement analytics."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from math import acos, degrees, hypot, isfinite
from statistics import median
from typing import Any

REQUIRED_LANDMARKS = ("selected_hip", "selected_knee", "selected_ankle")


@dataclass(frozen=True)
class ProjectedPoint:
    x: float
    y: float
    confidence: float = 1.0
    valid: bool = True


@dataclass(frozen=True)
class RepEvent:
    rep_index: int
    started_at_ms: int
    completed_at_ms: int
    duration_ms: int
    projected_angle_min_deg: float
    projected_angle_max_deg: float


def projected_joint_angle(a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint) -> float | None:
    """Return the rounded-to-consumer-precision projected angle estimate at point b."""
    if not (a.valid and b.valid and c.valid):
        return None
    ux, uy = a.x - b.x, a.y - b.y
    vx, vy = c.x - b.x, c.y - b.y
    nu, nv = hypot(ux, uy), hypot(vx, vy)
    if nu == 0 or nv == 0:
        return None
    cosine = max(-1.0, min(1.0, (ux * vx + uy * vy) / (nu * nv)))
    return round(degrees(acos(cosine)), 1)


def landmarks_usable(
    landmarks: Mapping[str, ProjectedPoint], min_confidence: float, required: Iterable[str]
) -> bool:
    """Confidence gate applied before smoothing so invalid data cannot be polished."""
    for name in required:
        point = landmarks.get(name)
        if point is None or not point.valid or point.confidence < min_confidence:
            return False
    return True


class ExponentialSmoother:
    """Per-sample EMA: causal, cheap, deterministic, and has no future-frame lookahead."""

    def __init__(self, alpha: float) -> None:
        if not 0 < alpha <= 1:
            raise ValueError("alpha must be in (0, 1]")
        self.alpha = alpha
        self._value: float | None = None

    def update(self, sample: float | None) -> float | None:
        if sample is None:
            return None
        if self._value is None:
            self._value = sample
        else:
            self._value = self.alpha * sample + (1 - self.alpha) * self._value
        return self._value

    def reset(self) -> None:
        self._value = None


RepState = str


@dataclass(frozen=True)
class RepConfig:
    """Clinician-provided angular bands plus configurable temporal gates."""

    rest_min_deg: float
    rest_max_deg: float
    target_min_deg: float
    target_max_deg: float
    dwell_ms: int = 200
    hold_ms: int = 400
    min_rep_duration_ms: int = 250

    def __post_init__(self) -> None:
        angles = (
            self.rest_min_deg,
            self.rest_max_deg,
            self.target_min_deg,
            self.target_max_deg,
        )
        if not all(isfinite(angle) and 0 <= angle <= 180 for angle in angles):
            raise ValueError("configured projected angle ranges must be finite and within 0..180")
        if self.rest_min_deg > self.rest_max_deg:
            raise ValueError("rest range minimum must not exceed maximum")
        if self.target_min_deg > self.target_max_deg:
            raise ValueError("target range minimum must not exceed maximum")
        if self.target_min_deg <= self.rest_max_deg:
            raise ValueError("target range must be above the rest range")
        if min(self.dwell_ms, self.hold_ms, self.min_rep_duration_ms) < 0:
            raise ValueError("temporal rep gates must be non-negative")


class RepStateMachine:
    """Rep counter with explicit re-arming after invalid data or temporal gaps."""

    def __init__(self, config: RepConfig) -> None:
        self.config = config
        self.state: RepState = "PAUSED"
        self.rep_count = 0
        self.target_range_hit_count = 0
        self.events: list[RepEvent] = []
        self._state_since: int | None = None
        self._rep_started_at: int | None = None
        self._cycle_angles: list[float] = []
        self._last_timestamp_ms: int | None = None
        self._valid_frames = 0
        self._total_frames = 0

    def pause(self, timestamp_ms: int | None = None, *, invalid: bool = False) -> RepState:
        self.state = "INVALID" if invalid else "PAUSED"
        self._state_since = timestamp_ms
        self._rep_started_at = None
        self._cycle_angles.clear()
        if timestamp_ms is not None:
            self._last_timestamp_ms = timestamp_ms
        return self.state

    def process(self, angle: float | None, timestamp_ms: int, valid: bool = True) -> RepState:
        self._total_frames += 1
        if not valid or angle is None:
            return self.pause(timestamp_ms, invalid=True)
        if self._last_timestamp_ms is not None and timestamp_ms <= self._last_timestamp_ms:
            return self.pause(timestamp_ms, invalid=True)
        self._last_timestamp_ms = timestamp_ms
        self._valid_frames += 1

        cfg = self.config
        in_rest = cfg.rest_min_deg <= angle <= cfg.rest_max_deg
        in_target = cfg.target_min_deg <= angle <= cfg.target_max_deg

        if self.state in ("INVALID", "PAUSED"):
            if in_rest:
                self._transition("REST", timestamp_ms)
            return self.state

        self._cycle_angles.append(angle)
        if self.state == "REST":
            if angle > cfg.rest_max_deg:
                self._rep_started_at = timestamp_ms
                self._cycle_angles = [angle]
                self._transition("EXTENDING", timestamp_ms)
        elif self.state == "EXTENDING":
            if in_target:
                self.target_range_hit_count += 1
                self._transition("TARGET_HOLD", timestamp_ms)
            elif in_rest:
                self._reset_to_rest(timestamp_ms)
        elif self.state == "TARGET_HOLD":
            if not in_target:
                if self._held_long_enough(timestamp_ms, cfg.hold_ms):
                    self._transition("RETURNING", timestamp_ms)
                elif in_rest:
                    self._reset_to_rest(timestamp_ms)
                else:
                    self.pause(timestamp_ms, invalid=True)
        elif self.state == "RETURNING":
            if in_target:
                self._transition("TARGET_HOLD", timestamp_ms)
            elif in_rest and self._held_long_enough(timestamp_ms, cfg.dwell_ms):
                self._finish_rep(timestamp_ms)
        return self.state

    def _finish_rep(self, timestamp_ms: int) -> None:
        started = self._rep_started_at
        duration = timestamp_ms - started if started is not None else 0
        if (
            started is not None
            and duration >= self.config.min_rep_duration_ms
            and self._cycle_angles
        ):
            self.rep_count += 1
            self.events.append(
                RepEvent(
                    rep_index=self.rep_count,
                    started_at_ms=started,
                    completed_at_ms=timestamp_ms,
                    duration_ms=duration,
                    projected_angle_min_deg=round(min(self._cycle_angles), 1),
                    projected_angle_max_deg=round(max(self._cycle_angles), 1),
                )
            )
        self._reset_to_rest(timestamp_ms)

    def _reset_to_rest(self, timestamp_ms: int) -> None:
        self.state = "REST"
        self._state_since = timestamp_ms
        self._rep_started_at = None
        self._cycle_angles.clear()

    def _held_long_enough(self, timestamp_ms: int, duration_ms: int) -> bool:
        return self._state_since is not None and timestamp_ms - self._state_since >= duration_ms

    def _transition(self, new_state: RepState, timestamp_ms: int) -> None:
        if new_state != self.state:
            self.state = new_state
            self._state_since = timestamp_ms

    @property
    def usable_frame_pct(self) -> float:
        if self._total_frames == 0:
            return 0.0
        return 100.0 * self._valid_frames / self._total_frames


@dataclass(frozen=True)
class EngineFrameResult:
    timestamp_ms: int
    projected_knee_angle_deg: float | None
    rep_count: int
    state: RepState
    usable: bool
    quality_flags: tuple[str, ...]
    simulated: bool


@dataclass
class MovementEngine:
    """Process named landmarks and retain only numeric session aggregates."""

    rep_config: RepConfig
    target_reps: int
    min_confidence: float = 0.6
    smoothing_alpha: float = 0.4
    max_gap_ms: int = 750
    max_landmark_speed_per_second: float = 8.0
    model_version: str = "fixture-simulated"
    mapping_version: str = "rehabloop-knee-map-1.0"
    side_view_confirmed: bool = False
    _machine: RepStateMachine = field(init=False, repr=False)
    _smoother: ExponentialSmoother = field(init=False, repr=False)
    _last_timestamp_ms: int | None = field(init=False, default=None, repr=False)
    _previous_landmarks: dict[str, ProjectedPoint] | None = field(
        init=False, default=None, repr=False
    )
    _frame_count: int = field(init=False, default=0, repr=False)
    _usable_frame_count: int = field(init=False, default=0, repr=False)
    _angles: list[float] = field(init=False, default_factory=list, repr=False)
    _quality_flags: set[str] = field(init=False, default_factory=set, repr=False)
    _first_timestamp_ms: int | None = field(init=False, default=None, repr=False)
    _simulated: bool = field(init=False, default=False, repr=False)

    def __post_init__(self) -> None:
        if self.target_reps < 0:
            raise ValueError("target_reps must be non-negative")
        if self.max_gap_ms < 1:
            raise ValueError("max_gap_ms must be positive")
        if not 0 <= self.min_confidence <= 1:
            raise ValueError("min_confidence must be within 0..1")
        if self.max_landmark_speed_per_second <= 0:
            raise ValueError("maximum landmark speed must be positive")
        self._machine = RepStateMachine(self.rep_config)
        self._smoother = ExponentialSmoother(self.smoothing_alpha)
        if not self.side_view_confirmed:
            self._quality_flags.add("CAMERA_SIDE_VIEW_ASSUMED")

    def process(
        self,
        landmarks: Mapping[str, ProjectedPoint],
        timestamp_ms: int,
        *,
        person_count: int = 1,
        model_version: str | None = None,
        mapping_version: str | None = None,
        simulated: bool = False,
    ) -> EngineFrameResult:
        self._frame_count += 1
        self._simulated |= simulated
        if simulated:
            self._quality_flags.add("SIMULATED_INPUT")
        flags: set[str] = set()

        if self._first_timestamp_ms is None:
            self._first_timestamp_ms = timestamp_ms
        if self._last_timestamp_ms is not None:
            delta_ms = timestamp_ms - self._last_timestamp_ms
            if delta_ms <= 0:
                flags.add("NON_MONOTONIC_TIMESTAMP")
                return self._invalid_frame(timestamp_ms, flags, simulated)
            if delta_ms > self.max_gap_ms:
                flags.add("TEMPORAL_GAP")
                self._machine.pause()
                self._smoother.reset()
                self._previous_landmarks = None
        self._last_timestamp_ms = timestamp_ms

        if person_count != 1:
            flags.add("PERSON_COUNT_NOT_ONE")
        if model_version is not None and model_version != self.model_version:
            flags.add("MODEL_VERSION_MISMATCH")
        if mapping_version is not None and mapping_version != self.mapping_version:
            flags.add("MAPPING_VERSION_MISMATCH")
        if not landmarks:
            flags.add("LANDMARKS_MISSING")
        elif any(name not in landmarks for name in REQUIRED_LANDMARKS):
            flags.add("REQUIRED_LANDMARK_MISSING")
        elif not landmarks_usable(landmarks, self.min_confidence, REQUIRED_LANDMARKS):
            flags.add("LANDMARK_CONFIDENCE_LOW")

        if not flags and self._previous_landmarks is not None:
            last_valid = self._last_valid_timestamp_ms
            elapsed = (timestamp_ms - last_valid) / 1000 if last_valid is not None else 0.0
            if elapsed > 0 and self._has_landmark_jump(landmarks, elapsed):
                flags.add("LANDMARK_DISCONTINUITY")

        if flags:
            return self._invalid_frame(timestamp_ms, flags, simulated)

        hip, knee, ankle = (landmarks[name] for name in REQUIRED_LANDMARKS)
        angle = projected_joint_angle(hip, knee, ankle)
        if angle is None:
            flags.add("PROJECTED_ANGLE_UNAVAILABLE")
            return self._invalid_frame(timestamp_ms, flags, simulated)

        smoothed = self._smoother.update(angle)
        assert smoothed is not None
        self._machine.process(smoothed, timestamp_ms, True)
        self._previous_landmarks = dict(landmarks)
        self._last_valid_timestamp_ms = timestamp_ms
        self._usable_frame_count += 1
        self._angles.append(smoothed)
        return EngineFrameResult(
            timestamp_ms=timestamp_ms,
            projected_knee_angle_deg=round(smoothed, 1),
            rep_count=self._machine.rep_count,
            state=self._machine.state,
            usable=True,
            quality_flags=tuple(),
            simulated=simulated,
        )

    _last_valid_timestamp_ms: int | None = field(init=False, default=None, repr=False)

    @property
    def rep_count(self) -> int:
        return self._machine.rep_count

    @property
    def quality_flags(self) -> list[str]:
        return sorted(self._quality_flags)

    def _invalid_frame(
        self, timestamp_ms: int, flags: set[str], simulated: bool
    ) -> EngineFrameResult:
        self._quality_flags.update(flags)
        self._machine.process(None, timestamp_ms, False)
        self._smoother.reset()
        self._previous_landmarks = None
        return EngineFrameResult(
            timestamp_ms=timestamp_ms,
            projected_knee_angle_deg=None,
            rep_count=self._machine.rep_count,
            state=self._machine.state,
            usable=False,
            quality_flags=tuple(sorted(flags)),
            simulated=simulated,
        )

    def _has_landmark_jump(
        self, landmarks: Mapping[str, ProjectedPoint], elapsed_seconds: float
    ) -> bool:
        if self._previous_landmarks is None:
            return False
        max_distance = self.max_landmark_speed_per_second * elapsed_seconds
        return any(
            hypot(
                landmarks[name].x - self._previous_landmarks[name].x,
                landmarks[name].y - self._previous_landmarks[name].y,
            )
            > max_distance
            for name in REQUIRED_LANDMARKS
        )

    def metrics(self) -> dict[str, Any]:
        """Return A1-compatible rounded aggregates; fixture provenance stays explicit."""
        angle_min = round(min(self._angles), 1) if self._angles else None
        angle_max = round(max(self._angles), 1) if self._angles else None
        durations = [event.duration_ms / 1000 for event in self._machine.events]
        duration = (
            (self._last_timestamp_ms - self._first_timestamp_ms) / 1000
            if self._last_timestamp_ms is not None and self._first_timestamp_ms is not None
            else 0.0
        )
        return {
            "completed_reps": self._machine.rep_count,
            "target_reps": self.target_reps,
            "projected_knee_angle_min_deg": angle_min,
            "projected_knee_angle_max_deg": angle_max,
            "projected_range_deg": round(angle_max - angle_min, 1)
            if angle_min is not None and angle_max is not None
            else None,
            "target_range_hit_count": self._machine.target_range_hit_count,
            "median_rep_duration_seconds": round(median(durations), 1) if durations else None,
            "usable_frame_pct": round(100 * self._usable_frame_count / self._frame_count, 1)
            if self._frame_count
            else 0.0,
            "session_duration_seconds": round(duration, 1),
        }
