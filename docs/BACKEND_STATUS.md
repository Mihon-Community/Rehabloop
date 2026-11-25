# Backend integration status

Updated: 2026-11-25
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
- Shared API examples and smoke-test docs describe MoveNet. Contract and
  Compose changes need Steve's review before merge.

## Validation

- Vision service pytest: 11 passed. Ruff, Ruff format and mypy passed.
- Backend pytest: 38 passed, 1 skipped. Ruff, Ruff format and mypy passed.
  The skipped test needs the external NVIDIA service.
- FastAPI health, mapping and `/infer` requests passed with the downloaded CPU
  model and a generated 640x480 synthetic seated figure. It detected the person,
  marked all three selected-side landmarks valid, and returned them in 14.8 ms.
  This is a wiring smoke test, not pose-accuracy or clinical validation.
- The CPU vision and backend images built successfully. Both containers reached
  `healthy`; backend `/api/v1/health` returned `ok`.
- The same synthetic HTTP smoke test passed inside the CPU container: MoveNet
  detected the figure and returned all three selected-side landmarks as valid
  in 35.3 ms. No Supabase writes or migrations were run.
- `.env` remains git-ignored. No environment values were printed or committed.

## Limits and follow-up

- MoveNet is Apache-2.0 licensed. This does not replace consent, privacy,
  data-protection, manual quality review, or clinical validation before patient-
  facing use. SinglePose does not reliably select among multiple people.
- Neither `20261124120300_backend_write_boundaries.sql` nor
  `20261124200048_backend_atomic_session_writes_and_service_grants.sql` has
  been applied. Review and apply them only through the authorized Supabase
  workflow, then run the synthetic RLS matrix.
- The legacy Sapiens2 runner remains licence-gated; it is not the selected CPU
  workflow.

No frontend files were changed. No migration was applied, branch deleted, push,
or commit performed.
