# Backend developer guide — Lennox

Owner: **Lennox** · branch: `feature/lennox` · area: `backend/`, `vision_service/`,
`supabase/`, `fixtures/` · Read first: `docs/api_contract.md` and
`docs/ARCHITECTURE.md`.

## 1. Your role

You build the API, the MoveNet vision worker, the deterministic movement
engine, Supabase schema/RLS and the constrained NVIDIA summary. The system must
produce reproducible numbers and reject unreliable input — it must never
fabricate inference or make clinical decisions.

**In scope:** `backend/`, `vision_service/`, `supabase/`, `fixtures/`.
**Out of scope:** the React UI (Steve's).
**You own** the four folders above (CODEOWNERS). Shared files (`docs/`,
`docker-compose*.yml`, `.env.example`, `.github/`, root config) need Steve's
review, and any HTTP/WebSocket contract change needs a PR approved by both of
you; update `docs/api_contract.md` in the same PR. The API verifies role and
patient assignment on the server — the UI is not an authorization layer.

## 2. Architecture and data flow

Three local processes: Vite frontend (:5173), FastAPI API (:8000), FastAPI
vision service (:8001). Supabase stays hosted; NVIDIA is called server-side
only. The vision worker is separate so model imports and latency do not
destabilize auth/session routes. It supports labelled fixture mode and the
real CPU MoveNet path.

```mermaid
flowchart LR
  B[Browser: getUserMedia + sampling] -->|WS frames + session token| API[FastAPI API]
  API -->|named keypoints request| V[Vision service: MoveNet / fixture]
  V -->|2D landmarks + confidence| E[Movement engine: gates, smoothing, angle, rep FSM]
  E -->|measurement / quality events| API
  API -->|transient measurement / quality events| B
  API -->|session aggregates, protocol versions, summaries| S[(Supabase Postgres + RLS)]
  API -->|numbers only, strict JSON| N[NVIDIA hosted LLM]
  N -->|validated text or deterministic fallback| API
```

The stream response is not a stored frame trace. Session reads return aggregate
metrics and provenance; they do not currently return frame-by-frame angles,
events, or landmarks for replay.

Vision starts first, then API, then frontend (Compose `depends_on` health ordering).

## 3. Folders, conventions, typing and lint

```
backend/app/
├── main.py                 # app, CORS, exception handlers, router
├── api/v1/router.py        # auth, protocol, session, progress, summary, and stream handlers
├── core/{config,logging,errors}.py   # pydantic-settings, logging, error contract
├── schemas/{common,session,protocol,summary}.py  # Pydantic request/response types
└── services/{session_service,movement_engine,nvidia_summary,supabase_repository}.py
backend/tests/              # auth, health, session/stream, summaries, movement engine, vision client
vision_service/app/{main,inference,keypoint_adapter,schemas,config}.py
vision_service/config/movenet_keypoint_mapping.yaml
vision_service/tests/
supabase/migrations/20261124120000_initial_schema.sql
supabase/seed/001_synthetic_demo.sql
fixtures/synthetic_keypoint_sequences/ + approved_test_frames/ (labelled synthetic JSON traces)
```

Python 3.12, type hints everywhere (`disallow_untyped_defs` in mypy), Ruff
(`E,F,I,UP,B`, 100 cols) and `ruff format`. All endpoints use Pydantic schemas;
secrets are `SecretStr` in settings and are never logged. Current routes cover
health, profile, protocols, sessions, progress, summaries, and streaming.
Local demo authentication is restricted to `APP_ENV=local`; other environments
verify Supabase access tokens and load application roles from trusted profile
rows. Fixture streams are labelled simulated.

## 4. Running locally

Docker (whole stack, fixture mode, no GPU):
```bash
copy .env.example .env && docker compose up --build
curl localhost:8000/api/v1/health; curl localhost:8001/health
```
Real model (CPU):
`docker compose -f docker-compose.yml -f docker-compose.cpu.yml up --build`
after downloading the MoveNet model to a local directory outside Git. See
`docs/model-smoke-test.md`; use only synthetic or explicitly approved frames.

Without Docker (Python 3.12):
```bash
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
pytest && ruff check . && ruff format --check . && mypy app

cd ../vision_service && python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8001
pytest && ruff check . && mypy app
```

Environment variables — mark the secrets:

| Variable | Use | Secret? |
|---|---|---|
| `APP_ENV`, `AUTH_MODE`, `LOG_LEVEL`, `CORS_ORIGINS` | shared config; dev auth only in local | no |
| `SUPABASE_URL` | backend server-side URL | no |
| `SUPABASE_ANON_KEY` | publishable key used to remotely verify legacy HS256 tokens | **public** |
| `SUPABASE_JWKS_URL` | optional override for the Supabase signing-key endpoint | no |
| `SUPABASE_SERVICE_ROLE_KEY` | backend DB access; bypasses RLS | **YES** |
| `NVIDIA_API_KEY` | backend summary calls | **YES** |
| `NVIDIA_BASE_URL`, `NVIDIA_MODEL_ID` | hosted LLM config | no |
| `STORE_RAW_VIDEO` | default `false`; must stay false | no |
| `MAX_FRAME_RATE`, `SESSION_TOKEN_TTL_SECONDS`, `VISION_SERVICE_URL` | backend limits/routing | no |
| `VISION_MODE` | `fixture` (default) or `movenet` | no |
| `MOVENET_MODEL_ROOT`, `MOVENET_MODEL_PATH` | host model directory and read-only container path | no |
| `MOVENET_MODEL_NAME`, `MOVENET_TARGET_SIDE` | model label and selected leg | no |

Never commit `.env` or secrets; CI must pass with no repository secrets.

## 5. Authorization per endpoint

The table in `docs/api_contract.md` is authoritative — do not duplicate it here.
In short: patients see only their own protocols/sessions/metrics/summaries;
clinicians see only patients with an active `clinician_patient_links` row; only
assigned clinicians create/version protocols; WebSocket uses a short-lived
session token bound to user + session; unauthenticated requests get 401,
unauthorized 403, invisible resources 404. Enforce in the API and in RLS.

Session start requires an unrevoked consent row for the same patient with
`purpose=camera_processing` and `consent_version=camera-processing-v1`. These
are machine-readable scope markers, not consent text. The UI must write them
only after explicit acceptance of approved camera-consent copy; coordinate
that integration with Steve.

## 6. Movement engine

Implemented in `backend/app/services/movement_engine.py`:

1. **Landmark validation** — require named `selected_hip/knee/ankle` above a
   configurable confidence threshold before any filtering. Never smooth an
   invalid keypoint into a plausible-looking measurement.
2. **Projected angle** — `projected_joint_angle(a,b,c)` = `arccos(clip(dot(u,v)/(|u||v|),-1,1))`
   in degrees, with `u = hip-knee`, `v = ankle-knee`; returns `None` for
   zero-length vectors. It is a 2D projected estimate, not anatomical.
3. **Smoothing** — exponential moving average with configurable alpha;
   timestamp-based (not frame-count) tempo; pause the state machine past a
   configured gap instead of interpolating across occlusions.
4. **Repetition state machine** — `REST → EXTENDING → TARGET_HOLD → RETURNING`,
   incrementing one rep only on a valid return; `INVALID`/`PAUSED` on low
   confidence, person loss or user pause counts nothing. Thresholds come from
   clinician-configured protocol parameters — there is no universal threshold.
5. **Quality rejection** — person visibility, landmark confidence, continuity,
   side view, temporal completeness and model/mapping version checks. Keep
   measurement quality separate from clinical performance; a low-quality
   session shows "insufficient data", not a red/green judgement.

Smoothing uses a causal, per-sample EMA (default alpha 0.4): it is deterministic
and does not require future frames. Tempo and state durations use timestamps.
The engine pauses after a 750 ms gap and requires a valid rest pose to re-arm.
The rest/target angle bands and target repetition count are required clinician
protocol fields; no default angle range is supplied.

Tests cover known geometry, clean and noisy synthetic repetitions, missing data,
long gaps, low confidence, partial repetitions, multiple people, model/mapping
version mismatch, and deterministic fixture generation. These validate engine
math only, not MoveNet accuracy or clinical performance.

## 7. Supabase

- Migrations are timestamped SQL in `supabase/migrations/`; apply with the
  Supabase MCP `apply_migration`. Never edit an applied
  migration — add a new one. After applying, run the security and performance
  advisors and fix RLS findings in a new migration.
- This connected project's MCP ledger assigns server-generated versions that
  differ from local filename timestamps, including for earlier migrations.
  Do not run `supabase db push` until local and remote history is reconciled.
- RLS is enabled on every exposed table. Policy pattern: patient reads own rows;
  assigned clinician reads linked patients via `clinician_link_active()`;
  metrics, rep events, flags, and summaries are readable through the parent
  session; audit events are readable by their actor or an admin. Derived rows
  are written by the service role. Roles come from application-managed profile
  data set by the trusted backend, not from user-editable auth metadata.
- Test the RLS matrix (patient A, patient B, assigned clinician, unassigned
  clinician, anonymous) for zero cross-patient reads before any non-synthetic data.
- `supabase/seed/001_synthetic_demo.sql` is **synthetic only** — fake UUIDs and
  `example.invalid` emails. Never insert real patient data. Keep the service-role
  key on the backend only; never in the frontend or a Vite variable. Private
  storage only if an approved asset is needed; no public patient bucket.

### Supabase MCP

Configure and authenticate the remote Supabase MCP server for the intended
project and confirm its URL before writing. Inspect migration history, tables,
and advisories first; apply with `apply_migration`, then verify history, grants,
and RLS with synthetic accounts. Never paste an access token or service-role key into
the repo or chat. If the connection is not authenticated, skip the migration
and report it — do not work around the login.

### Applied security correction

The read-only Section 12 review identified client-side write paths for
clinician links, sessions, and in-place protocol changes, broad clinician
access to audit rows, missing indexes on two session child tables, and no
database constraint on raw-video metadata. The new
20261124120300_backend_write_boundaries.sql and
20261124200048_backend_atomic_session_writes_and_service_grants.sql migrations
address these issues and add atomic protocol/session writes. Both were applied
through Supabase MCP. The synthetic patient/clinician RLS matrix and both RPCs
passed in a transaction that was rolled back.

## 8. NVIDIA integration

- Input is a **minimised, de-identified numeric metrics object only** — never
  frames, identifiers or raw keypoints. Base URL and model ID come from env;
  the exact model is pinned only after a key test in the API Catalog.
- Allowed: explain measured values in neutral language, describe each field,
  draft a clinician note repeating measured values and missing data.
  Disallowed: diagnosis, recovery/safety claims, new exercises or target
  changes, invented values, low-confidence → confident statements.
- Strict JSON schema (`headline`, `what_was_measured`, `observed_values`,
  `data_quality_note`, `clinician_review_note`). `validate_summary()` rejects
  disallowed claims and any invented number; the UI renders canonical stored
  numbers, not LLM-copied values. If the API times out, returns bad JSON or an
  unsupported claim, return `deterministic_summary()`. Store the provider,
  model id and schema version with the summary.
- HTTPX calls have bounded timeouts and one retry after provider, parsing, or
  validation failure. Results include source, model_id, and the fixed
  non-clinical disclaimer. The client requests a strict JSON schema, and the
  live-tested provider endpoint accepted it.

## 9. MoveNet, fixtures and pose quality

- `VISION_MODE=movenet` runs Google's MoveNet SinglePose Lightning model on CPU
  through LiteRT. The model is Apache-2.0 licensed and should be mounted from a
  local directory outside Git.
- The COCO-17 landmark mapping is `vision_service/config/movenet_keypoint_mapping.yaml`.
  Left hip/knee/ankle are 11/13/15; right are 12/14/16, as published in Google's
  model card. A synthetic seated-figure overlay was visually reviewed;
  clinical accuracy remains unvalidated.
- MoveNet returns a single pose and may focus on a person near the image centre
  when multiple people are visible. It does not provide reliable multi-person
  selection or tracking. Outputs remain estimates, not validated biomechanics.
- `VISION_MODE=fixture` (default) replays labelled synthetic keypoints. Every
  response has `simulated: true` and `model: fixture-simulated`. Never present
  it as real inference. Fixtures live in `fixtures/synthetic_keypoint_sequences/`;
  `fixtures/approved_test_frames/` stays empty in Git.
- Smoke test: see `docs/model-smoke-test.md`. Record model ID, file hash,
  runtime, image size and inference time; report pose quality separately from
  movement-engine math accuracy and end-to-end reliability.
## 10. Privacy, safety and Kenya context

- `STORE_RAW_VIDEO=false` by default; frames are transient, buffers cleared
  after inference; no video recording endpoint. No raw frames to third parties
  (including NVIDIA) — only numbers. No diagnosis or treatment advice anywhere.
- Kenya's Data Protection Act 2019 s.46 restricts health-data processing to
  responsible healthcare providers / professionals bound by secrecy. ODPC
  guidance covers health data, storage limitation, DPIAs and treats biometric
  data as sensitive. Removing names does not make footage anonymous. Obtain
  legal advice on controller/processor roles, complete a DPIA determination,
  document consent/retention/incident processes, and complete privacy and
  clinical validation **before** any real-patient pilot. Competition demos use synthetic or
  explicitly approved data only.

## 11. Testing strategy

- Geometry unit tests (done), signal tests (noise/gaps/out-of-order), rep-counter
  tests (full, partial, false start, pause, low confidence).
- API tests for auth, state transitions, invalid payloads and dependency
  failures; vision tests in fixture mode only, no GPU/weights.
- RLS tests for the full role matrix; check raw-video retention is zero; check
  NVIDIA numeric consistency and the key-removed fallback.
- CI runs ruff/format/mypy/pytest for both Python services with no secrets.

## 12. Git, PRs and definition of done

Work on `feature/lennox`, PR into `develop`; Steve reviews shared files and
anything contract-related. Never push to `main`/`develop`. See
`docs/GIT_WORKFLOW.md` for full rules and branch protection settings.

PR checklist: lint/typecheck/tests green; docs and contract updated if needed;
both owners approved for shared/contract changes; no secrets, weights or
patient data; safety review; "does this change the API contract?" answered.

Done means it runs from a clean checkout, has passing checks, is documented,
reviewed and merged into `develop`.

## 13. Glossary

- **Landmark** — named 2D keypoint (`selected_hip/knee/ankle`) in image space.
- **Projected angle** — angle at the knee in the image plane; an estimate.
- **Quality gate** — validation rule that rejects unusable frames.
- **Rep FSM** — deterministic repetition state machine.
- **Fixtures** — labelled synthetic test data, always marked simulated.
- **RLS / service role** — row-level authorization / backend-only DB credential.

## 14. Implemented record flow and backend gaps

The current backend supports the existing movement-record workflow: an
authorized patient receives assigned protocols, starts a consent-gated camera
session, streams transient frames, and receives measurement/quality events. On
completion, the API exposes aggregate metrics, quality flags, model and
protocol-version provenance, and a controlled summary. When NVIDIA is
configured and returns a valid response, its summary prompt can include numeric
metrics from a completed session for the same patient and protocol. The
deterministic fallback summarizes the current session only. The progress
endpoint returns the patient's session summaries under the existing
patient/clinician authorization checks.

This supports a post-discharge record using the project's existing measurements
and summaries. There is no separate discharge, appointment, messaging, or
treatment-management subsystem in the backend, and those are outside this
integration scope.

The following gaps explain why some frontend views remain simulated or partial:

| Area | Current backend behavior | Missing for full frontend integration |
|---|---|---|
| Patient session history | `GET /api/v1/patients/{id}/progress` returns `patient_id`, `sessions[]`, and `persisted`. Each session item is a `SessionSummaryResponse` with `session_id` and nested `metrics`. | The response item has no `started_at`, while the frontend's history view expects a date, `id`, and flattened metric fields. The repository already has `started_at`, but the response projection omits it; exposing it requires a reviewed additive contract change. The frontend adapter must also map the wire shape. |
| Clinician patient list | Progress is readable for a patient by that patient or a clinician assigned to them. | There is no endpoint to list the clinician's assigned patients. The UI cannot get its patient selector from the API. |
| Protocol editor | `POST /api/v1/protocols` and `PATCH /api/v1/protocols/{id}` support authorized create/version updates. | The frontend editor does not call these endpoints. Protocol `parameters` is a flexible map; coordinate the UI's field names with `_protocol_configuration` and validate requests server-side. |
| Session replay | `GET /api/v1/sessions/{id}` returns aggregate metrics, quality flags, status, and provenance. WebSocket events are delivered during the active stream. | There is no response field or endpoint for stored frame-by-frame angle/event history or landmarks. A real Recovery Twin trace cannot be loaded from current session reads. Any trace exposure needs a reviewed contract and data-handling decision. |
| Prior-session comparison | When NVIDIA is configured and returns a valid response, summary generation may pass numeric metrics from a completed session with the same patient and `protocol_id` to the constrained prompt. The deterministic fallback summarizes the current session only. | The summary schema returns prose, not a structured prior/current comparison. `_previous_session_metrics()` excludes the current record and selects the most recently started matching completed record, but does not verify that its start time is earlier than the current session. The API does not let the UI choose an earlier session. |

For the currently intended user-facing record, prefer the existing session
aggregate and summary flow. Do not infer recovery, prognosis, or treatment
changes from a difference between sessions. Any change to API fields or
endpoints belongs in `docs/api_contract.md` under its shared review process.
The [post-discharge backend note](post_discharge_follow_up_backend.md) describes
the same narrow integration using the existing movement-session records.

## 15. Remaining integration and readiness steps

1. Resolve the progress response/UI shape mismatch and decide, with Steve,
   whether a date field is needed in `ProgressResponse`. Keep additions
   backward-compatible and document them in the shared API contract.
2. Decide whether clinician patient listing is needed for the existing
   dashboard. If it is, propose the smallest assignment-scoped endpoint and
   obtain Steve's review before implementation/merge.
3. Integrate the existing protocol create/update endpoints in the frontend only
   after mapping request parameters, approval/version behavior, and validation
   errors. The current UI's local “save” is not a backend write.
4. Keep replay fixture-only until an approved contract and persistence policy
   support returning real per-frame measurements. Do not add raw video
   retention; `STORE_RAW_VIDEO` must remain false.
5. Complete clinical, privacy, and legal review before any patient-facing use
   of MoveNet measurements or generated summaries. Projected angles remain
   unvalidated estimates.
6. Enable leaked-password protection in Supabase Auth and reconcile
   MCP-generated remote migration versions with local migration filenames
   before returning to the Supabase CLI workflow.
7. Re-run the NVIDIA synthetic numeric-summary smoke check after changing the
   provider or model configuration. Keep credentials in ignored server-side
   configuration only.

## Current local backend workflow

This section describes the no-Docker fixture workflow. With Supabase variables
unset, the API uses in-memory protocol/session storage and a fixture WebSocket
path. Supabase-backed storage and authentication are selected when configured.
Local demo identities work only with `APP_ENV=local`; JWT verification tests
cover the HTTP/JWT layer with mocks, while connected-project database/RLS/RPC
smoke checks used synthetic records. Values below are synthetic test
configuration, not clinical targets.

Start the vision worker in a PowerShell terminal:

    cd vision_service
    .\.venv\Scripts\Activate.ps1
    $env:VISION_MODE = "fixture"
    uvicorn app.main:app --reload --port 8001

Start the API in a second terminal. Empty Supabase variables force ephemeral
storage even if a local .env contains other values:

    cd backend
    .\.venv\Scripts\Activate.ps1
    $env:APP_ENV = "local"
    $env:AUTH_MODE = "dev"
    $env:SUPABASE_URL = ""
    $env:SUPABASE_SERVICE_ROLE_KEY = ""
    $env:VISION_MODE = "fixture"
    $env:VISION_SERVICE_URL = "http://127.0.0.1:8001"
    $env:STORE_RAW_VIDEO = "false"
    uvicorn app.main:app --reload --port 8000

Health reports storage_mode=memory. The patient token is Bearer
demo-patient-token; the clinician token is Bearer demo-clinician-token. Create a
protocol as the clinician, then create and start a session as the patient:

    $clinicianHeaders = @{ Authorization = "Bearer demo-clinician-token" }
    $patientHeaders = @{ Authorization = "Bearer demo-patient-token" }
    $protocolBody = @{ patient_id = "00000000-0000-0000-0000-000000000001"; protocol_name = "Synthetic demo"; parameters = @{ rest_min_deg = 70; rest_max_deg = 80; target_min_deg = 110; target_max_deg = 125; target_reps = 8 } } | ConvertTo-Json -Depth 5
    $protocol = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/v1/protocols -Headers $clinicianHeaders -ContentType application/json -Body $protocolBody
    $sessionBody = @{ protocol_id = $protocol.id } | ConvertTo-Json
    $session = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/v1/sessions -Headers $patientHeaders -ContentType application/json -Body $sessionBody
    $startBody = @{ consent_record_id = "demo-consent-record"; camera_checks_passed = $true } | ConvertTo-Json
    $started = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/v1/sessions/$($session.session_id)/start" -Headers $patientHeaders -ContentType application/json -Body $startBody

The start response contains a short-lived stream_token. Connect to
/api/v1/sessions/{session_id}/stream?token={stream_token}, send ordered frame
events, then call complete and summary. Fixture-derived events include
simulated=true. Memory-backed responses include persisted=false and never claim
the session was saved.

### NVIDIA live smoke test

From backend, with the local .env containing the NVIDIA credential, run:

    python -m scripts.nvidia_smoke_test

The script lists available models, selects an explicitly supported summary
model, sends synthetic numeric metrics, validates the returned summary, and
reports whether a model is pinned plus observed latency. It never prints the
credential, provider response or local model setting. The pytest live check is
marked live, skipped by default, and disabled when CI is set. The current local
configuration passed this live check.

### Supabase and authentication limits

PostgREST is selected only when both SUPABASE_URL and
SUPABASE_SERVICE_ROLE_KEY are configured. JWT verification and repository
HTTP/PostgREST behavior are covered by mocks at the HTTP/JWT layer. Separately,
the corrective migrations, table grants, RLS policies, and atomic RPCs were
checked against the connected Supabase project with synthetic records in a
rollback-only transaction. No real patient data was used.
