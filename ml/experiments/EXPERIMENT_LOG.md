# Experiment log

One entry per training run. Every number below is transcribed from the saved
JSON output of the runs described (`val_selection.json`, `final_results.json`),
rendered by `python -m src.evaluation.report`. Nothing here is estimated.

Scope note for the whole file: these models predict **which of MobiPhysio's
nine annotated exercise categories** a clip is. No experiment here scores
execution quality, uses the EAAQ column as a target, or produces any statement
about a person's health, injury, recovery or clinical status.

---

## 2026-11-27 — Phase 2 baseline: nine-class exercise recognition

### Configuration

| Item | Value |
|---|---|
| Task | 9-class single-label clip classification, E01-E09 |
| Input | Phase 1 MoveNet COCO-17 keypoint sequences, `ml/data/processed/mobiphysio_movenet/{split}/*.npz`, float32 `[T, 17, 3]`, T = 39-320 |
| Pose re-extraction | None. Phase 1 features reused as-is. |
| Feature code | `ml/src/training/features.py` |
| Training code | `ml/src/training/train_classifier.py` |
| Metric code | `ml/src/evaluation/metrics.py`, `ml/src/evaluation/report.py` |
| Hardware | CPU only. No GPU, no CUDA, no PyTorch. |
| Environment | Python 3.12.10, scikit-learn 1.9.1, numpy 2.5.5 |
| Random seed | 42 everywhere |
| Wall clock | ~5 s to featurise 593 clips, ~4 s to fit the chosen model |

### Splits actually used

| split | clips | participants | classes present |
|---|---|---|---|
| train | 512 | P02, P04, P05, P07, P08, P09, P10 | 9/9 |
| val | 81 | P21 | 9/9 |
| test | 81 | P22 | 9/9 |

Participant-disjoint, exactly as assigned in Phase 1. Val and test hold **nine
clips of each of the nine classes**, so the class distribution is uniform on
both and chance level is 1/9 = 0.111.

### Features

Each variable-length sequence is collapsed to one fixed-length vector. Two
sizes were offered to the selection stage:

| feature set | dim | contents (per clip) |
|---|---|---|
| `compact` | 60 | per keypoint (17): confidence-weighted std of x, std of y, mean frame-to-frame displacement. Plus 9 whole-clip descriptors. |
| `full` | 148 | `compact` plus, per keypoint: weighted mean x, mean y, 5-95 percentile travel range in x and y, std of displacement; plus three upper-limb/lower-limb/trunk motion-share ratios. |

The 9 whole-clip descriptors are: frame count, mean confidence, weakest
keypoint's mean confidence, fraction of keypoints at or above the production
0.6 gate, torso scale, mean and std of per-frame motion energy, and bounding
box width/height.

Two coordinate spaces were offered:

* `raw` — Phase 1's frame-normalised x/y as stored.
* `bodycentric` — each frame re-expressed relative to the mid-hip point and
  divided by a clip-level torso scale (median mid-shoulder-to-mid-hip
  distance), removing where the participant stood and how much of the frame
  they filled.

Every position/spread/motion statistic is **confidence-weighted**. MoveNet
SinglePose Lightning emits 17 coordinates whether or not it located the joint,
and mean per-clip confidence on this footage is 0.487
(`ml/data/dataset_report.md`), so unweighted statistics would average in
coordinates the pose model itself does not believe.

### Selection stage (val only — the test split was not loaded)

Ranked by val balanced accuracy. 4 model configs x 2 feature sets x 2
coordinate spaces = 16 fits.

| model | features | coord space | dim | val accuracy | val balanced acc. | val macro F1 |
|---|---|---|---|---|---|---|
| hist_gradient_boosting | full | bodycentric | 148 | 0.815 | 0.815 | 0.809 |
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
| dummy_majority (trivial) | - | - | 0 | 0.111 | 0.111 | 0.022 |
| dummy_stratified (trivial) | - | - | 0 | 0.185 | 0.185 | 0.184 |

Model config definitions are in `build_model()` in
`ml/src/training/train_classifier.py`.

**Chosen:** `hist_gradient_boosting` (`HistGradientBoostingClassifier`,
`max_iter=300`, `learning_rate=0.1`, `max_leaf_nodes=31`,
`l2_regularization=0.0`, `early_stopping=False`) on the `full` feature set in
`bodycentric` space. Selected solely on val balanced accuracy, before the test
split was ever read.

### Final stage (chosen config, val + test)

