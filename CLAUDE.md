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
- As of the `AGENTS.md` change committed 2026-11-26 (`c4a22a9`), internal
  R&D may build and evaluate exercise-recognition, repetition
  segmentation/counting, and classifiers for movement categories or
  deviations that are **explicitly defined by permitted dataset
  annotations**. Outputs describe the observed/dataset-defined movement
  pattern only — never injury, danger, or a patient's clinical status;
  never recovery, prognosis, or clinical progression; never a treatment
  recommendation or prescribed exercise target. This still does not make
  RehabLoop a diagnostic or recovery-prediction product — see
  `AGENTS.md`'s "Safety and data handling" section for the exact wording,
  which controls if this summary ever drifts from it.
- `docs/backend_guide.md` §10's DPIA/legal-advice requirement is scoped to
  **any real-patient pilot** (RehabLoop actually used on real patients) —
  that gate is untouched by this change and still blocks real-patient use
  regardless of what model code exists. It does not, by itself, block
  training/evaluating on already-published, already-licensed third-party
  research datasets (e.g. WLU, MobiPhysio) within the scope their own
  license and stated research purpose actually cover — that usage is
  governed by `AGENTS.md`'s dataset-verification rule instead (license,
  consent/IRB scope, intended-use match), not a fresh RehabLoop-side DPIA.
- Dataset licence/consent verification still comes first for every dataset,
  per `AGENTS.md`'s dataset rules — a `license_class` label or this
  project's ownership never substitutes for actually checking terms.
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
