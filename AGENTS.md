# Repository guide

## Layout and ownership

- frontend/ is owned by Steve; avoid changes without coordination.
- backend/, vision_service/, supabase/, and fixtures/ are owned by Lennox.
- docs/api_contract.md and docker-compose*.yml are shared; API changes need
  Steve's review before merge.
- Keep model weights, patient footage, and real patient data out of Git.

## Common commands

- Backend: cd backend; activate .venv; run ruff check ., ruff format --check .,
  mypy app, and pytest.
- Vision: cd vision_service; activate .venv; run ruff check ., mypy app, pytest.
- Fixture stack: docker compose up --build; check /api/v1/health and /health.
- Synthetic fixtures: python backend/scripts/generate_synthetic_fixtures.py.

## Safety and data handling

- Never print, log, stage, or commit .env values. Check git check-ignore .env
  before every commit. Keep dependencies in repository-local virtual envs.
- STORE_RAW_VIDEO must remain false. Frames are transient and never go to NVIDIA.
- Internal R&D may build and evaluate exercise recognition, repetition
  segmentation/counting, and classifiers for movement categories or deviations
  that are explicitly defined by permitted dataset annotations. Outputs must
  describe the observed or dataset-defined movement pattern, not infer injury,
  danger, or a patient's clinical status.
- Longitudinal features may report changes in validated numeric measurements
  with their uncertainty and measurement limits. Do not present those changes
  as recovery, prognosis, or clinical progression, and do not recommend
  treatment or prescribe exercise targets. Clinical interpretation and targets
  belong to qualified professionals.
- LLM input is limited to validated numeric metrics; reject invented numbers,
  diagnosis, treatment, medication, prognosis, and unsupported recovery or
  clinical progression claims. LLM summaries may describe measured values and
  trends only, without assigning them a clinical meaning.
- Dataset `license_class` labels and withholding results from production do not
  grant permission to download, process, or use data for internal R&D. Verify
  the actual terms for the intended use before acquisition and use; do not use
  data whose terms are unclear or prohibit that use until permission is
  verified. Honor participant consent and originating ethics/IRB scope; do not
  infer that a project's ownership or an internal-only label expands it. Record
  attribution and restrictions, and keep research-only derivatives out of
  production unless the relevant rights are cleared.
- Label all fixture output simulated/synthetic. Do not claim in-memory data was
  saved. Round projected angles and call them estimates.
- Never guess pose keypoint indices; use the active model's YAML mapping and
  fail closed while indices are placeholders.
- Dev auth is allowed only with APP_ENV=local. No auth or RLS bypasses.

## Changes and review

- Add migrations; never rewrite an applied migration. Do not apply migrations
  without the authorized Supabase workflow.
- Keep API changes backward compatible and put unreviewed contract additions
  under PROPOSED (needs Steve's review).
- Work on feature/lennox. Never force-push or delete branches.
