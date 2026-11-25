# Frontend guide

Owner: **Steve** (`frontend/`). This guide describes the frontend in the current
`feature/lennox` checkout and the intended direction for unfinished screens.
It was checked after the merge from `develop` at `d0391d3`. That merge did not
change the feature branch's file tree; this guide therefore treats the current
frontend and backend code as the source of truth.

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

- **Implemented** means the current source contains the working screen or flow.
- **Placeholder** means a route renders descriptive scaffold content rather
  than the intended product experience.
- **Planned** means a recommended future design or behavior, not a feature in
  the current app.
- **Backend available** means the current API has an endpoint; the frontend may
  not call it yet.

| Area | Current state |
|---|---|
| App shell and navigation | Implemented; navigation links are always visible. |
| Sign in | Implemented with Supabase password sign-in and a development-only synthetic account. |
| Patient home | Placeholder. |
| Protocol detail | Placeholder. |
| Camera setup and consent prompt | Implemented; consent wording remains prototype copy. |
| Live camera session | Implemented; sends sampled JPEG frames and renders measurements and quality feedback. |
| Session result | Implemented; fetches the canonical session summary. |
| Clinician dashboard | Placeholder. |
| Recovery Twin | Placeholder; no 3D scene or landmark trace is supplied by the current stream API. |
| Route protection and sign out | Not implemented in the UI. Backend authorization remains authoritative. |
| Progress charts and summary narrative | Backend endpoints exist; current screens do not render these features. |

The purple **DEMO BUILD** badge appears unconditionally in the shell. It does
not identify the inference mode. Fixture output has a separate **SIMULATED**
label in the live screen. Check backend health/configuration to determine the
active vision and storage modes; do not infer them from the shell badge.

The app renders a safety notice inside each screen and another in the shell
footer, so it currently appears twice on most routes. This is a known UI
cleanup item, not a requirement to duplicate it in new components.

## 2. Routes and source map

The route definitions live in `frontend/src/app/routes.tsx`. The shell and
seven navigation links are in `frontend/src/App.tsx`.

| Path | Component | State | Current behavior / source |
|---|---|---|---|
| `/` | `features/sessions/AuthScreen.tsx` | Implemented | Sign in, local synthetic sign in in development, or continue link to patient home. |
| `/home` | `features/sessions/PatientHomeScreen.tsx` | Placeholder | Describes assigned protocols and recent-session intent; does not fetch data. |
| `/protocols/:id` | `features/protocols/ProtocolDetailScreen.tsx` | Placeholder | Describes the planned protocol view; does not fetch a protocol. |
| `/setup` | `features/sessions/CameraSetupScreen.tsx` | Implemented | Loads the signed-in profile and assigned protocols; consent, camera preview, framing checks, and session start. |
| `/sessions/:id/live` | `features/sessions/LiveSessionScreen.tsx` | Implemented | Requires stream token and consent context passed in route state by setup; sends camera frames to the WebSocket. |
| `/sessions/:id/result` | `features/sessions/SessionResultScreen.tsx` | Implemented | Fetches and displays the canonical session summary. |
| `/clinician` | `features/protocols/ClinicianDashboardScreen.tsx` | Placeholder | Describes intended patient, protocol, session, and trend views. |
| `/twin` | `features/recovery-twin/RecoveryTwinScreen.tsx` | Placeholder | Describes a possible projected-motion visualization; no scene is implemented. |
| `*` | `AuthScreen` | Implemented fallback | Unknown paths display sign in. |

The shell's navigation includes `/protocols/demo` and `/sessions/demo/result`
as example links. These do not refer to seeded records and can display an API
error or missing-session state. The app currently has no role-based navigation,
protected-route wrapper, session refresh redirect, or sign-out control. A link
on the sign-in screen also navigates directly to `/home`; this is not an
authorization boundary. Every protected request must continue to be authorized
by the backend.

Useful source files:

