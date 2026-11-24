from typing import Literal

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    detail: str
    code: str


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    mode: str
    storage_mode: Literal["memory", "supabase"] = "memory"


class ProfileResponse(BaseModel):
    id: str
    role: Literal["patient", "clinician", "admin"]
    display_name: str


class NotImplementedResponse(ErrorResponse):
    code: str = Field(default="NOT_IMPLEMENTED")
