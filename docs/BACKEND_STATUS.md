# Backend status

Updated: 2026-11-24 17:11 Africa/Nairobi

## Baseline audit

- The repository contains the FastAPI backend, fixture-capable vision service,
  Supabase migrations, and one synthetic knee-extension fixture. No root
  `AGENTS.md` or prior `BACKEND_STATUS.md` was present.
- Starting worktree was clean on `chore/mcp-setup`, not `feature/lennox`.
  `git switch feature/lennox` failed because the sandbox denied creation of
  `.git/index.lock`. Following the task's sandbox rule, no further branch or
  Git-write attempts will be made. Changes will remain in the worktree.
- `docs/backend_guide.md` documents the intended boundaries and safeguards,
  but still describes the API as stubs and the mapping as placeholder indices.
  `docs/api_contract.md` is the shared HTTP/WS source of truth; avoid contract
  changes unless documented under its proposed-change heading.
- The NVIDIA module currently makes one request, assumes JSON response support,
  and has no typed response provenance, retry, disclaimer, or complete safety
  validation. Its current template is deterministic but has no source/model
  metadata.
- The movement module currently provides angle geometry, confidence gating,
  EMA smoothing, and a basic rep machine. Session orchestration and Supabase
  repository methods are unimplemented. HTTP endpoints except health return
  501; the WebSocket returns `NOT_IMPLEMENTED`.
- Blueprint sections 07, 09-13 and Appendix A1-A3 set the governing movement,
  privacy, summary, API, persistence, and safety requirements. Fixture output
  must remain clearly simulated; clinician protocol parameters remain the
  source of movement thresholds; raw video storage remains disabled.
- `.env` was checked for populated variable names only. Several server-side
  variable names are populated, but the task identifies NVIDIA as the only
  available credential; Supabase will be treated as unavailable and not used.
  No `.env` values were displayed. `git check-ignore .env` reports it ignored.

## Progress

- Audit: complete.
- Step 1 implementation: added async HTTPX NVIDIA calls with bounded timeouts,
  one retry after failure, strict Pydantic content validation, numeric matching,
  prohibited-claim rejection, fixed disclaimer and source/model metadata. Added
  mocked HTTP tests and an opt-in live model-catalog/summary check. No model ID
  has been pinned and `.env` has not been edited.
- Step 1 verification: `ruff check app tests scripts`, `ruff format --check
  app tests scripts`, and mypy passed. Pytest: 16 passed, 1 live test skipped.
  The venv launchers reference an inaccessible Python runtime; checks used the
  available Python executable with dependencies from `backend/.venv` and did
  not install packages.
