"""Train and evaluate the Phase 2 nine-class exercise-recognition baseline.

What this predicts: which of MobiPhysio's nine annotated exercise categories
(E01-E09) a clip's keypoint sequence belongs to. Nothing else. It does not
score execution quality, does not use the EAAQ column as a target, and makes
no statement about any person's health, injury or recovery.

Protocol, matching the project's rule that test data stays out of model
selection:

* ``select`` fits every candidate configuration on **train** (512 clips,
  7 participants) and ranks them on **val** (81 clips, participant P21 only).
  It never loads the test split.
* ``final`` takes one already-chosen configuration, refits it on train, and
  reports it on val **and** test (81 clips, participant P22 only). Run once.

CPU only. scikit-learn tree ensembles; no GPU, no CUDA, no PyTorch.

Usage::

    python -m src.training.train_classifier select
    python -m src.training.train_classifier final --config random_forest_deep \
        --feature-set full --space bodycentric
"""

from __future__ import annotations

import argparse
import json
import platform
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import sklearn
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.inspection import permutation_importance

if __package__ in (None, ""):  # allow `python ml/src/training/train_classifier.py`
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.evaluation.metrics import (  # noqa: E402
    SplitReport,
    headline_markdown,
    score_split,
    subgroup_accuracy,
)
from src.training.features import (  # noqa: E402
    EXERCISE_CODES,
    ClipRecord,
    CoordSpace,
    FeatureSet,
    build_split_matrix,
    class_distribution,
    feature_names,
    read_clip_records,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
EXPERIMENTS_DIR = REPO_ROOT / "ml" / "experiments"
CHECKPOINT_DIR = REPO_ROOT / "ml" / "models" / "trained"
RANDOM_SEED = 42

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


def build_model(config: str) -> Any:
    """Instantiate one candidate by name. All CPU, all fixed-seed."""
    if config == "dummy_majority":
        return DummyClassifier(strategy="most_frequent")
    if config == "dummy_stratified":
        return DummyClassifier(strategy="stratified", random_state=RANDOM_SEED)
    if config == "random_forest":
        return RandomForestClassifier(
            n_estimators=600,
            min_samples_leaf=1,
            class_weight="balanced_subsample",
            random_state=RANDOM_SEED,
            n_jobs=-1,
        )
    if config == "random_forest_shallow":
        return RandomForestClassifier(
            n_estimators=600,
            max_depth=10,
            min_samples_leaf=2,
            class_weight="balanced_subsample",
            random_state=RANDOM_SEED,
            n_jobs=-1,
        )
    if config == "hist_gradient_boosting":
        return HistGradientBoostingClassifier(
            max_iter=300,
            learning_rate=0.1,
            max_leaf_nodes=31,
            l2_regularization=0.0,
            early_stopping=False,
            random_state=RANDOM_SEED,
        )
    if config == "hist_gradient_boosting_slow":
        return HistGradientBoostingClassifier(
            max_iter=400,
            learning_rate=0.05,
            max_leaf_nodes=15,
            l2_regularization=1.0,
            early_stopping=False,
            random_state=RANDOM_SEED,
        )
    raise ValueError(f"unknown model config: {config!r}")


MODEL_CONFIGS: tuple[str, ...] = (
    "random_forest",
    "random_forest_shallow",
    "hist_gradient_boosting",
    "hist_gradient_boosting_slow",
)
TRIVIAL_CONFIGS: tuple[str, ...] = ("dummy_majority", "dummy_stratified")
FEATURE_SETS: tuple[FeatureSet, ...] = ("compact", "full")
SPACES: tuple[CoordSpace, ...] = ("raw", "bodycentric")


@dataclass
class SplitData:
    """Feature matrix, labels and annotation columns for one split."""

    records: list[ClipRecord]
    x: np.ndarray
    y: np.ndarray

    @property
    def angles(self) -> list[str]:
        return [r.angle_code for r in self.records]

    @property
    def variations(self) -> list[str]:
        return [r.variation_code for r in self.records]

    @property
    def participants(self) -> list[str]:
        return sorted({r.participant_id for r in self.records})


def load_splits(
    splits: tuple[str, ...], feature_set: FeatureSet, space: CoordSpace
) -> dict[str, SplitData]:
    """Read the requested splits' Phase 1 sequences and featurise them."""
    out: dict[str, SplitData] = {}
    for split in splits:
        records = read_clip_records(split)
        x, y = build_split_matrix(records, feature_set, space)
        out[split] = SplitData(records=records, x=x, y=y)
    return out


def run_selection() -> dict[str, Any]:
    """Rank every candidate on val only. Never reads the test split."""
    results: list[dict[str, Any]] = []
    for feature_set in FEATURE_SETS:
        for space in SPACES:
            data = load_splits(("train", "val"), feature_set, space)
            train, val = data["train"], data["val"]
            print(
                f"[features] set={feature_set} space={space} "
                f"dim={train.x.shape[1]} train={train.x.shape[0]} val={val.x.shape[0]}",
                flush=True,
            )
            for config in MODEL_CONFIGS:
                model = build_model(config)
                model.fit(train.x, train.y)
                report = score_split(
                    name=f"{config}|{feature_set}|{space}",
                    split="val",
                    y_true=val.y,
                    y_pred=model.predict(val.x),
                    labels=EXERCISE_CODES,
                )
                results.append(
                    {
                        "config": config,
                        "feature_set": feature_set,
                        "space": space,
                        "n_features": int(train.x.shape[1]),
                        "val": report.as_dict(),
                    }
                )
                print(
                    f"  {config:<28} val acc={report.accuracy:.3f} "
                    f"bal={report.balanced_accuracy:.3f} macroF1={report.macro_f1:.3f}",
                    flush=True,
                )

    # Trivial floors, computed once on the compact/bodycentric matrices (the
    # dummies ignore X entirely, so the feature choice cannot affect them).
    data = load_splits(("train", "val"), "compact", "bodycentric")
    trivial: list[dict[str, Any]] = []
    for config in TRIVIAL_CONFIGS:
        model = build_model(config)
        model.fit(data["train"].x, data["train"].y)
        report = score_split(
            name=config,
            split="val",
            y_true=data["val"].y,
            y_pred=model.predict(data["val"].x),
            labels=EXERCISE_CODES,
        )
        trivial.append({"config": config, "val": report.as_dict()})
        print(
            f"  [trivial] {config:<18} val acc={report.accuracy:.3f} "
            f"bal={report.balanced_accuracy:.3f} macroF1={report.macro_f1:.3f}",
            flush=True,
        )

    ranked = sorted(results, key=lambda r: r["val"]["balanced_accuracy"], reverse=True)
    payload = {
        "stage": "selection",
        "generated_utc": datetime.now(UTC).isoformat(timespec="seconds"),
        "selection_metric": "val balanced_accuracy",
        "candidates": results,
        "trivial": trivial,
        "best": {
            "config": ranked[0]["config"],
            "feature_set": ranked[0]["feature_set"],
            "space": ranked[0]["space"],
            "val_balanced_accuracy": ranked[0]["val"]["balanced_accuracy"],
        },
    }
    EXPERIMENTS_DIR.mkdir(parents=True, exist_ok=True)
    (EXPERIMENTS_DIR / "val_selection.json").write_text(
        json.dumps(payload, indent=2), encoding="utf-8"
    )
    print("\nbest on val:", json.dumps(payload["best"], indent=2))
    return payload


def _attach_subgroups(report: SplitReport, data: SplitData, predictions: np.ndarray) -> None:
    report.subgroup = {
        "camera_angle": subgroup_accuracy(data.y, predictions, data.angles),
        "variation": subgroup_accuracy(data.y, predictions, data.variations),
    }


def run_final(config: str, feature_set: FeatureSet, space: CoordSpace) -> dict[str, Any]:
    """Refit the chosen configuration and evaluate it on val and test, once."""
    data = load_splits(("train", "val", "test"), feature_set, space)
    train, val, test = data["train"], data["val"], data["test"]
    names = feature_names(feature_set)
    if len(names) != train.x.shape[1]:
        raise AssertionError(
            f"feature_names() returned {len(names)} names for a "
            f"{train.x.shape[1]}-column matrix"
        )

    model = build_model(config)
    model.fit(train.x, train.y)

    reports: list[SplitReport] = []
    for split_name, split_data in (("val", val), ("test", test)):
        predictions = model.predict(split_data.x)
        report = score_split(
            name=config,
            split=split_name,
            y_true=split_data.y,
            y_pred=predictions,
            labels=EXERCISE_CODES,
        )
        _attach_subgroups(report, split_data, predictions)
        reports.append(report)

    trivial_reports: list[SplitReport] = []
    for trivial_config in TRIVIAL_CONFIGS:
        trivial_model = build_model(trivial_config)
        trivial_model.fit(train.x, train.y)
        for split_name, split_data in (("val", val), ("test", test)):
            trivial_reports.append(
                score_split(
                    name=trivial_config,
                    split=split_name,
                    y_true=split_data.y,
                    y_pred=trivial_model.predict(split_data.x),
                    labels=EXERCISE_CODES,
                )
            )

    # Feature importance is measured on **val**, never on test: it is
    # interpretation of the already-chosen model, and the test split must not
    # influence or illustrate any modelling choice. Permutation importance is
    # used because HistGradientBoostingClassifier exposes no native
    # ``feature_importances_``.
    importances: list[dict[str, float | str]] = []
    if hasattr(model, "feature_importances_"):
        scores = np.asarray(model.feature_importances_, dtype=float)
        importance_basis = "native feature_importances_ (train-fitted)"
    else:
        scores = permutation_importance(
            model, val.x, val.y, n_repeats=10, random_state=RANDOM_SEED, n_jobs=-1
        ).importances_mean
        importance_basis = "permutation importance on val (P21), 10 repeats"
    order = np.argsort(scores)[::-1][:20]
    importances = [{"feature": names[i], "importance": float(scores[i])} for i in order]

    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    checkpoint_path = CHECKPOINT_DIR / f"exercise_recognition_{config}_{feature_set}_{space}.joblib"
    joblib.dump(
        {
            "model": model,
            "config": config,
            "feature_set": feature_set,
            "coordinate_space": space,
            "feature_names": names,
            "classes": list(EXERCISE_CODES),
            "exercise_names": EXERCISE_NAMES,
            "random_seed": RANDOM_SEED,
            "sklearn_version": sklearn.__version__,
            "numpy_version": np.__version__,
            "python_version": platform.python_version(),
            "trained_utc": datetime.now(UTC).isoformat(timespec="seconds"),
            "dataset": "MobiPhysio v1.1 (doi:10.7910/DVN/XSI0QN, CC0 1.0)",
            "license_class": "commercial_ok",
            "intended_use": (
                "internal research/evaluation baseline for nine-class exercise "
                "recognition over dataset-annotated categories; not integrated "
                "into the live backend/API, not production-cleared"
            ),
        },
        checkpoint_path,
    )
    # Two hashes, because they answer different questions. ``file_sha1``
    # identifies this exact artifact but is *not* reproducible: the payload
    # embeds ``trained_utc``, so the bytes differ on every run. ``model_sha1``
    # hashes the fitted estimator itself and is stable across runs at a fixed
    # seed - that is the one to quote when checking reproducibility.
    checkpoint_file_sha = joblib.hash(checkpoint_path.read_bytes(), hash_name="sha1")
    model_sha = joblib.hash(model, hash_name="sha1")

    payload = {
        "stage": "final",
        "generated_utc": datetime.now(UTC).isoformat(timespec="seconds"),
        "chosen": {"config": config, "feature_set": feature_set, "space": space},
        "n_features": int(train.x.shape[1]),
        "counts": {
            name: {
                "clips": int(split.x.shape[0]),
                "participants": split.participants,
                "class_distribution": class_distribution(split.y),
            }
            for name, split in (("train", train), ("val", val), ("test", test))
        },
        "reports": [report.as_dict() for report in reports],
        "trivial_reports": [report.as_dict() for report in trivial_reports],
        "top_features": importances,
        "importance_basis": importance_basis,
        "checkpoint": {
            "path": str(checkpoint_path.relative_to(REPO_ROOT)).replace("\\", "/"),
            "bytes": checkpoint_path.stat().st_size,
            "file_sha1": checkpoint_file_sha,
            "file_sha1_reproducible": False,
            "model_sha1": model_sha,
        },
        "environment": {
            "python": platform.python_version(),
            "sklearn": sklearn.__version__,
            "numpy": np.__version__,
            "device": "cpu",
        },
    }
    EXPERIMENTS_DIR.mkdir(parents=True, exist_ok=True)
    (EXPERIMENTS_DIR / "final_results.json").write_text(
        json.dumps(payload, indent=2), encoding="utf-8"
    )
    print(headline_markdown(reports + trivial_reports))
    print(f"\ncheckpoint: {checkpoint_path} ({checkpoint_path.stat().st_size} bytes)")
    return payload


# Features that encode how long a clip is rather than how the body moved.
# MobiPhysio's classes have systematically different clip durations (E08 runs
# to the 320-frame sampling cap, E04 averages ~156 frames), so a classifier can
# partly shortcut the task by reading duration. These are the columns that leak
# it, used by the duration-shortcut diagnostic below.
DURATION_PROXY_FEATURES: tuple[str, ...] = ("clip_frames",)


def run_duration_diagnostic(config: str, feature_set: FeatureSet, space: CoordSpace) -> None:
    """Val-only check of how much the chosen model leans on clip duration.

    Fits the chosen configuration twice on train - once with every feature,
    once with the duration-proxy columns zeroed out - and compares on val.
    This is a diagnostic, not model selection: it never loads the test split
    and it does not change the configuration whose test result Phase 2 reports.
    """
    data = load_splits(("train", "val"), feature_set, space)
    train, val = data["train"], data["val"]
    names = feature_names(feature_set)
    drop = [names.index(name) for name in DURATION_PROXY_FEATURES if name in names]

    for label, columns in (("all features", []), ("duration features dropped", drop)):
        x_train, x_val = train.x.copy(), val.x.copy()
        keep = [i for i in range(x_train.shape[1]) if i not in columns]
        model = build_model(config)
        model.fit(x_train[:, keep], train.y)
        report = score_split(
            name=f"{config} ({label})",
            split="val",
            y_true=val.y,
            y_pred=model.predict(x_val[:, keep]),
            labels=EXERCISE_CODES,
        )
        print(
            f"{label:<28} dim={len(keep):>4} val acc={report.accuracy:.3f} "
            f"bal={report.balanced_accuracy:.3f} macroF1={report.macro_f1:.3f}",
            flush=True,
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="stage", required=True)
    sub.add_parser("select", help="rank candidates on val only (test never loaded)")
    final = sub.add_parser("final", help="evaluate one chosen config on val and test")
    diagnose = sub.add_parser(
        "diagnose", help="val-only duration-shortcut ablation for a chosen config"
    )
    for subparser in (final, diagnose):
        subparser.add_argument("--config", required=True, choices=MODEL_CONFIGS)
        subparser.add_argument("--feature-set", required=True, choices=list(FEATURE_SETS))
        subparser.add_argument("--space", required=True, choices=list(SPACES))
    args = parser.parse_args(argv)

    if args.stage == "select":
        run_selection()
    elif args.stage == "diagnose":
        run_duration_diagnostic(args.config, args.feature_set, args.space)
    else:
        run_final(args.config, args.feature_set, args.space)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
