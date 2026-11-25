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

No branch deletion, git push, or commit was performed.