```text
frontend/src/
  main.tsx                             React entry point and BrowserRouter
  App.tsx                              shell, navigation, DEMO BUILD badge, footer
  app/routes.tsx                       route table
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

The [PDF reference](frontend_visual_reference.pdf) shows the current shared
shell, then the four implemented screens, then clearly marked planned screens.
It is an illustrative product direction, not a screenshot of a running browser
or a promise that the planned features exist.

### Current visual system

Values below are read from `frontend/src/index.css` and describe the current
prototype. Extend these shared styles before adding one-off visual systems.

| Element | Current value / behavior |
|---|---|
| Font | System UI, then platform sans-serif fallbacks. |
| Page background | `#f5f7fa`; main text `#10243a`. |
| Main content | Centered shell, max width `1060px`, `1.5rem` padding. |
| Screen card | White, `#d7dee8` border, `10px` radius, `1.25rem` padding. |
| Main action | Deep teal `#155e75`, white label. |
| Safety notice | Pale amber `#fff8e1`, dark amber left rule `#b45309`. |
| Fixture badge | Purple `#4c1d95`; use only when data is simulated. |
| Status pills | Green for connected/ready and amber for waiting/paused states. Always show text as well as color. |
| Live layout | Camera preview and metric panel in a 1.6:0.8 two-column grid; one column at widths up to `720px`. |
| Results | Auto-fit metric cards with a minimum width of `13rem`. |

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

### 4.1 Sign in (`/`) — implemented

**Current layout:** a sign-in card with email and password fields when both
public Supabase settings are configured; a setup notice when they are not; a
development-only synthetic sign-in option; an error area; and a link to patient
home. The safety notice is shown in the card and the global footer.

**Current behavior:** Supabase `signInWithPassword()` runs first, then the
frontend calls `GET /api/v1/me`. Patient profiles navigate to `/home`; other
roles navigate to `/clinician`. The local synthetic button sets a token in
`sessionStorage`, calls the same profile endpoint, and is only rendered by a
Vite development build. Local backend auth also requires `APP_ENV=local` and
`AUTH_MODE=dev`.

**Still needed:** protected-route handling for presentation, a sign-out action,
and clear handling for expired sessions and role changes. The server remains
the source of authorization. Do not put the service-role key in browser code or
in any `VITE_*` variable.

### 4.2 Patient home (`/home`) — placeholder

The current page only describes its purpose. The intended view should summarize
assigned clinician-approved protocol(s), the next available patient action,
and recent session status. It should link to protocol detail, camera setup, and
previous results when those records exist.

The API has `GET /api/v1/patients/me/protocols` and
`GET /api/v1/patients/{id}/progress`; the screen currently calls neither. Show
an explicit empty state if no active approved protocol is assigned. In that
state, do not suggest or start an exercise. Distinguish unavailable data from
an empty protocol list and from an in-memory record that was not saved.

### 4.3 Protocol detail (`/protocols/:id`) — placeholder

The current page is scaffold text. The planned read-only patient view should
show the protocol name and version, assigned side, clinician-authored
instructions, configured repetitions or ranges when present, approval/status,
and clinician-provided stop instructions. Only render fields actually present
in the validated protocol response. The patient view must not edit approved
parameters. A confirmation step can acknowledge that the patient read the
protocol before opening camera setup; it is not medical consent.

The current patient protocol endpoint returns the assigned list. If the screen
needs a different lookup or a new field, align it with `docs/api_contract.md`
and get the required shared review before changing the API.

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

### 4.6 Session result (`/sessions/:id/result`) — implemented

The result screen fetches `GET /api/v1/sessions/{id}` and shows loading/error
states, session status, completed repetitions, target repetitions, projected
knee-angle range, the percentage of frames passing quality checks, quality
flags, and the raw-video-stored statement. It checks `persisted=false` to say
that an in-memory session was not saved for later.

The current screen does **not** show a frame-by-frame event list, a trend chart,
or an AI/NVIDIA explanation, and does not call the summary endpoint. Do not
write copy suggesting those features are active. If a summary is added, render
canonical numbers from the session record; treat generated text only as a
validated explanation of those values. Never display invented or text-only
clinical claims.

The current result screen also does not show a fixture/simulated badge. The
session response includes a model version, but the current UI does not use it
to label fixture-derived results. Close this labeling gap before showing
fixture results as patient measurements.

### 4.7 Clinician dashboard (`/clinician`) — placeholder

The current page is descriptive scaffold content. The intended dashboard can
include clinician-assigned patients, protocol creation/versioning, session
review, and patient progress. The API has clinician protocol write and patient
progress endpoints, but the frontend does not yet call them. Every patient,
protocol, and session query must remain scoped by backend authorization and
clinician assignment. Protocol edits create a new version; do not imply that
the app automatically updates a treatment plan.

### 4.8 Recovery Twin (`/twin`) — placeholder

