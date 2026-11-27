"""MobiPhysio (Harvard Dataverse doi:10.7910/DVN/XSI0QN) metadata helpers.

Pure parsing/labelling utilities for the MobiPhysio video corpus:

* the filename codebook ``E{xx}_P{yy}_A{F|L|R}_V{..}_G{M|F}.mp4``
* the Dataverse file listing (``dataset_metadata.json``) -> download ids
* the physiotherapist EAAQ marking CSV -> per-video execution-accuracy score

Scope note: every value produced here is a dataset-defined annotation of an
observed exercise *execution pattern* recorded by the dataset authors. The EAAQ
average score is "physiotherapist-assessed exercise-execution accuracy" on the
dataset's own 0-100 questionnaire scale. It is not a clinical assessment, a
diagnosis, or any statement about a person's health status, and nothing in this
module may be presented as such.

License: MobiPhysio is published under CC0 1.0 Universal (public domain
dedication); see ml/data/license_review.md.
"""

from __future__ import annotations

import csv
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# --- codebook (MobiPhysio_README.md, "Exercises (9 classes)" + Table 2) ------

EXERCISE_NAMES: dict[str, str] = {
    "E01": "Abduction",
    "E02": "Adduction",
    "E03": "Lateral Rotation",
    "E04": "Medial Rotation",
    "E05": "Circumduction",
    "E06": "Wrist Extension",
    "E07": "Hip Joint Flexion",
    "E08": "Both Leg Flexion",
    "E09": "Back Extension",
}

ANGLE_NAMES: dict[str, str] = {"F": "Front", "L": "Left", "R": "Right"}

VARIATION_NAMES: dict[str, str] = {
    "FL": "Full Light",
    "ML": "Medium Light",
    "LL": "Low Light",
    "LJ": "Low Jitter",
    "HJ": "High Jitter",
    "O": "Occlusion",
    "LR": "Low Resolution",
}

GENDER_NAMES: dict[str, str] = {"M": "Male", "F": "Female"}

LICENSE_CLASS = "commercial_ok"
LICENSE_NAME = "CC0 1.0 Universal"
DATASET_DOI = "doi:10.7910/DVN/XSI0QN"
DATAVERSE_ACCESS_URL = "https://dataverse.harvard.edu/api/access/datafile/{file_id}"

FILENAME_RE = re.compile(
    r"^E(?P<exercise>\d{2})_P(?P<participant>\d{2})_A(?P<angle>[FLR])"
    r"_V(?P<variation>[A-Z]{1,2})_G(?P<gender>[MF])\.mp4$"
)


@dataclass(frozen=True)
class VideoKey:
    """Labels decoded from a MobiPhysio video filename."""

    filename: str
    exercise_code: str
    exercise_name: str
    participant_id: str
    angle_code: str
    angle_name: str
    variation_code: str
    variation_name: str
    gender_code: str


def parse_filename(filename: str) -> VideoKey | None:
    """Decode a MobiPhysio filename, or return ``None`` if it does not match."""
    match = FILENAME_RE.match(filename.strip())
    if match is None:
        return None
    exercise_code = f"E{match.group('exercise')}"
    angle_code = match.group("angle")
    variation_code = match.group("variation")
    return VideoKey(
        filename=filename.strip(),
        exercise_code=exercise_code,
        exercise_name=EXERCISE_NAMES.get(exercise_code, "UNKNOWN"),
        participant_id=f"P{match.group('participant')}",
        angle_code=angle_code,
        angle_name=ANGLE_NAMES.get(angle_code, "UNKNOWN"),
        variation_code=variation_code,
        variation_name=VARIATION_NAMES.get(variation_code, "UNKNOWN"),
        gender_code=match.group("gender"),
    )


@dataclass
class DataverseFile:
    """One downloadable entry from the Dataverse file listing."""

    label: str
    file_id: int
    filesize: int
    md5: str | None
    key: VideoKey | None = None

    @property
    def access_url(self) -> str:
        return DATAVERSE_ACCESS_URL.format(file_id=self.file_id)


