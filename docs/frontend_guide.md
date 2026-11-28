# Frontend guide

Owner: **Steve** (`frontend/`). This guide describes the frontend in the current
`feature/lennox` checkout, distinguishes live API behavior from demo-only UI,
and lists integration gaps against the backend currently in this repository.
Source code and the API schemas are the source of truth when behavior changes.

For a visual reference, open the [frontend screen reference](frontend_visual_reference.pdf)
or its [HTML source](frontend_visual_reference.html). The PDF labels implemented
screens separately from planned mockups and uses synthetic example values.

Read alongside [the API contract](api_contract.md),
[the architecture overview](ARCHITECTURE.md),
[the backend guide](backend_guide.md), and [the repository instructions](../AGENTS.md).

## 1. Product and implementation status

RehabLoop is a prototype for capturing and displaying projected movement
measurements from one camera view. It does not diagnose, prescribe treatment,
or decide whether a patient should continue an exercise. A clinician owns the
protocol and interprets the measurements.

Status labels used below:

- **Implemented UI** means a working screen or interaction exists; it may still
  use fixtures or local state.
- **Live integration** means the screen currently calls a backend endpoint.
- **Gap** means the UI, adapter, or API response still needs work before the
  flow can use real records end to end.

| Area | Current state |
|---|---|
| App shell and navigation | Implemented UI. Theme, demo-role, notifications, and camera-mode controls are browser/demo behavior. |
| Sign in and sign up | Implemented UI; Supabase credentials are used when configured, with a development-only synthetic sign-in. |
| Patient home | Implemented UI; assigned protocols are live; recent sessions and trend chart are simulated fixtures. |
| Protocol detail | Implemented read-only UI; protocol values come from the assigned-protocol endpoint or labelled fixtures. |
| Camera setup and consent prompt | Live integration for profile, protocols, session creation/start, and consent markers; consent wording still needs review. |
| Live camera session | Live WebSocket flow for sampled frames, measurements, quality feedback, pause/resume, and completion. |
| Session result | Live session fetch and summary request; local unavailable-service fallback is labelled. Backend fixture provenance and backend deterministic-summary provenance are not mapped consistently yet. |
| Clinician dashboard | Implemented demo UI; its fixture patient IDs are not UUIDs, so the live progress request is rejected. If given a UUID, its response still needs mapping. Patient list and protocol editor are local fixtures/state. |
| Recovery Twin | Implemented interactive 3D projected-angle replay for fixtures; the backend does not return replay frames, so it is not connected to real session traces. |
| Sign out and route access | Sign-out controls exist. Route guards and expired-session redirects do not; backend authorization remains authoritative. |
| Post-session comparison | An available NVIDIA summary may use numeric metrics from a prior completed session on the same patient and protocol. The UI has no structured comparison field; Twin comparison is fixture-only. |

The top bar's **DEMO** label describes the current demo UI; it does not report
the backend's inference or storage mode. Several screens show **SIMULATED** for
fixture data, but result-screen model provenance still has a gap described
below. Check backend health and active service configuration for vision and
storage modes; do not infer them from the top-bar label.

## 2. Routes and source map

The route definitions live in `frontend/src/app/routes.tsx`; the shared shell
and navigation are in `frontend/src/components/layout/`.