The current page has no avatar or timeline; Three.js and related dependencies
are installed but unused. The current stream API sends measurements, not a
landmark trace, so a faithful skeleton replay cannot be built from the present
payload alone. Any future view should be described as a visualization of
projected movement in the measured plane, not true 3D biomechanics. Show gaps
for missing/low-quality frames and provide text labels alongside color.
Confirm data availability, API contract, model/art asset licensing, and
clinical wording before building a scene.

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
| `api.myProtocols()` | `GET /api/v1/patients/me/protocols` | Camera setup. |
| `api.createSession(protocolId)` | `POST /api/v1/sessions` | Camera setup. |
| `api.startSession(id, consentId)` | `POST /api/v1/sessions/{id}/start` | Camera setup and resume. |
| `api.completeSession(id)` | `POST /api/v1/sessions/{id}/complete` | Live session end. |
| `api.getSession(id)` | `GET /api/v1/sessions/{id}` | Result screen. |
| `api.progress(patientId)` | `GET /api/v1/patients/{id}/progress` | Helper exists; no screen uses it. |
| `api.createSummary(id)` | `POST /api/v1/sessions/{id}/summary` | Helper exists; no screen uses it. |
| `sessionStreamUrl(id, token)` | `WS /api/v1/sessions/{id}/stream?token=...` | Live session. Token is short-lived and session-scoped. |

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
- **Summaries:** the API has a controlled summary endpoint. Only validated
  numeric metrics may be sent to the provider; the backend validates output and
  can use a deterministic fallback. The current result page does not request
  or display this summary.
- **Operational state:** `.env.example` defaults to fixture mode; a local
  `.env` or deployment may select another supported mode. Read health and
  current environment configuration through approved channels rather than
  assuming the mode from the `DEMO BUILD` badge.
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

The frontend currently has four Vitest tests in three files:

| File | Coverage in the current test |
|---|---|
| `src/App.test.tsx` | Shell and safety notice; mock data declares simulation. |
| `src/features/sessions/CameraSetupScreen.test.tsx` | Consent before camera access; framing confirmations before session start. |
| `src/features/sessions/LiveSessionScreen.test.tsx` | WebSocket frame/measurement flow, simulated label, and camera stop/resume. |

There is no current `SessionResultScreen` test. Existing tests do not provide
end-to-end, real-camera, clinical-accuracy, or production-readiness evidence.

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

## 9. Prioritized frontend work

### P0 — before patient-facing use

1. Have product/legal/privacy reviewers approve camera consent wording and
   terms. Build consent withdrawal/revocation behavior and handle the existing
   consent row when camera permission is denied or setup is abandoned.
2. Add a sign-out path and presentation route guards. Keep server checks as the
   actual security boundary; cover role changes and expired sessions.
3. Review accessibility and usability on keyboard, mobile widths, and screen
   readers; reduce the duplicated safety banner and clarify the global DEMO
   BUILD versus per-event SIMULATED indicators.
4. Clearly represent fixture mode, memory storage, unavailable vision, and
   invalid measurement states, including a simulated label on results. Never
   show stale angle values after a quality failure.

### P1 — complete the main patient journey

1. Implement patient home from assigned protocols and session history with
   explicit loading, empty, error, and not-persisted states.
2. Implement read-only protocol detail using only fields present in the
   approved protocol response.
3. Add result screen tests and decide, with the API contract owners, whether
   the patient result should request the existing summary endpoint or link to
   clinician review.
4. Add clear navigation from sign-in to the actual patient/clinician landing
   pages, rather than relying on demo links.

### P2 — clinician workflow

1. Implement assigned-patient list and session review with server-enforced
   clinician/patient assignment.
2. Add protocol creation/version review only after mapping the current API
   request and response fields and handling validation and revoked access.
3. Add progress charts only from canonical progress responses; label estimates
   and missing data clearly. Do not add automated treatment changes.

### P3 — optional movement visualization

Confirm that an approved, sufficiently detailed movement trace can be exposed
before building a Recovery Twin. The current API does not provide the landmarks
needed for a skeleton overlay. Any new data shape requires shared contract
review. Keep the visualization limited to the measured projection and use
visible gaps instead of interpolation for missing frames.

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
- [Camera setup guide](camera-setup.md) — local camera test steps and limitations.
- [Model smoke test](model-smoke-test.md) — fixture and CPU MoveNet wiring checks.
- [Git workflow](GIT_WORKFLOW.md) — PR and shared review practices.
- [Visual screen reference (PDF)](frontend_visual_reference.pdf) — implemented views plus planned mockups.