def load_dataverse_listing(metadata_path: Path) -> tuple[list[DataverseFile], list[str]]:
    """Load ``dataset_metadata.json``.

    Returns ``(video_files, non_video_labels)``. ``non_video_labels`` holds any
    listing entry whose label does not decode as a MobiPhysio video filename
    (the dataset's own README/CSV, for example) so callers can log it rather
    than silently drop it.
    """
    with metadata_path.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    entries = payload["data"]["files"]
    videos: list[DataverseFile] = []
    others: list[str] = []
    for entry in entries:
        label = str(entry.get("label", "")).strip()
        data_file = entry.get("dataFile", {})
        key = parse_filename(label)
        if key is None:
            others.append(label)
            continue
        checksum = data_file.get("checksum") or {}
        md5 = data_file.get("md5") or (
            checksum.get("value") if str(checksum.get("type", "")).upper() == "MD5" else None
        )
        videos.append(
            DataverseFile(
                label=label,
                file_id=int(data_file["id"]),
                filesize=int(data_file.get("filesize", 0)),
                md5=str(md5) if md5 else None,
                key=key,
            )
        )
    return videos, others


# --- EAAQ physiotherapist marking CSV ---------------------------------------
#
# Layout (observed): two header rows, then three rows per video (one per judge).
# Only the first row of each group carries the video name, the "Average Score"
# and the "Rounding to 2 Decimal" columns; the two continuation rows leave them
# blank. Some groups have a blank video name in the source file - those are
# reported as unparseable rather than guessed.

_EAAQ_NAME_COL = 0
_EAAQ_AVERAGE_COL = 11
_EAAQ_ROUNDED_COL = 12


@dataclass
class EaaqTable:
    """Parsed EAAQ marking CSV."""

    scores: dict[str, float] = field(default_factory=dict)
    unnamed_groups: int = 0
    duplicate_names: list[str] = field(default_factory=list)
    unparseable_scores: list[str] = field(default_factory=list)

    def score_for(self, filename: str) -> float | None:
        """Look up the EAAQ average for a video filename (with or without .mp4)."""
        stem = filename[:-4] if filename.lower().endswith(".mp4") else filename
        return self.scores.get(stem.strip().upper())


def parse_eaaq_csv(csv_path: Path) -> EaaqTable:
    """Parse the physiotherapist EAAQ marking CSV into per-video average scores."""
    table = EaaqTable()
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.reader(handle))
    for row in rows[2:]:
        if not row or len(row) <= _EAAQ_AVERAGE_COL:
            continue
        name = row[_EAAQ_NAME_COL].strip()
        average_raw = row[_EAAQ_AVERAGE_COL].strip()
        rounded_raw = row[_EAAQ_ROUNDED_COL].strip() if len(row) > _EAAQ_ROUNDED_COL else ""
        is_group_start = bool(name) or bool(average_raw)
        if not is_group_start:
            continue  # continuation row for the previous video (judge 2 or 3)
        if not name:
            table.unnamed_groups += 1
            continue
        key = (name[:-4] if name.lower().endswith(".mp4") else name).strip().upper()
        value: float | None = None
        for raw in (average_raw, rounded_raw):
            if not raw:
                continue
            try:
                value = float(raw)
            except ValueError:
                continue
            break
        if value is None:
            table.unparseable_scores.append(name)
            continue
        if key in table.scores:
            table.duplicate_names.append(name)
            continue
        table.scores[key] = value
    return table


def manifest_row(
    key: VideoKey,
    split: str,
    eaaq_score: float | None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build one ``dataset_manifest.csv`` row."""
    row: dict[str, Any] = {
        "filename": key.filename,
        "exercise_code": key.exercise_code,
        "exercise_name": key.exercise_name,
        "participant_id": key.participant_id,
        "angle_code": key.angle_code,
        "angle_name": key.angle_name,
        "variation_code": key.variation_code,
        "variation_name": key.variation_name,
        "gender_code": key.gender_code,
        "eaaq_average_score": "" if eaaq_score is None else f"{eaaq_score:.4f}",
        "split": split,
        "license_class": LICENSE_CLASS,
    }
    if extra:
        row.update(extra)
    return row


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
    "local_path",
]
