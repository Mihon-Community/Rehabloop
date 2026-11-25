# Security policy

## Never commit

- Secrets: `SUPABASE_SERVICE_ROLE_KEY`, `NVIDIA_API_KEY`, any OAuth or MCP token.
- Any `.env` file (only `.env.example` is tracked).
- Real patient data, identifiable video, raw frames or clinical notes.
- Model weights and checkpoints (`*.pth`, `*.pt`, `*.safetensors`, ...).

Secrets belong in environment variables and the backend only. The Supabase
service-role key must never appear in frontend code or `VITE_*` variables.

## Reporting

If a secret or patient data is committed accidentally, rotate the credential
immediately, do not rewrite shared history without coordination with both
developers, and report the exposure. Use a private channel to the project lead.

## Runtime safety

- `STORE_RAW_VIDEO=false` by default; raw frames stay in memory and are cleared.
- RLS is enabled on every exposed Supabase table; verify isolation with the
  patient / linked-clinician / unlinked-clinician / anonymous test matrix.
- The NVIDIA endpoint receives numbers only, never frames or identifiers.
- Fixture mode output is labelled simulated; the only real pose mode currently
  supported is CPU MoveNet.

See `docs/backend_guide.md` and `docs/ARCHITECTURE.md`.
