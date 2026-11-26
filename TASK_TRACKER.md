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
- No real movement footage exists yet — MoveNet has only been proven
  against a static synthetic pose. Rep-counting accuracy on real
  knee-extension movement is unverified. Needs a consenting volunteer's
  footage or your own recorded clip (never real patient footage).
- Clinical validation, DPIA, and legal review (Kenya DPA 2019 s.46) remain
  pending before any real-patient use — see `docs/backend_guide.md` §10.
- `docker-compose*.yml` and `docs/api_contract.md` changes still need
  Steve's review before merge.
- `AGENTS.md` has an **uncommitted** working-tree edit (as of 2026-11-26
  evening) that would permit exercise-recognition/movement-deviation
  classifiers built from permitted dataset annotations. Not yet treated as
  authorization — see "Explicitly not planned" below. Needs an explicit
  confirmation (and a commit) that this is the final, intended wording
  before any classifier work starts on the strength of it.

## Explicitly not planned

- No patient-movement classification/diagnosis/recovery model, still, as
  of 2026-11-26 night. `CLAUDE.md`'s "Dataset and model-handling rules"
  says this needs an actual `AGENTS.md` change the project's stakeholders
  agree to, not an inline decision made mid-task — a chat instruction to
  "just start working" while heading to sleep doesn't satisfy that, even
  though an uncommitted edit loosening this exact rule is sitting in the
  working tree (see "Outstanding"). Resume this the moment that edit is
  confirmed as intentional and committed.
- No frontend work from Claude in this project until the user lifts that
  boundary.
