# Model provenance

Opened in Phase 1 (dataset acquisition + offline pose feature extraction) and
extended by Phase 2 (first trained model). Phase 1's record is preserved
verbatim below; the Phase 2 section is appended at the end.

**Current state: one trained model exists** — a nine-class
exercise-recognition baseline, 2026-11-27. See "Phase 2" at the bottom. It is
an internal research/evaluation artifact and is not part of the running
product.

## Status as of Phase 1

| Item | State |
|---|---|
| Trained models in this repo | **None.** No training was run, no checkpoint, no weights, no PyTorch, no GPU/CUDA anywhere. |
| What Phase 1 produced | Downloaded third-party video + derived MoveNet COCO-17 keypoint sequences. See `ml/data/dataset_report.md`. |
| Pose model used | Google **MoveNet SinglePose Lightning** (`movenet_singlepose_lightning.tflite`), Apache-2.0, pretrained, run on CPU via LiteRT. Not fine-tuned and not trained here. |
| Pose model code path | `vision_service/app/movenet_runner.py`'s `MoveNetRunner`, imported read-only by `ml/src/pose_estimation/movenet_sequence_extractor.py`. Identical weights and preprocessing to the live `/infer` endpoint. |

## Licence inheritance for any future model

Phase 1's processed features derive entirely from one source:

- **MobiPhysio v1.1** — Harvard Dataverse `doi:10.7910/DVN/XSI0QN`,
  **CC0 1.0 Universal** (public-domain dedication),
  `license_class: commercial_ok`. Full review: `ml/data/license_review.md`.

Therefore **any model trained on `ml/data/processed/mobiphysio_movenet/`
inherits `license_class: commercial_ok`**: CC0 imposes no copyleft, no
non-commercial restriction and no attribution condition on derivative works,
so neither the derived features nor a model fitted to them carries a
downstream licence obligation. Crediting the MobiPhysio authors remains good
practice (citation in `ml/data/license_review.md`).

The pretrained pose model that generated the features is Apache-2.0
(permissive, commercial use allowed, requires its own notice retention). It is
used as-is and is not redistributed from this repo — model weights are
`.gitignore`d and mounted from the host.

**This inheritance holds only while the training corpus stays
MobiPhysio-only.** Adding any other dataset re-opens the question. Notably
REHAB24-6 is CC BY-NC 4.0 (non-commercial) and would break
`commercial_ok` if mixed in; WLU is MIT and would add an attribution
obligation. Record any such addition here before training on it.

## Boundaries any future model in this directory must satisfy

From `AGENTS.md` (the controlling wording, updated in commit `c4a22a9`) and
`CLAUDE.md`'s "Dataset and model-handling rules":

- Permitted: exercise recognition, repetition segmentation/counting, and
  classifiers for movement categories or deviations that are **explicitly
  defined by permitted dataset annotations**. Outputs describe the observed or
  dataset-defined movement pattern.
- Forbidden: any inference of injury, danger, clinical status, recovery,
  prognosis or clinical progression; any treatment recommendation or
  prescribed exercise target.
