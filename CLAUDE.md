# CLAUDE.md

This file supplements `AGENTS.md`, which remains the authoritative, checked-in
source for ownership boundaries, safety rules, and review requirements.
Where anything here and `AGENTS.md` ever appear to conflict, `AGENTS.md`
wins — update this file instead of acting against it.

Do not add any attribution to Claude/AI anywhere in this project: no
`Co-Authored-By` trailers, no "Generated with Claude Code" lines, no
author/contributor fields in files created here. This applies to every
session, not just the one it was first said in.

## What RehabLoop actually is today

A FastAPI backend + a separate FastAPI vision service, producing
non-clinical numeric movement measurements for a knee-extension exercise,
with a constrained LLM summary layer and a React frontend (Steve's area,
out of scope here).

- **Pose estimation**: Google MoveNet SinglePose Lightning (Apache-2.0,
  pretrained, run via LiteRT on CPU). `vision_service/app/movenet_runner.py`.
  Not fine-tuned, not trained in this repo. `VISION_MODE=fixture` (default)
  replays labelled synthetic keypoints instead, always marked `simulated`.
- **Movement analysis**: deterministic geometry and a rep-counting state
  machine, no ML — `backend/app/services/movement_engine.py`. Angle bands
  are clinician-supplied protocol parameters, never invented defaults.
- **LLM summary**: NVIDIA-hosted model, numeric metrics in, validated text
  out. `backend/app/services/nvidia_summary.py`'s `DISALLOWED_CLAIMS` filter
  rejects diagnosis/treatment/recovery/progression language in any
  generated text, and `clinician_review_note`/the disclaimer are fixed
  constants, never provider-controlled.
- **Storage**: Supabase Postgres with RLS, or an in-memory repository for
  local dev (`AUTH_MODE=dev`, `APP_ENV=local` only).
- There is no PyTorch, no training pipeline, and no temporal-classification
  model anywhere in this repo. Anything describing "Meta Sapiens2" or a
  PyTorch movement-classification stack does not describe this codebase.

## Dataset and model-handling rules

- Real patient footage, model weights, and patient data never go in Git
  (`AGENTS.md`, enforced by `.gitignore`).
- This project does not build a model that classifies, diagnoses, or judges
  a patient's movement/recovery/progress. That is a direct conflict with
  `AGENTS.md`'s rule against recovery/diagnosis/progression claims and with
  the project's own stated DPIA/legal-review requirements for real movement
  data (`docs/backend_guide.md` §10). Don't start this work from a casual
  request — it needs an actual `AGENTS.md` change the project's stakeholders
  agree to, not an inline decision made mid-task.
- Hugging Face MCP (and similar dataset/model discovery tools) may be used
  for: researching alternative *pose-estimation* models (measurement
  accuracy, not diagnosis), or datasets for validating keypoint-detection
  quality. Downloading any dataset still requires checking its licence and
  consent terms first, and no real patient data is ever downloaded or used.

## Autonomous working rules

For ordinary engineering work in `backend/` and `vision_service/` (Lennox's
area per `AGENTS.md`): inspect before changing, plan, implement, run the
app/tests, fix what's broken, re-verify, update docs/tracker, keep the app
in a working state. Don't stop after just writing code — prove it works
(run it, hit the real endpoint, read the real output) before calling it
done. Don't manufacture test results or pose/model accuracy numbers.

Make ordinary engineering decisions without asking first; document them
(commit message, doc update, or a note in `TASK_TRACKER.md`) and continue.

Ask first before: destructive operations, production deployments, anything
touching real patient data, spending money on external compute, using a
dataset with unclear licensing, changing clinical protocol/exercise
thresholds, anything irreversible outside the project, or anything needing
credentials only the user can supply. Never bypass a safety permission or
an `AGENTS.md` rule just to move faster.

## Scope boundaries currently in force

- `frontend/` is out of scope for Claude work in this project (Steve's
  area). No frontend subagent, no frontend edits, no running/building the
  frontend container, unless the user explicitly lifts this.
- `docker-compose*.yml` and `docs/api_contract.md` need Steve's review
  before merge (`AGENTS.md`).
- Supabase migrations: additive only, applied only through the authorized
  Supabase workflow — never improvised via raw SQL against the live project.

## MCP servers configured for this project

`.mcp.json` (project-scoped, shareable once committed): `supabase`,
`playwright`, `context7`, `github`, `huggingface`. Each needs a one-time
restart of Claude Code, then approval, then OAuth authentication inside an
interactive session — none of that can be done from an automated turn.