| Path | Component | State | Current behavior / source |
|---|---|---|---|
| `/` | `features/landing/LandingPage.tsx` | Implemented | Public landing page with sign-in and sign-up navigation. |
| `/sign-in` | `features/auth/SignInScreen.tsx` | Implemented | Supabase password sign-in when configured; profile lookup selects the role landing page. |
| `/sign-up` | `features/auth/SignUpScreen.tsx` | Implemented | Supabase sign-up UI; backend profile/role setup still governs access. |
| `/demo` | `features/sessions/AuthScreen.tsx` | Demo | Legacy development/demo sign-in flow. |
| `/home` | `features/sessions/PatientHomeScreen.tsx` | Implemented, partly simulated | Loads assigned protocols; recent session history and chart use fixtures. |
| `/protocols/:id` | `features/protocols/ProtocolDetailScreen.tsx` | Implemented | Reads the protocol from the assigned protocol list; does not edit it. |
| `/setup` | `features/sessions/CameraSetupScreen.tsx` | Live integration | Loads profile/protocols, records consent markers, opens camera, and starts a session. |
| `/sessions/:id/live` | `features/sessions/LiveSessionScreen.tsx` | Live integration | Sends sampled frames to the WebSocket and handles stream events and controls. |
| `/sessions/:id/result` | `features/sessions/SessionResultScreen.tsx` | Live integration | Loads aggregate session metrics and requests the controlled summary. |
| `/clinician` | `features/protocols/ClinicianDashboardScreen.tsx` | Demo with partial live call | Patient and protocol data are fixtures; progress request is not yet correctly adapted. |
| `/twin` | `features/recovery-twin/RecoveryTwinScreen.tsx` | Fixture-backed UI | Replays an illustrative angle trace; no real trace is returned by the API. |
| `/settings` | `features/settings/SettingsScreen.tsx` | Implemented demo settings | Browser theme/demo preferences and sign-out control. |
| `*` | `LandingPage` | Implemented fallback | Unknown paths return to the landing page. |

The app has sign-out controls but no protected-route wrapper or automatic
expired-session redirect. A role selection in demo settings changes the view,
not the authenticated identity. Every protected request must continue to be
authorized by the backend.

Useful source files:

```text
frontend/src/
  main.tsx                             React entry point and BrowserRouter
  App.tsx                              providers and route composition
  app/routes.tsx                       route table
  components/layout/AppShell.tsx       app shell and navigation
  components/layout/Topbar.tsx         top bar, demo controls, and sign out
  index.css                            shared visual styling and responsive rule
  components/SafetyBanner.tsx          current prototype/safety copy
  components/ScreenPlaceholder.tsx     scaffold for unfinished pages
  features/sessions/AuthScreen.tsx
  features/sessions/PatientHomeScreen.tsx
  features/sessions/CameraSetupScreen.tsx
  features/sessions/LiveSessionScreen.tsx
  features/sessions/SessionResultScreen.tsx
  features/protocols/ProtocolDetailScreen.tsx
  features/protocols/ClinicianDashboardScreen.tsx
  features/recovery-twin/RecoveryTwinScreen.tsx
  lib/api.ts                           HTTP client and WebSocket URL builder
  lib/auth.ts                          development-only synthetic token storage
  lib/camera.ts                        consent record and active camera stream helpers
  lib/supabase.ts                      public-key browser Supabase client
  lib/mocks/events.ts                  explicitly simulated fixture events
  types/index.ts                       frontend wire types
```

## 3. Visual direction

The [PDF reference](frontend_visual_reference.pdf) is an illustrative design
artifact, not a screenshot of the running browser. Use the route/status table
above and current source to determine which behavior is implemented.

### Current visual system

`frontend/src/index.css` defines shared CSS variables and six selectable themes.
Components use those tokens for page, card, border, status, and chart colors;
use the shared tokens and base components rather than copying fixed colors into
new screens. Fixture badges use their own simulated color tokens. The shell and
screens use responsive cards and grids, including stacked layouts at narrow
widths.

### Intended screen composition

- Keep the brand and prototype status in the app header, followed by a compact
  navigation row. On small screens the nav wraps; keep controls reachable and
  avoid making the page wider than the viewport.
- Use one clear page heading, a short task-specific introduction, and a
  persistent safety notice. Avoid repeating the global notice inside a page if
  the shell already provides it.
- Use one primary action per step. Use secondary buttons for pause, return,
  decline, or cancel actions; distinguish destructive session-ending actions.
- Keep camera preview and camera controls together. Put the protocol name,
  stream status, repetition count, movement state, projected angle estimate,
  quality status, and session controls in a stable, readable order.
