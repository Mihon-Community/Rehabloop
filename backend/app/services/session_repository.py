"""Storage contract shared by the in-memory and Supabase repositories."""

from __future__ import annotations

from typing import Any, Literal, Protocol


class SessionRepository(Protocol):
    @property
    def storage_mode(self) -> Literal["memory", "supabase"]: ...

    async def clinician_has_patient(self, clinician_id: str, patient_id: str) -> bool: ...

    async def get_profile(self, user_id: str) -> dict[str, Any] | None: ...

    async def consent_is_valid(self, consent_id: str, patient_id: str) -> bool: ...

    async def create_protocol(self, protocol: dict[str, Any]) -> dict[str, Any]: ...

    async def get_protocol(self, protocol_id: str) -> dict[str, Any] | None: ...

    async def list_protocols(self, patient_id: str) -> list[dict[str, Any]]: ...

    async def deactivate_protocol(self, protocol_id: str) -> None: ...

    async def update_protocol_version(
        self, protocol_id: str, protocol: dict[str, Any]
    ) -> dict[str, Any] | None: ...

    async def create_session(self, session: dict[str, Any]) -> dict[str, Any]: ...

    async def get_session(self, session_id: str) -> dict[str, Any] | None: ...

    async def update_session(
        self, session_id: str, updates: dict[str, Any]
    ) -> dict[str, Any] | None: ...

    async def pause_active_session(self, session_id: str) -> bool:
        """Move a session to 'paused' only while it is still 'active'.

        Must be a single atomic compare-and-set, never a read followed by a
        write: a stream closing races session completion, and a stale write
        here would revert a completed session to 'paused', permanently
        blocking its summary. Returns whether this call did the transition.
        """
        ...

    async def complete_session(
        self,
        session_id: str,
        ended_at: str,
        metrics: dict[str, Any],
        quality_flags: list[str],
    ) -> dict[str, Any] | None: ...

    async def list_sessions(self, patient_id: str) -> list[dict[str, Any]]: ...

    async def save_summary(self, session_id: str, summary: dict[str, Any]) -> bool: ...

    async def get_summary(self, session_id: str) -> dict[str, Any] | None: ...
