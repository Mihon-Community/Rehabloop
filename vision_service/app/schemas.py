from typing import Any

from pydantic import BaseModel, Field


class FrameRequest(BaseModel):
    sequence: int
    timestamp_ms: int
    image_b64: str = Field(description="Compressed camera frame (base64 in the prototype)")


class Landmark(BaseModel):
    x: float = Field(description="Normalised image-plane x")
    y: float = Field(description="Normalised image-plane y")
    x_px: float = 0.0
    y_px: float = 0.0
    confidence: float
    valid: bool


class InferenceResponse(BaseModel):
    frame_id: str
    timestamp_ms: int
    sequence: int
    model: str
    mapping_version: str
    landmarks: dict[str, Landmark]
    inference_ms: float
    person_detected: bool
    simulated: bool = Field(
        description="True for fixture output. Never present simulated output as real inference."
    )
    quality: dict[str, Any] = Field(default_factory=dict)


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    mode: str
    model: str
    simulated: bool


class MappingResponse(BaseModel):
    version: str
    status: str
    landmarks: dict[str, Any]


class ErrorResponse(BaseModel):
    detail: str
    code: str