- Use empty, loading, error, disabled, paused, and unavailable states as
  deliberate layouts. Do not leave an empty card or display stale measurements
  after a quality failure.
- On smaller screens, stack preview and metrics, keep controls full-width when
  needed, let cards wrap, and make the live status visible without scrolling
  past the camera controls.

The current CSS provides base layout and a mobile breakpoint, but not a
complete design system, dedicated focus-ring treatment, or tested accessibility
standard. Treat those as implementation work, not assumed capabilities.

## 4. Screen behavior and design requirements

### 4.1 Sign in (`/sign-in`) — implemented

**Current layout:** the public landing page links to separate sign-in and
sign-up screens. Sign-in offers email/password when public Supabase settings
are configured and a development-only synthetic sign-in option in a Vite dev
build.

**Current behavior:** Supabase `signInWithPassword()` runs, then the frontend
calls `GET /api/v1/me`. Patient profiles navigate to `/home`; clinician profiles
navigate to `/clinician`. The local synthetic button sets a token in
`sessionStorage`, calls the same profile endpoint, and is only rendered by a
Vite development build. Local backend auth also requires `APP_ENV=local` and
`AUTH_MODE=dev`.

**Still needed:** protected-route handling for presentation and clear handling
for expired sessions and role changes. Sign-out controls are available in the
top bar and Settings. The server remains the source of authorization. Do not
put the service-role key in browser code or in any `VITE_*` variable.

### 4.2 Patient home (`/home`) — implemented with simulated history

The page calls `GET /api/v1/patients/me/protocols` through `loadProtocols()`.
It shows the first active, approved protocol, configured values that are
present, a protocol-review link, and an explicit empty state when no approved
protocol is available. It also shows a camera-mode choice and recent-session
cards with a trend chart.

The recent-session list and chart currently come from `loadSessions()`, which
always returns labelled synthetic fixtures. The backend progress endpoint
exists, but patient home does not call it. Connect it only after the response
adapter handles its actual nested `metrics` shape and the missing per-session
`started_at` field; until then, preserve the simulated label and do not present
fixture history as a patient's actual record.

### 4.3 Protocol detail (`/protocols/:id`) — implemented read-only view

The page loads the assigned protocol list and selects the matching route ID. It
shows protocol identity/version, side, repetitions and target range when those
fields exist, optional hold/camera values, approval state, and a confirmation
that the patient read the protocol. It then links to camera setup. The screen
does not edit the protocol. Live protocol parameters are free-form backend
values, so absent or unrecognized fields must remain “Not configured”; the
screen must not invent instructions or clinical text that are not in the API
response.

### 4.4 Camera setup (`/setup`) — implemented

**Current layout:** assigned-protocol selector and summary; camera-processing
notice with acceptance checkbox; an explicit button to enable the camera; live
preview; manual checks for selected-side hip, knee, and ankle visibility and a
steady, approximately side-on view with one person; and buttons to start or
turn off the camera.

**Current sequence:**

1. Load `GET /api/v1/me` and `GET /api/v1/patients/me/protocols`.
2. Require a patient profile and at least one returned assigned protocol.
3. Require the consent checkbox before enabling the camera.
4. Check secure context and browser camera support.
5. Create the consent record, then request `getUserMedia()` with video only
   (ideal user-facing camera, `640x480`); audio is disabled.
6. Ask the patient to manually confirm the framing checklist. The browser does
   not automatically verify camera position or which body parts are visible.
7. Create a draft session if needed, call the session start endpoint, and
   require a returned short-lived `stream_token` before navigating to live.

Camera access requires HTTPS or a local address such as `http://localhost`.
Permission denial is displayed as an error and the preview is not opened. The
currently stored consent row is not automatically revoked if camera permission
is denied or the patient leaves setup; add a reviewed revocation flow before
production use.

The consent wording explicitly says it is prototype copy and needs legal,
privacy, and product review before patient-facing deployment. The boolean
acceptance and database `purpose` / `consent_version` fields are machine-readable
markers; they are not a substitute for reviewed terms.

