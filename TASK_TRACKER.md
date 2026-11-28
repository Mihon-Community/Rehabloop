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

## Fixed 2026-11-27 (uncommitted — left staged for review per this session's instructions)

- **NVIDIA was never broken — verified live 2026-11-27.** `source=nvidia`,
  `model_id=nvidia/nemotron-3.5-bolt-e4b`, HTTP 200 in 2-7s, structured output
  accepted by `validate_summary`, and the fixed `clinician_review_note` /
  disclaimer constants correctly applied rather than provider-controlled. Every
  earlier summary attempt had failed at 409 before the provider was ever
  called, which is why it looked like a slow or broken model. **Keep
  `nemotron-3.5-bolt-e4b`.**
- **Silent provider failures made this unverifiable for days.**
  `generate_summary`'s `except Exception: continue` logged nothing, so a bad
  model id, an expired key, a read timeout and a validation rejection all
  produced the identical silent deterministic template. Added warning logs for
  each attempt, for validation rejection, and for final fallback — failure
  class and status only, never the API key, the prompt or unvalidated provider
  text.
- **`NVIDIA_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b` in `.env` is a live
  trap — recommend deleting that line.** It is unused (the backend reads
  `NVIDIA_MODEL_ID`), but the model it names is a *reasoning* model: tested
  live, it returns HTTP 200 with `content: None`, its chain-of-thought in
  `reasoning_content`, and `finish_reason: length` after spending all 512
  `max_tokens` thinking. Pointing the real variable at it would make
  `json.loads(None)` raise and every summary fall back to the template —
  previously with zero log output. Also checked: `google/gemma-3-12b-it` is
  listed in `/v1/models` but returns 404 "not found for account", so catalog
  listing does not imply access.
