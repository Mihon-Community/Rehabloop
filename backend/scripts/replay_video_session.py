"""Replay a local video file through the vision service and movement engine.

Use this to validate end-to-end rep counting against a recorded clip when a
live camera/session flow is unavailable. Only use footage you have rights and
consent to use, and keep it out of Git — see fixtures/approved_test_frames/
README.md. This script bypasses session consent/auth checks and is for local
engineering validation only; it must never be pointed at a deployed service or
anything resembling real patient data. Rep-config angle bands must come from an
actual clinician-approved protocol — this script invents no clinical numbers.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import sys
from collections.abc import Iterator
from pathlib import Path

import cv2

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.schemas.stream import FrameEvent  # noqa: E402
from app.services.movement_engine import MovementEngine, ProjectedPoint, RepConfig  # noqa: E402
from app.services.vision_client import VisionClient, VisionUnavailableError  # noqa: E402

NON_CLINICAL_NOTE = (
    "RehabLoop provides non-clinical measurements; a qualified clinician "
    "interprets this information. This replay bypasses consent/session "
    "checks and is for local engineering validation only."
)


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


async def run(args: argparse.Namespace) -> int:
    config = RepConfig(
        rest_min_deg=args.rest_min_deg,
        rest_max_deg=args.rest_max_deg,
        target_min_deg=args.target_min_deg,
        target_max_deg=args.target_max_deg,
        dwell_ms=args.dwell_ms,
        hold_ms=args.hold_ms,
        min_rep_duration_ms=args.min_rep_duration_ms,
    )
    client = VisionClient(args.vision_url)
    engine: MovementEngine | None = None
    processed = 0
    try:
        for sequence, timestamp_ms, frame_bytes in iter_sampled_frames(
            args.video_path, args.sample_fps, args.max_frames
        ):
            encoded = base64.b64encode(frame_bytes).decode("ascii")
            frame = FrameEvent(
                session_id="local-replay",
                sequence=sequence,
                timestamp_ms=timestamp_ms,
                image_b64=encoded,
            )
            try:
                vision = await client.infer(frame)
            except VisionUnavailableError as exc:
                print(f"Replay failed at frame {sequence}: {exc}")
                return 1
            if engine is None:
                # Match the real session_service: the engine's expected model/mapping
                # versions come from the vision service actually in use, not a guess.
                engine = MovementEngine(
                    rep_config=config,
                    target_reps=args.target_reps,
                    min_confidence=args.min_confidence,
                    smoothing_alpha=args.smoothing_alpha,
                    model_version=vision.model,
                    mapping_version=vision.mapping_version,
                )
            landmarks = {
                name: ProjectedPoint(
                    x=point.x, y=point.y, confidence=point.confidence, valid=point.valid
                )
                for name, point in vision.landmarks.items()
            }
            engine.process(
                landmarks,
                vision.timestamp_ms,
                person_count=1 if vision.person_detected else 0,
                model_version=vision.model,
                mapping_version=vision.mapping_version,
                simulated=vision.simulated,
            )
            processed += 1
    finally:
        await client.aclose()

    if engine is None:
        print("Replay failed: no frames were read from the video file.")
        return 1

    print(f"frames_processed={processed}")
    for key, value in engine.metrics().items():
        print(f"{key}={value}")
    print(f"quality_flags={engine.quality_flags}")
    print(NON_CLINICAL_NOTE)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video_path", type=Path)
    parser.add_argument("--vision-url", default="http://127.0.0.1:8001")
    parser.add_argument("--sample-fps", type=float, default=8.0)
    parser.add_argument("--max-frames", type=int, default=240)
    parser.add_argument("--target-reps", type=int, required=True)
    parser.add_argument("--rest-min-deg", type=float, required=True)
    parser.add_argument("--rest-max-deg", type=float, required=True)
    parser.add_argument("--target-min-deg", type=float, required=True)
    parser.add_argument("--target-max-deg", type=float, required=True)
    parser.add_argument("--dwell-ms", type=int, default=200)
    parser.add_argument("--hold-ms", type=int, default=400)
    parser.add_argument("--min-rep-duration-ms", type=int, default=250)
    parser.add_argument("--min-confidence", type=float, default=0.6)
    parser.add_argument("--smoothing-alpha", type=float, default=0.4)
    args = parser.parse_args()

    if not args.video_path.is_file():
        print(f"Replay failed: video file not found at {args.video_path}")
        return 1
    return asyncio.run(run(args))


if __name__ == "__main__":
    raise SystemExit(main())
