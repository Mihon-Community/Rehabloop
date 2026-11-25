"""Version 1 routes using server-side identity and session authorization."""

from __future__ import annotations

import time
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from ...core.auth import AuthUser, StreamGrant, current_user
from ...schemas.common import ErrorResponse, HealthResponse, ProfileResponse
from ...schemas.protocol import CreateProtocolRequest, ProtocolResponse, UpdateProtocolRequest
from ...schemas.session import (
    CompleteSessionRequest,
    CreateSessionRequest,
    ProgressResponse,
    SessionSummaryResponse,
    StartSessionRequest,
)
from ...schemas.stream import FrameEvent, StreamErrorEvent
from ...schemas.summary import SummaryRequest, SummaryResponse
from ...services.session_service import SessionService

router = APIRouter(prefix="/api/v1")


def _service(request: Request) -> SessionService:
    return request.app.state.session_service


@router.get("/health", response_model=HealthResponse, tags=["system"])
def health(request: Request) -> HealthResponse:
    """Public health response contains no sensitive dependency details."""
    settings = request.app.state.settings
    repository = request.app.state.repository
    return HealthResponse(
        status="ok",
        service="rehabloop-api",
        version="0.1.0",
        mode=settings.app_env,
        storage_mode=repository.storage_mode,
    )


@router.get("/me", response_model=ProfileResponse, tags=["auth"])
def me(user: Annotated[AuthUser, Depends(current_user)]) -> ProfileResponse:
    return ProfileResponse(id=user.user_id, role=user.role, display_name=user.display_name)


@router.get(
    "/patients/me/protocols",
    response_model=list[ProtocolResponse],
    tags=["protocols"],
)
async def my_protocols(
    request: Request, user: Annotated[AuthUser, Depends(current_user)]
) -> list[ProtocolResponse]:
    return [ProtocolResponse(**protocol) for protocol in await _service(request).my_protocols(user)]


