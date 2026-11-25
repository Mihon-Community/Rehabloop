from pydantic import BaseModel


class SessionMetrics(BaseModel):
    """Minimised, de-identified numeric input to the language layer."""

    completed_reps: int
    target_reps: int
    projected_knee_angle_min_deg: float | None
    projected_knee_angle_max_deg: float | None
    target_range_hit_count: int
    usable_frame_pct: float
    projected_range_deg: float | None = None
    median_rep_duration_seconds: float | None = None
    session_duration_seconds: float = 0
