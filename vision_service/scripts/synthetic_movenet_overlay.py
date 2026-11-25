"""Save a visual overlay from one generated synthetic frame and local MoveNet."""

from __future__ import annotations

import argparse
import base64
import tempfile
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw
from synthetic_movenet_smoke import request_json, synthetic_frame

LANDMARK_COLORS = {
    "selected_hip": (40, 160, 60),
    "selected_knee": (230, 150, 30),
    "selected_ankle": (210, 45, 45),
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8001", help="Vision service base URL")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(tempfile.gettempdir()) / "rehabloop-movenet-synthetic-overlay.png",
        help="Output PNG path (defaults to the system temp directory)",
    )
    args = parser.parse_args()
    base_url = args.url.rstrip("/")
    encoded_frame = synthetic_frame()

    try:
        health = request_json(f"{base_url}/health")
        if health.get("mode") != "movenet" or health.get("simulated") is not False:
            print("Overlay review failed: expected real MoveNet mode, not a fixture response.")
            return 1
        result = request_json(
            f"{base_url}/infer",
            {"sequence": 1, "timestamp_ms": 100, "image_b64": encoded_frame},
        )
    except Exception as exc:  # noqa: BLE001 - this script has no credentials or patient input
        print(f"Overlay review failed: service request error ({type(exc).__name__}).")
        return 1

    image = Image.open(BytesIO(base64.b64decode(encoded_frame))).convert("RGB")
    draw = ImageDraw.Draw(image)
    landmarks: dict[str, Any] = result.get("landmarks", {})
    valid_count = 0

    for name, color in LANDMARK_COLORS.items():
        point = landmarks.get(name)
        if not isinstance(point, dict) or not point.get("valid"):
            continue
        try:
            x = round(float(point["x"]) * image.width)
            y = round(float(point["y"]) * image.height)
            confidence = float(point["confidence"])
        except (KeyError, TypeError, ValueError):
            continue
        valid_count += 1
        radius = 8
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), outline=color, width=4)
        draw.line((x - 12, y, x + 12, y), fill=color, width=2)
        draw.line((x, y - 12, x, y + 12), fill=color, width=2)
        label = f"{name.removeprefix('selected_')} {confidence:.2f}"
        draw.text((min(x + 10, image.width - 130), max(0, y - 18)), label, fill=color)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.output, format="PNG")
    print(f"output={args.output}")
    print(f"model={health.get('model')}; simulated={result.get('simulated')}")
    print(f"selected_leg_landmarks_valid={valid_count}/3")
    if valid_count != 3:
        print("Synthetic overlay is incomplete; keep the mapping review open.")
        return 1
    print("Synthetic overlay saved; this is not clinical validation.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
