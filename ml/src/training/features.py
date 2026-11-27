"""Fixed-length clip features from variable-length COCO-17 keypoint sequences.

Phase 1 wrote one ``.npz`` per clip under
``ml/data/processed/mobiphysio_movenet/{split}/`` holding ``keypoints``
float32 ``[T, 17, 3]`` (x_norm, y_norm, confidence) with ``T`` between 39 and
320 frames. A classical classifier needs one fixed-length vector per clip, so
this module summarises each sequence into per-keypoint position/spread/motion
statistics plus a few whole-clip descriptors.

Design constraints, deliberately chosen for ~512 training clips:

* Feature count stays in the tens-to-low-hundreds range, never thousands.
  Two sizes are offered (``compact`` ~60, ``full`` ~145) so the smaller one
  can be selected on validation data if the larger overfits.
* Every statistic is confidence-weighted. MoveNet SinglePose Lightning always
  emits 17 coordinates whether or not it found the joint, so an unweighted mean
  silently averages in coordinates the pose model itself does not believe.
  Mean per-clip confidence on this footage is 0.487 (``ml/data/dataset_report.md``),
  which makes the weighting load-bearing rather than cosmetic.
* Two coordinate spaces are offered. ``raw`` keeps Phase 1's frame-normalised
  coordinates. ``bodycentric`` re-expresses each frame relative to the
  mid-hip point and divides by a clip-level torso scale, which removes where
  the participant stood and how much of the frame they filled - both of which
  vary by camera angle and are not part of the exercise label.

Scope: these are numeric geometry summaries of dataset-annotated exercise
categories. Nothing here describes or infers any person's health, injury,
recovery or clinical status.
"""

from __future__ import annotations

import json
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[3]
PROCESSED_ROOT = REPO_ROOT / "ml" / "data" / "processed" / "mobiphysio_movenet"
SEQUENCE_INDEX = PROCESSED_ROOT / "sequence_index.csv"

# COCO-17 indices, as recorded in each sequence's ``meta['keypoint_order']``.
KEYPOINT_NAMES: tuple[str, ...] = (
    "nose",
    "left_eye",
    "right_eye",
    "left_ear",
    "right_ear",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
)
LEFT_SHOULDER, RIGHT_SHOULDER = 5, 6
LEFT_HIP, RIGHT_HIP = 11, 12

# The live service's confidence gate (``production_confidence_gate`` in each
# sequence's metadata). Used here only as a reporting threshold, not a filter.
PRODUCTION_GATE = 0.6

# Floor on the confidence weight so a clip whose keypoints are all weakly
# detected still yields finite statistics instead of 0/0.
WEIGHT_FLOOR = 1e-3
# Floor on the torso scale divisor, in frame-normalised units. Guards against a
# degenerate clip where mid-shoulder and mid-hip collapse onto each other.
SCALE_FLOOR = 1e-2

CoordSpace = Literal["raw", "bodycentric"]
FeatureSet = Literal["compact", "full"]

EXERCISE_CODES: tuple[str, ...] = (
    "E01",
    "E02",
    "E03",
    "E04",
    "E05",
    "E06",
    "E07",
    "E08",
    "E09",
)


@dataclass(frozen=True)
class ClipRecord:
    """One clip: its feature vector's source sequence plus its dataset labels."""

    path: Path
    filename: str
    split: str
    exercise_code: str
    exercise_name: str
    participant_id: str
    angle_code: str
    variation_code: str
    mean_confidence: float


def load_sequence(path: Path) -> np.ndarray:
    """Return a clip's ``[T, 17, 3]`` keypoint array as float64."""
    with np.load(path, allow_pickle=False) as data:
        return np.asarray(data["keypoints"], dtype=np.float64)


def read_clip_records(split: str) -> list[ClipRecord]:
    """List the Phase 1 sequences for one split, newest-metadata-first order.

    Reads each ``.npz``'s embedded JSON ``meta`` rather than re-parsing
    filenames, so the labels come from the same place Phase 1 wrote them.
    """
    split_dir = PROCESSED_ROOT / split
    if not split_dir.is_dir():
        raise FileNotFoundError(f"no processed sequences for split {split!r}: {split_dir}")
    records: list[ClipRecord] = []
    for path in sorted(split_dir.glob("*.npz")):
        with np.load(path, allow_pickle=False) as data:
            meta = json.loads(str(data["meta"]))
            mean_conf = float(np.mean(np.asarray(data["keypoints"])[:, :, 2]))
        records.append(
            ClipRecord(
                path=path,
                filename=str(meta["filename"]),
                split=str(meta["split"]),
                exercise_code=str(meta["exercise_code"]),
                exercise_name=str(meta["exercise_name"]),
                participant_id=str(meta["participant_id"]),
                angle_code=str(meta["angle_code"]),
                variation_code=str(meta["variation_code"]),
                mean_confidence=mean_conf,
            )
        )
    if not records:
        raise FileNotFoundError(f"split {split!r} contains no .npz sequences")
    return records


