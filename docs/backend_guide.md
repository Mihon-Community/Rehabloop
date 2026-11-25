# Backend developer guide — Lennox

Owner: **Lennox** · branch: `feature/lennox` · area: `backend/`, `vision_service/`,
`supabase/`, `fixtures/` · Read first: the blueprint (Sections 6–14) and
`docs/api_contract.md`. Architecture map: `docs/ARCHITECTURE.md`.

## 1. Your role

You build the API, the Sapiens2 vision worker, the deterministic movement
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
only. The vision worker is separate because model imports, CUDA memory and
latency must not destabilize auth/session routes; it can be swapped between
local GPU, remote GPU and labelled fixture mode.

```mermaid
flowchart LR
  B[Browser: getUserMedia + sampling] -->|WS frames + session token| API[FastAPI API]
  API -->|named keypoints request| V[Vision service: Sapiens2 / fixture]
  V -->|2D landmarks + confidence| E[Movement engine: gates, smoothing, angle, rep FSM]
  E -->|measurement / quality events| API
  API -->|WS events + 3D metric trace| B
  API -->|aggregates + versions| S[(Supabase Postgres + RLS)]
  API -->|numbers only, strict JSON| N[NVIDIA hosted LLM]
  N -->|validated text or deterministic fallback| API
```

Vision starts first, then API, then frontend (Compose `depends_on` health ordering).

## 3. Folders, conventions, typing and lint

