"""Post a fully synthetic seated figure to a running MoveNet vision service."""

from __future__ import annotations

import argparse
import base64
import json
import sys
from io import BytesIO
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from PIL import Image, ImageDraw


def synthetic_frame() -> str:
    image = Image.new("RGB", (640, 480), (238, 242, 246))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 410, 639, 479), fill=(211, 205, 194))
    draw.rounded_rectangle((168, 205, 230, 333), radius=10, fill=(80, 94, 110))
    draw.rounded_rectangle((207, 315, 382, 340), radius=9, fill=(80, 94, 110))
    draw.line((222, 338, 205, 436), fill=(66, 75, 87), width=12)
    draw.line((365, 338, 380, 436), fill=(66, 75, 87), width=12)
    draw.polygon(
        [(275, 125), (347, 120), (379, 218), (354, 268), (293, 257), (260, 218)],
        fill=(54, 112, 168),
    )
    draw.ellipse((296, 52, 366, 130), fill=(198, 143, 108))
    draw.pieslice((292, 42, 371, 128), 180, 360, fill=(60, 49, 43))
    draw.polygon([(357, 83), (379, 95), (359, 103)], fill=(198, 143, 108))
    draw.line((345, 145, 394, 197, 430, 247), fill=(54, 112, 168), width=27, joint="curve")
    draw.ellipse((416, 236, 441, 263), fill=(198, 143, 108))
    draw.line((320, 250, 464, 273), fill=(47, 64, 91), width=42, joint="curve")
    draw.ellipse((443, 252, 486, 294), fill=(198, 143, 108))
    draw.line((464, 273, 571, 262), fill=(47, 64, 91), width=31, joint="curve")
    draw.line((571, 262, 608, 267), fill=(60, 58, 57), width=18)
    draw.line((322, 264, 397, 340), fill=(47, 64, 91), width=40, joint="curve")
    draw.ellipse((378, 320, 417, 359), fill=(198, 143, 108))
    draw.line((397, 340, 363, 413), fill=(47, 64, 91), width=29)
    draw.line((363, 413, 394, 420), fill=(60, 58, 57), width=18)

    stream = BytesIO()
    image.save(stream, format="JPEG", quality=94)
    return base64.b64encode(stream.getvalue()).decode("ascii")


def request_json(url: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = json.dumps(payload).encode() if payload is not None else None
    request = Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"} if data is not None else {},
    )
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8001", help="Vision service base URL")
    args = parser.parse_args()
    base_url = args.url.rstrip("/")

    try:
        health = request_json(f"{base_url}/health")
        mapping = request_json(f"{base_url}/mapping")
        result = request_json(
            f"{base_url}/infer",
            {"sequence": 1, "timestamp_ms": 100, "image_b64": synthetic_frame()},
        )
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        print(f"Smoke test failed: service returned HTTP {exc.code}: {detail}")
        return 1
    except (URLError, TimeoutError) as exc:
        print(f"Smoke test failed: cannot reach vision service at {base_url}: {exc}")
        return 1

    if health.get("mode") != "movenet" or health.get("simulated") is not False:
        print(
            "Smoke test failed: expected real MoveNet mode; "
            f"got mode={health.get('mode')!r}, simulated={health.get('simulated')!r}"
        )
        return 1
    if mapping.get("version") != "rehabloop-movenet-knee-map-1.0":
        print(f"Smoke test failed: unexpected mapping version {mapping.get('version')!r}")
        return 1

    selected = ("selected_hip", "selected_knee", "selected_ankle")
    landmarks = result.get("landmarks", {})
    valid_count = sum(bool(landmarks.get(name, {}).get("valid")) for name in selected)
    side = result.get("quality", {}).get("side", "unknown")
    print(
        f"Health OK: model={health.get('model')}; mapping={mapping['version']}\n"
        f"Synthetic inference: person_detected={result.get('person_detected')}; "
        f"side={side}; valid_landmarks={valid_count}/3; "
        f"inference_ms={result.get('inference_ms')}"
    )
    if valid_count != 3 or result.get("person_detected") is not True:
        print("This model run did not find all three selected-side joints confidently.")
        return 1
    print("Smoke test passed. This synthetic check verifies wiring, not pose accuracy.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