def _weighted_mean(values: np.ndarray, weights: np.ndarray) -> np.ndarray:
    """Confidence-weighted mean over the frame axis. ``values``/``weights`` [T, K]."""
    total = np.maximum(weights.sum(axis=0), WEIGHT_FLOOR)
    return (values * weights).sum(axis=0) / total


def _weighted_std(values: np.ndarray, weights: np.ndarray, mean: np.ndarray) -> np.ndarray:
    """Confidence-weighted standard deviation over the frame axis."""
    total = np.maximum(weights.sum(axis=0), WEIGHT_FLOOR)
    variance = (weights * (values - mean) ** 2).sum(axis=0) / total
    return np.sqrt(np.maximum(variance, 0.0))


def _weighted_percentile_range(
    values: np.ndarray, weights: np.ndarray, low: float = 5.0, high: float = 95.0
) -> np.ndarray:
    """Trimmed travel range per keypoint, ignoring frames the pose model distrusts.

    A plain min-to-max range is dominated by single-frame pose failures. This
    masks frames below the mean weight for a keypoint, then takes a 5-95
    percentile spread, which tracks how far the joint actually travelled.
    """
    out = np.empty(values.shape[1], dtype=np.float64)
    for column in range(values.shape[1]):
        column_weights = weights[:, column]
        keep = column_weights >= max(column_weights.mean(), WEIGHT_FLOOR)
        sample = values[keep, column] if keep.any() else values[:, column]
        out[column] = float(np.percentile(sample, high) - np.percentile(sample, low))
    return out


def _torso_scale(keypoints: np.ndarray) -> float:
    """Clip-level body scale: median mid-shoulder-to-mid-hip distance."""
    mid_shoulder = keypoints[:, [LEFT_SHOULDER, RIGHT_SHOULDER], :2].mean(axis=1)
    mid_hip = keypoints[:, [LEFT_HIP, RIGHT_HIP], :2].mean(axis=1)
    distances = np.linalg.norm(mid_shoulder - mid_hip, axis=1)
    return float(max(np.median(distances), SCALE_FLOOR))


def _coordinates(keypoints: np.ndarray, space: CoordSpace) -> tuple[np.ndarray, float]:
    """Return ``[T, 17, 2]`` coordinates in the requested space, plus torso scale."""
    scale = _torso_scale(keypoints)
    coords = keypoints[:, :, :2]
    if space == "raw":
        return coords, scale
    mid_hip = keypoints[:, [LEFT_HIP, RIGHT_HIP], :2].mean(axis=1, keepdims=True)
    return (coords - mid_hip) / scale, scale


def feature_names(feature_set: FeatureSet) -> list[str]:
    """Column names, in the exact order ``clip_features`` emits them."""
    names: list[str] = []
    for keypoint in KEYPOINT_NAMES:
        names.append(f"{keypoint}_std_x")
        names.append(f"{keypoint}_std_y")
        names.append(f"{keypoint}_motion_mean")
    if feature_set == "full":
        for keypoint in KEYPOINT_NAMES:
            names.append(f"{keypoint}_mean_x")
            names.append(f"{keypoint}_mean_y")
            names.append(f"{keypoint}_range_x")
            names.append(f"{keypoint}_range_y")
            names.append(f"{keypoint}_motion_std")
        names.append("motion_share_upper")
        names.append("motion_share_lower")
        names.append("motion_share_trunk")
    names.extend(
        [
            "clip_frames",
            "clip_mean_confidence",
            "clip_min_keypoint_confidence",
            "clip_frac_above_gate",
            "clip_torso_scale",
            "clip_motion_energy_mean",
            "clip_motion_energy_std",
            "clip_bbox_width",
            "clip_bbox_height",
        ]
    )
    return names


