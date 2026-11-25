# Backend integration status

Updated: 2026-11-24
Branch: `feature/lennox`

## Implemented

- Protocol, session, progress, summary, and WebSocket flows use server-side
  authorization. UUID inputs are validated at the route boundary.
- Local demo authentication is available only with `APP_ENV=local`. Supabase
  access tokens use JWKS verification for asymmetric signing or Supabase Auth
  remote verification for legacy HS256 tokens. Application roles are loaded
  from trusted profile rows; anonymous users are rejected.
- Session completion and protocol version changes use transactional Postgres
  functions. The repository uses the supported PostgREST write paths and saved
  summaries are reused unless regeneration is requested.
- Streaming reuses an async vision client, enforces frame order/rate limits,
  and keeps image frames transient. `STORE_RAW_VIDEO` remains false.
- The ignored root `.env` was updated for the requested CPU Sapiens setup. No
  `.env` values are recorded here; Git continues to ignore the file.
- The API contract's implementation status, backend README/guide, model smoke
  notes, and migration README now reflect the current branch. The shared API
  contract changes remain pending Steve's review.

## Validation

- Backend Ruff check and format check passed.
- Backend mypy passed for 25 source files.
- Backend pytest passed: 37 passed, 1 skipped. The skipped test requires the
  external NVIDIA service. Auth and PostgREST behavior used mocks; no live
  Supabase or NVIDIA service was contacted.
- `.env` was confirmed git-ignored. No environment values were printed or
  committed.

## Not run / waiting on external prerequisites

- No NVIDIA GPU is available, `nvidia-smi` is absent, and the Docker daemon is
  unavailable in this host session. I could not run Compose health checks.
- The host Sapiens2 source tree, pose checkpoint, and detector checkpoint are
  absent. The `.env` setup is prepared, but real-model `/health`, `/infer`, the
  official overlay review, checkpoint hash, and inference timing are not
  available yet.
- The Sapiens2 licence prohibits biometric processing and restricts health-data
  use and medical/health practice. Rehabilitation pose analysis may fall under
  those limits; this work does not clear that use. Keep model use gated until
  the project obtains legal/licensing clearance and the account owner accepts
  any gated Hugging Face terms. See the
  [official Sapiens2 licence](https://github.com/facebookresearch/sapiens2/blob/main/LICENSE.md).
- Neither `20261124120300_backend_write_boundaries.sql` nor
  `20261124200048_backend_atomic_session_writes_and_service_grants.sql` has
  been applied. Review and apply them only through the authorized Supabase
  workflow, then run the synthetic RLS matrix.
- Manual review of at least 20 approved/synthetic overlay frames remains
  necessary before relying on the mapped pose landmarks.

## Follow-up

1. Obtain legal/licensing clearance for Sapiens2 use in rehabilitation movement
   analysis and accept the model terms from the account that will use it.
2. Once cleared, place source and weights outside the repository, run the CPU
   smoke test, review overlays, and record the requested model evidence in
   `docs/model-smoke-test.md`.
3. Have Steve review the shared API contract, then review/apply both Supabase
   migrations through the authorized workflow.

No frontend files were changed. No migration was applied, no branch was
deleted, and no push or commit was performed.
