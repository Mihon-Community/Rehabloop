from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    detail: str
    code: str


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    mode: str


class NotImplementedResponse(ErrorResponse):
    code: str = Field(default="NOT_IMPLEMENTED")
