from pydantic import BaseModel, Field


class SummaryRequest(BaseModel):
    regenerate: bool = False


class SummaryResponse(BaseModel):
    headline: str
    what_was_measured: str
    observed_values: list[str]
    data_quality_note: str
    clinician_review_note: str
    schema_version: str = Field(default="rehabloop-summary-1.0")
    generated_by: str = Field(default="deterministic", description="nvidia | deterministic")
