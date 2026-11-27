# Task tracker

Reflects actual implementation state. See `docs/BACKEND_STATUS.md` for the
detailed validation log this is summarized from; update both together.

## Done and verified

- Protocol/session/progress/summary/WebSocket-stream API, server-side
  authorization, dev + Supabase JWT auth paths.
- Deterministic movement engine (confidence gating, smoothing, rep state
  machine) — clinician-supplied angle bands only, no invented defaults.
- MoveNet SinglePose Lightning CPU inference, fixture mode for
  camera-free dev/testing.
- Constrained NVIDIA summary layer — numeric metrics in, validated text
  out, fixed disclaimer and clinician-review-note (never provider text).
- Supabase schema, RLS policies, and the two atomic RPCs
  (`backend_update_protocol_version`, `backend_complete_session`) —
  applied to the live project via the authorized workflow, read-only
  cross-checked against `supabase_repository.py` again on 2026-11-26
  (consistent, no mismatches).
- No-camera test harness: `vision_service/scripts/video_file_replay.py`,
  `backend/scripts/replay_video_session.py`,
  `vision_service/scripts/generate_synthetic_test_video.py`.
- Full test suites green: vision 9 passed, backend 43 passed / 1 opt-in
  live test skipped (44 total, as of 2026-11-26 night — see
  `docs/BACKEND_STATUS.md` for the count history/correction and the three
  new robustness fixtures). Ruff/ruff-format/mypy clean on both services.
- Three new synthetic fixtures close remaining "Robust Testing" gaps:
  camera drift (angle math confirmed translation-invariant), persistent
  (not transient) single-landmark low confidence (confirms full,
  non-graceful hip/knee/ankle gating), variable sample-interval cycles
  (confirms `hold_ms` correctly rejects an over-fast rep). No engine code
  changes needed — all matched existing, correct behavior.
- Live-verified end-to-end session lifecycle (protocol → session → start
  → WebSocket stream → complete → summary) against the actually-running
  Docker stack, twice (before/after the two bug fixes below).

## ML/exercise-recognition work (started 2026-11-27, see OVERNIGHT_ML_STATUS.md)

- **Phase 1 done**: MobiPhysio dataset (CC0, `commercial_ok`) — 674/674
  planned videos downloaded and MD5-verified (28.17 GB), 674/674 keypoint
  sequences extracted via a new `ml/src/pose_estimation/` module that
  reuses `vision_service/app/movenet_runner.py`'s `MoveNetRunner` directly
  (read-only, nothing under `vision_service/app/` touched). Participant-
  disjoint train/val/test split (val=P21, test=P22, both held out
  entirely). Full detail in `ml/data/dataset_report.md`.
- **Phase 2 done 2026-11-27**: first trained model in this repo — a 9-class
  exercise-recognition baseline over MobiPhysio's own annotated categories
  (E01–E09). **Test-set result: 61.7% accuracy / 0.597 macro F1** on the
  held-out participant P22 (81 clips, 9 per class), vs 11.1% majority-class
  and 18.5% stratified-random floors. Validation (P21) was 81.5%.
  scikit-learn `HistGradientBoostingClassifier` on 148 confidence-weighted,
  body-centric pose-summary features; chosen from 16 candidates on val
  only, test scored once. CPU, ~10 s train, no GPU/PyTorch. Code in
  `ml/src/training/` + `ml/src/evaluation/`; reports in `ml/experiments/`;
  lineage and checkpoint hash in `ml/models/MODEL_PROVENANCE.md`.
  Caveats stated in full there, the important one being that val and test
  are **one participant each**, so the 20-point val/test gap means neither
  number is a generalisation estimate. Checkpoint is research-only,
  gitignored, **not wired into the backend/API and not production-cleared**.

## Fixed 2026-11-26 (committed in c9fee94)

- `MAPPING_VERSION_MISMATCH` on every fixture-mode frame — fixture output
  now reports its own mapping-version identity instead of the MoveNet
  YAML's. Regression test added.
- `clinician_review_note` could be provider-controlled text that
  contradicted the app's own disclaimer (a live NVIDIA call returned "No
  review required"). Now a fixed constant. Regression test added.
- Supabase demo seed (`001_synthetic_demo.sql`) had stale protocol
  parameter keys that no longer match `_protocol_configuration`. Fixed in
  the repo; not applied to the live project.

## Outstanding

- **Rotate `SUPABASE_SERVICE_ROLE_KEY` and `NVIDIA_API_KEY`** — both were
  accidentally printed into a local tool-output transcript (not git) during
  this session's work. Not yet done as of 2026-11-26.
- Real Supabase write path not re-verified since the credential exposure
  (deliberately tested via the in-memory repository instead this session).
  Re-verify live once rotated.
- **Partially resolved 2026-11-27**: MoveNet has now been run against real
  (non-synthetic) human footage for the first time in this repo — 674
  MobiPhysio clips, 149,401 real pose frames (see "ML/exercise-recognition
  work" below). But MobiPhysio has no knee-extension exercise, so this does
  **not** verify RehabLoop's actual rep-counting/angle accuracy on
  knee-extension movement specifically — that still needs a consenting
  volunteer's own knee-extension footage (never real patient footage).
  What it does newly confirm: MoveNet Lightning's measured keypoint
  confidence on real people in non-ideal framing (wide, full-room
  smartphone shots) averages 0.487 and drops below 0.40 on 173/674 clips —
  a real input-framing sensitivity worth knowing before relying on similar
  framing for knee-extension sessions.
- Clinical validation, DPIA, and legal review (Kenya DPA 2019 s.46) remain
  pending before any real-patient use — see `docs/backend_guide.md` §10.
- `docker-compose*.yml` and `docs/api_contract.md` changes still need
  Steve's review before merge.
- ~~`AGENTS.md` uncommitted edit~~ — **resolved 2026-11-26 23:59** (commit
  `c4a22a9`, by Lennox). Exercise-recognition/movement-deviation
  classifiers built from permitted dataset annotations are now explicitly
  in scope — see `AGENTS.md`'s "Safety and data handling" section for the
  exact, controlling wording. `CLAUDE.md`'s "Dataset and model-handling
  rules" updated to match.

## Explicitly not planned

- Still no model that infers injury, danger, clinical status, recovery,
  prognosis, or progression, or that recommends treatment/exercise targets
  — `AGENTS.md`'s new wording explicitly keeps this line even though
  exercise-recognition/movement-pattern classifiers are now permitted.
- No frontend work from Claude in this project until the user lifts that
  boundary.
