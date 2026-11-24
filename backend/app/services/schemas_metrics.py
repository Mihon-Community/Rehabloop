from pydantic import BaseModel


class SessionMetrics(BaseModel):
    """Minimised, de-identified numeric input to the language layer."""

    completed_reps: int
    target_reps: int
    projected_knee_angle_min_deg: float
    projected_knee_angle_max_deg: float
    target_range_hit_count: int
    usable_frame_pct: float
    session_duration_seconds: float = 0
