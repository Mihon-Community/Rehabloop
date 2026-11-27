"""Build ml/data/dataset_manifest.csv and ml/data/dataset_report.md.

Merges three records into the Phase 1 deliverables:

* ``ml/data/sample_plan.csv``      - what was intended (see ``sample_plan.py``)
* ``ml/data/download_status.csv``  - what was actually obtained and verified
* ``ml/data/processed/mobiphysio_movenet/sequence_index.csv`` - what extracted

Everything intended is reported, including gaps: a planned video that failed to
download or failed to decode keeps its manifest row with a ``download_status`` /
``extraction_status`` that says so, rather than disappearing.

Nothing here makes any clinical claim. The EAAQ column is the dataset's own
physiotherapist-assessed exercise-execution accuracy score (0-100).
"""

from __future__ import annotations

import argparse
import csv
import statistics
import sys
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = Path(__file__).resolve().parents[1]
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from datasets.mobiphysio import (  # noqa: E402
    EXERCISE_NAMES,
    LICENSE_CLASS,
    VARIATION_NAMES,
    parse_filename,
)
from datasets.sample_plan import PARTICIPANT_SPLITS, SELECTED_VARIATIONS  # noqa: E402

# Cap how many individual bad files the report lists inline; the full picture is
# always in download_status.csv / dataset_manifest.csv.
LIST_LIMIT = 40

MANIFEST_COLUMNS = [
    "filename",
    "exercise_code",
    "exercise_name",
    "participant_id",
    "angle_code",
    "angle_name",
    "variation_code",
    "variation_name",
    "gender_code",
    "eaaq_average_score",
    "split",
    "license_class",
    "file_id",
    "filesize_bytes",
    "download_status",
    "extraction_status",
    "sequence_path",
    "sequence_frames",
    "mean_keypoint_confidence",
]


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.is_file():
        return []
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def build_rows(plan_path: Path, status_path: Path, index_path: Path) -> list[dict[str, str]]:
    status = {row["filename"]: row for row in read_csv(status_path)}
    index = {row["filename"]: row for row in read_csv(index_path)}
    rows: list[dict[str, str]] = []
    for planned in read_csv(plan_path):
        filename = planned["filename"]
        key = parse_filename(filename)
        if key is None:
            continue
        download = status.get(filename, {})
        extraction = index.get(filename, {})
        rows.append(
            {
                "filename": filename,
                "exercise_code": key.exercise_code,
                "exercise_name": key.exercise_name,
                "participant_id": key.participant_id,
                "angle_code": key.angle_code,
                "angle_name": key.angle_name,
                "variation_code": key.variation_code,
                "variation_name": key.variation_name,
                "gender_code": key.gender_code,
                "eaaq_average_score": planned.get("eaaq_average_score", ""),
                "split": planned["split"],
                "license_class": LICENSE_CLASS,
                "file_id": planned["file_id"],
                "filesize_bytes": planned["filesize_bytes"],
                "download_status": download.get("status", "not_attempted"),
                "extraction_status": extraction.get("status", "not_extracted"),
                "sequence_path": extraction.get("sequence_path", ""),
                "sequence_frames": extraction.get("frames", ""),
                "mean_keypoint_confidence": extraction.get("mean_confidence", ""),
            }
        )
    rows.sort(key=lambda row: row["filename"])
    return rows


def _table(header: list[str], body: list[list[str]]) -> list[str]:
    lines = ["| " + " | ".join(header) + " |", "|" + "|".join(["---"] * len(header)) + "|"]
    lines.extend("| " + " | ".join(cells) + " |" for cells in body)
    return lines