Run once, as `final --config hist_gradient_boosting --feature-set full
--space bodycentric`. The run was repeated once after permutation-importance
reporting was added to the script; the val and test reports came back
byte-identical (fixed seed, deterministic fit), so the test split informed no
choice.

| model | split | n | accuracy | balanced acc. | macro P | macro R | macro F1 |
|---|---|---|---|---|---|---|---|
| hist_gradient_boosting | val | 81 | 0.815 | 0.815 | 0.833 | 0.815 | 0.809 |
| **hist_gradient_boosting** | **test** | **81** | **0.617** | **0.617** | **0.684** | **0.617** | **0.597** |
| dummy_majority | val | 81 | 0.111 | 0.111 | 0.012 | 0.111 | 0.022 |
| dummy_majority | test | 81 | 0.111 | 0.111 | 0.012 | 0.111 | 0.022 |
| dummy_stratified | val | 81 | 0.185 | 0.185 | 0.191 | 0.185 | 0.184 |
| dummy_stratified | test | 81 | 0.185 | 0.185 | 0.191 | 0.185 | 0.184 |

Accuracy and balanced accuracy coincide because both evaluation splits are
exactly 9 clips per class.

### Per-class F1

| class | exercise | clips per split | val F1 | test F1 |
|---|---|---|---|---|
| E01 | Abduction | 9 | 0.842 | 0.667 |
| E02 | Adduction | 9 | 1.000 | 0.783 |
| E03 | Lateral Rotation | 9 | 1.000 | 0.429 |
| E04 | Medial Rotation | 9 | 0.875 | 0.364 |
| E05 | Circumduction | 9 | 0.842 | 0.714 |
| E06 | Wrist Extension | 9 | 0.947 | 0.696 |
| E07 | Hip Joint Flexion | 9 | 0.533 | 0.471 |
| E08 | Both Leg Flexion | 9 | 0.667 | 0.500 |
| E09 | Back Extension | 9 | 0.571 | 0.750 |

### Confusion matrices (rows = annotated class, columns = prediction)

**val** (participant P21)

| true \ pred | E01 | E02 | E03 | E04 | E05 | E06 | E07 | E08 | E09 |
|---|---|---|---|---|---|---|---|---|---|
| **E01** | 8 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| **E02** | 0 | 9 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **E03** | 0 | 0 | 9 | 0 | 0 | 0 | 0 | 0 | 0 |
| **E04** | 1 | 0 | 0 | 7 | 0 | 1 | 0 | 0 | 0 |
| **E05** | 1 | 0 | 0 | 0 | 8 | 0 | 0 | 0 | 0 |
| **E06** | 0 | 0 | 0 | 0 | 0 | 9 | 0 | 0 | 0 |
| **E07** | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 4 | 1 |
| **E08** | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 8 | 0 |
| **E09** | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 3 | 4 |

**test** (participant P22)

| true \ pred | E01 | E02 | E03 | E04 | E05 | E06 | E07 | E08 | E09 |
|---|---|---|---|---|---|---|---|---|---|
| **E01** | 8 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **E02** | 0 | 9 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **E03** | 2 | 2 | 3 | 0 | 0 | 2 | 0 | 0 | 0 |
| **E04** | 0 | 1 | 2 | 2 | 0 | 4 | 0 | 0 | 0 |
| **E05** | 4 | 0 | 0 | 0 | 5 | 0 | 0 | 0 | 0 |
| **E06** | 1 | 0 | 0 | 0 | 0 | 8 | 0 | 0 | 0 |
| **E07** | 0 | 1 | 0 | 0 | 0 | 0 | 4 | 3 | 1 |
| **E08** | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 5 | 0 |
| **E09** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 6 |

### Breakdown by the dataset's own reporting dimensions

| split / camera angle | F (front) | L (left) | R (right) |
|---|---|---|---|
| val | 0.815 | 0.741 | 0.889 |
| test | 0.630 | 0.556 | 0.667 |

| split / variation | FL (full light) | LL (low light) | O (occlusion) |
|---|---|---|---|
| val | 0.926 | 0.778 | 0.741 |
| test | 0.667 | 0.593 | 0.593 |

Low light and occlusion both cost accuracy on both splits, which is the
expected direction. These are 27-clip cells, so treat the ordering between
`LL` and `O` as noise.

### Top permutation importances (measured on val, 10 repeats)

`HistGradientBoostingClassifier` has no native `feature_importances_`.
Importance is measured on **val**, never on test.

