# Supabase migrations

Timestamped SQL, applied in order. `20261124120000_initial_schema.sql` creates all
tables, indexes, triggers and RLS policies from blueprint Section 12 / A5.

Apply via the Supabase MCP (`apply_migration`) or `supabase db push`. After
applying, run the security and performance advisors and fix findings in a NEW
timestamped migration — never edit an applied migration.

Test the RLS matrix with synthetic accounts only: patient A, patient B,
assigned clinician, unassigned clinician, anonymous. Zero cross-patient reads.
