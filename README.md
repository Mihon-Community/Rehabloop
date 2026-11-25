# RehabLoop

AI-assisted rehabilitation movement and recovery intelligence.

RehabLoop helps a physiotherapist review a patient's clinician-prescribed
seated knee-extension exercise between appointments. A single camera and Meta
Sapiens2 Pose estimate body keypoints; a deterministic movement engine computes
a **projected** knee-angle trace, repetition events and measurement-quality
indicators; Supabase stores structured results; an NVIDIA-hosted language model
explains the already-computed numbers in plain language. A 3D "Recovery Twin"
replays the measured movement plane.

## Safety and limitations — read this first

**RehabLoop is a competition prototype, not a medical device.** It does not
diagnose, treat, prescribe or give medical advice. It does not decide whether an
exercise is safe, whether a person is recovering, or whether a care plan should
change. The physiotherapist sets the protocol and interprets the evidence. All
angles are 2D projected estimates from one camera view, not validated anatomical
measurements. Raw video is **not** stored by default. Sapiens2 is a licence-gated
engineering target and its intended health-related use requires legal review
before any real-patient work. Fixture mode replays labelled synthetic keypoints
and is **always** marked simulated — it is never presented as real inference.

See `docs/RehabLoop_Full_Product_and_Technical_Blueprint.md` (source of truth)
and `docs/ARCHITECTURE.md`.

## Architecture (概览 / overview)

```
Browser (React/TS) --camera frames--> Vision service (FastAPI, Sapiens2)
       ^                                      | named 2D keypoints
       | measurement / quality events         v
       +---------- API (FastAPI, movement engine) ----> Supabase (RLS)
                          |                              NVIDIA (numbers only)
                          +--> Recovery Twin (measured angle trace)
```

Three local services start together with Docker Compose: frontend `:5173`,
backend `:8000`, vision `:8001`. Supabase stays hosted.

## Quick start

```bash
copy .env.example .env        # then fill in the values you need
docker compose up --build     # whole stack in fixture mode, no GPU/weights
```

Health endpoints: `http://localhost:8000/api/v1/health`,
`http://localhost:8001/health`, `http://localhost:5173/`.

Real Sapiens2 inference can use the CPU-only or NVIDIA setup; both require the
licensed source and checkpoints outside the repo. See `docs/model-smoke-test.md`
for setup and the licence gate.

CPU-only (slow, not for live sessions):
`docker compose -f docker-compose.yml -f docker-compose.cpu.yml up --build`

NVIDIA GPU:
`docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build`

## Team and ownership

| Developer | Area | Branch | Owns |
|-----------|------|--------|------|
| Steve | Frontend / experience | `feature/steve` | `frontend/` |
| Lennox | Backend / AI / data | `feature/lennox` | `backend/`, `vision_service/`, `supabase/`, `fixtures/` |
| Both | Shared | PR into `develop` | `docs/`, `docker-compose*.yml`, `.env.example`, `.github/`, root config |

Contract changes to the API or WebSocket require a PR approved by **both**
developers. See `docs/api_contract.md` and `docs/GIT_WORKFLOW.md`.

## Documentation

- `docs/ARCHITECTURE.md` — system boundaries and data flow
- `docs/api_contract.md` — HTTP, WebSocket, errors, state machine (shared source of truth)
- `docs/frontend_guide.md` — Steve's day-one guide
- `docs/backend_guide.md` — Lennox's day-one guide
- `docs/GIT_WORKFLOW.md` — branches, PRs, definition of done
- `docs/model-smoke-test.md`, `docs/camera-setup.md`, `docs/demo-runbook.md`

## Branch / PR workflow

`main` <- `develop` <- `feature/steve`, `feature/lennox`. Work on your feature
branch, open a PR into `develop`, get the other developer's review, never push
directly to `main` or `develop`. `develop` merges to `main` only for releases
and demos.

No software LICENSE file is included: licensing is a team decision and the
Sapiens2 model has its own licence terms.