### 4.5 Live session (`/sessions/:id/live`) — implemented

**Current layout:** session title and protocol name; connection status; live
preview or paused-camera message; repetition count; movement state; projected
2D knee-angle estimate; quality status and confidence; simulated label when
the server marks the event simulated; and pause/resume/end controls.

**Frame capture:** the browser samples the live preview at the configured
interval, caps the longest image dimension at `640px`, encodes JPEG at quality
`0.65`, and sends JSON frame events over the session WebSocket. Audio is not
requested. `VITE_FRAME_SAMPLE_RATE` is parsed and clamped by the frontend to
`5–8` frames per second, default `8`; the current backend default cap is also
`8`. Keep timestamps and sequence numbers increasing. Raw video storage remains
disabled (`STORE_RAW_VIDEO=false`); frames are transient input for processing.

**Events rendered:**

- A usable `measurement` updates repetitions, movement state, rounded angle,
  quality feedback, and a simulated label if `simulated=true`.
- A `quality_warning` shows its message and clears the latest measurement so a
  stale angle is not left on screen.
- An `error` event is shown to the user. Connection failure/closure pauses the
  screen and stops the camera stream.
- The browser does not receive pose landmarks from this API, so there is no
  skeleton overlay in the current UI.

**Controls:** Pause closes the socket and stops the camera tracks. On the
backend, the stream handler finalizes the pause when the socket closes. Resume
requests camera access again and starts a fresh stream token, with retries for
the expected session-state race. End calls the session completion endpoint,
stops the camera, and opens the result route. A direct visit without the route
state token displays a link back to camera setup; the token is intentionally not
persisted as a long-lived credential.

The UI currently rounds displayed live angles to whole degrees, although the
backend contract rounds the transmitted estimate to one decimal place. Keep the
label explicit: **projected 2D knee-angle estimate**. The PDF uses invented,
clearly illustrative display values, not model validation evidence.

### 4.6 Session result (`/sessions/:id/result`) — live aggregate and summary

The result screen fetches `GET /api/v1/sessions/{id}` and requests
`POST /api/v1/sessions/{id}/summary`. It displays the canonical stored metrics,
quality flags, session/protocol/model provenance, and whether the record was
persisted. On API failure, the frontend shows a local deterministic
fixture/unavailable fallback with a simulated label. A successful API response
is currently treated as non-fallback, even when the backend's `source` says
`deterministic_fallback`. It keeps the measurements visually ahead of
explanatory text and states that the summary is not clinical advice.

The session endpoint returns aggregate metrics only. `loadSession()` currently
adds empty `events` and `angle_trace` arrays because no event history or replay
trace is returned by the backend. The event table therefore has no live records
to display, and the result's small avatar is a schematic of the peak projected
angle, not a replay. The “Share with assigned clinician” control currently
shows a browser alert; it does not export or send the record.

When NVIDIA is configured and returns a valid response, the backend summary
generator may include numeric comparisons with the most recent completed
session it finds for the same patient and protocol. Its deterministic backend
fallback summarizes only the current session. The response schema exposes
explanatory text, not a structured prior/current comparison object, so the UI
cannot independently render a labelled side-by-side comparison yet. Keep any
wording limited to returned measured values and do not describe them as
recovery or clinical progression.

There are two provenance details to fix before relying on result labels:
`loadSession()` currently treats any successful API response as `source: live`,
even if its `model_version` identifies fixture inference. Also,
`loadSummary()` treats any successful summary response as non-fallback and its
frontend type omits the backend `source` and model metadata. A backend-generated
deterministic summary can therefore be titled “AI-generated” and appear live.
Map backend provenance fields after the shared API contract review, and keep
“API response received” separate from “real model output.”

### 4.7 Clinician dashboard (`/clinician`) — demo UI with a partial live request

