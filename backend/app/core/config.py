from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Server-side settings. Secrets are never logged and never sent to the browser."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    supabase_url: str = ""
    supabase_jwks_url: str = ""
    supabase_service_role_key: SecretStr = Field(default_factory=lambda: SecretStr(""))
    nvidia_api_key: SecretStr = Field(default_factory=lambda: SecretStr(""))
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    nvidia_model_id: str = ""

    store_raw_video: bool = False
    max_frame_rate: int = 8
    vision_service_url: str = "http://vision_service:8001"
    session_token_ttl_seconds: int = 300

    # Movement engine / quality gates — protocol-configurable at runtime.
    landmark_min_confidence: float = 0.6
    knee_angle_smoothing_alpha: float = 0.4
    analytics_version: str = "knee-extension-engine-0.1.0"
    keypoint_mapping_version: str = "rehabloop-knee-map-1.0"

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
