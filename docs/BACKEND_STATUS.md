# Backend integration status

Updated: 2026-11-26
Branch: `feature/lennox`

## Implemented

- Protocol, session, progress, summary, and WebSocket flows use server-side
  authorization. UUID inputs are validated at the route boundary.
- Local demo authentication is available only with `APP_ENV=local`. Supabase
  access tokens use JWKS verification for asymmetric signing or Supabase Auth
  remote verification for legacy HS256 tokens. Application roles are loaded
  from trusted profile rows; anonymous users are rejected.
- Session completion and protocol version changes use transactional Postgres
  functions. The repository uses supported PostgREST write paths, and saved
  summaries are reused unless regeneration is requested.
- Streaming reuses an async vision client, enforces frame order/rate limits,
  and keeps image frames transient. `STORE_RAW_VIDEO` remains false.
- The CPU vision path is MoveNet SinglePose Lightning through LiteRT. Its model
  file lives in `C:/movenet-host`, outside the repository, and is mounted read-only.
  The ignored root `.env` selects MoveNet; no `.env` values are recorded here.
- Backend session metadata records the MoveNet model and COCO-17 mapping
  version. The vision service maps official left/right hip, knee and ankle
  indices into normalized source-frame coordinates.
- Fixture and MoveNet CPU are the only supported vision modes. Unused model
  runners, mappings, and dependencies were removed.
- Shared API examples and smoke-test docs describe MoveNet. Contract and
  Compose changes need Steve's review before merge.

## Validation

- Vision pytest: 8 passed. Backend pytest: 39 passed, 1 opt-in live test skipped.
  Ruff, Ruff format, and mypy passed for both services.
- FastAPI health, mapping and `/infer` requests passed with the downloaded CPU
  model and a generated 640x480 synthetic seated figure. It detected the person,
  marked all three selected-side landmarks valid, and returned them in 14.8 ms.
  This is a wiring smoke test, not pose-accuracy or clinical validation.
- The CPU vision and backend images built successfully. Both containers reached
  `healthy`; backend `/api/v1/health` returned `ok`.
- The same synthetic HTTP smoke test passed inside the CPU container: MoveNet
  detected the figure and returned all three selected-side landmarks as valid
  in 35.3 ms.
- Supabase MCP applied `20261124120300_backend_write_boundaries.sql`
  (remote version `20261125090352`) and
  `20261124200048_backend_atomic_session_writes_and_service_grants.sql`
  (remote version `20261125090508`). Live ACL checks confirmed anonymous
  access is removed, signed-in session writes are denied, and the backend role
  has only the repository's required table operations.
- A live synthetic RLS and RPC smoke test passed for two patients, an assigned
  clinician, an unassigned clinician, and an admin. It checked cross-patient
  reads, consent grant/revocation, derived session rows, audit visibility, and
  both atomic write functions. All synthetic rows were rolled back; a follow-up
  query confirmed no test fixtures remained.
- Post-migration security advisories show leaked-password protection disabled.
  Performance advisories report 11 unused indexes and 4 pairs of permissive
  read policies; those indexes and ownership-specific policies were retained.
- A generated synthetic seated-figure overlay was manually inspected on
  2026-11-25; hip, knee, and ankle points were placed on the expected joints.
  This checks visual wiring only, not pose accuracy or clinical suitability.
- NVIDIA model discovery and a live synthetic numeric-summary check passed;
  the validated model is pinned in the ignored local `.env`. The provider
  received only generated numeric metrics.
- `.env` remains git-ignored. No environment values were printed or committed.

## Limits and follow-up

- MoveNet is Apache-2.0 licensed. This does not replace consent, privacy,
  data-protection, manual quality review, or clinical validation before patient-
  facing use. SinglePose does not reliably select among multiple people.
- Both corrective Supabase migrations have been applied and verified through
  the authorized workflow.
- The Supabase MCP ledger assigns server-generated migration versions that
  differ from local filename timestamps, including for the pre-existing
  migrations. Continue remote changes through MCP; do not use `supabase db push`
  until local and remote migration history is reconciled.
- Leaked-password protection needs an Auth settings change in Supabase; the
  connected MCP exposes no Auth settings update operation.
- MoveNet clinical accuracy, consent/privacy/legal review, and readiness for
  patient-facing use remain pending. Steve's review of proposed API changes
  also remains pending.

## 2026-11-26 — no-camera test harness, two live bugs found and fixed

- Added a local, camera-free test harness so the vision/backend pipeline can
  be validated without a webcam: `vision_service/scripts/video_file_replay.py`
  (video → MoveNet, reports keypoint-detection stats) and
  `backend/scripts/replay_video_session.py` (video → vision service →
  movement engine, reports rep-count/angle metrics). Both read a local video
  file only (never committed; see `fixtures/approved_test_frames/README.md`
  and `docs/model-smoke-test.md`); no footage was fetched from the web.
  `vision_service/scripts/generate_synthetic_test_video.py` produces a fully
  synthetic test clip from the existing validated seated-figure frame so the
  harness can be exercised with zero licensing/consent questions.