The dashboard presents patient selection, a protocol editor, session table,
quality flags, and trend chart. Patient names and IDs are fixtures. Editing and
“saving” a protocol only changes local React state; it does not call the
backend's `POST /api/v1/protocols` or `PATCH /api/v1/protocols/{id}`. The
assigned-patient list is not available from a backend endpoint.

The screen calls `GET /api/v1/patients/{id}/progress` using fixture IDs such as
`patient-demo-1`, but the backend route requires a UUID. The request therefore
gets a 422 validation error and `loadProgress()` does not currently convert
that error into fixture data. If supplied a real UUID, `loadProgress()` still
casts the response to the frontend's flattened `SessionRecord[]` instead of
mapping it: backend items contain `session_id` and nested `metrics`, and omit
`started_at`; the table/chart expect `id`, flattened metrics, and a date. The
UI needs valid authorized patient IDs, an explicit response mapper, and a
reviewed date field before it can show live dated history. Keep the clinician
view marked simulated until that integration works. Server-side role and
assignment checks remain required for every real record.

### 4.8 Recovery Twin (`/twin`) — implemented for fixture traces only

The screen has a 3D projected-angle avatar, timeline, playback controls, visible
gaps for unusable measurements, and a comparison display. It loads a fixed demo
session ID and compares against a hard-coded earlier fixture trace. The backend
currently returns no per-frame angle trace, and the session mapper intentionally
does not invent one. As a result, the real endpoint cannot populate this
replay; the visible comparison is not a comparison of a patient's two videos.

The avatar visualizes a measured projected angle; it is not a true 3D body
model or clinical biomechanics analysis. To use real recordings here, the API
would need a reviewed way to return the permitted per-frame measurements and
identify the earlier session. Preserve missing-frame gaps and numeric-only
comparison language; do not claim recovery or clinical progression.

## 5. Frontend/backend integration

The browser talks to the API through `src/lib/api.ts`. `VITE_API_BASE_URL`
defaults to `http://localhost:8000`; HTTP calls include JSON headers,
credentials, and the current Supabase access token or the development-only
synthetic token when available. API errors are wrapped as `ApiError` with HTTP
status and response body.

| Frontend helper | API path | Current UI usage |
|---|---|---|
| `api.health()` | `GET /api/v1/health` | Synthetic consent helper checks storage mode. |
| `api.me()` | `GET /api/v1/me` | Sign in and camera setup. |
| `api.myProtocols()` | `GET /api/v1/patients/me/protocols` | Patient home, protocol detail, and camera setup. |
| `api.createSession(protocolId)` | `POST /api/v1/sessions` | Camera setup. |
| `api.startSession(id, consentId)` | `POST /api/v1/sessions/{id}/start` | Camera setup and resume. |
| `api.completeSession(id)` | `POST /api/v1/sessions/{id}/complete` | Live session end. |
| `api.getSession(id)` | `GET /api/v1/sessions/{id}` | Result screen; Twin requests a fixed demo ID and receives a fixture fallback or aggregate-only record. |
| `api.progress(patientId)` | `GET /api/v1/patients/{id}/progress` | Clinician dashboard through `loadProgress()`; response shape is not mapped correctly yet. |
| `api.createSummary(id)` | `POST /api/v1/sessions/{id}/summary` | Result screen; falls back to deterministic fixture text when unavailable. |
| `sessionStreamUrl(id, token)` | `WS /api/v1/sessions/{id}/stream?token=...` | Live session. Token is short-lived and session-scoped. |

`loadSessions()` has no API call and always returns demo fixtures. There is no
separate list-sessions endpoint; the patient-scoped progress endpoint does
return session summaries. Its `sessions[]` items omit the date in the API
response and use the backend wire shape rather than the UI's flattened
`SessionRecord` shape.

All business routes require authenticated identity and backend authorization;
health is public. The server validates roles, patient assignment, session
ownership, UUIDs, and consent. Hiding a button in React is not security.

### Supabase and consent

