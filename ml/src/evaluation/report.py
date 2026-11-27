"""Render the markdown tables used in ``ml/experiments/*.md`` from saved JSON.

Reads ``ml/experiments/val_selection.json`` (written by the ``select`` stage)
and ``ml/experiments/final_results.json`` (written by the ``final`` stage) and
prints the headline, per-class, confusion-matrix and subgroup tables, so the
numbers in the experiment docs are transcribed from measured output rather than
retyped by hand.

Usage::

    python -m src.evaluation.report
    python -m src.evaluation.report --section confusion
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

if __package__ in (None, ""):  # allow direct `python ml/src/evaluation/report.py`
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.evaluation.metrics import SplitReport  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[3]
EXPERIMENTS_DIR = REPO_ROOT / "ml" / "experiments"
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


def _load(name: str) -> dict[str, Any]:
    path = EXPERIMENTS_DIR / name
    if not path.is_file():
        raise FileNotFoundError(f"missing {path}; run the matching training stage first")
    return json.loads(path.read_text(encoding="utf-8"))


def _to_report(payload: dict[str, Any]) -> SplitReport:
    return SplitReport(**payload)


def selection_table() -> str:
    """Every candidate's val score, ranked, plus the trivial floors."""
    data = _load("val_selection.json")
    rows = sorted(data["candidates"], key=lambda r: r["val"]["balanced_accuracy"], reverse=True)
    lines = [
        "| model | features | coord space | dim | val accuracy | val balanced acc. |"
        " val macro F1 |",
        "|---|---|---|---|---|---|---|",
    ]
    for row in rows:
        val = row["val"]
        lines.append(
            f"| {row['config']} | {row['feature_set']} | {row['space']} | "
            f"{row['n_features']} | {val['accuracy']:.3f} | "
            f"{val['balanced_accuracy']:.3f} | {val['macro_f1']:.3f} |"
        )
    for row in data["trivial"]:
        val = row["val"]
        lines.append(
            f"| {row['config']} (trivial) | - | - | 0 | {val['accuracy']:.3f} | "
            f"{val['balanced_accuracy']:.3f} | {val['macro_f1']:.3f} |"
        )
    return "\n".join(lines)


def headline_table() -> str:
    """Chosen model vs. both trivial baselines, on val and test."""
    data = _load("final_results.json")
    reports = [_to_report(r) for r in data["reports"] + data["trivial_reports"]]
    lines = [
        "| model | split | n | accuracy | balanced acc. | macro P | macro R | macro F1 |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for report in reports:
        lines.append(
            f"| {report.name} | {report.split} | {report.n_samples} | "
            f"{report.accuracy:.3f} | {report.balanced_accuracy:.3f} | "
            f"{report.macro_precision:.3f} | {report.macro_recall:.3f} | "
            f"{report.macro_f1:.3f} |"
        )
    return "\n".join(lines)


def per_class_table() -> str:
    """Per-class F1 on val and test for the chosen model."""
    data = _load("final_results.json")
    reports = [_to_report(r) for r in data["reports"]]
    lines = ["| class | exercise | clips per split | val F1 | test F1 |", "|---|---|---|---|---|"]
    for label in reports[0].labels:
        lines.append(
            f"| {label} | {EXERCISE_NAMES[label]} | "
            f"{reports[0].per_class_support[label]} | "
            f"{reports[0].per_class_f1[label]:.3f} | "
            f"{reports[1].per_class_f1[label]:.3f} |"
        )
    return "\n".join(lines)


def confusion_tables() -> str:
    """Confusion matrix per split, rows = annotated class, columns = prediction."""
    data = _load("final_results.json")
    blocks: list[str] = []
    for payload in data["reports"]:
        report = _to_report(payload)
        header = "| true \\ pred | " + " | ".join(report.labels) + " |"
        divider = "|---" * (len(report.labels) + 1) + "|"
        lines = [f"**{report.split}** ({report.name})", "", header, divider]
        for label, row in zip(report.labels, report.confusion, strict=False):
            cells = " | ".join(str(value) for value in row)
            lines.append(f"| **{label}** | {cells} |")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def subgroup_tables() -> str:
    """Accuracy by the dataset's camera-angle and variation annotations."""
    data = _load("final_results.json")
    blocks: list[str] = []
    for payload in data["reports"]:
        report = _to_report(payload)
        for dimension, scores in report.subgroup.items():
            cells = " | ".join(f"{value:.3f}" for value in scores.values())
            head = "| split / " + dimension + " | " + " | ".join(scores.keys()) + " |"
            blocks.append(
                "\n".join([head, "|---" * (len(scores) + 1) + "|", f"| {report.split} | {cells} |"])
            )
    return "\n\n".join(blocks)


def counts_table() -> str:
    """Clip and participant counts per split."""
    data = _load("final_results.json")
    lines = ["| split | clips | participants | classes present |", "|---|---|---|---|"]
    for split, info in data["counts"].items():
        present = sum(1 for count in info["class_distribution"].values() if count > 0)
        lines.append(
            f"| {split} | {info['clips']} | {', '.join(info['participants'])} | {present}/9 |"
        )
    return "\n".join(lines)


def top_features_table() -> str:
    """The chosen model's 20 highest-importance features, if it exposes them."""
    data = _load("final_results.json")
    if not data["top_features"]:
        return "_This model type does not expose feature importances._"
    lines = ["| rank | feature | importance |", "|---|---|---|"]
    for rank, row in enumerate(data["top_features"], start=1):
        lines.append(f"| {rank} | `{row['feature']}` | {row['importance']:.4f} |")
    return "\n".join(lines)


SECTIONS = {
    "selection": selection_table,
    "headline": headline_table,
    "per_class": per_class_table,
    "confusion": confusion_tables,
    "subgroup": subgroup_tables,
    "counts": counts_table,
    "top_features": top_features_table,
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--section", choices=sorted(SECTIONS), default=None)
    args = parser.parse_args(argv)
    chosen = [args.section] if args.section else list(SECTIONS)
    for name in chosen:
        print(f"### {name}\n")
        print(SECTIONS[name]())
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