- **Fixed a real bug**: `vision_service/app/inference.py` always reported the
  MoveNet YAML's `mapping_version` even in fixture/simulated mode, while the
  backend's `Settings.keypoint_mapping_version` expected a different value for
  fixture sessions. Every real frame through the default local dev stack
  (`VISION_MODE=fixture`) failed `MAPPING_VERSION_MISMATCH` — fixture-mode
  sessions produced zero usable measurements end-to-end, even though isolated
  unit tests passed (they stub the vision client, so the real-HTTP mismatch
  never showed up). Fixed by giving fixture output its own mapping-version
  identity; added a regression test
  (`test_fixture_mapping_version_is_distinct_from_movenet_mapping`). Verified
  live: before the fix, a 40-frame streamed session returned 40
  `quality_warning` events and `usable_frame_pct=0`; after, 40 `measurement`
  events and `usable_frame_pct=100`.
- **Fixed a safety gap**: `backend/app/services/nvidia_summary.py`'s
  `clinician_review_note` was provider-generated text validated only against
  `DISALLOWED_CLAIMS` (diagnosis/recovery/treatment wording). A live NVIDIA
  call returned `"No review required"` for this field — it matches no banned
  word, so it passed validation, but it directly contradicts the app's own
  disclaimer that a clinician must interpret the data. This field is now a
  fixed constant (`CLINICIAN_REVIEW_NOTE`), the same treatment the disclaimer
  already got, never provider-controlled regardless of what the model
  returns. Added a regression test
  (`test_clinician_review_note_is_never_provider_controlled`).
- **Fixed stale demo seed data**: `supabase/seed/001_synthetic_demo.sql`'s
  protocol `parameters` used array keys (`target_range_deg`/`rest_range_deg`)
  that no longer match `SessionService._protocol_configuration`'s required
  flat keys (`rest_min_deg`/`target_min_deg`/etc.) — creating a session from
  that seeded protocol would have 422'd. Fixed in the repo only; **not**
  applied to the live Supabase project (seed application stays a deliberate,
  separate step, same as migrations).
- Re-verified both services clean after all fixes: vision pytest 9 passed
  (was 8), backend pytest 42 passed / 1 opt-in live test skipped (was 39/1);
  Ruff, Ruff format, and mypy clean for both.
- **Re-verified independently 2026-11-26 night**: vision pytest still 9
  passed, matching this doc exactly. Backend pytest actually collects 40
  passed / 1 skipped (41 total), not 42/1 as recorded just above — `git log
  --stat` shows only additions to `backend/tests/` since this doc was
  written, no deletions, so the discrepancy isn't a regression from missing
  tests; the "42" figure above was most likely inaccurate when first
  recorded. Ruff/ruff-format/mypy still clean on both services. Treat the
  per-file breakdown as authoritative going forward: test_auth 4,
  test_health 5, test_movement_engine 11, test_nvidia_live 1 (skipped),
  test_nvidia_summary 7, test_session_api 8, test_stream_api 3,
  test_vision_client 2 = 41 backend tests total.
- **Added 2026-11-26 night**: three more synthetic fixtures/tests closing
  gaps in the mission's "Robust Testing" edge-case list —
  `camera_drift.json` (confirms the engine's angle math is genuinely
  translation-invariant: 8/8 reps despite a steady per-frame coordinate
  drift), `persistent_partial_visibility.json` (sustained, not transient,
  low ankle confidence for a whole sequence — 0 reps, `LANDMARK_CONFIDENCE_LOW`,
  confirming the engine gates hip/knee/ankle identically with no
  graceful-degradation path for any single joint), `variable_speed.json`
  (same rep shape at 50ms/200ms/400ms sample intervals — 2 of 3 cycles
  count, the 50ms one correctly rejected for not clearing `hold_ms`). No
  `movement_engine.py` changes were needed; all three matched its existing,
  correct behavior. Backend suite now 43 passed / 1 skipped (44 total,
  `test_movement_engine.py` 11→14). Ruff/ruff-format/mypy clean.
- Live-verified a full session lifecycle twice (before and after the fixes)
  against the actually-running Docker containers: protocol creation → session
  creation → start with consent → 40 frames over a real WebSocket → complete
  → summary (real NVIDIA call, `source=nvidia`) → final session/progress
  reads. Used the backend's in-memory repository (a supported first-class
  mode, toggled only via a temporary shell-level env override, `.env` itself
  untouched) to avoid writing anything to the live Supabase project while its
  credentials are pending rotation (see below); the real NVIDIA API was used
  deliberately, matching the existing `backend/scripts/nvidia_smoke_test.py`
  precedent. Backend was restored to its original (real-Supabase) config
  after each test and reconfirmed healthy.
- Read-only cross-check of all 5 Supabase migrations against
  `supabase_repository.py`'s actual table/RPC/column usage (grants, RPC
  signatures, unique constraints) — no mismatches found.
- **Open item, not acted on without explicit sign-off**: during this session
  a `grep` on `.env` accidentally printed `SUPABASE_SERVICE_ROLE_KEY` and
  `NVIDIA_API_KEY` into a local tool-output transcript (not git — `.env`
  stayed gitignored throughout). Rotate both credentials.
- `frontend/`, `docker-compose*.yml`, `docs/api_contract.md`, and
  `supabase/migrations/*` were not touched by any of the above.
- Everything in this "2026-11-26" section is in the local working tree only
  and is **not yet committed or pushed**.

The "Implemented"/"Validation"/"Limits and follow-up" sections above describe
the 2026-11-25 work, which is already committed and pushed to
`feature/lennox`; no branch was deleted or force-pushed.