The browser client in `src/lib/supabase.ts` is initialized only when
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. The anon key is public
and relies on Row Level Security. The service-role key, NVIDIA key, and other
server credentials must never be referenced by the frontend or bundled in
`VITE_*` values.

For Supabase-backed sign-in, the user's session supplies the bearer token. The
camera flow inserts a consent record through the signed-in Supabase client so
RLS applies. In the current backend contract, start requires an unrevoked
consent row for the patient with `purpose=camera_processing` and
`consent_version=camera-processing-v1`. Local synthetic mode selects the
repository's seeded/memory consent ID based on API `storage_mode` instead of
inserting through Supabase.

The current `api_contract.md` still marks several additive fields and consent
requirements **PROPOSED / needs Steve's review**, even though this frontend
checkout already uses them and the backend implements them. Keep that review
status visible for shared integration; do not silently rewrite the contract's
approval state.

### Stream payload and events

Client frame JSON fields are `type: "frame"`, `session_id`, increasing
`sequence`, monotonic `timestamp_ms`, and base64 JPEG `image_b64`. The current
backend limits encoded frame length to 2,000,000 characters and enforces rate
and ordering. Server events are `measurement`, `quality_warning`, or `error`;
measurement and quality-warning events may carry `simulated`. When the backend
is in fixture mode, the UI must show the simulated label. A synthetic camera
pattern or generated image verifies wiring only; it does not establish pose
accuracy or clinical suitability.

Before changing endpoints, payload fields, states, or errors, read
`docs/api_contract.md`, update frontend types and fixtures with the backend
schemas, and follow the shared review process in `AGENTS.md`.

## 6. Backend changes the UI must account for

The backend work in this checkout adds important behavior beyond a simple
in-memory demo. Keep these distinctions visible in user-facing states:

- **Authentication and authorization:** Supabase access tokens are validated by
  the API; application roles come from trusted profile records. Synthetic
  development auth is accepted only when `APP_ENV=local` and `AUTH_MODE=dev`.
  The API authorizes protocol, session, progress, and summary operations.
- **Storage:** API health reports a storage mode; protocol/session/progress/
  summary responses may include `persisted`. Never say data is saved when
  `persisted=false`. A page refresh or later session may not recover
  memory-backed data.
- **Database boundaries:** Supabase RLS limits user reads; session writes and
  versioned/atomic changes are performed through reviewed backend paths. The
  browser must not write session metrics directly to the database.
- **Camera and privacy:** `STORE_RAW_VIDEO` must stay false. Frames are
  transient and are not sent to the NVIDIA summary provider. The UI should say
  what is being processed, ask for consent before camera access, and stop
  tracks on pause/end/unmount.
- **Vision:** the supported real model path is CPU MoveNet SinglePose Lightning
  with the repository's named COCO-17 mapping. Fixture mode is synthetic and
  must be labeled. The frontend receives estimates and quality events, not the
  keypoint array; there is no browser skeleton overlay.
- **Summaries:** the result screen calls the controlled summary endpoint. Only
  validated numeric metrics (including a limited same-patient/same-protocol
  prior-session comparison when available) may be sent to the provider; the
  backend validates output and can use a deterministic fallback. The response
  does not expose a structured comparison object.
- **Operational state:** `.env.example` defaults to fixture mode; a local
  `.env` or deployment may select another supported mode. Read health and
  current environment configuration through approved channels rather than
  assuming the mode from the top-bar `DEMO` label.
- **Supabase migrations:** follow `docs/backend_guide.md` and the authorized
  Supabase workflow. Local and remote migration ledgers can have different
  versions; do not run `supabase db push` until they are reconciled.

Backend validation and remaining readiness work are tracked in
[`docs/BACKEND_STATUS.md`](BACKEND_STATUS.md). It records passing synthetic
integration checks separately from pending clinical, privacy/legal, and
patient-readiness reviews.

## 7. Local setup and public configuration

### Whole stack

