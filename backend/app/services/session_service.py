"""Session lifecycle orchestration. Endpoints are contract stubs for now."""

from __future__ import annotations

from ..core.config import Settings
from .movement_engine import RepConfig, RepStateMachine
from .supabase_repository import SupabaseRepository


class SessionService:
    def __init__(self, settings: Settings, repository: SupabaseRepository | None = None) -> None:
        self.settings = settings
        self.repository = repository or SupabaseRepository(settings)

    def new_state_machine(self, parameters: dict) -> RepStateMachine:
        """Build the machine from clinician-configured parameters (no universal thresholds)."""
        cfg = RepConfig(
            rest_min_deg=float(parameters.get("rest_min_deg", 70)),
            rest_max_deg=float(parameters.get("rest_max_deg", 80)),
            target_min_deg=float(parameters.get("target_min_deg", 110)),
            target_max_deg=float(parameters.get("target_max_deg", 125)),
        )
        return RepStateMachine(cfg)

    def create_session(self, protocol_id: str) -> dict:
        raise NotImplementedError("Session creation lands in the backend implementation")