| rank | feature | importance |
|---|---|---|
| 1 | `right_wrist_mean_y` | 0.2506 |
| 2 | `clip_frames` | 0.1222 |
| 3 | `right_elbow_std_y` | 0.0864 |
| 4 | `left_wrist_mean_y` | 0.0654 |
| 5 | `clip_bbox_width` | 0.0605 |
| 6 | `left_hip_range_y` | 0.0420 |
| 7 | `right_elbow_mean_y` | 0.0420 |
| 8 | `left_elbow_mean_y` | 0.0370 |
| 9 | `right_ear_mean_y` | 0.0346 |
| 10 | `right_shoulder_mean_y` | 0.0321 |

### Duration-shortcut diagnostic (val only)

`clip_frames` ranking second prompted a check. Clip length does vary
systematically by class in the training data (mean sampled frames: E04 156,
E03 179, E05 188, E02 192, E06 204, E01 215, E09 275, E07 290, E08 313 — and
E08 effectively saturates the 320-frame sampling cap), so a classifier can
partly shortcut the task by reading duration rather than movement.

Refitting the chosen config on train with `clip_frames` removed, scored on val
only (`diagnose` subcommand):

| features | dim | val accuracy | val balanced acc. | val macro F1 |
|---|---|---|---|---|
| all features | 148 | 0.815 | 0.815 | 0.809 |
| `clip_frames` dropped | 147 | 0.753 | 0.753 | 0.741 |

So duration is worth roughly 6 accuracy points on val, and the remaining
0.753 comes from pose geometry and motion. The reported Phase 2 test number
stays with the as-selected 148-feature config; whether to drop duration
features belongs to a later phase, because changing it now and re-reading test
would be exactly the test-set iteration this phase forbids.

### Honest reading of these numbers

* **Test accuracy is 0.617, not 0.815.** The 20-point val-to-test drop is the
  headline caveat. Val is one participant (P21) and test is one participant
  (P22); each split's accuracy is one draw from a population of one, so
  neither is a generalisation estimate. A single-participant test set cannot
  support a claim about unseen people.
* The gap is **not** explained by input quality. Mean MoveNet confidence is
  0.502 on val and 0.497 on test (22 and 21 clips below 0.40 respectively) —
  essentially identical. It is participant-to-participant variation in how the
  same labelled exercise is performed, plus small-sample noise.
* The lower-body/trunk trio E07/E08/E09 is the weakest group on both splits
  (val F1 0.533/0.667/0.571, test 0.471/0.500/0.750) and the confusions are
  mostly *within* that trio. Consistent with the known framing problem: these
  are whole-body movements in wide full-room shots where MoveNet Lightning has
  the least to work with.
* On test the model additionally collapses the shoulder-rotation pair
  E03/E04 into each other and into E01/E02/E06 (E04 test F1 0.364). This did
  not happen on val, where both were near-perfect — another sign that
  single-participant splits are moving these numbers a lot.
* Both trivial baselines are far below the model on both splits (0.111 and
  0.185 accuracy), so the baseline is cleared by a wide margin even at 0.617.

### Not attempted in this phase

No LSTM/TCN/temporal deep-learning comparison was run. PyTorch is not
installed in `ml/.venv` and this phase's remit explicitly made that step
optional and time-boxed; adding a training framework was not worth the scope.
Stated here rather than left implied. If a later phase wants it, the
sequences are already on disk and unchanged.

### Artifacts

| Artifact | Path |
|---|---|
| Selection results (val only) | `ml/experiments/val_selection.json` |
| Final results (val + test) | `ml/experiments/final_results.json` |
| Checkpoint (gitignored) | `ml/models/trained/exercise_recognition_hist_gradient_boosting_full_bodycentric.joblib` |
| Fitted-model SHA-1 (stable, seed-fixed) | `6486141ac14a52913e2c31505059b58367031141` |
| Checkpoint file SHA-1 (this artifact only) | `b968bc07211a39b37ed0bd3b5c719b9b0ab88d68`, 2,421,542 bytes |

The file hash is deliberately recorded as **not** reproducible: the checkpoint
payload embeds a `trained_utc` timestamp, so the bytes differ every run.
`model_sha1` hashes the fitted estimator itself and was verified identical
across repeated runs — that is the hash to quote for reproducibility.

The checkpoint is a research artifact only. It is **not** wired into the
backend, any FastAPI route, or anything live-serving, and is not
production-cleared.