```
backend/app/
├── main.py                 # app, CORS, exception handlers, router
├── api/v1/router.py        # auth, protocol, session, progress, summary, and stream handlers
├── core/{config,logging,errors}.py   # pydantic-settings, logging, error contract
├── schemas/{common,session,protocol,summary}.py  # Pydantic request/response types
└── services/{session_service,movement_engine,nvidia_summary,supabase_repository}.py
backend/tests/              # health + Appendix A3 angle tests (passing)
vision_service/app/{main,inference,detector,keypoint_adapter,schemas,config}.py
vision_service/config/keypoint_mapping.yaml    # resolved indices; overlay review pending
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
Real model (CPU, slow/offline):
`docker compose -f docker-compose.yml -f docker-compose.cpu.yml up --build`
after the licensed source and checkpoints are in place. For NVIDIA, use
`docker-compose.gpu.yml` and install the NVIDIA Container Toolkit. See
`docs/model-smoke-test.md`; do not use real frames until the licence gate is cleared.

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
| `VISION_MODE` | `fixture` (default), `movenet`, or legacy `sapiens` | no |
| `VISION_DEVICE` | `cpu` for MoveNet; legacy Sapiens also accepts `cuda` | no |
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

## 6. Movement engine (blueprint Section 7, Appendix A3)

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
  Supabase MCP `apply_migration` or `supabase db push`. Never edit an applied
  migration — add a new one. After applying, run the security and performance
  advisors and fix RLS findings in a new migration.
- RLS is enabled on every exposed table. Policy pattern: patient reads own rows;
  assigned clinician reads linked patients via `clinician_link_active()`;
  derived tables (metrics, rep events, flags, summaries, audit) are readable
  through the parent session but written only by the service role. Roles come
  from application-managed profile data set by the trusted backend, not from
  user-editable auth metadata.
- Test the RLS matrix (patient A, patient B, assigned clinician, unassigned
  clinician, anonymous) for zero cross-patient reads before any non-synthetic data.
- `supabase/seed/001_synthetic_demo.sql` is **synthetic only** — fake UUIDs and
  `example.invalid` emails. Never insert real patient data. Keep the service-role
  key on the backend only; never in the frontend or a Vite variable. Private
  storage only if an approved asset is needed; no public patient bucket.

### Supabase MCP (Hermes Agent)

Generic steps, no credentials in docs: configure the remote MCP server in your
agent (`hermes mcp add supabase --url "<project MCP URL>" --auth oauth`, then
`hermes mcp login supabase --flow browser`), approve the browser OAuth once, and
confirm with `hermes mcp list` / `hermes mcp test supabase`. Then list tools,
apply each migration, run the security/performance advisors, and verify RLS
with synthetic accounts. Never paste an access token or service-role key into
the repo or chat. If the connection is not authenticated, skip the migration
and report it — do not work around the login.

### Pending security correction

The read-only Section 12 review identified client-side write paths for
clinician links, sessions, and in-place protocol changes, broad clinician
access to audit rows, missing indexes on two session child tables, and no
database constraint on raw-video metadata. The new
20261124120300_backend_write_boundaries.sql and
20261124200048_backend_atomic_session_writes_and_service_grants.sql migrations
address these issues and add atomic protocol/session writes. Neither has been
applied; review and apply them through the authorized Supabase workflow, then
run the synthetic RLS matrix.

## 8. NVIDIA integration (blueprint Section 9)

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
  non-clinical disclaimer. The current client omits response_format because the
  candidate model does not advertise structured-output support.

## 9. MoveNet, fixtures and pose quality

- `VISION_MODE=movenet` runs Google's MoveNet SinglePose Lightning model on CPU
  through LiteRT. The model is Apache-2.0 licensed and should be mounted from a
  local directory outside Git.
- The COCO-17 landmark mapping is `vision_service/config/movenet_keypoint_mapping.yaml`.
  Left hip/knee/ankle are 11/13/15; right are 12/14/16, as published in Google's
  model card. The mapping and overlay still require manual review.
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
- The Sapiens2 runner remains legacy and licence-gated. Do not enable it for
  movement analysis without specific legal clearance.
## 10. Privacy, safety and Kenya context (blueprint Section 13)

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

## 14. Known limitations

Angles are 2D projected estimates; clinical accuracy and real-time performance
are not validated. Sapiens2 licensing is unresolved for this rehabilitation
use; the source and checkpoints are absent on the current host, and the
official landmark mapping still needs manual overlay review. Supabase JWT
verification and PostgREST behavior are covered by mocks only; neither
corrective migration has been applied. No real patient data was used. The
blueprint's media folder was absent, so example screenshots are not bundled.

## 15. Remaining integration steps

1. Obtain legal/licensing clearance for the intended Sapiens2 use, then accept
   any gated model terms and put source/checkpoints outside the repository.
   Run the CPU smoke test on synthetic or explicitly approved frames and review
   overlays before relying on landmark outputs.
2. Have Steve review the proposed API contract and coordinate the camera
   consent UI with the backend's required purpose/version markers.
3. Review and apply both pending Supabase migrations through the authorized
   workflow; test the patient/clinician RLS matrix with synthetic accounts.
4. Run a live NVIDIA summary check when the service is reachable; pin a model
   only after its response passes numeric and safety validation.

## Current local backend workflow

This section describes the no-Docker fixture workflow. The API has in-memory protocol/session handlers and a fixture WebSocket path. Local demo identities work only with `APP_ENV=local`; Supabase JWT verification is implemented but has only been tested with mocks here. Values below are synthetic test configuration, not clinical targets.

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

The script lists available models, selects a listed instruct model, sends a
synthetic numeric metrics object, validates the returned summary, and prints
the model and observed latency. It never prints the credential or provider
response. The pytest live check is marked live, skipped by default, and
disabled when CI is set. Do not pin NVIDIA_MODEL_ID unless a real summary
passes. This workspace could not reach the endpoint, so no model or latency
has been selected. NVIDIA's Catalog currently describes
meta/llama-3.3-70b-instruct as instruction-following capable but says
structured output is unsupported; the client does not send response_format.
See https://build.nvidia.com/meta/llama-3_3-70b-instruct.

### Supabase and authentication limits

PostgREST is selected only when both SUPABASE_URL and
SUPABASE_SERVICE_ROLE_KEY are configured. Supabase repository and JWT behavior
were tested with mocks only; no live Supabase project was contacted. Both
20261124120300_backend_write_boundaries.sql and
20261124200048_backend_atomic_session_writes_and_service_grants.sql remain
unapplied and require the authorized Supabase workflow.
