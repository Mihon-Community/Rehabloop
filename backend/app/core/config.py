from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Server-side settings. Secrets are never logged and never sent to the browser."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    auth_mode: Literal["supabase", "dev"] = "supabase"
    vision_mode: Literal["fixture", "movenet"] = "fixture"
    movenet_model_name: str = "movenet-singlepose-lightning"
    movenet_keypoint_mapping_version: str = "rehabloop-movenet-knee-map-1.0"
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    supabase_url: str = ""
    supabase_jwks_url: str = ""
    supabase_anon_key: SecretStr = Field(default_factory=lambda: SecretStr(""))
    supabase_service_role_key: SecretStr = Field(default_factory=lambda: SecretStr(""))
    nvidia_api_key: SecretStr = Field(default_factory=lambda: SecretStr(""))
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    nvidia_model_id: str = ""

    store_raw_video: bool = False
    max_frame_rate: int = Field(default=8, ge=1, le=60)
    vision_service_url: str = "http://vision_service:8001"
    session_token_ttl_seconds: int = Field(default=300, ge=1, le=3600)

    # Movement engine / quality gates — protocol-configurable at runtime.
    landmark_min_confidence: float = Field(default=0.6, ge=0, le=1)
    knee_angle_smoothing_alpha: float = Field(default=0.4, gt=0, le=1)
    analytics_version: str = "knee-extension-engine-0.1.0"
    keypoint_mapping_version: str = "rehabloop-knee-map-1.0"

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def storage_mode(self) -> Literal["memory", "supabase"]:
        return (
            "supabase"
            if self.supabase_url and self.supabase_service_role_key.get_secret_value()
            else "memory"
        )

    @model_validator(mode="after")
    def enforce_local_safety(self) -> "Settings":
        if self.auth_mode == "dev" and self.app_env != "local":
            raise ValueError("AUTH_MODE=dev is allowed only when APP_ENV=local")
        if self.store_raw_video:
            raise ValueError("STORE_RAW_VIDEO must remain false")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
