# Supabase migrations

Timestamped SQL, applied in order. `20261124120000_initial_schema.sql` creates all
tables, indexes, triggers, and RLS policies described in this project.

Apply via the Supabase MCP (`apply_migration`) or `supabase db push`. After
applying, run the security and performance advisors and fix findings in a NEW
timestamped migration — never edit an applied migration.

Test the RLS matrix with synthetic accounts only: patient A, patient B,
assigned clinician, unassigned clinician, anonymous. Zero cross-patient reads.

The un-applied 20261124120300_backend_write_boundaries.sql migration revokes
direct client writes that bypass backend consent/state checks, narrows audit
reads, adds the two session-child indexes, and prevents new rows from claiming
raw-video retention. Review and apply only through the authorized Supabase
workflow; this task did not apply it.

The un-applied 20261124200048_backend_atomic_session_writes_and_service_grants.sql
migration adds the least-privilege service-role grants used by the backend,
restricts patient consent updates to one-way revocation, and adds atomic
protocol-version and session-completion functions. It also must be reviewed and
applied only through the authorized Supabase workflow. Neither migration has
been applied by this task.
