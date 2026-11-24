"""Person detection availability check for fixture and Sapiens2 modes.

Real detection is performed inside the licensed Sapiens2 `vis_pose.py` demo
tool (which uses the official DETR detector). This module validates that the
checkpoint root is usable and fails clearly otherwise.
"""

from __future__ import annotations

from pathlib import Path

from .config import VisionSettings


class VisionUnavailableError(RuntimeError):
    """Raised when real inference cannot run. Maps to HTTP 503."""


class PersonDetector:
    def __init__(self, settings: VisionSettings) -> None:
        self.settings = settings

    def detect(self, _frame: bytes) -> bool:
        if self.settings.mode == "fixture":
            return True
        root = Path(self.settings.sapiens_checkpoint_root)
        if not root.is_dir() or not any(root.iterdir()):
            raise VisionUnavailableError(
                "vision service unavailable: SAPIENS_CHECKPOINT_ROOT is missing or empty; "
                "set it to a directory containing the approved detector and pose checkpoints"
            )
        detector_dir = root / "detector" / self.settings.sapiens_detector_model.rsplit("/", 1)[-1]
        if not detector_dir.is_dir():
            raise VisionUnavailableError(
                "vision service unavailable: detector checkpoint directory not found at "
                f"{detector_dir}"
            )
        return True