From the repository root:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose up --build
```

Open `http://localhost:5173`. API health is at
`http://localhost:8000/api/v1/health`; vision health is at
`http://localhost:8001/health`. The example environment defaults to fixture
vision mode; check the active service health for the mode selected by your
local configuration. See `docs/camera-setup.md` and `frontend/README.md` for
the current local camera test flow. Do not overwrite an existing `.env`; never
paste or print its values into docs or chat.

### Frontend alone

```powershell
Set-Location frontend
npm ci
npm run dev
```

The Vite app is normally available at `http://localhost:5173`. For integration
work, run the API and vision services as described in `docs/backend_guide.md`.

### Browser-visible variables

Every `VITE_*` variable becomes public browser configuration. Never place
secrets in these values.

| Variable | Read by | Meaning |
|---|---|---|
| `VITE_SUPABASE_URL` | `lib/supabase.ts` | Public Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | `lib/supabase.ts` | Public anon/publishable key; access remains subject to RLS. |
| `VITE_API_BASE_URL` | `lib/api.ts` | API base URL; defaults to `http://localhost:8000`. |
| `VITE_FRAME_SAMPLE_RATE` | `LiveSessionScreen.tsx` | Desired live sampling rate; frontend clamps to 5–8 fps. |
| `VITE_POLLING` | `vite.config.ts` | Node-side Vite file-watcher setting for Docker/Windows bind mounts. |

`APP_ENV`, `AUTH_MODE`, `VISION_MODE`, `STORE_RAW_VIDEO`, model paths, and
provider credentials are server/container configuration. Do not copy their
secrets or actual values into this guide.

## 8. Current tests and verification

Frontend unit and component tests are present in:

- `src/App.test.tsx`
- `src/lib/data.test.ts` and `src/lib/stream.test.ts`
- `src/features/sessions/CameraSetupScreen.test.tsx`,
  `LiveSessionScreen.test.tsx`, `PatientHomeScreen.test.tsx`, and
  `SessionResultScreen.test.tsx`
- `src/features/recovery-twin/angleMapping.test.ts` and
  `RecoveryTwinScreen.test.tsx`

These tests cover selected data fallbacks, camera/session flows, results, and
fixture replay behavior. They do not provide end-to-end, real-camera,
clinical-accuracy, or production-readiness evidence. This document update does
not claim that tests were run.

Available commands from `frontend/`:

```powershell
npm test
npm run lint
npm run typecheck
npm run build
npm run format:check
```

The CI frontend job uses Node 22, installs with `npm ci`, then runs lint,
typecheck, tests, and build. For future behavior work, add focused tests for:

- sign-in success/failure, 401/403 responses, expired session, role landing,
  and route access;
- loading, empty, error, and `persisted=false` result states;
- camera unavailable/denied, unmount cleanup, consent write failure, and
  consent revocation behavior;
- low-quality events clearing stale values; `simulated=true` labels; socket
  closure and unavailable vision behavior;
- keyboard use, focus visibility, narrow layouts, and readable status messages.

This guide change is documentation; the test commands above document the
existing workflow rather than claiming those checks were run here.

## 9. Remaining frontend integration work

### First: use the existing records consistently

1. Update `loadProgress()` to validate and map `ProgressResponse.sessions[]`:
   each item has `session_id` and nested `metrics`, while the UI currently
   expects `id` and flattened metrics. The backend response also omits
   `started_at`, which the table and chart need for dates. Agree a reviewed
   response field or leave dates unavailable; do not fabricate them. The
   clinician screen must also stop sending fixture IDs to a UUID route, and the
   helper needs deliberate handling for malformed demo requests.
2. Connect patient home to the existing patient progress endpoint after the
   mapping is correct. At present its history and trend chart are always
   simulated even if stored progress is available.
3. Map summary provenance (`source`, model ID, persistence) from the backend
   response. Do not call every successful API response AI-generated: the
   backend may return its deterministic fallback when NVIDIA is unavailable.
