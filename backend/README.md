# RehabLoop backend

FastAPI service owned by Lennox on `feature/lennox`. See the
[`backend_guide.md`](../docs/backend_guide.md) and the shared
[`api_contract.md`](../docs/api_contract.md).

## Current implementation

- Protocol, session, progress, summary, and WebSocket routes validate UUIDs and
  enforce patient/clinician access in the service layer.
- Local demo tokens work only with `APP_ENV=local`. Supabase access tokens are
  verified through JWKS for asymmetric keys or through Supabase Auth for legacy
  HS256 tokens. Application roles come from the trusted `profiles` row, not
  user-editable JWT metadata.
- The repository supports an in-memory fixture mode and Supabase PostgREST.
  In-memory responses are marked `persisted: false`.
- Streaming uses short-lived session-bound tokens, increasing frame sequence
  and timestamps, server-side frame-rate limits, and a persistent async vision
  client. Frames are transient; `STORE_RAW_VIDEO` must remain `false`.
- Session completion and protocol versioning use atomic Postgres functions.
  Summary requests reuse the saved summary unless regeneration is requested.

## Local development

The default Compose workflow uses labelled synthetic fixtures and needs no GPU
or model weights:

```powershell
docker compose up --build
```

For backend-only checks, use the repository-local virtual environment:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
ruff check .
ruff format --check .
mypy app
pytest
```

The CPU MoveNet Compose override is in `../docker-compose.cpu.yml`; it needs the
official `.tflite` model in a local directory outside the repository. See
[`model-smoke-test.md`](../docs/model-smoke-test.md) for the model setup and
limitations. The Sapiens2 runner remains optional and licence-gated.

## Supabase status

`20261124120300_backend_write_boundaries.sql` and
`20261124200048_backend_atomic_session_writes_and_service_grants.sql` are
additive migrations and have not been applied. Do not use Supabase-backed
production mode until both migrations have been reviewed and applied through
the authorized workflow. See `../supabase/migrations/README.md`.

Never commit `.env`, model weights, patient footage, or real patient data.
