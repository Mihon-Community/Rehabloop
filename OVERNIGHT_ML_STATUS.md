# Overnight ML/vision status — 2026-11-26

Owner: Lennox. Tracks the overnight mission request to build RehabLoop's
ML/vision/performance work autonomously. Read this alongside `TASK_TRACKER.md`
(overall backend/vision state), `DEVELOPMENT_ROADMAP.md`, and the two detail
docs it points to (`docs/movenet_pipeline_status.md`,
`docs/rehab_dataset_landscape.md`).

## Unblocked 2026-11-26 23:59 (commit c4a22a9)

Lennox committed the `AGENTS.md` change that permits exercise-recognition
and movement-category/deviation classifiers built from permitted dataset
annotations. `CLAUDE.md` updated to match (its old "direct conflict"
wording was stale). Actual classifier-building work has started — see
"Phase 1: in progress" below. The line that's still firmly in force: no
model may infer injury, danger, clinical status, recovery, prognosis, or
progression, or recommend treatment/exercise targets.

## Phase 1 (dataset acquisition + offline pose extraction): DONE

Dataset: **MobiPhysio** (Harvard Dataverse, CC0 1.0, `commercial_ok`, 9
labelled AROM physiotherapy exercises E01–E09, EAAQ physiotherapist
accuracy scores). WLU/Kaggle stays blocked (needs an account not available
here — see `docs/rehab_dataset_landscape.md`).

**674/674 planned videos downloaded** (28.17 GB, every file size+MD5
verified against the Dataverse listing) and **674/674 keypoint sequences
extracted** (149,401 total pose frames) — participant-disjoint splits:
train (512 videos, P02/P04/P05/P07/P08/P09/P10), val (81, P21 held out
entirely), test (81, P22 held out entirely). All 9 exercise classes present
in every split. One real hiccup, caught and fixed, not just reported: the
first extraction pass hit 29 "missing" files because the orchestrating
script's own file-count check raced the last few (largest) downloads still
being flushed to disk — confirmed by exact byte-size match once settled,
then re-ran extraction (idempotent, skips already-done work) to pick up all
674. No data was actually lost or corrupted.

Pipeline: `ml/src/pose_estimation/` reuses `vision_service/app/movenet_runner.py`'s
`MoveNetRunner` directly (same `.tflite`, same preprocessing — training-
serving consistency), read-only, nothing under `vision_service/app/`
touched. Keeps the full 17 COCO keypoints (not just the 3-point live-API
mapping), since MobiPhysio spans upper body/trunk, not just hip/knee/ankle.

**Honest measurement-quality finding**: mean per-clip keypoint confidence
0.161–0.742 (mean 0.487); 173/674 clips average below 0.40. MobiPhysio is
wide full-room smartphone footage, and MoveNet Lightning's 192×192 input
expects the person to fill more of the frame — a real limit of this
pose model on this footage, not an exercise property. No crop/upscale/model
swap was introduced to "fix" this, since Phase 1 required byte-identical
production preprocessing; it's carried forward as a caveat for Phase 2.

Full detail: `ml/data/dataset_report.md`, `dataset_manifest.csv`,
`license_review.md`, `download_log.md`; data under `ml/data/raw/` and
`ml/data/processed/` (both gitignored — nothing here will be committed).
Documented gaps (deliberate, not errors): only `FL`/`LL`/`O` variations
downloaded (jitter/low-res dropped to stay in budget); only 9 of 58
participants used; val/test are male-only because no female participant
has full 9-exercise coverage in the source dataset (E07–E09 have zero
female examples in this sample) — cross-gender generalisation cannot be
claimed from this sample.

## Phase 2 (baseline exercise-recognition model): DONE 2026-11-27

**Headline: 61.7% test accuracy on 9 balanced exercise classes** (macro F1
0.597), against an 11.1% majority-class floor and an 18.5% stratified-random
floor. Validation was 81.5% — and that 20-point val/test gap is the real
finding, see below.

What it predicts: which of MobiPhysio's nine dataset-annotated exercise
categories (E01–E09) a clip is. Nothing else. No quality score, no EAAQ
target, no injury/clinical/recovery/progression inference of any kind.

- **Features** (148 per clip): variable-length sequences (39–320 frames)
  collapsed into per-keypoint confidence-weighted mean/std/travel-range of
  x,y plus frame-to-frame displacement stats, three limb/trunk motion-share
  ratios, and nine whole-clip descriptors. Coordinates re-expressed per
  frame relative to mid-hip and divided by a clip-level torso scale.
  Everything is confidence-weighted on purpose — MoveNet emits 17
  coordinates whether or not it found the joint, and mean confidence on
  this footage is only 0.487.
- **Model**: scikit-learn `HistGradientBoostingClassifier` (300 iters, lr
  0.1, 31 leaves, seed 42). Picked from 16 candidates (RF vs GB × 60- vs
  148-feature set × raw vs body-centric coords) **on val only**; test was
  read once after the config was locked. CPU, ~10 s total train time, no
  GPU, no PyTorch, no external spend.
