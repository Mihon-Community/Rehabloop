# Development roadmap

Grounded in the actual current architecture (MoveNet + deterministic
engine + constrained LLM summary — no PyTorch, no training pipeline; see
`CLAUDE.md`). Ownership and review boundaries follow `AGENTS.md`.

## Near-term (backend/vision_service, Lennox's area)

1. Rotate the two exposed credentials; re-verify the live Supabase write
   path afterward.
2. Get real movement footage (consenting volunteer or self-recorded, never
   a real patient) and validate rep-counting/angle accuracy against it
   using the existing replay harness — the one real gap between "unit
   tests pass" and "this works on an actual exercise."
3. Expand quality-flag coverage in `movement_engine.py` as real-footage
   testing surfaces gaps (e.g. partial-rep edge cases), still as plain
   numeric-threshold logic, never a learned model.
4. Keep the Supabase schema/RLS and the NVIDIA summary safety filter
   under regression tests as they're extended — both have already caught
   real bugs this way.

## Medium-term

5. Clinical/legal review track (DPIA, Kenya DPA 2019 s.46, consent and
   retention policy) — required before any real-patient pilot, not
   something engineering work substitutes for.
6. If pose-estimation accuracy needs improvement, research alternative
   pretrained pose models via the `huggingface`/`context7` MCP servers —
   still measurement-only, still no classification/diagnosis output.
7. Frontend integration and end-to-end UI testing (Steve's area) — out of
   scope for Claude work in this project until explicitly authorized.

## Explicitly out of scope unless the project's rules change

- Any model that classifies, diagnoses, or predicts a patient's
  recovery/progress from movement data. This conflicts with `AGENTS.md`
  today; changing that is a project-governance decision, not a roadmap
  item to schedule around.

## Process

- Project-scoped MCP servers (`supabase`, `playwright`, `context7`,
  `github`, `huggingface`) are registered in `.mcp.json`; each needs a
  one-time restart + approval + OAuth step only the user can do.
- Update `TASK_TRACKER.md` as items move; keep `docs/BACKEND_STATUS.md` as
  the detailed validation log for backend/vision_service work specifically.
