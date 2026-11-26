"""Write a short, fully synthetic .mp4 from the existing validated seated-figure frame.

Every frame reuses the same generated drawing already relied on by
synthetic_movenet_smoke.py / synthetic_movenet_overlay.py for real MoveNet
wiring checks. No camera, video file, or patient data is read or produced;
this exists only to give the video-file replay scripts something to read.
"""

from __future__ import annotations

import argparse
import base64
import sys
from io import BytesIO
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from synthetic_movenet_smoke import synthetic_frame


def decoded_frame_array() -> np.ndarray:
    encoded = synthetic_frame()
    image = Image.open(BytesIO(base64.b64decode(encoded))).convert("RGB")
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--frames", type=int, default=24)
    parser.add_argument("--fps", type=float, default=8.0)
    args = parser.parse_args()

    frame = decoded_frame_array()
    height, width = frame.shape[:2]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    writer = cv2.VideoWriter(
        str(args.output), cv2.VideoWriter_fourcc(*"mp4v"), args.fps, (width, height)
    )
    if not writer.isOpened():
        print(f"Failed to open video writer for {args.output}")
        return 1
    for _ in range(args.frames):
        writer.write(frame)
    writer.release()
    print(f"wrote {args.frames} frames to {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