- **Session-to-session comparison added, 2026-11-27 — user-requested, scoped
  to what `AGENTS.md` explicitly permits.** The user asked how a
  physiotherapist is meant to tell whether a patient is doing better or
  needs urgent care from this summary. Answer given: RehabLoop deliberately
  never makes that call — `DISALLOWED_CLAIMS`, the system prompt, and
  `validate_summary`'s number-matching all exist specifically so no
  model-generated text can carry a verdict; the clinician does that
  judgement themselves from the raw trend already in the Clinician
  Dashboard (`loadProgress` → real `/patients/{id}/progress`, live, not
  fixture). What `AGENTS.md` does explicitly allow — "Longitudinal features
  may report changes in validated numeric measurements... Do not present
  those changes as recovery, prognosis, or clinical progression" — was not
  yet built. Implemented:
  - `session_service.py`'s new `_previous_session_metrics()` finds the same
    patient's most recently *started*, previously *completed* session on
    the *same protocol* (a different protocol's angle targets would make
    the comparison meaningless), via `repository.list_sessions()`.
  - `build_prompt`/`validate_summary`/`generate_summary` all gained an
    optional `previous_metrics` parameter. When absent, the request/prompt
    is byte-for-byte unchanged — existing tests and behaviour hold.
  - `DISALLOWED_CLAIMS` extended with `better|worse|worsen*|improv*|declin*|
    regress*` — words the original diagnosis/recovery regex didn't cover,
    but exactly what a model reaches for when comparing two values.
  - Deliberately NOT extended: `deterministic_summary()` (the non-LLM
    fallback) stays single-session. Comparison prose is exactly the kind of
    text this project writes by hand and reviews, not something to add to a
    hard-coded template casually.
  **Two traps found tuning this live, worth keeping in the comments (and
  they are):** (1) the model put a correct, validator-accepted comparison
  entirely into `clinician_review_note` — the one field `generate_summary`
  always discards and replaces with the fixed constant — because the first
  prompt draft never said *where* the comparison must go. Fixed by requiring
  it in `observed_values` specifically and forbidding it in
  `clinician_review_note`. (2) Confirmed live, end to end, on two of the
  user's own real sessions via the real endpoint (`a9e7af76` vs `f4efe9ac`,
  same protocol): `"projected knee angle max 158.0 deg and 161.0 deg"`,
  `"usable frame percentage 96.6 pct and 97.6 pct"` — both numbers verbatim
  from the two sessions, validator-ACCEPTED, no comparison language.
  **Known minor cosmetic artifact, not fixed:** one observed_values entry
  occasionally starts with a stray leading comma (", completed repetitions
  0 and 0") — a model formatting quirk, not a safety or correctness issue;
  left alone rather than risk another prompt-tuning regression.
  Regression tests: `test_single_session_prompt_is_unchanged_without_previous_metrics`,
  `test_comparison_prompt_nests_current_and_previous`,
  `test_validate_summary_allows_a_previous_value_only_when_previous_is_supplied`,
  `test_validate_summary_rejects_comparison_verdict_language`,
  `test_generate_summary_sends_both_sessions_when_previous_is_supplied`
  (`test_nvidia_summary.py`), `test_previous_session_metrics_only_match_completed_same_protocol_sessions`
  (`test_session_api.py`). Backend: 64 passed, 1 skipped, ruff/format/mypy clean.
- **`headline`/`what_was_measured`/`data_quality_note` made specific,
  2026-11-27.** These three free-text fields were defaulting to generic
  boilerplate ("Session Performance Summary", "Session performance
  metrics") even after `observed_values` was fixed to be readable — so the
  "explanation" still read as numbers-only. Prompt now requires each field
  to name an actual supplied value (completed vs target reps, the usable-
  frames percentage, etc.) instead of describing the session in the
  abstract. **Trap found while tuning, same session:** the first version of
  this instruction used the literal snake_case field names
  (`completed_reps`, `usable_frame_pct`) as examples, and the model echoed
  them verbatim into the output ("completed_reps of 6") instead of
  translating to English. Fixed by rephrasing every example in plain words
  and adding an explicit "never use the literal field name" instruction.
  Live result for a real session: headline "Completed repetitions at 0",
  data_quality_note "The percentage of usable frames indicates that 97.9
  percent of the session was usable" — still validator-ACCEPTED, still only
  numbers taken verbatim from the session. Verified in the browser; no new
  console errors beyond the pre-existing `twin-rig.glb` asset gap.
- **Summary prompt rewritten for readability.** `observed_values` came back as
  a bare list of digits (`['6','3.2','118.0',…]`) — valid and useless. The
  prompt now asks for a labelled phrase per value with its unit, derived from
  the field name. Live result:
  `completed reps 6 · median rep duration 3.2 seconds · projected knee angle
  max 118.0 deg · usable frame 89.5 pct`, still validator-ACCEPTED. **Trap
  found while tuning:** asking for units as English words made the model spell
  the *numbers* out too ("one hundred eighteen point zero degrees"), which
  `NUMBER_WORD_PATTERN` rejects — silently falling back to the template. The
  "write the value itself as digits" clause is therefore load-bearing, not
  styling; a comment in the code says so.
- **"Session could not be loaded" on every scaffold navigation link.** The
  sidebar, `StepCards`, `RecoveryTwinScreen` and `DemoProvider`'s defaults all
  point at the placeholder ids `session-demo-1` / `protocol-demo-1`, but the
  routes declare `session_id: UUID`, so the backend rejected them with
  `422 VALIDATION_ERROR` before any handler ran. `data.ts`'s `unavailable()`
  covers only 404/501/502/503, so that escaped as a hard error — even though
  this module's whole stated purpose is to fall back to labelled fixtures for
  exactly these scaffold routes. Added `malformedRequest()`, applied in
  `loadSession` and `loadSummary`. It matches on the `VALIDATION_ERROR` code
  rather than on 422 alone, which is the part that keeps it safe: a 422
  carrying `UNPROCESSABLE` is a domain refusal (invalid clinician protocol
  parameters) and must never be answered with a fixture. Verified live: the
  demo route now renders the SIMULATED fixture plus a labelled deterministic
  summary instead of an error. Pre-existing bug, not introduced by today's
  work. Tests added in `src/lib/data.test.ts`, which also lock in the
  `approved_at`+`active` derivation and the flat parameter-key mapping.
  Not changed (product call, Steve's area): the navigation still points at
  placeholder ids rather than the current session, so those links show demo
  data even once a real session exists.
- **Race: closing a stream could revert a completed session to `paused`,
  permanently blocking its summary.** `session_service.pause_stream` read the
  session status and then wrote `"paused"` in a separate round trip. Because
  `get_session` costs four sequential Supabase calls (~350-400ms each against
  this project), that window is ~1.5s wide — wide enough for the frontend's
  `completeSession()` to land in between, after which the stale write reverted
  `completed` back to `paused`. `POST /sessions/{id}/summary` requires
  `status == "completed"`, so the session was stuck returning 409 forever.
  Observed live: session `e49d080f` sat at `paused` *with* `ended_at` set, a
  combination no single code path can produce. Replaced the read-then-write
  with an atomic compare-and-set: new `pause_active_session()` on both
  repositories, implemented for Supabase as a single filtered PostgREST PATCH
  (`?id=eq.X&status=eq.active`), so no migration was needed and a stale write
  is now impossible. Two regression tests added
  (`test_closing_a_stream_never_reverts_a_completed_session`,
  `test_supabase_pause_is_a_single_conditional_patch`). Backend: 54 tests pass,
  ruff/format/mypy clean. Note the race itself is timing-dependent, so it is
  covered by unit test and by code inspection, not by reproducing it live.
- **Session result screen hung forever on "Preparing explanation…"** — the
  user-visible symptom of the race above, and the reason it looked like the
  LLM was merely slow. `SessionResultScreen`'s `.catch` reset summary state to
  `null`, which renders identically to a request still in flight, so any
  rejection displayed the loading message permanently. It rejected because
  `data.ts`'s `unavailable()` only treats 404/501/502/503 as fallback-worthy
  and this was a 409. Replaced the nullable state with an explicit
  `loading | ready | error` union so a failure can never be mistaken for
  pending, and 409 now reports that the session was never completed rather
  than silently falling back to a deterministic summary (which would have
  dressed a real refusal up as data). 409/401 are deliberately still excluded
  from `unavailable()`; that intent is now documented there. Regression test
  added (`SessionResultScreen.test.tsx`).
- **`"Target: undefined"` rendered to patients** — found while verifying the
  above in the browser. `SessionSummary.metrics` declares every field as
  `number`, but real rows are null for a session that produced no usable
  frames, so the result screen interpolated `undefined` into a visible hint
  and showed bare units for every metric. Added `metricValue()` (renders `—`)
  and a "Target not recorded" hint. Same bug class as the two above:
  undefined reaching the UI as if it were data.
- **Seeded demo users could never sign in** — `supabase/seed/001_synthetic_demo.sql`
  inserts `auth.users` rows directly, which bypasses the defaults GoTrue would
  set itself, leaving `confirmation_token`, `recovery_token`,
  `email_change_token_new`, `email_change` and `raw_app_meta_data` NULL. GoTrue
  scans those into non-nullable Go types, so every sign-in as either synthetic
  user failed with an opaque `500 "Database error querying schema"`. The seed
  now sets all of them explicitly. The already-seeded live rows were repaired
  separately (by Lennox, via the SQL editor) along with the missing
  `auth.identities` rows the seed also never created.
- **Frontend showed "No clinician-approved protocol is assigned" while the API
  returned one** — `frontend/src/lib/data.ts`'s `loadProtocols()` cast the
  backend `Protocol` straight to the flattened `DemoProtocol` display shape
  (`as unknown as`), so every field the screens read was `undefined`.
  `PatientHomeScreen` filters on `p.approved`, which the backend never sends
  (it sends `approved_at` + `active`), so a real, approved protocol was
  silently filtered out. Added a real `toProtocolView()` mapper and made the
  clinician-configured fields optional in `DemoProtocol`, so screens must
  handle absence instead of rendering `undefined` as data. `clinician_name`
  was dropped from the UI (the backend only exposes `clinician_id`;
  Lennox's call). `instructions`/`stop_instructions`/`notes` have no backend
  equivalent and are now fixture-only — deliberately never synthesised for
  live data, since that would be inventing clinical text. Frontend scope was
  explicitly lifted by the user for this fix. Verified live in the browser
  against the real Supabase-authenticated session: typecheck clean, eslint
  clean on all changed files, 11/11 vitest tests pass.
- **Backend container test/lint tooling missing** — `backend/Dockerfile`'s
  `dev` target only installed `requirements.txt`, so `docker compose exec
  backend pytest/ruff/mypy` failed with exit 127 even though
  `requirements-dev.txt` declares them. Now installed in the `deps` stage.
  Same fix applied to `vision_service/Dockerfile` (its `dev`/`cpu` targets
  had the same gap). Verified live: `docker compose exec backend pytest`,
  `... ruff check .`, `... mypy app` (and the same three for
  `vision_service`) all pass against the rebuilt containers.
- **10 backend tests failing only under `docker compose exec`**
  (`test_movement_engine.py`, `test_stream_api.py`) — `FileNotFoundError`
  reading `fixtures/synthetic_keypoint_sequences/*.json`, because
  `docker-compose.yml`'s backend service has no `/fixtures` volume mount
  (only `vision_service` does). Not fixed by editing `docker-compose.yml`
  (out of scope this session — needs Steve's review per `AGENTS.md`).
  Fixed instead in `backend/tests/test_movement_engine.py` and
  `test_stream_api.py`: the fixture loaders now fall back to
  `backend/scripts/generate_synthetic_fixtures.py`'s `generated_fixtures()`
  — the actual deterministic source of truth the on-disk JSON is a
  generated snapshot of — when the on-disk file isn't reachable. No
  duplicate fixture data checked in anywhere. Verified: `docker compose
  exec backend pytest` now passes all 51 (1 opt-in live test skipped, as
  before).
- **`AUTH_MODE=supabase` + incomplete Supabase storage config silently used
  the wrong profile store** — `main.py` always wired
  `SupabaseJWTAuthVerifier`'s profile lookup to whichever repository
  `storage_mode` picked (independent of `auth_mode`), so a real,
  correctly-signed Supabase token could resolve against
  `InMemoryRepository` (which only recognises its two hardcoded dev UUIDs)
  and fail as a misleading "401 Invalid access token" instead of a clear
  config error. Fixed: Supabase-mode auth now always gets a
  Supabase-backed profile lookup (reusing the existing `SupabaseRepository`
  when storage is already Supabase-backed, constructing a dedicated one
  otherwise), independent of session-storage repository choice. Regression
  tests added in `test_health.py`.
- **Narrow exception handling in `auth.py` around upstream Supabase calls**
  — a malformed-but-200 profile response (`json.JSONDecodeError`, a
  `ValueError`) or a structurally invalid JWK could escape as a generic 500
  instead of the module's own 503 pattern. Both excepts broadened to also
  catch `ValueError`/`TypeError`. Regression tests added in `test_auth.py`
  (the JWK case is tested via a direct monkeypatch of
  `jwt.PyJWK.from_dict`, since empirically PyJWT 2.15.1's own `PyJWK`
  already wraps the malformed-field cases we tried into `InvalidKeyError`,
  a `PyJWTError` — so that specific natural trigger doesn't currently
  reproduce a bare `ValueError`, but the except clause is still exercised
  directly as a defensive contract test).
- **Silent `AUTH_MODE=dev` fallback despite real Supabase credentials being
  configured** — `.env` has no `AUTH_MODE=` line, so
  `docker-compose.yml`'s `${AUTH_MODE:-dev}` silently wins over this
  module's own safer field default, with no indication anything was off.
  Not fixed by editing the shared `.env` (out of this session's scope, and
  flipping the live container's auth mode isn't something this session
  could verify end-to-end without calling the Supabase Auth API, which was
  out of bounds). Added a non-fatal startup warning instead
  (`main.py::_warn_on_dev_auth_with_supabase_credentials`) that logs when
  this combination is detected, without changing any behaviour. Confirmed
  live in the running backend container's logs after rebuild.
- **Gitignore gap**: found while chasing the vision test failure below —
  `fixtures/movenet_singlepose_lightning.tflite` (the real, legitimately
  pretrained MoveNet weight file mounted into the vision container) had no
  matching `.gitignore` pattern (`*.pth/*.pt/*.ckpt/*.safetensors/*.onnx/
  *.bin/*.h5/*.gguf` and `models/` etc. don't match a `.tflite` file sitting
  directly in `fixtures/`). It was not tracked/staged, so nothing was ever
  actually committed, but the safety net had a hole. Added `*.tflite` and
  `*.litertlm` to `.gitignore`.
- **`vision_service/tests/test_fixture_mode.py::test_movenet_mode_without_model_path_fails_clearly`**
  — only failed when actually run via `docker compose exec` (never before,
  since that wasn't possible until the Dockerfile fix above): the test
  didn't pin `movenet_model_path=""` explicitly, so it picked up the real
  container env var `MOVENET_MODEL_PATH=/models/movenet_singlepose_lightning.tflite`
  pointing at a real, present model file, and the "without model path"
  precondition the test depends on silently didn't hold. Same root cause
  briefly bit one of this session's own new backend tests
  (`test_no_warning_for_plain_local_dev_auth_without_supabase_credentials`
  picked up the real `SUPABASE_JWKS_URL`); both now pin every
  environment-sourced setting field explicitly. Verified live:
  `docker compose exec vision_service pytest` now passes all 9.

## Outstanding

- **Resolved 2026-11-27**: the live project held three rows that were stale
  relative to the checked-in seed, each breaking a different step of the
  session flow. All three were repaired by Lennox via the SQL editor (every
  value taken verbatim from `supabase/seed/001_synthetic_demo.sql`, so no
  clinician-set value was invented or changed):
  (1) `auth.users` NULL token columns — blocked all sign-in with a 500;
  (2) `exercise_protocols.parameters` stored angle ranges as arrays
  (`target_range_deg: [110,125]`) where the backend requires flat
  `target_min_deg`/`target_max_deg`/`rest_*` — blocked session creation with
  422; (3) `consent_records` carried `consent_version: demo-consent-1.0` and
  a prose `purpose` where the backend matches exactly
  `camera-processing-v1`/`camera_processing` — blocked session start with 403.
  Verified live end to end afterwards: real Supabase JWT → `/api/v1/me`
  (`role=patient`) → protocols → session create (200) → session start (200,
  `status=active`, stream token issued). **Lesson worth keeping:** the live
  project can drift from the seed silently, and each mismatch surfaces only
  at the step that consumes it. The seed is the authority; re-apply it rather
  than adapting code to stale rows.
- **The NVIDIA summary path is still unverified.** Every summary attempt this
  session failed earlier in the chain (409), so the model was never actually
  invoked — its health, latency and output are unconfirmed. Worth knowing
  before testing: `nvidia_summary.py` uses `read=15s` with one retry, so an
  unresponsive provider costs ~30s before falling back to the deterministic
  template. Exercising it spends real money on an external API, which is
  ask-first per `CLAUDE.md`. Also note `.env` carries a stray unused
  `NVIDIA_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b`; the value the backend
  actually reads is `NVIDIA_MODEL_ID=nvidia/nemotron-3.5-bolt-e4b`.

- **Resolved 2026-11-27**: `AUTH_MODE=supabase` is now set explicitly in
  `.env` (Lennox's decision) and the backend container was recreated to
  pick it up — live-confirmed: `docker compose exec backend printenv
  AUTH_MODE` → `supabase`; `Bearer demo-patient-token` against
  `/api/v1/me` now gets `401 "Invalid access token"` (the
  `SupabaseJWTAuthVerifier` path), not the old dev-path acceptance; the
  dev-mode startup warning correctly no longer fires. Consequence: the
  dev/demo-token shortcut is now fully disabled on the live stack — the
  only way into the app is a real Supabase sign-in. **Still not verified
  end-to-end with a real, signed Supabase JWT** — that needs an actual
  Supabase sign-up/sign-in (through the frontend, or a real session
  obtained some other way); not done this session per the same
  out-of-bounds reasoning as below (no Supabase admin/auth API calls).
  Separately, the frontend's "Continue with demo access" button
  (`frontend/src/features/auth/AuthForm.tsx`'s `continueWithDemo()`) never
  called `setLocalDemoToken()` even before this change, so it never sent
  any bearer token at all — that's a frontend bug, unaffected by this
  switch, out of scope here.
- **Supabase MCP not available this session** — `.mcp.json` configures a
  `supabase` server, but it needs a one-time restart + approval +
  interactive OAuth that can't happen in an automated turn, so
  `list_tables`/`list_migrations`/`get_advisors` could not be run. Remote
  migration-applied status and current advisories are unconfirmed as of
  today (2026-11-27); last confirmed run is the 2026-11-26 one already
  recorded below/in `docs/BACKEND_STATUS.md`.
- **Leaked-password protection** (Supabase Auth dashboard setting,
  `docs/BACKEND_STATUS.md` line ~54) — not fixable via migration, needs a
  manual dashboard change; status unconfirmed today since advisors
  couldn't be re-run.
- **Performance advisories** (11 unused indexes, 4 overlapping RLS read
  policy pairs) — per `docs/BACKEND_STATUS.md`, already reviewed and
  deliberately retained as of 2026-11-26 (ownership-specific policies kept
  separate for clarity; indexes expected unused on a low-traffic/synthetic
  project). No new action; status unconfirmed today since advisors
  couldn't be re-run.
- **Migration documentation nuance**: `supabase/migrations/20261124120200_advisor_fixes.sql`
  moves the `on_auth_user_created` trigger (on `auth.users`) from calling
  `public.handle_new_user()` to `private.handle_new_user()` and drops the
  old public function. A future remote-schema check should expect
  `private.handle_new_user`, not `public.handle_new_user`, or it will
  misread the intentional relocation as drift. (Not a code change — the
  applied migration itself is never rewritten — just a note for whoever
  runs that check next, since the live schema couldn't be re-confirmed
  this session per the MCP point above.)
- **Rotate `SUPABASE_SERVICE_ROLE_KEY` and `NVIDIA_API_KEY`** — both were
  accidentally printed into a local tool-output transcript (not git) during
  this session's work. Not yet done as of 2026-11-26. Still not confirmed
  rotated as of 2026-11-27; deliberately not used this session (not even
  for read-only calls) given that status.
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
