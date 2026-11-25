from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class VisionSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    vision_mode: str = "fixture"
    movenet_model_path: str = ""
    movenet_model_name: str = "movenet-singlepose-lightning"
    movenet_target_side: str = "left"
    log_level: str = "INFO"
    max_frame_rate: int = Field(default=8)

    @property
    def mode(self) -> str:
        return self.vision_mode.lower().strip()


@lru_cache
def get_settings() -> VisionSettings:
    return VisionSettings()