- **Honest caveat that matters more than the number**: val is one
  participant (P21) and test is one participant (P22). 0.815 vs 0.617 is
  two draws from a population of one each, and the spread between them is
  bigger than the spread across all 16 models on val. Neither figure is a
  generalisation estimate. Widening the held-out sets has to come before
  anyone quotes 0.617 as "the" accuracy.
- It is **not** an input-quality difference: mean MoveNet confidence is
  0.502 on val and 0.497 on test. The gap is how the two people move.
- Weakest classes on both splits are E07 Hip Joint Flexion / E08 Both Leg
  Flexion / E09 Back Extension, mostly confused with *each other* — exactly
  the whole-body movements where Phase 1's wide-full-room framing problem
  bites hardest. The framing caveat carried forward from Phase 1 shows up
  in the results as predicted.
- **One shortcut found and measured, not hidden**: clip duration differs
  systematically by class (E04 ~156 sampled frames, E08 saturating the
  320-frame cap). A val-only ablation puts the frame-count feature at ~6
  accuracy points (0.815 → 0.753); the remaining 0.753 is genuine pose
  geometry. Deliberately *not* removed in this phase — evaluating that
  change would have meant re-reading test, which is the one thing this
  phase forbids. It's the top candidate change for Phase 3.
- **Skipped, saying so plainly**: no LSTM/TCN comparison. That step was
  optional; PyTorch isn't installed in `ml/.venv` and adding a training
  framework wasn't worth the scope. Still no PyTorch anywhere in this repo.
- Code: `ml/src/training/features.py`, `ml/src/training/train_classifier.py`,
  `ml/src/evaluation/metrics.py`, `ml/src/evaluation/report.py`. Ruff +
  ruff-format clean. Phase 1 sequences reused as-is; no pose re-extraction,
  nothing under `vision_service/app/` touched.
- Reports: `ml/experiments/TRAINING_SUMMARY.md` (start here),
  `EXPERIMENT_LOG.md` (full confusion matrices, per-class F1, camera-angle
  and lighting/occlusion breakdowns), `MODEL_COMPARISON.md` (baselines vs
  models side by side), `ml/models/MODEL_PROVENANCE.md` (lineage, splits,
  checkpoint SHA-1).
- **Checkpoint is research-only**: `ml/models/trained/` (gitignored, left
  that way). Not wired into the backend, any FastAPI route, or anything
  live-serving. **Not production-cleared** — that stays true regardless of
  the CC0 licence, because integration is a separate decision nobody has
  made.

## The one blocked decision — history (resolved 2026-11-26 23:59, commit c4a22a9)

The mission brief's core objective — exercise recognition, repetition-phase
classification, movement-deviation detection — touches the same ground as a
patient-movement classification/recovery model, which `CLAUDE.md`'s old
"Dataset and model-handling rules" flagged as conflicting with `AGENTS.md`,
needing "an actual `AGENTS.md` change the project's stakeholders agree to,
not an inline decision made mid-task." Earlier this session an uncommitted
working-tree edit to `AGENTS.md` carrying exactly that permission was found
and deliberately **not** treated as authorization, since it wasn't yet a
committed, deliberate decision. Lennox then committed it (`c4a22a9`) and
said so explicitly — that's what actually unblocked Phase 1/2 above. Kept
here only as the record of why work paused and then resumed.

## What's already true about the existing pipeline (verified, not assumed)

Full detail in `docs/movenet_pipeline_status.md`. Summary: MoveNet SinglePose
**Lightning**, TFLite/LiteRT, **CPU-only**, runs in `vision_service` (not the
browser — no training/serving mismatch to reconcile). COCO-17 keypoints,
mapped to hip/knee/ankle via `vision_service/config/movenet_keypoint_mapping.yaml`.
Confidence-gated, EMA-smoothed 2D projected knee angle feeds a deterministic
rep-counting state machine — no ML in that layer, by design. Measured
inference: 15–50ms against a 125ms/frame budget (8fps cap) — **no performance
bottleneck found**, so no optimization work was indicated or attempted.

No existing ML training pipeline, PyTorch, or checkpoints exist in this repo
— that's deliberate, not a gap (see `CLAUDE.md`).

## Dataset license research (read-only, nothing downloaded)

Full table in `docs/rehab_dataset_landscape.md`. All six datasets named in
the mission brief now have a license finding:

| Dataset | License status | Commercial use |
|---|---|---|
| WLU Rehabilitation Posture (Kaggle) | MIT | Yes |
| REHAB24-6 (Zenodo) | CC BY-NC 4.0 | No |
| MobiPhysio (Harvard Dataverse) | CC0 1.0 | Yes |
| Upper Limb Stroke Rehab (Mendeley) | CC BY 4.0 | Yes (upper-limb, not knee) |
| UI-PRMD | PDDL v1.0 (public domain) | Yes (skeleton data only, no video) |
| PrimSeq (NYU) | **Blocked** — needs a SimTK account to see actual terms | Unclear |