- The MobiPhysio EAAQ score is a legitimate target (physiotherapist-assessed
  exercise-execution accuracy, 0–100, on the dataset's own questionnaire) and
  must be described as exactly that — never as a patient's health status.
- Real patient footage, patient data and model weights never go in Git.
- CPU-only in this project's current setup; no GPU/CUDA dependency was
  introduced.

## To be filled in by the training phase

Filled in by Phase 2 below (2026-11-27). The items this section asked for —
architecture, feature spec, split actually used, metrics per exercise /
variation / camera angle, carried-over limitations, checkpoint location and
hash — are all recorded there.

---

# Phase 2 — nine-class exercise-recognition baseline (2026-11-27)

## What the model does, and does not do

| | |
|---|---|
| Predicts | Which of MobiPhysio's nine **dataset-annotated** exercise categories a clip's keypoint sequence belongs to: E01 Abduction, E02 Adduction, E03 Lateral Rotation, E04 Medial Rotation, E05 Circumduction, E06 Wrist Extension, E07 Hip Joint Flexion, E08 Both Leg Flexion, E09 Back Extension. |
| Output | One of nine category labels. Nothing else. |
| Does **not** | Score execution quality or correctness. Use the EAAQ column as a target (EAAQ was not used in this phase at all). Infer injury, danger, clinical status, recovery, prognosis or clinical progression. Recommend a treatment or an exercise target. |

This is exercise recognition over categories explicitly defined by permitted
dataset annotations — the case `AGENTS.md` (commit `c4a22a9`) and `CLAUDE.md`'s
"Dataset and model-handling rules" permit for internal R&D.

## Status — read this before using the checkpoint for anything

> **Internal research/evaluation baseline only — not integrated into the live
> backend/API, not production-cleared.**

The checkpoint is not referenced by `backend/`, by any FastAPI route, or by
`vision_service/`. Nothing under `vision_service/app/` was modified in Phase 2.
This status is independent of the dataset licence: CC0 removes licence
obstacles, it does not make a model fit to serve. Wiring any model into the
product is a separate, much larger decision that has not been made.

## Dataset lineage

| Item | Value |
|---|---|
| Source dataset | **MobiPhysio v1.1**, Harvard Dataverse `doi:10.7910/DVN/XSI0QN` |
| Licence | **CC0 1.0 Universal** (public-domain dedication) |
| `license_class` | `commercial_ok` — licence review in `ml/data/license_review.md` |
| Training corpus | MobiPhysio only. The `commercial_ok` inheritance recorded above therefore holds for this model. |
| Real patient data | None. No real patient footage or patient data was used, downloaded or produced. |
| Derived features | `ml/data/processed/mobiphysio_movenet/{split}/*.npz` — written by Phase 1, reused unchanged. No pose re-extraction in Phase 2. |
| Pose model that produced the features | Google MoveNet SinglePose Lightning (Apache-2.0), pretrained, CPU via LiteRT, unmodified — see Phase 1 section above |
| Dataset sample bounds | 9 of 58 participants; variations `FL`/`LL`/`O` only; see `ml/data/dataset_report.md` |

## Train/val/test split actually used

Participant-disjoint, exactly Phase 1's assignment
(`ml/data/dataset_manifest.csv`), per MobiPhysio's own recommended protocol.

| split | clips | participants | classes present |
|---|---|---|---|
| train | 512 | P02, P04, P05, P07, P08, P09, P10 | 9/9 |
| val | 81 | **P21** (held out entirely) | 9/9 (9 clips each) |
| test | 81 | **P22** (held out entirely) | 9/9 (9 clips each) |

Val was used for every hyperparameter and feature choice. Test was scored once,
after the configuration was locked, and informed no choice.

## Model type and version

| Item | Value |
|---|---|
| Type | `sklearn.ensemble.HistGradientBoostingClassifier` — gradient-boosted decision trees |
| Hyperparameters | `max_iter=300`, `learning_rate=0.1`, `max_leaf_nodes=31`, `l2_regularization=0.0`, `early_stopping=False`, `random_state=42` |
| Input | 148 fixed-length features per clip, body-centric coordinate space (per-frame mid-hip origin, clip-level torso-scale divisor), all statistics confidence-weighted. Spec and code: `ml/src/training/features.py` |
| Selected from | 16 candidates (random forest / gradient boosting x 60- or 148-feature set x raw or body-centric coordinates), ranked on val balanced accuracy |
| Trained by | `ml/src/training/train_classifier.py` |
| Hardware | CPU only. No GPU, no CUDA, no PyTorch anywhere in this phase. |
| Environment | Python 3.12.10, scikit-learn 1.9.1, numpy 2.5.5, joblib 1.6.0 |
| Training cost | ~5 s featurisation + ~4 s fit. No external compute, no spend. |
| Version | `exercise-recognition-baseline-v0.1` (first trained model in this repo) |

## Checkpoint

| Item | Value |
|---|---|
| Path (outside Git — `models/` is gitignored, deliberately left that way) | `ml/models/trained/exercise_recognition_hist_gradient_boosting_full_bodycentric.joblib` |
| Format | `joblib` dict: model, feature names, class list, seed, library versions, dataset/licence strings, intended-use string |
| Size | 2,421,542 bytes |
| **Fitted-model SHA-1** (stable identifier) | `6486141ac14a52913e2c31505059b58367031141` — `joblib.hash` of the estimator; verified identical across repeated runs |
| Checkpoint file SHA-1 (this artifact only) | `b968bc07211a39b37ed0bd3b5c719b9b0ab88d68` — **not** reproducible: the payload embeds a `trained_utc` timestamp, so the file bytes change every run |
| Reproducible | Yes — fixed seed 42; repeated runs produced identical val and test reports and an identical fitted-model hash |

## Headline test metrics

Test = participant P22, 81 clips, 9 per class. Chance level 0.111.

| model | accuracy | balanced acc. | macro P | macro R | macro F1 |
|---|---|---|---|---|---|
| Majority-class baseline | 0.111 | 0.111 | 0.012 | 0.111 | 0.022 |
| Stratified-random baseline | 0.185 | 0.185 | 0.191 | 0.185 | 0.184 |
| **This model** | **0.617** | **0.617** | **0.684** | **0.617** | **0.597** |

Validation (P21) for reference: accuracy 0.815, balanced accuracy 0.815, macro
F1 0.809.

Per-exercise F1, per-camera-angle and per-variation accuracy, and both
confusion matrices: `ml/experiments/EXPERIMENT_LOG.md`. Raw numbers:
`ml/experiments/final_results.json`.

## Known limitations

Carried over from `ml/data/dataset_report.md`, none of them fixed here:

- **One held-out participant per split.** 0.815 (P21) and 0.617 (P22) are each
  a single draw from a population of one. The 20-point spread between them
  exceeds every difference between the 16 candidate models. **Neither number
  is a generalisation estimate**, and the test figure must not be presented as
  one.
- **Val/test are male-only**, and E07-E09 have no female examples anywhere in
  this sample. Cross-gender generalisation is unmeasured and must not be
  claimed.
- **MoveNet confidence is low on this footage** — 0.487 mean across the corpus;
  0.502 on val and 0.497 on test, i.e. the val/test gap is *not* an
  input-quality difference. The weakest classes (E07/E08/E09) are the
  whole-body movements where wide full-room framing hurts MoveNet Lightning
  most, and they are mostly confused with each other.
- **Clip duration is a partial shortcut.** Class durations differ
  systematically (E04 ~156 sampled frames, E08 saturating the 320-frame cap).
  A val-only ablation puts the frame-count feature's contribution at about 6
  accuracy points (0.815 -> 0.753); the rest is pose geometry. Not removed in
  this phase because evaluating the removal on test would break test-set
  discipline.
- **No camera-jitter or low-resolution robustness claim is possible** — those
  variations are not in the Phase 1 sample.
- **No temporal deep-learning comparison** was run (optional for this phase;
  PyTorch is not installed). Skipped, not attempted-and-omitted.

## Boundary compliance for this model

- Built only on CC0, already-published third-party research data; no real
  patient data touched.
- Predicts a dataset-annotated movement category and nothing else; no
  clinical, diagnostic, injury, recovery, prognosis or progression inference,
  and no treatment or exercise target.
- Weights live outside Git. CPU only. No external paid compute.
- `docs/backend_guide.md` §10's DPIA/legal gate on real-patient use is
  untouched and still blocks real-patient use regardless of this model.
