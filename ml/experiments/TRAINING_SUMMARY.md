# Training summary — Phase 2 exercise-recognition baseline

Date: 2026-11-27. Owner: Lennox. CPU only.

## What was built

A nine-class classifier that reads one clip's MoveNet COCO-17 keypoint
sequence and predicts which of MobiPhysio's nine annotated exercise categories
it is: Abduction, Adduction, Lateral Rotation, Medial Rotation,
Circumduction, Wrist Extension, Hip Joint Flexion, Both Leg Flexion, Back
Extension.

That is the whole claim. It does not score how well an exercise was performed,
does not use the dataset's EAAQ column, and says nothing about anyone's
health, injury, recovery or clinical status.

## The result

| | accuracy | balanced acc. | macro F1 |
|---|---|---|---|
| Majority-class baseline (test) | 0.111 | 0.111 | 0.022 |
| Stratified-random baseline (test) | 0.185 | 0.185 | 0.184 |
| **Model, test (P22, 81 clips)** | **0.617** | **0.617** | **0.597** |
| Model, val (P21, 81 clips) | 0.815 | 0.815 | 0.809 |

**Headline: 61.7% test accuracy on 9 balanced classes**, against an 11.1%
majority-class floor. Comfortably better than trivial, and clearly not good
enough to rely on for anything.

## How it works

* **Features (148 per clip).** Variable-length sequences (39-320 frames) are
  collapsed into per-keypoint confidence-weighted statistics — mean x/y, std
  x/y, 5-95 percentile travel range in x/y, and mean/std of frame-to-frame
  displacement — plus three motion-share ratios (upper limb / lower limb /
  trunk) and nine whole-clip descriptors (frame count, confidence stats, torso
  scale, motion energy, bounding box). Every statistic is weighted by MoveNet's
  own per-keypoint confidence, because mean confidence on this footage is only
  0.487 and MoveNet emits coordinates whether or not it found the joint.
* **Coordinates** are re-expressed per frame relative to the mid-hip point and
  divided by a clip-level torso scale, so where the participant stood and how
  much of the frame they filled drop out.
* **Model.** `HistGradientBoostingClassifier` (scikit-learn, CPU, seed 42),
  300 iterations, learning rate 0.1, 31 leaves. Chosen out of 16 candidates
  (random forest / gradient boosting x two feature sizes x two coordinate
  spaces) on validation balanced accuracy, before the test split was read.
* **Protocol.** Fit on train (512 clips, 7 participants) only. All tuning on
  val (P21). Test (P22) scored once, after the configuration was locked. Total
  compute: about 10 seconds.

## What to be careful about

1. **Val and test are one participant each.** 0.815 on P21 and 0.617 on P22
   are two draws from a population of one apiece. The 20-point spread between
   them is the single most important number in this report: it says
   participant-to-participant variation is larger than any model difference
   measured here, and that **neither figure is a generalisation estimate**.
   Widening the held-out sets has to come before anyone treats 0.617 as "the"
   accuracy.
2. **It is not an input-quality artefact.** Mean MoveNet confidence is 0.502
   on val and 0.497 on test — the same. The gap is behavioural, not a pose
   failure difference.
3. **Lower-body/trunk classes are the weak group.** E07 Hip Joint Flexion,
   E08 Both Leg Flexion and E09 Back Extension score worst on both splits and
   are mostly confused with each other. Consistent with the known Phase 1
   framing problem: these are whole-body movements in wide full-room
   smartphone shots, where MoveNet Lightning has the least to work with.
4. **Clip duration is a partial shortcut.** Clip length varies systematically
   by class (E04 averages 156 sampled frames, E08 effectively hits the
   320-frame cap). Dropping the frame-count feature costs about 6 accuracy
   points on val (0.815 -> 0.753), so most of the signal is genuine pose
   geometry — but not all of it. Removing duration features is a candidate
   change for a later phase, deliberately not made here because re-reading
   test to evaluate it would break this phase's test-set discipline.
5. **Male-only held-out splits**, no camera-jitter or low-resolution
   variations, 9 of MobiPhysio's 58 participants. All inherited from Phase 1's
   sample bounds (`ml/data/dataset_report.md`); none of them improved here.
6. **No temporal deep-learning comparison was run.** The optional LSTM/TCN
   step was skipped — PyTorch is not installed in `ml/.venv` and this phase
   kept its scope to classical models. Saying so explicitly: it was skipped,
   not attempted and omitted.

## Status and next steps

Internal research/evaluation baseline only. **Not integrated into the live
backend or API, not production-cleared.** Wiring any model into the product is
a separate decision that nobody has made.

Reasonable next steps, in rough value order:

1. Widen val/test beyond one participant each (more MobiPhysio participants
   are available; coverage was the Phase 1 constraint).
2. Address the pose-input quality limit — person-crop before MoveNet, or
   evaluate a heavier pose model — since the weakest classes are the ones
   where keypoints are least reliable.
3. Re-run without the duration features and report both, so the
   movement-only number is the one carried forward.
4. Only then consider a small temporal model on the raw sequences.

## Files

| What | Where |
|---|---|
| Feature extraction | `ml/src/training/features.py` |
| Training / selection / final evaluation | `ml/src/training/train_classifier.py` |
| Metrics | `ml/src/evaluation/metrics.py` |
| Markdown table rendering | `ml/src/evaluation/report.py` |
| Full log, confusion matrices | `ml/experiments/EXPERIMENT_LOG.md` |
| Baseline vs. model comparison | `ml/experiments/MODEL_COMPARISON.md` |
| Raw results | `ml/experiments/val_selection.json`, `ml/experiments/final_results.json` |
| Checkpoint (gitignored) | `ml/models/trained/exercise_recognition_hist_gradient_boosting_full_bodycentric.joblib` |
| Provenance | `ml/models/MODEL_PROVENANCE.md` |

Reproduce with:

```
cd ml
./.venv/Scripts/python.exe -m src.training.train_classifier select
./.venv/Scripts/python.exe -m src.training.train_classifier final \
    --config hist_gradient_boosting --feature-set full --space bodycentric
./.venv/Scripts/python.exe -m src.evaluation.report
```
