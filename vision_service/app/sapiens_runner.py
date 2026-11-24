"""Adapter around the licensed Sapiens2 pose CLI.

We call the documented `vis_pose.py` tool rather than guessing the model's
Python API. It performs DETR person detection + 308-keypoint pose inference
and writes a per-frame predictions JSON. Frames are transient: the temporary
input/output directories are deleted after each call and no image is logged.
"""

from __future__ import annotations

import base64
import json
import re
import subprocess
import sys
import tempfile
from io import BytesIO
from pathlib import Path
from typing import Any

from .config import VisionSettings
from .detector import VisionUnavailableError


class SapiensRunner:
    def __init__(self, settings: VisionSettings) -> None:
        self.settings = settings
        if not settings.sapiens_root:
            raise VisionUnavailableError(
                "vision service unavailable: SAPIENS_ROOT must point to a directory "
                "containing the licensed Sapiens2 source tree"
            )
        root = Path(settings.sapiens_root)
        if not root.is_dir():
            raise VisionUnavailableError(
                "vision service unavailable: SAPIENS_ROOT must point to a directory "
                "containing the licensed Sapiens2 source tree"
            )
        self.root = root
        self.pose_dir = root / "sapiens" / "pose"
        self.script = self.pose_dir / "tools" / "vis" / "vis_pose.py"
        if not self.script.is_file():
            raise VisionUnavailableError(
                f"vision service unavailable: Sapiens2 pose tool not found at {self.script}"
            )
        self.checkpoint = (
            Path(settings.sapiens_checkpoint_root) / "pose" / self._checkpoint_filename()
        )
        if not self.checkpoint.is_file():
            raise VisionUnavailableError(
                f"vision service unavailable: pose checkpoint not found at {self.checkpoint}"
            )
        detector_dir = (
            Path(settings.sapiens_checkpoint_root)
            / "detector"
            / settings.sapiens_detector_model.rsplit("/", 1)[-1]
        )
        if not detector_dir.is_dir():
            raise VisionUnavailableError(
                f"vision service unavailable: detector directory not found at {detector_dir}"
            )
        self.detector_dir = detector_dir
        self.config = self._pose_config()
        if not self.config.is_file():
            raise VisionUnavailableError(
                f"vision service unavailable: pose config not found at {self.config}; "
                "set SAPIENS_POSE_CONFIG to the verified config path"
            )

    def _size_suffix(self) -> str:
        name = self.settings.sapiens_pose_model.rsplit("/", 1)[-1]
        match = re.fullmatch(r"sapiens2-pose-([0-9.]+[bB])", name)
        if not match:
            raise VisionUnavailableError(
                f"vision service unavailable: cannot derive checkpoint size from "
                f"SAPIENS_POSE_MODEL={name!r}; set SAPIENS_CHECKPOINT_FILE explicitly"
            )
        return match.group(1).lower()

    def _checkpoint_filename(self) -> str:
        if self.settings.sapiens_checkpoint_file:
            return self.settings.sapiens_checkpoint_file
        return f"sapiens2_{self._size_suffix()}_pose.safetensors"

    def _pose_config(self) -> Path:
        if self.settings.sapiens_pose_config:
            candidate = Path(self.settings.sapiens_pose_config)
            return candidate if candidate.is_absolute() else self.pose_dir / candidate
        size = self._size_suffix()
        dataset = self.settings.sapiens_dataset
        filename = f"sapiens2_{size}_keypoints308_{dataset}-1024x768.py"
        return self.pose_dir / "configs" / "keypoints308" / dataset / filename

    def infer(self, image_b64: str) -> list[dict[str, Any]]:
        """Run inference on one transient frame and return 308 raw keypoints."""
        try:
            frame = base64.b64decode(image_b64, validate=True)
        except Exception as exc:  # noqa: BLE001
            raise VisionUnavailableError(
                "vision service unavailable: invalid frame payload"
            ) from exc
        try:
            from PIL import Image  # lazy: only needed in the GPU image
        except ImportError as exc:
            raise VisionUnavailableError(
                "vision service unavailable: Pillow is not installed"
            ) from exc

        try:
            image = Image.open(BytesIO(frame)).convert("RGB")
        except Exception as exc:  # noqa: BLE001
            raise VisionUnavailableError("vision service unavailable: undecodable frame") from exc

        with tempfile.TemporaryDirectory(prefix="rehabloop-vision-") as tmp:
            input_dir = Path(tmp) / "in"
            output_dir = Path(tmp) / "out"
            input_dir.mkdir()
            output_dir.mkdir()
            image.save(input_dir / "frame.png")
            command = [
                sys.executable,
                str(self.script),
                str(self.detector_dir),
                str(self.config),
                str(self.checkpoint),
                "--input",
                str(input_dir),
                "--output",
                str(output_dir),
                "--predictions-name",
                "pred.json",
                "--device",
                self.settings.vision_device,
            ]
            try:
                result = subprocess.run(
                    command,
                    cwd=str(self.root),
                    capture_output=True,
                    text=True,
                    timeout=self.settings.sapiens_inference_timeout,
                    check=False,
                )
            except (OSError, subprocess.TimeoutExpired) as exc:
                raise VisionUnavailableError(
                    f"vision service unavailable: pose tool failed: {exc}"
                ) from exc
            if result.returncode != 0:
                raise VisionUnavailableError(
                    "vision service unavailable: pose tool exited with "
                    f"{result.returncode}: {result.stderr[-400:]}"
                )
            predictions = output_dir / "pred.json"
            if not predictions.is_file():
                raise VisionUnavailableError(
                    "vision service unavailable: pose tool produced no predictions JSON"
                )
            payload = json.loads(predictions.read_text(encoding="utf-8"))

        frames = payload.get("frames") or []
        if not frames:
            raise VisionUnavailableError("vision service unavailable: no usable pose frame")
        instances = frames[0].get("instances") or []
        if len(instances) != 1:
            raise VisionUnavailableError(
                "vision service unavailable: expected exactly one person in frame, "
                f"got {len(instances)}"
            )
        image_size = payload.get("image_size") or []
        if len(image_size) != 2:
            raise VisionUnavailableError(
                "vision service unavailable: missing image size in predictions"
            )
        height, width = int(image_size[0]), int(image_size[1])
        if height <= 0 or width <= 0:
            raise VisionUnavailableError(
                "vision service unavailable: invalid image size in predictions"
            )
        keypoints = instances[0].get("keypoints") or []
        scores = instances[0].get("keypoint_scores") or []
        if len(keypoints) != 308 or len(scores) != 308:
            raise VisionUnavailableError(
                "vision service unavailable: expected 308 Sapiens2 keypoints"
            )
        return [
            {
                "x": float(point[0]) / width,
                "y": float(point[1]) / height,
                "x_px": float(point[0]),
                "y_px": float(point[1]),
                "confidence": float(score),
                "valid": True,
            }
            for point, score in zip(keypoints, scores, strict=True)
        ]
