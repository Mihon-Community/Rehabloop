# Supabase migrations

Timestamped SQL, applied in order. `20261124120000_initial_schema.sql` creates all
tables, indexes, triggers, and RLS policies described in this project.

Apply remote migrations via the Supabase MCP (`apply_migration`). After
applying, run the security and performance advisors and fix findings in a NEW
timestamped migration — never edit an applied migration.

The connected project's MCP ledger assigns server-generated versions that
differ from local filename timestamps, including for earlier migrations. Do
not use `supabase db push` until local and remote history is reconciled.

The live rollback-only RLS smoke test passed for synthetic patient A, patient B,
an assigned clinician, an unassigned clinician, and an admin. It verified zero
cross-patient reads, consent revocation, derived-table access, audit visibility,
and both backend RPCs. Anonymous table access was checked through grants. Run
the matrix again after future policy changes; never use real patient data.

The applied `20261124120300_backend_write_boundaries.sql` migration revokes
direct client writes that bypass backend consent/state checks, narrows audit
reads, removes inherited broad table/default privileges, adds the two
session-child indexes, and prevents new rows from claiming raw-video retention.

The applied
`20261124200048_backend_atomic_session_writes_and_service_grants.sql` migration
adds least-privilege service-role grants, restricts patient consent updates to
one-way revocation, and adds atomic protocol-version and session-completion
functions. Live synthetic RLS and RPC smoke tests passed in a rollback-only
transaction; no test rows remain.
