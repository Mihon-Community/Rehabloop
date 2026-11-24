"""Versioned adapter from raw model output to RehabLoop named landmarks.

No Sociopticon index is hard-coded. If the pinned mapping still contains
placeholders, real inference is refused with a clear error.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml  # type: ignore[import-untyped]
from pydantic import BaseModel

MAPPING_PATH = Path(__file__).resolve().parent.parent / "config" / "keypoint_mapping.yaml"
REQUIRED_LANDMARKS = ("selected_hip", "selected_knee", "selected_ankle")


class KeypointMappingError(RuntimeError):
    """Raised when the mapping is missing or still a placeholder."""


class Mapping(BaseModel):
    version: str
    status: str
    landmarks: dict[str, Any]
    required_confidence: float = 0.6
    sides: dict[str, dict[str, int]] | None = None
    source: str = ""

    @property
    def is_placeholder(self) -> bool:
        return "PLACEHOLDER" in self.status.upper() or any(
            self.landmarks.get(name, {}).get("index") is None for name in REQUIRED_LANDMARKS
        )


def load_mapping(path: Path = MAPPING_PATH) -> Mapping:
    with path.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    return Mapping.model_validate(data)


def map_raw_keypoints(
    raw: list[dict[str, Any]], mapping: Mapping, side: str = "left"
) -> dict[str, Any]:
    """Map raw Sapiens2 keypoints. Refuse when indices are unresolved."""
    if mapping.is_placeholder:
        raise KeypointMappingError(
            "keypoint mapping indices are placeholders; resolve them from the official "
            "Sapiens2 keypoint specification before real inference"
        )
    indices: dict[str, int]
    if mapping.sides:
        if side not in mapping.sides:
            raise KeypointMappingError(
                f"unsupported SAPIENS_TARGET_SIDE={side!r}; use left or right"
            )
        side_map = mapping.sides[side]
        indices = {
            "selected_hip": side_map["hip"],
            "selected_knee": side_map["knee"],
            "selected_ankle": side_map["ankle"],
        }
    else:
        indices = {name: int(mapping.landmarks[name]["index"]) for name in REQUIRED_LANDMARKS}
    result: dict[str, Any] = {}
    for name in REQUIRED_LANDMARKS:
        index = indices[name]
        if index < 0 or index >= len(raw):
            raise KeypointMappingError(f"raw keypoint index {index} for {name} is out of range")
        result[name] = raw[index]
    return result
