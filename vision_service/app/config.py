from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class VisionSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    vision_mode: str = "fixture"
    vision_device: str = "cpu"
    movenet_model_path: str = ""
    movenet_model_name: str = "movenet-singlepose-lightning"
    movenet_target_side: str = "left"
    sapiens_checkpoint_root: str = ""
    sapiens_pose_model: str = "facebook/sapiens2-pose-0.4b"
    sapiens_detector_model: str = "facebook/detr-resnet-101-dc5"
    # Directory holding the licensed Sapiens2 source tree (read-only mount in GPU mode).
    sapiens_root: str = ""
    # Optional explicit config path, relative to sapiens_root/sapiens/pose.
    sapiens_pose_config: str = ""
    sapiens_dataset: str = "shutterstock_goliath_3po"
    sapiens_checkpoint_file: str = ""
    sapiens_target_side: str = "left"
    sapiens_inference_timeout: int = 120
    log_level: str = "INFO"
    max_frame_rate: int = Field(default=8)

    @property
    def mode(self) -> str:
        return self.vision_mode.lower().strip()


@lru_cache
def get_settings() -> VisionSettings:
    return VisionSettings()
