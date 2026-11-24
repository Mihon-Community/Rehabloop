from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class VisionSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    vision_mode: str = "fixture"
    vision_device: str = "cpu"
    sapiens_checkpoint_root: str = ""
    sapiens_pose_model: str = "facebook/sapiens2-pose-0.4b"
    sapiens_detector_model: str = "facebook/detr-resnet-101-dc5"
    log_level: str = "INFO"
    max_frame_rate: int = Field(default=8)

    @property
    def mode(self) -> str:
        return self.vision_mode.lower().strip()


@lru_cache
def get_settings() -> VisionSettings:
    return VisionSettings()
