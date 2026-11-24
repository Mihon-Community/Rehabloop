"""Person detection: fixture stub or Sapiens2 detector (lazy-loaded)."""

from __future__ import annotations

from pathlib import Path

from .config import VisionSettings


class VisionUnavailableError(RuntimeError):
    """Raised when real inference cannot run. Maps to HTTP 503."""


class PersonDetector:
    def __init__(self, settings: VisionSettings) -> None:
        self.settings = settings

    def detect(self, frame: bytes) -> bool:
        if self.settings.mode == "fixture":
            return True
        root = Path(self.settings.sapiens_checkpoint_root)
        if not root.is_dir() or not any(root.iterdir()):
            raise VisionUnavailableError(
                "vision service unavailable: SAPIENS_CHECKPOINT_ROOT is missing or empty; "
                "set it to a directory containing the approved detector checkpoint"
            )
        raise VisionUnavailableError(
            "vision service unavailable: the Sapiens2 detector runtime is not installed "
            "in this image; use the GPU override and run the smoke test first"
        )
