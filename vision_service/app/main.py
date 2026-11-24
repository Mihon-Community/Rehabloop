from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .config import get_settings
from .detector import VisionUnavailableError
from .inference import InferenceEngine
from .keypoint_adapter import load_mapping
from .schemas import (
    ErrorResponse,
    FrameRequest,
    HealthResponse,
    InferenceResponse,
    MappingResponse,
)

settings = get_settings()
engine = InferenceEngine(settings)
app = FastAPI(
    title="RehabLoop Vision Service",
    version="0.1.0",
    description="2D pose inference. Fixture output is always labelled simulated.",
)


@app.exception_handler(VisionUnavailableError)
async def vision_unavailable(_request: Request, exc: VisionUnavailableError) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content=ErrorResponse(detail=str(exc), code="VISION_UNAVAILABLE").model_dump(),
    )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="rehabloop-vision",
        version="0.1.0",
        mode=engine.settings.mode,
        model=engine.model_name(),
        simulated=engine.simulated,
    )


@app.get("/mapping", response_model=MappingResponse)
def mapping() -> MappingResponse:
    current = load_mapping()
    return MappingResponse(
        version=current.version,
        status=current.status,
        landmarks={k: v for k, v in current.landmarks.items()},
    )


@app.post("/infer", response_model=InferenceResponse, responses={503: {"model": ErrorResponse}})
def infer(frame: FrameRequest) -> InferenceResponse:
    """Infer named landmarks. Raw frames are processed transiently, never stored."""
    return engine.infer(frame.sequence, frame.timestamp_ms, frame.image_b64)
