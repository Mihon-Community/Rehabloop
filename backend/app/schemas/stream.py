from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class FrameEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["frame"] = "frame"
    session_id: str
    sequence: int = Field(ge=0)
    timestamp_ms: int = Field(ge=0)
    image_b64: str = Field(min_length=1, max_length=2_000_000)


class VisionLandmark(BaseModel):
    x: float
    y: float
    confidence: float
    valid: bool


class VisionResponse(BaseModel):
    frame_id: str
    timestamp_ms: int
    sequence: int
    model: str
    mapping_version: str
    landmarks: dict[str, VisionLandmark]
    inference_ms: float
    person_detected: bool
    simulated: bool
    quality: dict[str, Any] = Field(default_factory=dict)


class MeasurementQuality(BaseModel):
    usable: bool
    reason: str | None
    confidence: float | None


class MeasurementEvent(BaseModel):
    type: Literal["measurement"] = "measurement"
    sequence: int
    timestamp_ms: int
    projected_knee_angle_deg: float
    rep_count: int
    state: str
    quality: MeasurementQuality
    model_version: str
    simulated: bool


class QualityWarningEvent(BaseModel):
    type: Literal["quality_warning"] = "quality_warning"
    sequence: int
    timestamp_ms: int
    reason: str
    message: str
    rep_count: int
    model_version: str
    simulated: bool


class StreamErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    code: str
    message: str