def build_report(rows: list[dict[str, str]], index_path: Path) -> str:
    total = len(rows)
    ok_download = [r for r in rows if r["download_status"] in ("ok", "skipped_existing")]
    ok_names = {r["filename"] for r in ok_download}
    bad_download = [r for r in rows if r["filename"] not in ok_names]
    ok_extract = [r for r in rows if r["extraction_status"] == "ok"]
    bad_extract = [r for r in ok_download if r["extraction_status"] not in ("ok",)]
    total_bytes = sum(int(r["filesize_bytes"] or 0) for r in ok_download)

    confidences = [
        float(r["mean_keypoint_confidence"]) for r in ok_extract if r["mean_keypoint_confidence"]
    ]
    frames = [int(r["sequence_frames"]) for r in ok_extract if r["sequence_frames"]]
    scores = [float(r["eaaq_average_score"]) for r in ok_extract if r["eaaq_average_score"]]

    by_split: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in ok_extract:
        by_split[row["split"]].append(row)

    now = datetime.now(UTC).isoformat(timespec="seconds")
    lines: list[str] = [
        "# MobiPhysio Phase 1 dataset report",
        "",
        f"Generated {now} (UTC).",
        "",
        "Source: MobiPhysio v1.1, Harvard Dataverse `doi:10.7910/DVN/XSI0QN`, "
        "CC0 1.0 Universal (`license_class: commercial_ok`). Licence detail and the "
        "Kaggle WLU blocker are in `ml/data/license_review.md`.",
        "",
        "Scope: this is a non-clinical, numeric movement-measurement dataset of "
        "dataset-defined exercise categories. The EAAQ column is the dataset's own "
        "physiotherapist-assessed exercise-execution accuracy score on its 0-100 "
        "questionnaire scale. Nothing here describes any person's health status, "
        "injury, danger, recovery, prognosis or clinical progression, and no "
        "treatment or exercise target is implied.",
        "",
        "## Headline counts",
        "",
        f"- Planned videos: **{total}**",
        f"- Downloaded and checksum-verified: **{len(ok_download)}** "
        f"({total_bytes / 1000**3:.2f} GB on disk)",
        f"- Download gaps: **{len(bad_download)}**",
        f"- Keypoint sequences extracted: **{len(ok_extract)}**",
        f"- Videos obtained but not extractable: **{len(bad_extract)}**",
        f"- Participants: **{len({r['participant_id'] for r in ok_extract})}** "
        f"(participant-disjoint splits)",
        "",
    ]
    if frames:
        lines += [
            f"- Sampled frames per clip: min {min(frames)}, median "
            f"{int(statistics.median(frames))}, max {max(frames)}; "
            f"total {sum(frames):,} pose frames.",
        ]
    if confidences:
        lines += [
            f"- Mean MoveNet keypoint confidence across clips: "
            f"{statistics.fmean(confidences):.3f} "
            f"(min {min(confidences):.3f}, max {max(confidences):.3f}).",
        ]
    if scores:
        lines += [
            f"- EAAQ average score present for {len(scores)}/{len(ok_extract)} extracted "
            f"clips; range {min(scores):.2f}-{max(scores):.2f}, "
            f"mean {statistics.fmean(scores):.2f}.",
        ]
    lines.append("")

    lines += ["## Split assignment (participant-disjoint)", ""]
    body = []
    for split in ("train", "val", "test"):
        split_rows = by_split.get(split, [])
        participants = sorted({r["participant_id"] for r in split_rows})
        exercises = sorted({r["exercise_code"] for r in split_rows})
        body.append(
            [
                split,
                str(len(split_rows)),
                str(len(participants)),
                ", ".join(participants) or "-",
                f"{len(exercises)}/9",
            ]
        )
    lines += _table(["split", "videos", "participants", "participant ids", "exercises"], body)
    lines.append("")
    lines.append(
        "No participant appears in more than one split, per the dataset's own "
        'recommended protocol (`MobiPhysio_README.md`, "Recommended evaluation '
        'protocol").'
    )
    lines.append("")

    lines += ["## Videos per exercise class and split", ""]
    counts: dict[tuple[str, str], int] = Counter(
        (row["exercise_code"], row["split"]) for row in ok_extract
    )
    body = []
    for code in sorted(EXERCISE_NAMES):
        train = counts.get((code, "train"), 0)
        val = counts.get((code, "val"), 0)
        test = counts.get((code, "test"), 0)
        body.append(
            [code, EXERCISE_NAMES[code], str(train), str(val), str(test), str(train + val + test)]
        )
    lines += _table(["code", "exercise", "train", "val", "test", "total"], body)
    lines.append("")

    lines += ["## Videos per camera angle and variation", ""]
    angle_counts = Counter(row["angle_name"] for row in ok_extract)
    variation_counts = Counter(row["variation_code"] for row in ok_extract)
    lines += _table(
        ["camera angle", "videos"],
        [[name, str(count)] for name, count in sorted(angle_counts.items())],
    )
    lines.append("")
    lines += _table(
        ["variation", "meaning", "videos"],
        [
            [code, VARIATION_NAMES.get(code, "?"), str(count)]
            for code, count in sorted(variation_counts.items())
        ],
    )
    lines.append("")

    lines += ["## Gender distribution of recorded participants", ""]
    gender_rows = []
    for split in ("train", "val", "test"):
        split_rows = by_split.get(split, [])
        counter = Counter(r["gender_code"] for r in split_rows)
        participants = {(r["participant_id"], r["gender_code"]) for r in split_rows}
        gender_rows.append(
            [
                split,
                str(counter.get("M", 0)),
                str(counter.get("F", 0)),
                str(sum(1 for _, g in participants if g == "M")),
                str(sum(1 for _, g in participants if g == "F")),
            ]
        )
    lines += _table(
        ["split", "videos (M)", "videos (F)", "participants (M)", "participants (F)"],
        gender_rows,
    )
    lines.append("")

    lines += ["## Corrupted, unreadable or missing files", ""]
    if not bad_download and not bad_extract:
        lines.append(
            "None. Every planned video downloaded with a matching published MD5, and "
            "every downloaded video decoded and produced a keypoint sequence."
        )
    else:
        if bad_download:
            lines.append(f"### Download gaps ({len(bad_download)})")
            lines.append("")
            for row in bad_download[:LIST_LIMIT]:
                lines.append(
                    f"- `{row['filename']}` (file id {row['file_id']}): "
                    f"download_status=`{row['download_status']}`"
                )
            if len(bad_download) > LIST_LIMIT:
                lines.append(
                    f"- ...and {len(bad_download) - LIST_LIMIT} more; the complete "
                    "per-file outcome is in `ml/data/download_status.csv` and the "
                    "`download_status` column of `ml/data/dataset_manifest.csv`."
                )
            lines.append("")
        if bad_extract:
            lines.append(f"### Downloaded but not extractable ({len(bad_extract)})")
            lines.append("")
            for row in bad_extract[:LIST_LIMIT]:
                lines.append(
                    f"- `{row['filename']}`: extraction_status=`{row['extraction_status']}`"
                )
            if len(bad_extract) > LIST_LIMIT:
                lines.append(
                    f"- ...and {len(bad_extract) - LIST_LIMIT} more; see the "
                    "`extraction_status` column of `ml/data/dataset_manifest.csv`."
                )
            lines.append("")
    lines.append("")

    lines += [
        "## Gaps versus the intended sample",
        "",
        "These are deliberate bounds of the Phase 1 sample, not errors:",
        "",
        f"- **Variation subset.** Only `{'`, `'.join(SELECTED_VARIATIONS)}` were "
        "downloaded (one clean baseline plus illumination and occlusion stress). "
        "The jitter variations (`LJ`, `HJ`) and `LR` (Low Resolution) are not in "
        "this sample; `LJ`/`HJ` are the two largest variations on disk and were "
        "dropped to stay inside the 40 GB download budget. Any robustness claim "
        "about camera jitter or low resolution is therefore out of scope here.",
        f"- **Participant subset.** {len(PARTICIPANT_SPLITS)} of MobiPhysio's 58 "
        "participants are included. Participants with sparse exercise coverage "
        "(roughly P24-P62) are excluded so every split covers the full label set.",
        "- **Val/test are male-only.** Every MobiPhysio participant with full "
        "9-exercise coverage is male; female participants were recorded for E01-E06 "
        "only. Two female participants (P09, P10) are therefore in **train only**, "
        "and the held-out val/test participants are male. Cross-gender "
        "generalisation cannot be measured from this sample and must not be claimed.",
        "- **E07-E09 have no female examples at all** in this sample, for the same " "reason.",
        "- **One held-out participant per split.** Val and test are a single "
        "participant each (P21, P22), so split-level metrics will carry wide "
        "participant-level uncertainty. A later phase should widen the held-out "
        "sets before any result is treated as a generalisation estimate.",
        "",
    ]

    lines += [
        "## Pose features",
        "",
        "Extraction reuses the production pose stack unchanged: "
        "`vision_service/app/movenet_runner.py`'s `MoveNetRunner` is imported and "
        "called directly on the same MoveNet SinglePose Lightning `.tflite` weights, "
        "with the same resize-and-pad preprocessing and the same OpenCV JPEG frame "
        "path the live replay client uses. The offline path keeps all 17 COCO "
        "keypoints rather than the three named knee-extension landmarks the `/infer` "
        "API exposes; nothing under `vision_service/app/` was modified.",
        "",
        "Per-keypoint confidence is stored verbatim and no confidence gate is "
        "applied; the production gate value (0.6) is recorded in each sequence's "
        "metadata so a later phase can apply it explicitly.",
        "",
        f"Per-clip extraction detail (frames, source fps/resolution, mean confidence, "
        f"share of keypoints at or above the production gate, decode failures) is in "
        f"`{index_path.relative_to(REPO_ROOT).as_posix()}`.",
        "",
    ]
    if confidences:
        low = [
            r
            for r in ok_extract
            if r["mean_keypoint_confidence"] and float(r["mean_keypoint_confidence"]) < 0.4
        ]
        lines += [
            "### Measurement-quality observation",
            "",
            f"{len(low)} of {len(ok_extract)} extracted clips have a mean keypoint "
            "confidence below 0.40. MoveNet SinglePose Lightning takes a 192x192 "
            "input and expects the person to fill much of the frame; MobiPhysio was "
            "recorded as wide full-room smartphone shots where the participant "
            "occupies a small part of the image. This is a pose-measurement quality "
            "limit of the production model on this footage, not a property of the "
            "exercises. It is recorded here as an input-quality caveat for the next "
            "phase; no crop, upscale or alternative pose model was introduced, "
            "because Phase 1 is required to keep the production pose preprocessing "
            "byte-for-byte identical.",
            "",
        ]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    data_dir = REPO_ROOT / "ml" / "data"
    parser.add_argument("--plan", type=Path, default=data_dir / "sample_plan.csv")
    parser.add_argument("--status-csv", type=Path, default=data_dir / "download_status.csv")
    parser.add_argument(
        "--index-csv",
        type=Path,
        default=data_dir / "processed" / "mobiphysio_movenet" / "sequence_index.csv",
    )
    parser.add_argument("--manifest", type=Path, default=data_dir / "dataset_manifest.csv")
    parser.add_argument("--report", type=Path, default=data_dir / "dataset_report.md")
    args = parser.parse_args()

    rows = build_rows(args.plan, args.status_csv, args.index_csv)
    if not rows:
        print("no planned rows found")
        return 1
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    with args.manifest.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=MANIFEST_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    args.report.write_text(build_report(rows, args.index_csv), encoding="utf-8")
    print(f"wrote {args.manifest} ({len(rows)} rows)")
    print(f"wrote {args.report}")
    print("download_status:", dict(sorted(Counter(r["download_status"] for r in rows).items())))
    print("extraction_status:", dict(sorted(Counter(r["extraction_status"] for r in rows).items())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
