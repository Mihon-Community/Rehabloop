"""Batch-extract full COCO-17 MoveNet keypoint sequences for the MobiPhysio sample.

Reads the Phase 1 sample plan and download status, runs the production
``MoveNetRunner`` (see ``movenet_sequence_extractor``) over every successfully
downloaded video, and writes one labelled ``.npz`` sequence per video plus an
index CSV.

Output layout (ml/data/processed/mobiphysio_movenet/)
-----------------------------------------------------
``{split}/{video_stem}.npz`` per video, each containing:

* ``keypoints``      float32 ``[T, 17, 3]`` - ``(x_norm, y_norm, confidence)``
                     in COCO-17 order; confidence is preserved verbatim and no
                     threshold is applied.
* ``frame_indices``  int32 ``[T]`` - index of each sample in the source video
* ``timestamps_ms``  int32 ``[T]`` - source presentation timestamps
* ``keypoint_names`` the 17 COCO names, in array order
* ``meta``           a JSON string with every label for the clip (exercise code
                     and name, participant, camera angle, variation, gender,
                     EAAQ average score, split, licence class, sampling config,
                     source video properties and the production confidence gate)

One file per video (rather than one big tensor) keeps extraction resumable and
safely parallel across processes, and lets a later phase load only the split it
needs. ``sequence_index.csv`` is the flat index over all of them.

CPU only. No training happens here - this is feature extraction.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = Path(__file__).resolve().parents[1]
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from datasets.mobiphysio import (  # noqa: E402
    DATASET_DOI,
    LICENSE_CLASS,
    LICENSE_NAME,
    parse_filename,
)
from pose_estimation.movenet_sequence_extractor import (  # noqa: E402
    COCO17_KEYPOINT_NAMES,
    DEFAULT_MAX_FRAMES,
    DEFAULT_SAMPLE_FPS,
    build_runner,
    extract_sequence,
    production_confidence_gate,
)

DEFAULT_MODEL_PATH = Path("C:/movenet-host/movenet_singlepose_lightning.tflite")

INDEX_COLUMNS = [
    "filename",
    "split",
    "exercise_code",
    "exercise_name",
    "participant_id",
    "angle_code",
    "variation_code",
    "gender_code",
    "eaaq_average_score",
    "license_class",
    "sequence_path",
    "frames",
    "source_frame_count",
    "source_fps",
    "frame_width",
    "frame_height",
    "mean_confidence",
    "frames_above_gate_pct",
    "decode_failures",
    "status",
    "detail",
]


@dataclass
class Task:
    filename: str
    video_path: Path
    out_path: Path
    labels: dict[str, str]


# One runner per worker process; LiteRT models are not safe to share across forks.
_RUNNER = None
_GATE = 0.6
_SAMPLE_FPS = DEFAULT_SAMPLE_FPS
_MAX_FRAMES = DEFAULT_MAX_FRAMES
_MODEL_PATH = str(DEFAULT_MODEL_PATH)


def _init_worker(model_path: str, gate: float, sample_fps: float, max_frames: int) -> None:
    global _RUNNER, _GATE, _SAMPLE_FPS, _MAX_FRAMES, _MODEL_PATH
    _MODEL_PATH = model_path
    _GATE = gate
    _SAMPLE_FPS = sample_fps
    _MAX_FRAMES = max_frames
    _RUNNER = build_runner(model_path)


def _process(task: Task) -> dict[str, object]:
    row: dict[str, object] = dict(task.labels)
    row["filename"] = task.filename
    row["sequence_path"] = ""
    row["frames"] = 0
    row["source_frame_count"] = 0
    row["source_fps"] = ""
    row["frame_width"] = 0
    row["frame_height"] = 0
    row["mean_confidence"] = ""
    row["frames_above_gate_pct"] = ""
    row["decode_failures"] = 0
    row["status"] = "failed"
    row["detail"] = ""

    assert _RUNNER is not None
    try:
        sequence = extract_sequence(
            _RUNNER, task.video_path, sample_fps=_SAMPLE_FPS, max_frames=_MAX_FRAMES
        )
    except Exception as exc:  # noqa: BLE001 - a bad clip must be logged, not fatal
        row["detail"] = f"{type(exc).__name__}: {exc}"
        row["status"] = "unreadable"
        return row

    row["source_frame_count"] = sequence.source_frame_count
    row["source_fps"] = f"{sequence.source_fps:.3f}"
    row["frame_width"] = sequence.frame_width
    row["frame_height"] = sequence.frame_height
    row["decode_failures"] = sequence.decode_failures
    row["frames"] = sequence.length

    if sequence.length == 0:
        row["detail"] = "no frames decoded from the video"
        row["status"] = "empty"
        return row

    gate_pct = float(np.mean(sequence.keypoints[:, :, 2] >= _GATE) * 100.0)
    row["mean_confidence"] = f"{sequence.mean_confidence:.4f}"
    row["frames_above_gate_pct"] = f"{gate_pct:.2f}"

    meta = dict(task.labels)
    meta.update(
        {
            "filename": task.filename,
            "dataset": "MobiPhysio",
            "dataset_doi": DATASET_DOI,
            "license": LICENSE_NAME,
            "license_class": LICENSE_CLASS,
            "keypoint_format": "COCO-17",
            "keypoint_order": list(COCO17_KEYPOINT_NAMES),
            "coordinate_space": "normalised to source frame width/height",
            "pose_model": "movenet-singlepose-lightning (LiteRT, CPU)",
            "pose_model_path": _MODEL_PATH,
            "pose_model_source": "vision_service/app/movenet_runner.py MoveNetRunner (imported)",
            "sample_fps": _SAMPLE_FPS,
            "max_frames": _MAX_FRAMES,
            "production_confidence_gate": _GATE,
            "confidence_gate_applied": False,
            "source_fps": sequence.source_fps,
            "source_frame_count": sequence.source_frame_count,
            "frame_width": sequence.frame_width,
            "frame_height": sequence.frame_height,
            "decode_failures": sequence.decode_failures,
            "extracted_utc": datetime.now(UTC).isoformat(timespec="seconds"),
            "note": (
                "Numeric keypoint measurements of a dataset-defined exercise "
                "movement pattern. The EAAQ score is physiotherapist-assessed "
                "exercise-execution accuracy on the dataset's own 0-100 "
                "questionnaire scale; it is not a clinical assessment and carries "
                "no diagnostic, injury, recovery or progression meaning."
            ),
        }
    )

    task.out_path.parent.mkdir(parents=True, exist_ok=True)
    # numpy appends ".npz" unless the path already ends in it, so the temp name
    # must keep that extension for the atomic replace below to work.
    temporary = task.out_path.with_suffix(".tmp.npz")
    np.savez_compressed(
        temporary,
        keypoints=sequence.keypoints,
        frame_indices=sequence.frame_indices,
        timestamps_ms=sequence.timestamps_ms,
        keypoint_names=np.array(COCO17_KEYPOINT_NAMES),
        meta=np.array(json.dumps(meta)),
    )
    temporary.replace(task.out_path)
    row["sequence_path"] = str(task.out_path.relative_to(REPO_ROOT)).replace("\\", "/")
    row["status"] = "ok"
    return row


def load_tasks(
    plan_path: Path,
    status_path: Path,
    videos_dir: Path,
    out_dir: Path,
    overwrite: bool,
) -> tuple[list[Task], list[dict[str, object]]]:
    with plan_path.open(encoding="utf-8", newline="") as handle:
        plan = list(csv.DictReader(handle))
    obtained: set[str] = set()
    if status_path.is_file():
        with status_path.open(encoding="utf-8", newline="") as handle:
            for row in csv.DictReader(handle):
                if row["status"] in ("ok", "skipped_existing"):
                    obtained.add(row["filename"])

    tasks: list[Task] = []
    skipped: list[dict[str, object]] = []
    for row in plan:
        filename = row["filename"]
        key = parse_filename(filename)
        if key is None:
            continue
        labels = {
            "split": row["split"],
            "exercise_code": key.exercise_code,
            "exercise_name": key.exercise_name,
            "participant_id": key.participant_id,
            "angle_code": key.angle_code,
            "variation_code": key.variation_code,
            "gender_code": key.gender_code,
            "eaaq_average_score": row.get("eaaq_average_score", ""),
            "license_class": LICENSE_CLASS,
        }
        video_path = videos_dir / filename
        out_path = out_dir / row["split"] / f"{filename[:-4]}.npz"

        if not video_path.is_file():
            base = dict(labels)
            base.update(
                {
                    "filename": filename,
                    "sequence_path": "",
                    "frames": 0,
                    "source_frame_count": 0,
                    "source_fps": "",
                    "frame_width": 0,
                    "frame_height": 0,
                    "mean_confidence": "",
                    "frames_above_gate_pct": "",
                    "decode_failures": 0,
                    "status": "missing_download" if filename not in obtained else "missing_file",
                    "detail": "planned video not present on disk",
                }
            )
            skipped.append(base)
            continue
        if out_path.is_file() and not overwrite:
            continue
        tasks.append(Task(filename, video_path, out_path, labels))
    return tasks, skipped


def read_existing_index(index_path: Path) -> dict[str, dict[str, object]]:
    if not index_path.is_file():
        return {}
    with index_path.open(encoding="utf-8", newline="") as handle:
        return {row["filename"]: dict(row) for row in csv.DictReader(handle)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, default=REPO_ROOT / "ml" / "data" / "sample_plan.csv")
    parser.add_argument(
        "--status-csv", type=Path, default=REPO_ROOT / "ml" / "data" / "download_status.csv"
    )
    parser.add_argument(
        "--videos-dir",
        type=Path,
        default=REPO_ROOT / "ml" / "data" / "raw" / "mobiphysio" / "videos",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=REPO_ROOT / "ml" / "data" / "processed" / "mobiphysio_movenet",
    )
    parser.add_argument("--model-path", type=Path, default=DEFAULT_MODEL_PATH)
    parser.add_argument("--sample-fps", type=float, default=DEFAULT_SAMPLE_FPS)
    parser.add_argument("--max-frames", type=int, default=DEFAULT_MAX_FRAMES)
    parser.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 4) - 4))
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    if not args.model_path.is_file():
        print(f"MoveNet model not found at {args.model_path}")
        return 1
    if not args.plan.is_file():
        print(f"missing plan: {args.plan}")
        return 1

    gate = production_confidence_gate()
    tasks, skipped = load_tasks(
        args.plan, args.status_csv, args.videos_dir, args.out_dir, args.overwrite
    )
    if args.limit:
        tasks = tasks[: args.limit]
    print(
        f"extracting {len(tasks)} sequences at {args.sample_fps} fps "
        f"(max {args.max_frames} frames/clip) with {args.workers} workers; "
        f"{len(skipped)} planned videos not on disk"
    )
    if not tasks and not skipped:
        print("nothing to do")
        return 0

    index_path = args.out_dir / "sequence_index.csv"
    rows = read_existing_index(index_path)
    started = time.time()
    results: list[dict[str, object]] = []

    if tasks:
        if args.workers <= 1:
            _init_worker(str(args.model_path), gate, args.sample_fps, args.max_frames)
            for done, task in enumerate(tasks, start=1):
                results.append(_process(task))
                if done % 10 == 0 or done == len(tasks):
                    print(f"[{done}/{len(tasks)}] {time.time() - started:.0f}s", flush=True)
        else:
            from concurrent.futures import ProcessPoolExecutor

            with ProcessPoolExecutor(
                max_workers=args.workers,
                initializer=_init_worker,
                initargs=(str(args.model_path), gate, args.sample_fps, args.max_frames),
            ) as pool:
                for done, row in enumerate(pool.map(_process, tasks, chunksize=1), start=1):
                    results.append(row)
                    if row["status"] != "ok":
                        print(f"  {row['status']}: {row['filename']} {row['detail']}", flush=True)
                    if done % 25 == 0 or done == len(tasks):
                        rate = done / max(1e-6, time.time() - started)
                        print(
                            f"[{done}/{len(tasks)}] {time.time() - started:.0f}s "
                            f"({rate:.2f} clips/s)",
                            flush=True,
                        )

    for row in results + skipped:
        rows[str(row["filename"])] = row

    args.out_dir.mkdir(parents=True, exist_ok=True)
    with index_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=INDEX_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for filename in sorted(rows):
            writer.writerow(rows[filename])

    statuses: dict[str, int] = {}
    for row in rows.values():
        statuses[str(row["status"])] = statuses.get(str(row["status"]), 0) + 1
    print(f"index: {index_path} ({len(rows)} rows)")
    print("status counts:", dict(sorted(statuses.items())))
    print(f"elapsed {(time.time() - started) / 60:.1f} min")
    return 0


if __name__ == "__main__":
    sys.exit(main())