4. Keep summary output beside canonical session metrics. An available NVIDIA
   summary may include a constrained prior-session comparison in text, but the
   API does not return a structured prior/current comparison that the UI can
   independently label.

For the project's post-discharge follow-up record, this means presenting the
existing session record, summary, and comparable measurements clearly. These
gaps do not require a separate discharge, appointment, messaging, or treatment
management system. See the [follow-up scope](post_discharge_follow_up.md) and
[frontend implementation note](post_discharge_follow_up_frontend.md) for the
focused design.

### Clinician and optional replay work

1. The clinician page needs an authorized assigned-patient list before its
   fixture selector can represent live patients. The backend currently has no
   such listing endpoint.
2. Wire the local protocol editor to the existing create/update endpoints,
   map the API parameter names correctly, and show server validation and
   persistence outcomes. Its current “saved” message only changes local state.
3. Real Twin replay requires a reviewed way to expose per-frame measurements
   and select the earlier session. The stream events are transient to the live
   screen and `GET /sessions/{id}` currently returns aggregates only. Keep the
   Twin clearly fixture-backed until an agreed contract supports real replay.

### Before patient-facing use

- Review the camera-consent wording and legal/privacy terms; complete a
  consent-revocation path for setup abandonment and camera denial.
- Add presentation route guards and expired-session handling. Server checks
  remain the authorization boundary. Sign-out controls already exist.
- Review keyboard, mobile, and screen-reader behavior; represent fixture mode,
  memory storage, unavailable vision, and unusable measurements with text.
- Do not show stale angles after a quality failure, and do not present
  projected estimates or generated summaries as diagnosis, treatment,
  prognosis, recovery, or clinical progression.

## 10. UX, safety, and accessibility checklist

- Keep the `SafetyBanner` meaning visible: prototype, not a medical device;
  projected estimates, not clinical measurements; clinician owns protocol and
  interpretation.
- Label the angle **projected 2D knee-angle estimate**. Use the precision that
  the screen actually displays and do not imply clinical measurement accuracy.
- Pair color with readable text and, where helpful, an icon. Announce connection
  and measurement updates without causing noisy screen-reader output.
- Associate every input with a label; preserve visible keyboard focus; ensure
  all controls work by keyboard and have adequate touch size.
- Keep camera consent separate from protocol acknowledgement. Explain camera
  use before the browser permission prompt. Do not claim frames are stored.
- On denial, loss of stream, pause, route exit, or completion, stop every media
  track. Do not transmit frames to NVIDIA or retain raw video.
- Show no angle for unusable frames and do not invent/interpolate a measurement.
- Mark all fixtures and generated sample values as simulated. A passing wiring
  test is not evidence of pose accuracy, clinical safety, or patient readiness.
- Do not use generated summaries for diagnosis, treatment, progression,
  medication, or recovery claims. Show canonical numbers from the API alongside
  any approved explanatory text.
- Keep service-role, NVIDIA, and other backend credentials out of frontend
  code, Vite variables, browser storage, logs, screenshots, and commits.

## 11. Further reading

- [API contract](api_contract.md) — endpoints, states, errors, and pending shared review.
- [Architecture](ARCHITECTURE.md) — system boundaries and data flow.
- [Backend guide](backend_guide.md) — local services, Supabase, vision, and summaries.
- [Backend status](BACKEND_STATUS.md) — current integration checks and remaining limits.
- [Post-discharge follow-up scope](post_discharge_follow_up.md) — use of the existing session record for follow-up.
- [Post-discharge frontend note](post_discharge_follow_up_frontend.md) — focused UI integration details.
- [Camera setup guide](camera-setup.md) — local camera test steps and limitations.
- [Model smoke test](model-smoke-test.md) — fixture and CPU MoveNet wiring checks.
- [Git workflow](GIT_WORKFLOW.md) — PR and shared review practices.
- [Visual screen reference (PDF)](frontend_visual_reference.pdf) — implemented views plus planned mockups.