# Keypoint groups used only for the three ``motion_share_*`` features: which
# part of the body carried the clip's movement. Purely anatomical grouping of
# COCO-17 indices, no clinical meaning.
_UPPER_LIMB = [7, 8, 9, 10]  # elbows, wrists
_LOWER_LIMB = [13, 14, 15, 16]  # knees, ankles
_TRUNK = [5, 6, 11, 12]  # shoulders, hips


def clip_features(
    keypoints: np.ndarray,
    feature_set: FeatureSet = "compact",
    space: CoordSpace = "bodycentric",
) -> np.ndarray:
    """Summarise one ``[T, 17, 3]`` sequence into a fixed-length feature vector."""
    if keypoints.ndim != 3 or keypoints.shape[1:] != (17, 3):
        raise ValueError(f"expected [T, 17, 3] keypoints, got {keypoints.shape}")
    frames = keypoints.shape[0]
    if frames < 2:
        raise ValueError("need at least 2 frames to compute motion features")

    confidence = keypoints[:, :, 2]
    coords, scale = _coordinates(keypoints, space)
    x_values, y_values = coords[:, :, 0], coords[:, :, 1]

    mean_x = _weighted_mean(x_values, confidence)
    mean_y = _weighted_mean(y_values, confidence)
    std_x = _weighted_std(x_values, confidence, mean_x)
    std_y = _weighted_std(y_values, confidence, mean_y)

    # Frame-to-frame displacement, weighted by the weaker of the two frames'
    # confidences so a drop-out frame cannot invent a large jump.
    steps = np.linalg.norm(np.diff(coords, axis=0), axis=2)
    step_weights = np.minimum(confidence[:-1], confidence[1:])
    motion_mean = _weighted_mean(steps, step_weights)
    motion_std = _weighted_std(steps, step_weights, motion_mean)

    parts: list[np.ndarray] = []
    interleaved = np.empty(len(KEYPOINT_NAMES) * 3, dtype=np.float64)
    interleaved[0::3] = std_x
    interleaved[1::3] = std_y
    interleaved[2::3] = motion_mean
    parts.append(interleaved)

    if feature_set == "full":
        range_x = _weighted_percentile_range(x_values, confidence)
        range_y = _weighted_percentile_range(y_values, confidence)
        wide = np.empty(len(KEYPOINT_NAMES) * 5, dtype=np.float64)
        wide[0::5] = mean_x
        wide[1::5] = mean_y
        wide[2::5] = range_x
        wide[3::5] = range_y
        wide[4::5] = motion_std
        parts.append(wide)
        total_motion = max(float(motion_mean.sum()), WEIGHT_FLOOR)
        parts.append(
            np.array(
                [
                    float(motion_mean[_UPPER_LIMB].sum()) / total_motion,
                    float(motion_mean[_LOWER_LIMB].sum()) / total_motion,
                    float(motion_mean[_TRUNK].sum()) / total_motion,
                ]
            )
        )

    energy = (steps * step_weights).sum(axis=1) / np.maximum(step_weights.sum(axis=1), WEIGHT_FLOOR)
    parts.append(
        np.array(
            [
                float(frames),
                float(confidence.mean()),
                float(confidence.mean(axis=0).min()),
                float((confidence >= PRODUCTION_GATE).mean()),
                scale,
                float(energy.mean()),
                float(energy.std()),
                float(np.percentile(x_values, 95) - np.percentile(x_values, 5)),
                float(np.percentile(y_values, 95) - np.percentile(y_values, 5)),
            ]
        )
    )

    vector = np.concatenate(parts)
    return np.nan_to_num(vector, nan=0.0, posinf=0.0, neginf=0.0).astype(np.float32)


def build_split_matrix(
    records: Sequence[ClipRecord],
    feature_set: FeatureSet = "compact",
    space: CoordSpace = "bodycentric",
) -> tuple[np.ndarray, np.ndarray]:
    """Return ``(X, y)`` for a list of clip records. ``y`` holds exercise codes."""
    rows = [clip_features(load_sequence(r.path), feature_set, space) for r in records]
    return np.stack(rows), np.array([r.exercise_code for r in records])


def class_distribution(labels: Iterable[str]) -> dict[str, int]:
    """Count clips per exercise code, always listing all nine classes."""
    counts = dict.fromkeys(EXERCISE_CODES, 0)
    for label in labels:
        counts[label] = counts.get(label, 0) + 1
    return counts
