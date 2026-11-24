from datetime import datetime  # noqa: F401  (kept for schema versioning)

from pydantic import BaseModel, Field


class CreateProtocolRequest(BaseModel):
    patient_id: str
    protocol_name: str
    parameters: dict = Field(description="Clinician-configured side, reps, target range, etc.")


class UpdateProtocolRequest(BaseModel):
    parameters: dict | None = None
    active: bool | None = None


class ProtocolResponse(BaseModel):
    id: str
    patient_id: str
    clinician_id: str
    protocol_name: str = ""
    version: int
    parameters: dict
    approved_at: str | None = None
    active: bool
    persisted: bool = False