This table was originally licensing research only; **MobiPhysio has since
been ingested and processed** (Phase 1/2 above) now that the `AGENTS.md`
question is resolved. The others remain research-only records: WLU is
blocked on a Kaggle account, PrimSeq on a SimTK account, and REHAB24-6's
CC BY-NC license would need separate negotiation before any commercial use
(internal research/eval use is fine under its terms, just not attempted
yet). `docs/backend_guide.md` §10's DPIA/legal-review gate is specifically
about a real-patient pilot, not about using already-licensed third-party
research data within its own stated scope — see `CLAUDE.md` for the exact
distinction.

## Done tonight, continued

1. **Test re-verification (done)**: vision pytest still 9/9. Backend pytest
   actually collects **40 passed / 1 skipped (41 total)**, not the "42"
   `docs/BACKEND_STATUS.md` recorded — corrected there and in
   `TASK_TRACKER.md`. `git log --stat` confirms only test additions since
   that doc was written, no deletions, so this was a stale figure, not a
   regression. Ruff/ruff-format/mypy clean on both services. No source code
   touched during verification.
2. **Pose-model research (done)**: `docs/pose_model_research.md` — survey of
   MoveNet Thunder, BlazePose, RTMPose, YOLOv8/11-Pose as measurement-accuracy
   alternatives (explicitly not a classification model). Caveat worth
   repeating: the agent that wrote it did **not** actually have Hugging Face
   MCP tool access despite being asked to use it — it used trained-in
   knowledge of each model's public card/paper instead, and said so plainly
   in the file. Treat it as a first-pass literature survey to be re-verified
   against live sources before anyone acts on it, not confirmed current data.
   Verdict: no switch justified now (no measured bottleneck); MoveNet
   Thunder flagged as lowest-friction option *if* an accuracy problem is
   ever documented later.
3. **Done**: filled the remaining "Robust Testing" edge-case gaps from the
   mission brief — three new synthetic fixtures + tests in
   `backend/scripts/generate_synthetic_fixtures.py` /
   `backend/tests/test_movement_engine.py`:
   - `camera_drift.json`: steady per-frame coordinate drift on top of a
     clean 8-rep cycle. 8/8 counted — confirms the engine's angle math is
     genuinely translation-invariant (it only uses relative joint
     vectors). No bug.
   - `persistent_partial_visibility.json`: ankle confidence held below
     the gate for an *entire* sequence (vs. `dropout.json`'s transient
     1-frame drop). 0 reps, `LANDMARK_CONFIDENCE_LOW` — confirms the
     engine gates hip/knee/ankle identically, with no partial/graceful
     path for losing just one of the three. That's its correct, as-designed
     behavior, not a bug — worth knowing precisely because real footage
     with a borderline-occluded ankle (a known MoveNet/camera-angle
     limitation, see `docs/movenet_pipeline_status.md`) would currently
     score a whole rep as unusable rather than degrading partially.
   - `variable_speed.json`: the same rep shape sampled at 50ms/200ms/400ms
     intervals. 2 of 3 cycles counted — the 50ms one is correctly rejected
     for not clearing `RepConfig.hold_ms`, confirmed by tracing the state
     machine's actual thresholds, not assumed.
   No `movement_engine.py` changes were needed — all three matched
   existing, correct behavior. Backend suite now **43 passed / 1 skipped
   (44 total)**, `test_movement_engine.py` 11→14. Ruff/ruff-format/mypy
   still clean.

## Noticed, not acted on

- `docs/RehabLoop_App_Overview.pptx` appeared in the working tree during
  this session (untracked). Not created by me or any delegated agent —
  presumably dropped in by you. Left untouched.

## Urgent, needs you specifically

- **Rotate `SUPABASE_SERVICE_ROLE_KEY` and `NVIDIA_API_KEY`** — both were
  accidentally printed into a local tool-output transcript (not git) earlier
  this session. Still not rotated. I don't have console access to do this
  myself.
- Re-verify the live Supabase write path once rotated.

## Not attempted, and why

- No knee-extension-specific real footage, and no model wired into the
  backend/API — MobiPhysio has no knee-extension exercise, and integrating
  any trained model into the live product is a separate decision nobody has
  made (see Phase 2's "not production-cleared" note above).
- REHAB24-6, Upper Limb Stroke, UI-PRMD, PrimSeq not yet ingested — licensed/
  scoped in `docs/rehab_dataset_landscape.md` but not acted on; WLU and
  PrimSeq remain blocked on accounts not available here.
- No frontend changes — out of scope per `AGENTS.md`/`CLAUDE.md`; verified
  untouched (`git status` shows nothing under `frontend/`).
- No `docker-compose*.yml` or `docs/api_contract.md` changes — need Steve's
  review first, and nothing required changing them anyway.
