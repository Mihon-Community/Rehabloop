from typing import Any, Literal

from pydantic import BaseModel, Field

SessionStatus = Literal[
    "draft", "ready", "active", "paused", "completed", "aborted", "review_required"
]


class CreateSessionRequest(BaseModel):
    protocol_id: str = Field(description="UUID of the clinician-approved protocol")


class StartSessionRequest(BaseModel):
    consent_record_id: str = Field(description="Proof of camera-processing consent")
    camera_checks_passed: bool = False


class CompleteSessionRequest(BaseModel):
    reason: str | None = None


class SessionSummaryResponse(BaseModel):
    session_id: str
    protocol_id: str
    protocol_version: int
    model_version: str
    keypoint_mapping_version: str
    analytics_version: str
    status: SessionStatus
    metrics: dict[str, Any]
    quality_flags: list[str]
    raw_video_stored: bool = False
    persisted: bool = False
    stream_token: str | None = None


class ProgressResponse(BaseModel):
    patient_id: str
    sessions: list[SessionSummaryResponse] = Field(default_factory=list)
    persisted: bool = False
