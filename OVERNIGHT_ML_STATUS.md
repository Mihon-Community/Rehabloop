# Overnight ML/vision status — 2026-11-26

Owner: Lennox. Tracks the overnight mission request to build RehabLoop's
ML/vision/performance work autonomously. Read this alongside `TASK_TRACKER.md`
(overall backend/vision state), `DEVELOPMENT_ROADMAP.md`, and the two detail
docs it points to (`docs/movenet_pipeline_status.md`,
`docs/rehab_dataset_landscape.md`).

## The one blocked decision

The mission brief's core objective — exercise recognition, repetition-phase
classification, movement-deviation detection, a "recovery-progress system" —
is a patient-movement classification/recovery model. `CLAUDE.md`'s "Dataset
and model-handling rules" says this conflicts with `AGENTS.md` and
**"needs an actual `AGENTS.md` change the project's stakeholders agree to,
not an inline decision made mid-task."**

`AGENTS.md` currently has an **uncommitted** working-tree edit that would
permit exactly this (exercise recognition, repetition counting, and
dataset-annotation-defined movement/deviation classifiers). Found during this
session; not known whether it's a deliberate final decision or an
in-progress draft. Not treated as authorization — a chat instruction to
proceed while unavailable to confirm isn't the "stakeholders agree" process
`CLAUDE.md` asks for. **No classification/training code has been written.**

To unblock: commit that `AGENTS.md` wording (or revise it) as a deliberate
decision, and say so explicitly. Everything below is what was done instead,
all within the existing rules.

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

This is licensing research only, kept on file for if/when the `AGENTS.md`
question above is resolved. Nothing has been ingested or processed. Using any
of this data for real training still requires the DPIA/legal review
`docs/backend_guide.md` §10 already requires — license research isn't a
substitute for that.

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

- No real movement footage, no classifier, no training pipeline, no `ml/`
  directory — see "The one blocked decision" above.
- No frontend changes — out of scope per `AGENTS.md`/`CLAUDE.md`; verified
  untouched (`git status` shows nothing under `frontend/`).
- No `docker-compose*.yml` or `docs/api_contract.md` changes — need Steve's
  review first, and nothing required changing them anyway.
