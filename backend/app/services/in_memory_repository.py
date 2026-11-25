"""Ephemeral local repository. Responses always identify non-persisted data."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Literal

from ..core.auth import DEV_CLINICIAN_ID, DEV_PATIENT_ID

DEMO_CONSENT_ID = "demo-consent-record"


class InMemoryRepository:
    def __init__(self) -> None:
        self._protocols: dict[str, dict[str, Any]] = {}
        self._sessions: dict[str, dict[str, Any]] = {}
        self._summaries: dict[str, dict[str, Any]] = {}
        self._consents = {(DEMO_CONSENT_ID, DEV_PATIENT_ID)}

    @property
    def storage_mode(self) -> Literal["memory"]:
        return "memory"

    async def clinician_has_patient(self, clinician_id: str, patient_id: str) -> bool:
        return clinician_id == DEV_CLINICIAN_ID and patient_id == DEV_PATIENT_ID

    async def get_profile(self, user_id: str) -> dict[str, Any] | None:
        profiles = {
            DEV_PATIENT_ID: {
                "id": DEV_PATIENT_ID,
                "role": "patient",
                "display_name": "Demo Patient",
            },
            DEV_CLINICIAN_ID: {
                "id": DEV_CLINICIAN_ID,
                "role": "clinician",
                "display_name": "Demo Clinician",
            },
        }
        profile = profiles.get(user_id)
        return deepcopy(profile) if profile is not None else None

    async def consent_is_valid(self, consent_id: str, patient_id: str) -> bool:
        return (consent_id, patient_id) in self._consents

    async def create_protocol(self, protocol: dict[str, Any]) -> dict[str, Any]:
        stored = deepcopy(protocol)
        self._protocols[stored["id"]] = stored
        return deepcopy(stored)

    async def get_protocol(self, protocol_id: str) -> dict[str, Any] | None:
        protocol = self._protocols.get(protocol_id)
        return deepcopy(protocol) if protocol is not None else None

    async def list_protocols(self, patient_id: str) -> list[dict[str, Any]]:
        return [
            deepcopy(protocol)
            for protocol in self._protocols.values()
            if protocol["patient_id"] == patient_id and protocol["active"]
        ]

    async def deactivate_protocol(self, protocol_id: str) -> None:
        if protocol_id in self._protocols:
            self._protocols[protocol_id]["active"] = False

    async def update_protocol_version(
        self, protocol_id: str, protocol: dict[str, Any]
    ) -> dict[str, Any] | None:
        current = self._protocols.get(protocol_id)
        if current is None:
            return None
        if not current["active"]:
            return None
        current["active"] = False
        stored = deepcopy(protocol)
        self._protocols[stored["id"]] = stored
        return deepcopy(stored)

    async def create_session(self, session: dict[str, Any]) -> dict[str, Any]:
        stored = deepcopy(session)
        self._sessions[stored["session_id"]] = stored
        return deepcopy(stored)

    async def get_session(self, session_id: str) -> dict[str, Any] | None:
        session = self._sessions.get(session_id)
        return deepcopy(session) if session is not None else None

    async def update_session(
        self, session_id: str, updates: dict[str, Any]
    ) -> dict[str, Any] | None:
        session = self._sessions.get(session_id)
        if session is None:
            return None
        session.update(deepcopy(updates))
        return deepcopy(session)

    async def complete_session(
        self,
        session_id: str,
        ended_at: str,
        metrics: dict[str, Any],
        quality_flags: list[str],
    ) -> dict[str, Any] | None:
        session = self._sessions.get(session_id)
        if session is None or session["status"] not in {"active", "paused"}:
            return None
        session.update(
            {
                "status": "completed",
                "ended_at": ended_at,
                "metrics": deepcopy(metrics),
                "quality_flags": deepcopy(quality_flags),
                "raw_video_stored": False,
            }
        )
        return deepcopy(session)

    async def list_sessions(self, patient_id: str) -> list[dict[str, Any]]:
        return [
            deepcopy(session)
            for session in self._sessions.values()
            if session["patient_id"] == patient_id
        ]

    async def save_summary(self, session_id: str, summary: dict[str, Any]) -> bool:
        if session_id not in self._sessions:
            return False
        self._summaries[session_id] = deepcopy(summary)
        return False

    async def get_summary(self, session_id: str) -> dict[str, Any] | None:
        summary = self._summaries.get(session_id)
        return deepcopy(summary) if summary is not None else None
