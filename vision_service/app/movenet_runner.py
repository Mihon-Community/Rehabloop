"""CPU MoveNet SinglePose Lightning runner using Google's LiteRT runtime.

Frames stay in memory. MoveNet returns COCO-17 joints in coordinates of its
square, padded input; this adapter removes the padding before returning them.
"""

from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageOps

from .config import VisionSettings
from .errors import VisionUnavailableError

INPUT_SIZE = 192
EXPECTED_KEYPOINTS = 17


class MoveNetRunner:
    def __init__(self, settings: VisionSettings) -> None:
        self.settings = settings
        model_path = Path(settings.movenet_model_path).expanduser()
        if not settings.movenet_model_path.strip():
            raise VisionUnavailableError(
                "vision service unavailable: MOVENET_MODEL_PATH must point to the "
                "local MoveNet SinglePose Lightning .tflite model"
            )
        if not model_path.is_file():
            raise VisionUnavailableError(
                f"vision service unavailable: MoveNet model file not found at {model_path}"
            )
        try:
            from ai_edge_litert.compiled_model import CompiledModel

            self.model = CompiledModel.from_file(str(model_path))
            self.input_buffers = self.model.create_input_buffers(0)
            self.output_buffers = self.model.create_output_buffers(0)
            if len(self.input_buffers) != 1 or len(self.output_buffers) != 1:
                raise ValueError("expected one input and one output tensor")
            self.input_details = self.input_buffers[0].get_tensor_details()
            self.output_details = self.output_buffers[0].get_tensor_details()
            input_shape = tuple(int(value) for value in self.input_details["shape"])
            output_shape = tuple(int(value) for value in self.output_details["shape"])
            if input_shape != (1, INPUT_SIZE, INPUT_SIZE, 3):
                raise ValueError(f"unexpected model input shape: {input_shape}")
            if output_shape not in ((1, 1, EXPECTED_KEYPOINTS, 3), (1, EXPECTED_KEYPOINTS, 3)):
                raise ValueError(f"unexpected model output shape: {output_shape}")
            self.input_dtype = np.dtype(self.input_details["dtype"])
            self.output_dtype = np.dtype(self.output_details["dtype"])
        except VisionUnavailableError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise VisionUnavailableError(
                f"vision service unavailable: could not load the MoveNet LiteRT model: {exc}"
            ) from exc

    @staticmethod
    def _decode_image(image_b64: str) -> Image.Image:
        try:
            frame = base64.b64decode(image_b64, validate=True)
            return Image.open(BytesIO(frame)).convert("RGB")
        except Exception as exc:  # noqa: BLE001
            raise VisionUnavailableError(
                "vision service unavailable: invalid or undecodable frame payload"
            ) from exc

    @staticmethod
    def _resize_with_pad(
        image: Image.Image,
    ) -> tuple[Image.Image, int, int, int, int, int, int]:
        width, height = image.size
        if width <= 0 or height <= 0:
            raise VisionUnavailableError("vision service unavailable: empty frame")
        scale = min(INPUT_SIZE / width, INPUT_SIZE / height)
        resized_width = max(1, min(INPUT_SIZE, round(width * scale)))
        resized_height = max(1, min(INPUT_SIZE, round(height * scale)))
        resized = image.resize((resized_width, resized_height), Image.Resampling.BILINEAR)
        left = (INPUT_SIZE - resized_width) // 2
        top = (INPUT_SIZE - resized_height) // 2
        padded = ImageOps.expand(
            resized,
            border=(
                left,
                top,
                INPUT_SIZE - resized_width - left,
                INPUT_SIZE - resized_height - top,
            ),
            fill=(0, 0, 0),
        )
        return padded, width, height, left, top, resized_width, resized_height

    def infer(self, image_b64: str) -> list[dict[str, Any]]:
        image = self._decode_image(image_b64)
        padded, width, height, left, top, resized_width, resized_height = self._resize_with_pad(
            image
        )
        pixels = np.asarray(padded, dtype=self.input_dtype)[None, ...]
        try:
            self.input_buffers[0].write(pixels)
            self.model.run_by_index(0, self.input_buffers, self.output_buffers)
            output_size = int(np.prod(self.output_details["shape"]))
            scores = self.output_buffers[0].read(output_size, self.output_dtype)
            keypoints = scores.reshape(tuple(int(value) for value in self.output_details["shape"]))
        except Exception as exc:  # noqa: BLE001
            raise VisionUnavailableError(
                f"vision service unavailable: MoveNet inference failed: {exc}"
            ) from exc

        points = keypoints.reshape((EXPECTED_KEYPOINTS, 3))
        if not np.isfinite(points).all():
            raise VisionUnavailableError(
                "vision service unavailable: MoveNet returned non-finite output"
            )
        if np.any((points[:, 2] < 0.0) | (points[:, 2] > 1.0)):
            raise VisionUnavailableError(
                "vision service unavailable: invalid MoveNet confidence output"
            )
        result: list[dict[str, Any]] = []
        for y_model, x_model, confidence in points:
            x_px = (float(x_model) * INPUT_SIZE - left) * width / resized_width
            y_px = (float(y_model) * INPUT_SIZE - top) * height / resized_height
            result.append(
                {
                    "x": x_px / width,
                    "y": y_px / height,
                    "x_px": x_px,
                    "y_px": y_px,
                    "confidence": float(confidence),
                    "valid": True,
                }
            )
        return result