- Step 1 live check: blocked by a network `ConnectError` while querying
  NVIDIA `/models`; no API response was received, no latency was observed, and
  `.env` was not edited. NVIDIA's official Catalog lists an instruct-capable
  candidate, `meta/llama-3.3-70b-instruct`; its Catalog page says structured
  output is unsupported, so the client intentionally sends no
  `response_format`. Candidate is not selected or pinned pending the real
  summary test. See [NVIDIA API Catalog](https://build.nvidia.com/meta/llama-3_3-70b-instruct).
- Supabase read-only audit: the initial migration allows self-authorized
  clinician links, direct client session writes that bypass consent/state
  checks, in-place protocol edits, broad clinician audit reads, and has missing
  session-metric/rep-event FK indexes. `raw_video_stored` is not constrained
  false. A corrective migration was added later; it has not been applied.
- Next: implement movement-engine coverage and deterministic fixtures. Do not
  set `NVIDIA_MODEL_ID` unless a live summary passes.
- Step 2 implementation: expanded the pure-Python movement pipeline with
  confidence/person/version gates, a timestamp gap pause with re-arming at the
  clinician-configured rest range, EMA smoothing, completed-rep events, a
  minimum rep duration, rounded projected estimates, range of motion, median
  rep duration, usable-frame percentage, and quality/provenance flags. Added a
  seeded fixture generator and six labelled traces: clean eight reps, jitter,
  dropout, low confidence, incomplete reps, and two people in frame. Smoothing
  uses a causal per-sample EMA because it is deterministic and needs no
  lookahead; it resets when data is rejected or a long gap occurs.
- Step 2 verification: Ruff check/format and mypy passed; pytest: 19 passed,
  1 live test skipped. The fixture-based dropout test confirms the interrupted
  partial cycle does not count and that a rest pose is required before a later
  complete cycle. The available Python 3.14 executable again used dependencies
  from the project venv; no packages were installed.
- Step 3 implementation: added the SessionRepository protocol, ephemeral
  in-memory repository, and mocked PostgREST implementation. Health reports
  storage mode; protocol versioning, session create/start/complete/get,
  progress, and summary handlers now enforce server-side access. Consent and
  camera setup gate session start. Local demo auth exposes one synthetic
  patient/clinician pair and fails validation outside APP_ENV=local.
  Responses from memory storage carry persisted: false; sessions never claim
  raw video was stored. Supabase JWT verification remains fail-closed and
  unimplemented; non-local protected requests receive 401.
- Step 3 verification: Ruff check/format and mypy passed; pytest: 23 passed,
  1 live test skipped. Mocked PostgREST tests passed; no live Supabase call was
  made.
- Step 4 implementation: added the bounded HTTPX vision client, a
  session/user-bound expiring stream token, sequential WebSocket frame
  processing, server-side frame-rate limiting, sequence/timestamp validation,
  quality warnings, simulated event labels, and pause/revoke handling on
  disconnect. Frames are passed transiently to the vision client; only
  aggregates are retained.
- Step 4 verification: Ruff check/format and mypy passed; pytest: 27 passed,
  1 live test skipped. The API flow test creates a protocol/session, starts
  with consent, streams the clean synthetic eight-rep fixture through the real
  WebSocket route with a mocked vision client, completes, and requests a
  deterministic summary. No separate vision worker or NVIDIA endpoint was
  contacted.
- Step 5 review: added the unapplied migration
  20261124120300_backend_write_boundaries.sql for the reviewed RLS/write-boundary
  findings, audit visibility, session-child indexes, and raw-video metadata
  constraint. The migration was not applied. API contract additions are under
  PROPOSED (needs Steve's review). Updated the backend guide, local-mode
  environment example, and synthetic fixture README.

## Done

- Implemented the NVIDIA summary adapter with strict response validation,
  numeric grounding, prohibited-claim filtering, deterministic fallback,
  provenance fields, fixed disclaimer, bounded timeouts, and one retry. The
  opt-in live test stays skipped by default and in CI.
- Implemented the pure-Python movement pipeline and seeded synthetic fixture
  generator. Six labelled fixtures cover clean repetitions, jitter, dropout,
  low confidence, partial repetitions, and a second person.
- Implemented protocol/session APIs, an ephemeral in-memory repository,
  mocked PostgREST repository tests, session state and consent checks, local
  demo authentication, progress and summary handlers, and health storage-mode
  reporting. Memory responses say `persisted: false`.
- Implemented the HTTPX vision client and fixture WebSocket flow with bound,
  expiring stream tokens, frame-rate and sequence checks, simulated labels,
  and disconnect pause/revocation. Synthetic end-to-end route coverage uses a
  mocked vision client.
- Added the reviewed but unapplied Supabase authorization migration, proposed
  API contract additions, backend run guide, `.env.example` documentation,
  fixture documentation, and root `AGENTS.md`. No frontend files were changed.
- Final checks: Ruff `check` passed; Ruff `format --check` passed (35 files);
  mypy passed (25 source files); pytest passed (29 passed, 1 live test skipped);
  `git diff --check` passed. Python checks used the available Python runtime
  with packages from `backend/.venv`; no packages were installed.

## Partial

- NVIDIA live model selection and latency measurement are incomplete. The
  `/models` request failed with a network `ConnectError`, so no real summary
  ran and no model was selected or pinned. The official Catalog lists
  `meta/llama-3.3-70b-instruct` as an instruction-following candidate, but
  structured output is unsupported. This candidate remains unverified for
  this task: [NVIDIA API Catalog](https://build.nvidia.com/meta/llama-3_3-70b-instruct).
- Supabase repository behavior is covered with mocks only. Supabase JWT
  verification is not implemented; non-local protected requests fail closed.
- Vision service calls are represented by the HTTPX client, but the stream
  route end-to-end test uses a mocked vision client. Sapiens2 weights, license,
  GPU, and official landmark mapping remain unavailable/unresolved.

## Blocked

- Docker CLI was present, but access to
  `C:\Users\Administrator\.docker\config.json` was denied. Compose config
  emitted that warning; backend image build failed, so no container health
  check was possible.
- The sandbox denied `git switch feature/lennox` when it tried to create
  `.git/index.lock`. No further Git writes were attempted. The current branch
  is `chore/mcp-setup`; both local `feature/lennox` and `origin/feature/lennox`
  exist.
- `.env` was not read or changed during finalization. Earlier inspection
  reported populated variable names only; no values were displayed.
  `git check-ignore .env` reports `.env`.

## Decisions made

- Use causal per-sample EMA smoothing (alpha 0.4), which needs no lookahead;
  reset smoothing on rejected samples or long gaps. Require a valid rest pose
  to re-arm after a dropout and use clinician protocol bands for repetition
  thresholds.
- Keep projected angle estimates rounded to one decimal and label fixture
  output simulated. Never infer clinical ranges from synthetic data.
- Send only numeric metrics to NVIDIA, omit `response_format` because the
  candidate Catalog does not support structured output, and fall back to a
  deterministic, validated template after failures.
- Keep raw video storage disabled. Use ephemeral memory mode when Supabase
  settings are absent and never report those sessions as persisted.
- Leave the database migration unapplied and the shared contract changes
  marked proposed for Steve's review.

## How to run

- Follow **Current local backend workflow** in `docs/backend_guide.md` to start
  the fixture vision service and local in-memory API. The demo patient and
  clinician tokens are synthetic and local-only.
- From `backend/`, run Ruff with `.venv\Scripts\ruff.exe check app tests
  scripts`, formatting with `.venv\Scripts\ruff.exe format --check app tests
  scripts`, `mypy app`, and `pytest`. Run the NVIDIA live smoke test only when
  the endpoint is reachable: `python -m scripts.nvidia_smoke_test`.

## Needs human

- Review the proposed API contract changes with Steve and decide when to
  integrate them with the frontend.
- Configure and locally validate Supabase JWT verification and persistence;
  review the corrective migration, then apply it only through the authorized
  database workflow.
- Rerun the NVIDIA live smoke test; select and pin a model only after a real
  numeric-metrics summary passes validation. Resolve Sapiens2 license, weights,
  and landmark mapping before enabling that mode.
- Move the worktree changes to `feature/lennox`, then commit and push. The
  branch switch was blocked in this sandbox, so run these commands from the
  repository root in a Git-enabled session:

  ```powershell
  git stash push -u -m "backend: add fixture session flow"
  git switch feature/lennox
  git stash pop
  git check-ignore .env
  git add .env.example AGENTS.md docker-compose.yml backend/app backend/scripts backend/tests backend/pyproject.toml docs/api_contract.md docs/backend_guide.md docs/BACKEND_STATUS.md fixtures/synthetic_keypoint_sequences supabase/migrations/README.md supabase/migrations/20261124120300_backend_write_boundaries.sql
  git commit -m "feat(backend): add fixture session flow and constrained summaries"
  git push origin feature/lennox
  ```

## Next three backend tasks

1. Complete and test Supabase JWT verification, then validate repository behavior
   against an authorized Supabase project and review/apply the migration.
2. Run the fixture vision service with the API outside mocks; resolve Sapiens2
   licensing, weights, and official keypoint mapping before real inference.
3. Rerun the NVIDIA smoke test and pin a model only after a passing live
   summary; coordinate the proposed contract with Steve.
