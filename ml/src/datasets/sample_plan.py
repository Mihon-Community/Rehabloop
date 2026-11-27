"""Bounded, participant-split MobiPhysio sample plan (Phase 1).

Why a sample and not the whole corpus
-------------------------------------
The published MobiPhysio corpus is 3,686 videos / ~159 GB. Phase 1 needs
enough data for a first honest baseline, not the whole archive, and the
download budget for this phase is 40 GB. This plan selects ~674 videos
(~24.7 GB, ~62% of budget) by:

1. **Participant-disjoint splits** (the dataset's own recommended protocol):
   every video of a participant lands in exactly one of train/val/test.
2. **Full 9-exercise coverage** for the core participants, so train/val/test
   all cover all nine exercise classes.
3. **A fixed 3-variation subset** - ``FL`` (Full Light, the clean baseline),
   ``LL`` (Low Light) and ``O`` (Occlusion) - kept for *all* 3 camera angles
   and *all* 9 exercises. This keeps one clean condition plus two different
   real-world stress axes (illumination, occlusion) while dropping the two
   most expensive variations (``HJ``/``LJ`` jitter average ~65 MB/clip vs
   ~44 MB for the retained set). Jitter and Low Resolution are deliberately
   left for a later phase; that gap is recorded in dataset_report.md.
4. **A documented gender supplement.** Every participant with full
   9-exercise coverage in MobiPhysio is male - the female participants were
   only recorded for E01-E06. P09 and P10 (female, E01-E06) are therefore
   added to *train only* so the training data is not single-gender. Val/test
   stay full-coverage held-out participants, and the resulting all-male
   val/test limitation is recorded in dataset_report.md.

Changing these constants changes the dataset; do it deliberately and re-run
``build_sample_plan`` so ml/data/sample_plan.csv stays the record of intent.
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(Path(__file__).resolve().parents[1]) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from datasets.mobiphysio import (  # noqa: E402
    DataverseFile,
    load_dataverse_listing,
    parse_eaaq_csv,
)

# Variation codes kept for every selected participant, angle and exercise.
SELECTED_VARIATIONS: tuple[str, ...] = ("FL", "LL", "O")

# Participant -> split. Participant-disjoint by construction.
PARTICIPANT_SPLITS: dict[str, str] = {
    # train, full 9-exercise coverage (all male - see module docstring)
    "P02": "train",
    "P04": "train",
    "P05": "train",
    "P07": "train",
    "P08": "train",
    # train, female, E01-E06 only (gender supplement, train only)
    "P09": "train",
    "P10": "train",
    # held-out, full 9-exercise coverage
    "P21": "val",
    "P22": "test",
}

DOWNLOAD_BUDGET_BYTES = 40 * 1000**3

PLAN_COLUMNS = [
    "filename",
    "file_id",
    "filesize_bytes",
    "md5",
    "exercise_code",
    "participant_id",
    "angle_code",
    "variation_code",
    "gender_code",
    "split",
    "eaaq_average_score",
    "access_url",
]


def select_files(videos: list[DataverseFile]) -> list[DataverseFile]:
    """Filter the full listing down to the planned sample, sorted by filename."""
    chosen = [
        video
        for video in videos
        if video.key is not None
        and video.key.participant_id in PARTICIPANT_SPLITS
        and video.key.variation_code in SELECTED_VARIATIONS
    ]
    chosen.sort(key=lambda video: video.label)
    return chosen


def build_plan_rows(metadata_path: Path, eaaq_path: Path) -> list[dict[str, object]]:
    videos, _others = load_dataverse_listing(metadata_path)
    eaaq = parse_eaaq_csv(eaaq_path)
    rows: list[dict[str, object]] = []
    for video in select_files(videos):
        key = video.key
        assert key is not None
        score = eaaq.score_for(key.filename)
        rows.append(
            {
                "filename": key.filename,
                "file_id": video.file_id,
                "filesize_bytes": video.filesize,
                "md5": video.md5 or "",
                "exercise_code": key.exercise_code,
                "participant_id": key.participant_id,
                "angle_code": key.angle_code,
                "variation_code": key.variation_code,
                "gender_code": key.gender_code,
                "split": PARTICIPANT_SPLITS[key.participant_id],
                "eaaq_average_score": "" if score is None else f"{score:.4f}",
                "access_url": video.access_url,
            }
        )
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--raw-dir",
        type=Path,
        default=REPO_ROOT / "ml" / "data" / "raw" / "mobiphysio",
        help="Directory holding dataset_metadata.json and the EAAQ CSV",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=REPO_ROOT / "ml" / "data" / "sample_plan.csv",
    )
    args = parser.parse_args()

    metadata_path = args.raw_dir / "dataset_metadata.json"
    eaaq_path = args.raw_dir / "Physiotherapist_Exercise_Marking.csv"
    for path in (metadata_path, eaaq_path):
        if not path.is_file():
            print(f"missing required input: {path}")
            return 1

    rows = build_plan_rows(metadata_path, eaaq_path)
    if not rows:
        print("plan is empty - check SELECTED_VARIATIONS / PARTICIPANT_SPLITS")
        return 1

    total_bytes = sum(int(row["filesize_bytes"]) for row in rows)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=PLAN_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    by_split: dict[str, list[dict[str, object]]] = {}
    for row in rows:
        by_split.setdefault(str(row["split"]), []).append(row)
    print(f"planned videos: {len(rows)}")
    print(f"planned bytes: {total_bytes} ({total_bytes / 1000**3:.2f} GB)")
    print(f"budget: {DOWNLOAD_BUDGET_BYTES / 1000**3:.0f} GB")
    for split in ("train", "val", "test"):
        split_rows = by_split.get(split, [])
        split_bytes = sum(int(row["filesize_bytes"]) for row in split_rows)
        participants = sorted({str(row["participant_id"]) for row in split_rows})
        print(
            f"  {split}: {len(split_rows)} videos, {split_bytes / 1000**3:.2f} GB, "
            f"participants={','.join(participants)}"
        )
    scored = sum(1 for row in rows if row["eaaq_average_score"])
    print(f"EAAQ score available for {scored}/{len(rows)} planned videos")
    if total_bytes > DOWNLOAD_BUDGET_BYTES:
        print("ABORT: plan exceeds the download budget; shrink the selection")
        return 2
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
