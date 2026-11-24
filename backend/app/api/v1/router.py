"""Version 1 routes.

Every protected route below will verify role AND patient-clinician assignment
on the server (blueprint section 11). Until implemented they return the
contract's 501 error. Changes here require a PR approved by Steve and Lennox.
"""

from fastapi import APIRouter, WebSocket
from fastapi.responses import JSONResponse

from ...core.config import get_settings
from ...core.errors import not_implemented
from ...schemas.common import ErrorResponse, HealthResponse
from ...schemas.protocol import CreateProtocolRequest, ProtocolResponse, UpdateProtocolRequest
from ...schemas.session import (
    CompleteSessionRequest,
    CreateSessionRequest,
    ProgressResponse,
    SessionSummaryResponse,
    StartSessionRequest,
)
from ...schemas.summary import SummaryRequest, SummaryResponse

router = APIRouter(prefix="/api/v1")


@router.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    """Public, dependency-free health endpoint used by Compose and CI."""
    settings = get_settings()
    return HealthResponse(
        status="ok",
        service="rehabloop-api",
        version="0.1.0",
        mode=settings.app_env,
    )


@router.get("/me", responses={501: {"model": ErrorResponse}}, tags=["auth"])
def me() -> JSONResponse:
    """Authenticated user profile and role. Authorization: authenticated user."""
    return not_implemented("GET /api/v1/me")


@router.get(
    "/patients/me/protocols",
    responses={200: {"model": list[ProtocolResponse]}, 501: {"model": ErrorResponse}},
    tags=["protocols"],
)
def my_protocols() -> JSONResponse:
    """Authorization: patient sees only protocols assigned to them."""
    return not_implemented("GET /api/v1/patients/me/protocols")


@router.post(
    "/protocols",
    responses={200: {"model": ProtocolResponse}, 501: {"model": ErrorResponse}},
    tags=["protocols"],
)
def create_protocol(_body: CreateProtocolRequest) -> JSONResponse:
    """Authorization: clinician with an active link to the patient."""
    return not_implemented("POST /api/v1/protocols")


@router.patch(
    "/protocols/{protocol_id}",
    responses={200: {"model": ProtocolResponse}, 501: {"model": ErrorResponse}},
    tags=["protocols"],
)
def update_protocol(protocol_id: str, _body: UpdateProtocolRequest) -> JSONResponse:
    """Authorization: assigned clinician only; creates a new version."""
    return not_implemented(f"PATCH /api/v1/protocols/{protocol_id}")


@router.post(
    "/sessions",
    responses={200: {"model": SessionSummaryResponse}, 501: {"model": ErrorResponse}},
    tags=["sessions"],
)
def create_session(_body: CreateSessionRequest) -> JSONResponse:
    """Authorization: patient with assigned protocol or clinician demo."""
    return not_implemented("POST /api/v1/sessions")


@router.post(
    "/sessions/{session_id}/start",
    responses={200: {"model": SessionSummaryResponse}, 501: {"model": ErrorResponse}},
    tags=["sessions"],
)
def start_session(session_id: str, _body: StartSessionRequest) -> JSONResponse:
    """Authorization: session owner with valid consent record."""
    return not_implemented(f"POST /api/v1/sessions/{session_id}/start")


@router.post(
    "/sessions/{session_id}/complete",
    responses={200: {"model": SessionSummaryResponse}, 501: {"model": ErrorResponse}},
    tags=["sessions"],
)
def complete_session(session_id: str, _body: CompleteSessionRequest) -> JSONResponse:
    """Authorization: session owner or assigned clinician."""
    return not_implemented(f"POST /api/v1/sessions/{session_id}/complete")


@router.get(
    "/sessions/{session_id}",
    responses={200: {"model": SessionSummaryResponse}, 501: {"model": ErrorResponse}},
    tags=["sessions"],
)
def get_session(session_id: str) -> JSONResponse:
    """Authorization: patient owner or assigned clinician."""
    return not_implemented(f"GET /api/v1/sessions/{session_id}")


@router.get(
    "/patients/{patient_id}/progress",
    responses={200: {"model": ProgressResponse}, 501: {"model": ErrorResponse}},
    tags=["sessions"],
)
def progress(patient_id: str) -> JSONResponse:
    """Authorization: assigned clinician or patient owner."""
    return not_implemented(f"GET /api/v1/patients/{patient_id}/progress")


@router.post(
    "/sessions/{session_id}/summary",
    responses={200: {"model": SummaryResponse}, 501: {"model": ErrorResponse}},
    tags=["summary"],
)
def summary(session_id: str, _body: SummaryRequest) -> JSONResponse:
    """Authorization: patient owner or assigned clinician. Numbers only to NVIDIA."""
    return not_implemented(f"POST /api/v1/sessions/{session_id}/summary")


@router.websocket("/sessions/{session_id}/stream")
async def stream(websocket: WebSocket, session_id: str) -> None:
    """WS contract stub. Real auth uses a short-lived session token, not a
    service-role or long-lived user token in the URL.
    """
    await websocket.accept()
    await websocket.send_json(
        {
            "type": "error",
            "code": "NOT_IMPLEMENTED",
            "message": f"Stream for {session_id} is not implemented yet",
        }
    )
    await websocket.close(code=1011)