@router.post(
    "/protocols",
    response_model=ProtocolResponse,
    responses={403: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
    tags=["protocols"],
)
async def create_protocol(
    body: CreateProtocolRequest,
    request: Request,
    user: Annotated[AuthUser, Depends(current_user)],
) -> dict:
    return await _service(request).create_protocol(user, body)


@router.patch(
    "/protocols/{protocol_id}",
    response_model=ProtocolResponse,
    responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
    tags=["protocols"],
)
async def update_protocol(
    protocol_id: UUID,
    body: UpdateProtocolRequest,
    request: Request,
    user: Annotated[AuthUser, Depends(current_user)],
) -> dict:
    return await _service(request).update_protocol(user, str(protocol_id), body)


@router.post(
    "/sessions",
    response_model=SessionSummaryResponse,
    responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
    tags=["sessions"],
)
async def create_session(
    body: CreateSessionRequest,
    request: Request,
    user: Annotated[AuthUser, Depends(current_user)],
) -> SessionSummaryResponse:
    session = await _service(request).create_session(user, body)
    return SessionSummaryResponse(**session)


@router.post(
    "/sessions/{session_id}/start",
    response_model=SessionSummaryResponse,
    responses={403: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
    tags=["sessions"],
)
async def start_session(
    session_id: UUID,
    body: StartSessionRequest,
    request: Request,
    user: Annotated[AuthUser, Depends(current_user)],
) -> SessionSummaryResponse:
    return await _service(request).start_session(user, str(session_id), body)


@router.post(
    "/sessions/{session_id}/complete",
    response_model=SessionSummaryResponse,
    responses={403: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
    tags=["sessions"],
)
async def complete_session(
    session_id: UUID,
    body: CompleteSessionRequest,
    request: Request,
    user: Annotated[AuthUser, Depends(current_user)],
) -> SessionSummaryResponse:
    return await _service(request).complete_session(user, str(session_id), body)


@router.get(
    "/sessions/{session_id}",
    response_model=SessionSummaryResponse,
    responses={404: {"model": ErrorResponse}},
    tags=["sessions"],
)
async def get_session(
    session_id: UUID,
    request: Request,
    user: Annotated[AuthUser, Depends(current_user)],
) -> SessionSummaryResponse:
    return await _service(request).get_session(user, str(session_id))


@router.get(
    "/patients/{patient_id}/progress",
    response_model=ProgressResponse,
    responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
    tags=["sessions"],
)
async def progress(
    patient_id: UUID,
    request: Request,
    user: Annotated[AuthUser, Depends(current_user)],
) -> ProgressResponse:
    return await _service(request).progress(user, str(patient_id))


@router.post(
    "/sessions/{session_id}/summary",
    response_model=SummaryResponse,
    responses={403: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
    tags=["summary"],
)
async def summary(
    session_id: UUID,
    request: Request,
    user: Annotated[AuthUser, Depends(current_user)],
    body: SummaryRequest | None = None,
) -> SummaryResponse:
    summary_request = body if body is not None else SummaryRequest()
    result = await _service(request).generate_session_summary(
        user, str(session_id), summary_request
    )
    return SummaryResponse(**result.model_dump())


@router.websocket("/sessions/{session_id}/stream")
async def stream(websocket: WebSocket, session_id: UUID) -> None:
    """Bounded sequential frame processing with a short-lived per-session token."""
    session_key = str(session_id)
    await websocket.accept()
    token = websocket.query_params.get("token", "")
    token_store = websocket.app.state.token_store
    grant: StreamGrant | None = token_store.resolve(token, session_key)
    if grant is None:
        await websocket.send_json(
            StreamErrorEvent(
                code="UNAUTHENTICATED", message="A valid session stream token is required."
            ).model_dump()
        )
        await websocket.close(code=4401)
        return

    service: SessionService = websocket.app.state.session_service
    vision_client = websocket.app.state.vision_client
    session = await websocket.app.state.repository.get_session(session_key)
    if session is None or session["patient_id"] != grant.user_id or session["status"] != "active":
        await websocket.send_json(
            StreamErrorEvent(
                code="NOT_FOUND", message="Session is not available for streaming."
            ).model_dump()
        )
        await websocket.close(code=4404)
        token_store.revoke(token)
        return

    user = AuthUser(grant.user_id, grant.role, grant.display_name)
    last_sequence = -1
    last_timestamp_ms = -1
    last_server_receive: float | None = None
    min_interval = 1 / websocket.app.state.settings.max_frame_rate
    try:
        while True:
            try:
                payload = await websocket.receive_json()
                frame = FrameEvent.model_validate(payload)
            except (ValidationError, ValueError, TypeError):
                await websocket.send_json(
                    StreamErrorEvent(
                        code="UNPROCESSABLE",
                        message="Frame payload is invalid or exceeds the allowed size.",
                    ).model_dump()
                )
                continue

            if frame.sequence <= last_sequence or frame.timestamp_ms <= last_timestamp_ms:
                await websocket.send_json(
                    StreamErrorEvent(
                        code="BAD_FRAME_ORDER",
                        message="Frame sequence and timestamp must increase.",
                    ).model_dump()
                )
                continue
            last_sequence = frame.sequence
            last_timestamp_ms = frame.timestamp_ms

            now = time.monotonic()
            if last_server_receive is not None and now - last_server_receive < min_interval:
                await websocket.send_json(
                    StreamErrorEvent(
                        code="RATE_LIMITED",
                        message="Frame skipped to enforce the configured sampling limit.",
                    ).model_dump()
                )
                continue
            last_server_receive = now

            if frame.session_id != session_key:
                await websocket.send_json(
                    StreamErrorEvent(
                        code="UNPROCESSABLE",
                        message="Frame session ID does not match the stream.",
                    ).model_dump()
                )
                continue
            try:
                event = await service.process_frame(user, session_key, frame, vision_client)
            except HTTPException as exc:
                code = {
                    409: "INVALID_STATE",
                    422: "UNPROCESSABLE",
                    503: "VISION_UNAVAILABLE",
                }.get(exc.status_code, "STREAM_ERROR")
                await websocket.send_json(
                    StreamErrorEvent(code=code, message=str(exc.detail)).model_dump()
                )
                if exc.status_code == 503:
                    await websocket.close(code=1013)
                    break
                continue
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    except (ValueError, TypeError):
        await websocket.close(code=1003)
    finally:
        await service.pause_stream(session_key)
        token_store.revoke(token)
