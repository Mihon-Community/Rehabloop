from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SummaryRequest(BaseModel):
    regenerate: bool = False


class SummaryContent(BaseModel):
    """Strict provider-generated prose, without provider metadata."""

    model_config = ConfigDict(extra="forbid", strict=True)

    headline: str
    what_was_measured: str
    observed_values: list[str]
    data_quality_note: str
    clinician_review_note: str


class SummaryResult(SummaryContent):
    """Validated summary plus source and fixed non-clinical context."""

    source: Literal["nvidia", "deterministic_fallback"]
    model_id: str | None
    disclaimer: str
    persisted: bool = False
    schema_version: str = Field(default="rehabloop-summary-1.0")
    # Retained as a backward-compatible alias for existing clients.
    generated_by: Literal["nvidia", "deterministic"]


class SummaryResponse(SummaryResult):
    """HTTP response model kept separate for future API versioning."""
