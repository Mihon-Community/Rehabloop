"""Server-side Supabase access. The service-role key never leaves this module."""

from __future__ import annotations

from ..core.config import Settings


class SupabaseRepository:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        # Initialise with the service-role key only on the server. Never log it.
        self._configured = bool(settings.supabase_url and settings.supabase_service_role_key)

    @property
    def configured(self) -> bool:
        return self._configured

    def save_session(self, session: dict) -> None:
        raise NotImplementedError("Supabase persistence lands in the 24-32h backend slot")

    def get_session(self, session_id: str) -> dict | None:
        raise NotImplementedError("Supabase reads land in the 24-32h backend slot")
