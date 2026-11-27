"""Metric and confusion-matrix reporting for the exercise-recognition baseline.

Reports accuracy, balanced accuracy, macro precision/recall/F1, per-class F1,
the full confusion matrix and the class distribution, plus breakdowns by the
dataset's camera-angle and variation annotations (the MobiPhysio README's own
recommended reporting dimensions).

Everything here measures agreement with a dataset-annotated exercise category.
No metric in this module describes a person's health, injury or recovery.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)


@dataclass
class SplitReport:
    """Scores for one model on one split."""

    name: str
    split: str
    n_samples: int
    labels: list[str]
    accuracy: float
    balanced_accuracy: float
    macro_precision: float
    macro_recall: float
    macro_f1: float
    per_class_f1: dict[str, float]
    per_class_support: dict[str, int]
    confusion: list[list[int]]
    subgroup: dict[str, dict[str, float]] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "split": self.split,
            "n_samples": self.n_samples,
            "labels": self.labels,
            "accuracy": self.accuracy,
            "balanced_accuracy": self.balanced_accuracy,
            "macro_precision": self.macro_precision,
            "macro_recall": self.macro_recall,
            "macro_f1": self.macro_f1,
            "per_class_f1": self.per_class_f1,
            "per_class_support": self.per_class_support,
            "confusion": self.confusion,
            "subgroup": self.subgroup,
        }


def score_split(
    name: str,
    split: str,
    y_true: Sequence[str],
    y_pred: Sequence[str],
    labels: Sequence[str],
) -> SplitReport:
    """Compute every reported metric for one model/split pair."""
    truth = np.asarray(y_true)
    pred = np.asarray(y_pred)
    label_list = list(labels)
    per_class = f1_score(truth, pred, labels=label_list, average=None, zero_division=0)
    support = {label: int((truth == label).sum()) for label in label_list}
    per_class_f1 = {label: float(value) for label, value in zip(label_list, per_class, strict=True)}
    return SplitReport(
        name=name,
        split=split,
        n_samples=int(truth.size),
        labels=label_list,
        accuracy=float(accuracy_score(truth, pred)),
        balanced_accuracy=float(balanced_accuracy_score(truth, pred)),
        macro_precision=float(
            precision_score(truth, pred, labels=label_list, average="macro", zero_division=0)
        ),
        macro_recall=float(
            recall_score(truth, pred, labels=label_list, average="macro", zero_division=0)
        ),
        macro_f1=float(f1_score(truth, pred, labels=label_list, average="macro", zero_division=0)),
        per_class_f1=per_class_f1,
        per_class_support=support,
        confusion=confusion_matrix(truth, pred, labels=label_list).tolist(),
    )


def subgroup_accuracy(
    y_true: Sequence[str], y_pred: Sequence[str], groups: Sequence[str]
) -> dict[str, float]:
    """Accuracy within each value of a dataset annotation (camera angle, variation)."""
    truth = np.asarray(y_true)
    pred = np.asarray(y_pred)
    group_array = np.asarray(groups)
    out: dict[str, float] = {}
    for value in sorted(set(group_array.tolist())):
        mask = group_array == value
        out[str(value)] = float(accuracy_score(truth[mask], pred[mask]))
    return out


def confusion_markdown(report: SplitReport, class_names: dict[str, str]) -> str:
    """Render the confusion matrix as a markdown table (rows = true class)."""
    header = "| true \\ pred | " + " | ".join(report.labels) + " |"
    divider = "|---" * (len(report.labels) + 1) + "|"
    lines = [header, divider]
    for label, row in zip(report.labels, report.confusion, strict=False):
        cells = " | ".join(str(value) for value in row)
        lines.append(f"| **{label}** {class_names.get(label, '')} | {cells} |")
    return "\n".join(lines)


def headline_markdown(reports: Sequence[SplitReport]) -> str:
    """One markdown row per report: the five headline aggregate metrics."""
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


def per_class_markdown(reports: Sequence[SplitReport], class_names: dict[str, str]) -> str:
    """Per-class F1 for several reports side by side."""
    labels = reports[0].labels
    header = "| class | exercise | support | " + " | ".join(
        f"{r.name} ({r.split})" for r in reports
    )
    lines = [header + " |", "|---" * (3 + len(reports)) + "|"]
    for label in labels:
        values = " | ".join(f"{r.per_class_f1[label]:.3f}" for r in reports)
        support = reports[0].per_class_support[label]
        lines.append(f"| {label} | {class_names.get(label, '')} | {support} | {values} |")
    return "\n".join(lines)
