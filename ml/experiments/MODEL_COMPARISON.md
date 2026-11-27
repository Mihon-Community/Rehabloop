# Model comparison — nine-class exercise recognition

Task: given one clip's MoveNet COCO-17 keypoint sequence, predict which of
MobiPhysio's nine annotated exercise categories (E01-E09) it is. Nothing here
scores execution quality or says anything about a person's health, injury or
recovery.

Dataset: MobiPhysio v1.1 (CC0 1.0, `commercial_ok`). Participant-disjoint
splits — train 512 clips / P02,P04,P05,P07,P08,P09,P10; val 81 clips / P21;
test 81 clips / P22. Both evaluation splits are exactly 9 clips per class, so
chance level is 0.111 and accuracy equals balanced accuracy.

Full detail, confusion matrices and caveats: `EXPERIMENT_LOG.md`.
Raw numbers: `val_selection.json`, `final_results.json`.

## Headline: trivial baselines vs. the chosen model

| model | split | accuracy | balanced acc. | macro P | macro R | macro F1 |
|---|---|---|---|---|---|---|
| Majority class (`DummyClassifier`, `most_frequent`) | val | 0.111 | 0.111 | 0.012 | 0.111 | 0.022 |
| Majority class | **test** | **0.111** | **0.111** | **0.012** | **0.111** | **0.022** |
| Stratified random (`DummyClassifier`, `stratified`) | val | 0.185 | 0.185 | 0.191 | 0.185 | 0.184 |
| Stratified random | **test** | **0.185** | **0.185** | **0.191** | **0.185** | **0.184** |
| HistGradientBoosting, 148 features, body-centric | val | 0.815 | 0.815 | 0.833 | 0.815 | 0.809 |
| **HistGradientBoosting, 148 features, body-centric** | **test** | **0.617** | **0.617** | **0.684** | **0.617** | **0.597** |

Margin over the trivial floor, on test: **+0.506 accuracy** over majority
class, **+0.432** over stratified random; macro F1 **+0.575** / **+0.413**.
The baseline is cleared decisively even though 0.617 is a mediocre absolute
number.

## All candidates, on validation only

Every configuration below was fitted on train and scored on val. The test
split was not loaded during this stage, and the winner was picked from this
table alone.

| model | features | coord space | dim | val accuracy | val balanced acc. | val macro F1 |
|---|---|---|---|---|---|---|
| hist_gradient_boosting | full | bodycentric | 148 | **0.815** | **0.815** | **0.809** |
| random_forest | full | bodycentric | 148 | 0.778 | 0.778 | 0.768 |
| hist_gradient_boosting | compact | raw | 60 | 0.741 | 0.741 | 0.715 |
| hist_gradient_boosting | full | raw | 148 | 0.741 | 0.741 | 0.724 |
| hist_gradient_boosting_slow | full | raw | 148 | 0.728 | 0.728 | 0.708 |
| hist_gradient_boosting_slow | full | bodycentric | 148 | 0.728 | 0.728 | 0.693 |
| hist_gradient_boosting_slow | compact | raw | 60 | 0.716 | 0.716 | 0.706 |
| random_forest | full | raw | 148 | 0.716 | 0.716 | 0.707 |
| random_forest_shallow | full | bodycentric | 148 | 0.716 | 0.716 | 0.707 |
| random_forest_shallow | full | raw | 148 | 0.691 | 0.691 | 0.664 |
| random_forest_shallow | compact | raw | 60 | 0.679 | 0.679 | 0.658 |
| random_forest | compact | raw | 60 | 0.654 | 0.654 | 0.625 |
| hist_gradient_boosting | compact | bodycentric | 60 | 0.642 | 0.642 | 0.636 |
| random_forest | compact | bodycentric | 60 | 0.630 | 0.630 | 0.609 |
| hist_gradient_boosting_slow | compact | bodycentric | 60 | 0.617 | 0.617 | 0.607 |
| random_forest_shallow | compact | bodycentric | 60 | 0.605 | 0.605 | 0.585 |
| majority class (trivial) | - | - | 0 | 0.111 | 0.111 | 0.022 |
| stratified random (trivial) | - | - | 0 | 0.185 | 0.185 | 0.184 |

## What the comparison actually shows

* **Gradient boosting beat random forest** at matched features and coordinate
  space in 3 of 4 pairings, by 2-4 accuracy points. Not a large margin on 81
  val clips, but consistent in direction.
* **Deliberately weakened variants did not help.** `random_forest_shallow`
  (depth 10, `min_samples_leaf=2`) and `hist_gradient_boosting_slow`
  (`learning_rate=0.05`, 15 leaves, `l2=1.0`) both scored below their
  unrestricted counterparts on the winning feature set. At 512 training
  samples the extra regularisation cost more than the variance it removed.
* **The 148-feature set beat the 60-feature set** in 7 of 8 matched pairs.
  Trimming to per-keypoint spread and mean displacement loses the absolute
  joint positions, and those turn out to carry a lot of the signal — the single
  most important feature is `right_wrist_mean_y`, i.e. roughly how high the
  working hand is held.
* **Body-centric normalisation only helps with the full feature set**
  (`full`: 0.741 raw -> 0.815 body-centric; `compact`: 0.741 raw -> 0.642
  body-centric). That is consistent with the point above: normalisation is
  what makes absolute joint positions comparable across camera framings, so it
  pays off only when those positions are in the vector at all. With the
  compact set it strictly removes information (where in the frame the person
  stood) without giving anything back.
* **The val/test gap dwarfs every gap in this table.** The spread across all
  16 candidates on val is 0.605-0.815; the chosen model's drop from val to
  test is 0.815 -> 0.617. With one held-out participant per split, the
  between-participant difference is larger than the between-model difference,
  so this table should be read as "which model to carry forward", not as
  evidence that any of these configurations is reliably better than another.

## Model/config definitions

All in `build_model()` in `ml/src/training/train_classifier.py`, seed 42,
CPU only.

| name | definition |
|---|---|
| `dummy_majority` | `DummyClassifier(strategy="most_frequent")` |
| `dummy_stratified` | `DummyClassifier(strategy="stratified")` |
| `random_forest` | `RandomForestClassifier(n_estimators=600, min_samples_leaf=1, class_weight="balanced_subsample")` |
| `random_forest_shallow` | as above plus `max_depth=10, min_samples_leaf=2` |
| `hist_gradient_boosting` | `HistGradientBoostingClassifier(max_iter=300, learning_rate=0.1, max_leaf_nodes=31, l2_regularization=0.0, early_stopping=False)` |
| `hist_gradient_boosting_slow` | `HistGradientBoostingClassifier(max_iter=400, learning_rate=0.05, max_leaf_nodes=15, l2_regularization=1.0, early_stopping=False)` |

No deep-learning comparison (LSTM/TCN) was run — PyTorch is not installed in
`ml/.venv` and that step was optional for this phase. Recorded as skipped, not
silently dropped.

## Status

Internal research/evaluation baseline only. Not integrated into the live
backend or API, and not production-cleared.
