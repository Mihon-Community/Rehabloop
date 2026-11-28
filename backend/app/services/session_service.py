"""Protocol and session lifecycle with server-side authorization and state checks."""

from __future__ import annotations

from datetime import UTC, datetime
from math import isfinite
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from ..core.auth import AuthUser, SessionTokenStore
from ..core.config import Settings
from ..schemas.protocol import CreateProtocolRequest, UpdateProtocolRequest
from ..schemas.session import (
    CompleteSessionRequest,
    CreateSessionRequest,
    ProgressResponse,
    SessionSummaryResponse,
    StartSessionRequest,
)
from ..schemas.stream import FrameEvent, VisionResponse
from ..schemas.summary import SummaryRequest, SummaryResult
from .movement_engine import MovementEngine, ProjectedPoint, RepConfig
from .nvidia_summary import generate_summary
from .schemas_metrics import SessionMetrics
from .session_repository import SessionRepository
from .vision_client import VisionInferenceClient, VisionUnavailableError


class SessionService:
    def __init__(
        self,
        settings: Settings,
        repository: SessionRepository,
        token_store: SessionTokenStore,
    ) -> None:
        self.settings = settings
        self.repository = repository
        self.token_store = token_store
        self._engines: dict[str, MovementEngine] = {}

    async def create_protocol(self, user: AuthUser, body: CreateProtocolRequest) -> dict[str, Any]:
        if user.role != "clinician":
            raise HTTPException(status_code=403, detail="Clinician role required")
        patient_id = str(body.patient_id)
        if not await self.repository.clinician_has_patient(user.user_id, patient_id):
            raise HTTPException(status_code=403, detail="Patient assignment required")
        self._protocol_configuration(body.parameters)
        now = datetime.now(UTC).isoformat()
        protocol = {
            "id": str(uuid4()),
            "patient_id": patient_id,
            "clinician_id": user.user_id,
            "protocol_name": body.protocol_name,
            "version": 1,
            "parameters": body.parameters,
            "approved_at": now,
            "active": True,
            "persisted": False,
        }
        return await self.repository.create_protocol(protocol)

    async def update_protocol(
        self, user: AuthUser, protocol_id: str, body: UpdateProtocolRequest
    ) -> dict[str, Any]:
        if user.role != "clinician":
            raise HTTPException(status_code=403, detail="Clinician role required")
        current = await self.repository.get_protocol(protocol_id)
        if current is None:
            raise HTTPException(status_code=404, detail="Protocol not found")
        if current[
            "clinician_id"
        ] != user.user_id or not await self.repository.clinician_has_patient(
            user.user_id, current["patient_id"]
        ):
            raise HTTPException(status_code=404, detail="Protocol not found")
        parameters = body.parameters if body.parameters is not None else current["parameters"]
        self._protocol_configuration(parameters)
        updated = {
            **current,
            "id": str(uuid4()),
            "version": current["version"] + 1,
            "parameters": parameters,
            "active": current["active"] if body.active is None else body.active,
            "approved_at": datetime.now(UTC).isoformat(),
            "persisted": False,
        }
        version = await self.repository.update_protocol_version(protocol_id, updated)
        if version is None:
            raise HTTPException(
                status_code=409, detail="Protocol changed; reload it before updating"
            )
        return version

    async def my_protocols(self, user: AuthUser) -> list[dict[str, Any]]:
        if user.role != "patient":
            raise HTTPException(status_code=403, detail="Patient role required")
        return await self.repository.list_protocols(user.user_id)

    async def create_session(self, user: AuthUser, body: CreateSessionRequest) -> dict[str, Any]:
        protocol = await self.repository.get_protocol(str(body.protocol_id))
        if protocol is None or not protocol["active"]:
            raise HTTPException(status_code=404, detail="Protocol not found")
        if user.role == "patient":
            if protocol["patient_id"] != user.user_id:
                raise HTTPException(status_code=404, detail="Protocol not found")
        elif user.role == "clinician":
            if not await self.repository.clinician_has_patient(
                user.user_id, protocol["patient_id"]
            ):
                raise HTTPException(status_code=404, detail="Protocol not found")
        else:
            raise HTTPException(status_code=403, detail="Role cannot create sessions")

        config, target_reps = self._protocol_configuration(protocol["parameters"])
        if self.settings.vision_mode == "fixture":
            model_version = "fixture-simulated"
            mapping_version = self.settings.keypoint_mapping_version
        else:
            model_version = self.settings.movenet_model_name
            mapping_version = self.settings.movenet_keypoint_mapping_version
        session_id = str(uuid4())
        engine = MovementEngine(
            rep_config=config,
            target_reps=target_reps,
            min_confidence=self.settings.landmark_min_confidence,
            smoothing_alpha=self.settings.knee_angle_smoothing_alpha,
            model_version=model_version,
            mapping_version=mapping_version,
        )
        self._engines[session_id] = engine
        session = {
            "session_id": session_id,
            "protocol_id": protocol["id"],
            "protocol_version": protocol["version"],
            "patient_id": protocol["patient_id"],
            "clinician_id": protocol["clinician_id"],
            "model_version": model_version,
            "keypoint_mapping_version": mapping_version,
            "analytics_version": self.settings.analytics_version,
            "status": "draft",
            "metrics": engine.metrics(),
            "quality_flags": engine.quality_flags,
            "raw_video_stored": False,
            "persisted": False,
            "created_at": datetime.now(UTC).isoformat(),
        }
        return await self.repository.create_session(session)

    async def start_session(
        self, user: AuthUser, session_id: str, body: StartSessionRequest
    ) -> SessionSummaryResponse:
        session = await self._get_authorized_session(user, session_id)
        if session["patient_id"] != user.user_id:
            raise HTTPException(status_code=403, detail="Only the session owner can start it")
        if session["status"] not in {"draft", "ready", "paused"}:
            raise HTTPException(
                status_code=409, detail="Session cannot be started from its current state"
            )
        if not body.camera_checks_passed:
            raise HTTPException(status_code=409, detail="Camera setup checks have not passed")
        if not await self.repository.consent_is_valid(
            body.consent_record_id, session["patient_id"]
        ):
            raise HTTPException(status_code=403, detail="Valid camera consent is required")
        updated = await self.repository.update_session(
            session_id,
            {"status": "active", "started_at": datetime.now(UTC).isoformat()},
        )
        if updated is None:
            raise HTTPException(status_code=404, detail="Session not found")
        token = self.token_store.issue(user, session_id, self.settings.session_token_ttl_seconds)
        return self._response(updated, stream_token=token)

    async def complete_session(
        self, user: AuthUser, session_id: str, _body: CompleteSessionRequest
    ) -> SessionSummaryResponse:
        session = await self._get_authorized_session(user, session_id)
        if user.user_id != session["patient_id"] and user.role != "clinician":
            raise HTTPException(status_code=403, detail="Session completion denied")
        if session["status"] not in {"active", "paused"}:
            raise HTTPException(
                status_code=409, detail="Session cannot be completed from its current state"
            )
        engine = self._engines.get(session_id)
        metrics = engine.metrics() if engine is not None else session["metrics"]
        quality_flags = list(session.get("quality_flags", []))
        if engine is not None:
            quality_flags.extend(engine.quality_flags)
        if not engine or engine.metrics().get("usable_frame_pct") == 0:
            quality_flags.append("NO_VALID_FRAMES")
        updated = await self.repository.complete_session(
            session_id,
            datetime.now(UTC).isoformat(),
            metrics,
            sorted(set(quality_flags)),
        )
        if updated is None:
            raise HTTPException(
                status_code=409, detail="Session changed; reload it before completing"
            )
        self.token_store.revoke_session(session_id)
        self._engines.pop(session_id, None)
        return self._response(updated)

    async def get_session(self, user: AuthUser, session_id: str) -> SessionSummaryResponse:
        session = await self._get_authorized_session(user, session_id)
        return self._response(session)

    async def process_frame(
        self,
        user: AuthUser,
        session_id: str,
        frame: FrameEvent,
        vision_client: VisionInferenceClient,
    ) -> dict[str, Any]:
        if frame.session_id != session_id:
            raise HTTPException(status_code=422, detail="Frame session ID does not match stream")
        session = await self._get_authorized_session(user, session_id)
        if user.user_id != session["patient_id"]:
            raise HTTPException(status_code=403, detail="Only the session owner can stream frames")
        if session["status"] != "active":
            raise HTTPException(status_code=409, detail="Session is not active")
        engine = self._engines.get(session_id)
        if engine is None:
            raise HTTPException(status_code=409, detail="Session processing state is unavailable")
        try:
            vision: VisionResponse = await vision_client.infer(frame)
        except VisionUnavailableError as exc:
            raise HTTPException(status_code=503, detail="vision service unavailable") from exc
        if vision.sequence != frame.sequence or vision.timestamp_ms != frame.timestamp_ms:
            raise HTTPException(
                status_code=502, detail="Vision response did not match the input frame"
            )

        landmarks = {
            name: ProjectedPoint(
                x=point.x,
                y=point.y,
                confidence=point.confidence,
                valid=point.valid,
            )
            for name, point in vision.landmarks.items()
        }
        result = engine.process(
            landmarks,
            vision.timestamp_ms,
            person_count=1 if vision.person_detected else 0,
            model_version=vision.model,
            mapping_version=vision.mapping_version,
            simulated=vision.simulated,
        )
        confidence_values = [
            point.confidence
            for name, point in vision.landmarks.items()
            if name in {"selected_hip", "selected_knee", "selected_ankle"}
        ]
        confidence = round(min(confidence_values), 2) if confidence_values else None
        if result.usable and result.projected_knee_angle_deg is not None:
            return {
                "type": "measurement",
                "sequence": frame.sequence,
                "timestamp_ms": frame.timestamp_ms,
                "projected_knee_angle_deg": result.projected_knee_angle_deg,
                "rep_count": result.rep_count,
                "state": result.state,
                "quality": {"usable": True, "reason": None, "confidence": confidence},
                "model_version": vision.model,
                "simulated": vision.simulated,
            }
        reason = result.quality_flags[0] if result.quality_flags else "MEASUREMENT_UNAVAILABLE"
        return {
            "type": "quality_warning",
            "sequence": frame.sequence,
            "timestamp_ms": frame.timestamp_ms,
            "reason": reason,
            "message": "Measurement unavailable for this frame.",
            "rep_count": result.rep_count,
            "model_version": vision.model,
            "simulated": vision.simulated,
        }

    async def pause_stream(self, session_id: str) -> None:
        await self.repository.pause_active_session(session_id)
        self.token_store.revoke_session(session_id)

    async def progress(self, user: AuthUser, patient_id: str) -> ProgressResponse:
        if user.role == "patient" and user.user_id != patient_id:
            raise HTTPException(status_code=404, detail="Patient not found")
        if user.role == "clinician" and not await self.repository.clinician_has_patient(
            user.user_id, patient_id
        ):
            raise HTTPException(status_code=404, detail="Patient not found")
        if user.role not in {"patient", "clinician"}:
            raise HTTPException(status_code=403, detail="Role cannot view progress")
        records = await self.repository.list_sessions(patient_id)
        return ProgressResponse(
            patient_id=patient_id,
            sessions=[self._response(record) for record in records],
            persisted=self.repository.storage_mode == "supabase",
        )

    async def generate_session_summary(
        self,
        user: AuthUser,
        session_id: str,
        request: SummaryRequest,
    ) -> SummaryResult:
        session = await self._get_authorized_session(user, session_id)
        if session["status"] != "completed":
            raise HTTPException(
                status_code=409, detail="Complete the session before requesting a summary"
            )
        if not request.regenerate:
            cached = await self.repository.get_summary(session_id)
            if cached is not None:
                return SummaryResult.model_validate(cached).model_copy(
                    update={"persisted": self.repository.storage_mode == "supabase"}
                )
        metrics = SessionMetrics.model_validate(session["metrics"])
        previous_metrics = await self._previous_session_metrics(session)
        result = await generate_summary(metrics, self.settings, previous_metrics=previous_metrics)
        stored_copy = result.model_copy(
            update={"persisted": self.repository.storage_mode == "supabase"}
        )
        stored = await self.repository.save_summary(session_id, stored_copy.model_dump(mode="json"))
        return result.model_copy(update={"persisted": stored})

    async def _previous_session_metrics(self, session: dict[str, Any]) -> SessionMetrics | None:
        """The same patient's most recently started, prior completed session on
        the same protocol — the only comparison build_prompt is allowed to make,
        since angle targets and rep counts from a different protocol version
        would not be a meaningful comparison.
        """
        candidates = [
            record
            for record in await self.repository.list_sessions(session["patient_id"])
            if record["session_id"] != session["session_id"]
            and record["protocol_id"] == session["protocol_id"]
            and record["status"] == "completed"
            and record.get("started_at")
        ]
        if not candidates:
            return None
        candidates.sort(key=lambda record: record["started_at"], reverse=True)
        try:
            return SessionMetrics.model_validate(candidates[0]["metrics"])
        except (TypeError, ValueError):
            return None

    async def _get_authorized_session(self, user: AuthUser, session_id: str) -> dict[str, Any]:
        session = await self.repository.get_session(session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found")
        if session["patient_id"] == user.user_id:
            return session
        if user.role == "clinician" and await self.repository.clinician_has_patient(
            user.user_id, session["patient_id"]
        ):
            return session
        raise HTTPException(status_code=404, detail="Session not found")

    def _response(
        self, session: dict[str, Any], *, stream_token: str | None = None
    ) -> SessionSummaryResponse:
        return SessionSummaryResponse(
            **{
                key: session[key]
                for key in (
                    "session_id",
                    "protocol_id",
                    "protocol_version",
                    "model_version",
                    "keypoint_mapping_version",
                    "analytics_version",
                    "status",
                    "metrics",
                    "quality_flags",
                    "raw_video_stored",
                )
            },
            persisted=session.get("persisted", self.repository.storage_mode == "supabase"),
            stream_token=stream_token,
        )

    @staticmethod
    def _protocol_configuration(parameters: dict[str, Any]) -> tuple[RepConfig, int]:
        required = ("rest_min_deg", "rest_max_deg", "target_min_deg", "target_max_deg")
        missing = [name for name in required if name not in parameters]
        if "target_reps" not in parameters:
            missing.append("target_reps")
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"Clinician protocol is missing required fields: {', '.join(missing)}",
            )
        try:
            for name in required:
                raw_value = parameters[name]
                if (
                    isinstance(raw_value, bool)
                    or not isinstance(raw_value, (int, float))
                    or not isfinite(float(raw_value))
                ):
                    raise ValueError(f"{name} must be a finite number")

            def integer_parameter(name: str, default: int | None = None) -> int:
                raw_value = parameters.get(name, default)
                if (
                    isinstance(raw_value, bool)
                    or not isinstance(raw_value, (int, float))
                    or not float(raw_value).is_integer()
                ):
                    raise ValueError(f"{name} must be an integer")
                return int(raw_value)

            config = RepConfig(
                rest_min_deg=float(parameters["rest_min_deg"]),
                rest_max_deg=float(parameters["rest_max_deg"]),
                target_min_deg=float(parameters["target_min_deg"]),
                target_max_deg=float(parameters["target_max_deg"]),
                dwell_ms=integer_parameter("dwell_ms", 200),
                hold_ms=integer_parameter("hold_ms", 400),
                min_rep_duration_ms=integer_parameter("min_rep_duration_ms", 250),
            )
            target_reps = integer_parameter("target_reps")
            if target_reps < 1:
                raise ValueError("target_reps must be positive")
        except (TypeError, ValueError, OverflowError) as exc:
            raise HTTPException(
                status_code=422, detail="Invalid clinician protocol parameters"
            ) from exc
        return config, target_reps
