"""Replay a local video file through the running vision service, frame by frame.

Use this to validate MoveNet pose detection against a recorded clip when a live
camera is unavailable. Only use footage you have the rights and consent to use,
and keep it out of Git — see fixtures/approved_test_frames/README.md. This is
an engineering wiring/plausibility check, not clinical validation, and it does
not diagnose, predict recovery, or assess treatment.
"""

from __future__ import annotations

import argparse
import base64
import statistics
import sys
from collections.abc import Iterator
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError

import cv2
from PIL import Image, ImageDraw
from synthetic_movenet_smoke import request_json

SELECTED_LANDMARKS = ("selected_hip", "selected_knee", "selected_ankle")
LANDMARK_COLORS = {
    "selected_hip": (40, 160, 60),
    "selected_knee": (230, 150, 30),
    "selected_ankle": (210, 45, 45),
}


def iter_sampled_frames(
    video_path: Path, sample_fps: float, max_frames: int
) -> Iterator[tuple[int, int, bytes]]:
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise RuntimeError(f"could not open video file: {video_path}")
    source_fps = capture.get(cv2.CAP_PROP_FPS) or 0.0
    if source_fps <= 0:
        source_fps = 30.0
    interval = max(1, round(source_fps / sample_fps)) if sample_fps > 0 else 1
    index = 0
    sent = 0
    try:
        while sent < max_frames:
            ok, frame = capture.read()
            if not ok:
                break
            if index % interval == 0:
                timestamp_ms = round(capture.get(cv2.CAP_PROP_POS_MSEC))
                ok_encode, buffer = cv2.imencode(".jpg", frame)
                if not ok_encode:
                    index += 1
                    continue
                yield sent, timestamp_ms, buffer.tobytes()
                sent += 1
            index += 1
    finally:
        capture.release()


def save_overlay(frame_bytes: bytes, landmarks: dict[str, Any], output: Path) -> None:
    image = Image.open(BytesIO(frame_bytes)).convert("RGB")
    draw = ImageDraw.Draw(image)
    for name, color in LANDMARK_COLORS.items():
        point = landmarks.get(name)
        if not isinstance(point, dict) or not point.get("valid"):
            continue
        x = round(float(point["x"]) * image.width)
        y = round(float(point["y"]) * image.height)
        radius = 8
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), outline=color, width=4)
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, format="PNG")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video_path", type=Path, help="Local video file; never commit this path")
    parser.add_argument("--url", default="http://127.0.0.1:8001")
    parser.add_argument("--sample-fps", type=float, default=8.0)
    parser.add_argument("--max-frames", type=int, default=240)
    parser.add_argument(
        "--overlay-dir",
        type=Path,
        default=None,
        help="Optional directory (outside Git) to save a few overlay PNGs for visual review",
    )
    parser.add_argument("--overlay-every", type=int, default=30)
    args = parser.parse_args()
    base_url = args.url.rstrip("/")

    if not args.video_path.is_file():
        print(f"Replay failed: video file not found at {args.video_path}")
        return 1

    try:
        health = request_json(f"{base_url}/health")
    except (HTTPError, URLError, TimeoutError) as exc:
        print(f"Replay failed: cannot reach vision service at {base_url}: {exc}")
        return 1
    if health.get("mode") != "movenet" or health.get("simulated") is not False:
        print(
            "Replay failed: expected real MoveNet mode; "
            f"got mode={health.get('mode')!r}, simulated={health.get('simulated')!r}"
        )
        return 1

    person_detected = 0
    valid_counts = {name: 0 for name in SELECTED_LANDMARKS}
    confidences: dict[str, list[float]] = {name: [] for name in SELECTED_LANDMARKS}
    inference_times: list[float] = []
    total = 0

    for sequence, timestamp_ms, frame_bytes in iter_sampled_frames(
        args.video_path, args.sample_fps, args.max_frames
    ):
        encoded = base64.b64encode(frame_bytes).decode("ascii")
        try:
            result = request_json(
                f"{base_url}/infer",
                {"sequence": sequence, "timestamp_ms": timestamp_ms, "image_b64": encoded},
            )
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            print(f"Replay failed at frame {sequence}: HTTP {exc.code}: {detail}")
            return 1
        except (URLError, TimeoutError) as exc:
            print(f"Replay failed at frame {sequence}: {exc}")
            return 1

        total += 1
        if result.get("person_detected"):
            person_detected += 1
        landmarks = result.get("landmarks", {})
        for name in SELECTED_LANDMARKS:
            point = landmarks.get(name, {})
            if isinstance(point, dict) and point.get("valid"):
                valid_counts[name] += 1
                confidences[name].append(float(point.get("confidence", 0.0)))
        inference_times.append(float(result.get("inference_ms", 0.0)))

        if args.overlay_dir is not None and sequence % args.overlay_every == 0:
            save_overlay(frame_bytes, landmarks, args.overlay_dir / f"frame-{sequence:05d}.png")

    if total == 0:
        print("Replay failed: no frames were read from the video file.")
        return 1

    print(f"frames_sent={total}")
    print(f"person_detected_pct={round(100 * person_detected / total, 1)}")
    for name in SELECTED_LANDMARKS:
        pct = round(100 * valid_counts[name] / total, 1)
        mean_conf = round(statistics.fmean(confidences[name]), 3) if confidences[name] else None
        print(f"{name}: valid_pct={pct} mean_confidence={mean_conf}")
    print(f"mean_inference_ms={round(statistics.fmean(inference_times), 3)}")
    print(
        "This is an engineering wiring/plausibility check on a recorded clip; "
        "it is not clinical validation and does not diagnose, predict recovery, "
        "or assess treatment."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
