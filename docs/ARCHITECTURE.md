# RehabLoop architecture

The current implementation references are this architecture map,
`backend_guide.md`, and `api_contract.md`.

## Boundaries

| Component | Tech | Responsibility |
|---|---|---|
| Patient/clinician UI | React + TypeScript (Vite) | Auth-aware screens, camera permission + sampling, live metrics, charts, Recovery Twin |
| API service | Python + FastAPI | Session lifecycle, protocol management, authorization, persistence, NVIDIA call, audit |
| Vision service | Python 3.12+, LiteRT, MoveNet SinglePose Lightning | CPU pose inference, output parsing, inference metadata |
| Movement engine | Python module in API | Landmark validation, smoothing, projected knee angle, rep state machine, aggregates |
| Database | Hosted Supabase Postgres | Users, roles, links, protocols, sessions, metrics, events, consent, audit; RLS |
| Language model | NVIDIA hosted API | Structured explanation of approved numeric output only |

The vision runtime is deliberately separate for fault isolation from
auth/session routes. It supports labelled fixtures and the real CPU MoveNet
path without changing the patient-facing app.

## Data flow (text)

```
browser --getUserMedia (consent)--> sampled frames (5-10 fps, secure context)
   --> WS /sessions/{id}/stream (short-lived session token)
   --> API movement engine --> private vision /infer --> named 2D keypoints
   --> confidence gates + smoothing + projected angle + rep state machine
   --> measurement / quality_warning events back over WS
   --> Recovery Twin reads the same metric stream
session end --> API persists aggregates + versions to Supabase (RLS)
   --> minimised numeric metrics --> NVIDIA --> validated explanation (or deterministic fallback)
```

Supabase stays hosted; no local DB stack in Docker Compose. Fixtures mode means
no GPU and no weights are needed for local development.

## Safety boundaries (binding)

- MoveNet pose is 2D; the angle is a **projected estimate**, not validated 3D
  biomechanics or an anatomical measurement.
- No diagnosis, treatment advice, exercise prescription or autonomous plan change.
- No raw video stored by default (`STORE_RAW_VIDEO=false`); transient frames only.
- Fixture output is labelled simulated; no fabricated output presented as inference.
- MoveNet's Apache-2.0 licence does not replace consent, privacy or clinical validation.
- Backend authorization is authoritative; UI role is cosmetic. Service-role key
  is server-side only.

## Repository map

See the ownership table and service layout in the root `README.md`. Ownership:
Steve → `frontend/`; Lennox → `backend/`, `vision_service/`, `supabase/`,
`fixtures/`; shared → `docs/`, `docker-compose*.yml`, `.env.example`, `.github/`,
root config.

Contracts: `docs/api_contract.md`. Workflow: `docs/GIT_WORKFLOW.md`.
