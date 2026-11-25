# Frontend developer guide — Steve

Owner: **Steve** · branch: `feature/steve` · area: `frontend/`
Read first: `docs/api_contract.md` and `docs/ARCHITECTURE.md`.
Backend integration details: `docs/backend_guide.md`. Workflow:
`docs/GIT_WORKFLOW.md`.

Verified against the repository on branch `feature/lennox`, commit `f96fd28`.
Every command, file and variable below was read from this checkout. Where the
spec and the code disagree, the code wins for someone building today; the
disagreement is called out explicitly.

## 0. Current reality snapshot (read this before planning work)

- `frontend/` is partly scaffolded. Authentication, camera setup and live
  session now use real auth/API/WebSocket flows. Patient home, protocol detail,
  results, clinician dashboard and Recovery Twin still use placeholders; there
  are no charts or 3D scene yet.
- The backend on `feature/lennox` has **implemented** the documented HTTP
  handlers and the session WebSocket flow; no current route returns 501. Do
  not design against "everything is a stub" any more.
- `docs/api_contract.md` has a **PROPOSED** section with additive v1 fields and
  events implemented on `feature/lennox` but **pending Steve's review** before
  merge. Section 6.5 lists them. Do not silently treat them as agreed.
- Vision is CPU-first now: default `VISION_MODE=fixture`, real path is MoveNet
  SinglePose Lightning via `VISION_MODE=movenet`. See `docs/model-smoke-test.md` and
  `docs/BACKEND_STATUS.md`.
- Backend HTTP routes require `Authorization: Bearer <token>`. The API client
  now obtains the Supabase access token or a development-only synthetic token.
- `VITE_FRAME_SAMPLE_RATE` is read by the live stream; its rate is capped at
  the backend default of 8 frames per second. `VITE_POLLING` is read by
  `vite.config.ts` as a Node-side variable.
- `docs/mcp_setup.md` and `frontend/playwright-mcp.config.json` exist on branch
  `chore/mcp-setup`, not on `develop`/`feature/lennox` at the time of writing.
  Verify on your branch before relying on the Playwright tooling.

## 1. Your role, scope and ownership

You build the patient and clinician experience: auth screens, protocol view,
consent, camera setup and frame sampling, live session, results, progress
charts and the Recovery Twin. RehabLoop is a measurement tool with a clinician
in control — not a chatbot, coach or diagnostic app.

**In scope:** everything under `frontend/` — routes, components, feature
folders, `lib/` clients and mocks, `types/`, tests, build config, styling and
accessibility. CODEOWNERS maps `/frontend/` to `@Pinyotimo`.

**Out of scope:** API behaviour, movement math, vision models, Supabase schema
and RLS, NVIDIA summaries. Those are Lennox's (`backend/`, `vision_service/`,
`supabase/`, `fixtures/`, mapped to `@Le-n-n-ox`).

**Shared, needing both reviews:** `docs/`, `docker-compose*.yml`,
`.env.example`, `.github/`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md` and
all root config (default CODEOWNERS entry lists both owners). Any change to the
HTTP or WebSocket contract needs a PR explicitly approved by both developers,
with `docs/api_contract.md` updated in the same PR. UI role display is never an
authorization control; the backend verifies identity, role and patient
assignment.

## 2. Tech stack and exact configuration

From `frontend/package.json` (versions are caret ranges; the committed lockfile
is authoritative for `npm ci`):

| Area | Package / setting |
|---|---|
| Build | Vite `^5.4.10`, `@vitejs/plugin-react` `^4.3.3` |
| UI | React `^18.3.1`, ReactDOM `^18.3.1`, React Router DOM `^6.28.0` |
| Data | `@supabase/supabase-js` `^2.46.1` |
| 3D (installed, unused) | `three` `^0.169.0`, `@react-three/fiber` `^8.17.10`, `@react-three/drei` `^9.114.3` |
| Tests | Vitest `^2.1.4`, jsdom `^25.0.1`, `@testing-library/react` `^16.0.1`, `@testing-library/jest-dom` `^6.6.3` |
| Lint/format | ESLint `^9.13.0`, `typescript-eslint` `^8.11.0`, `eslint-config-prettier` `^9.1.0`, Prettier `^3.3.3` |
| TypeScript | `typescript` `^5.6.3`, strict, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `jsx: react-jsx`, `moduleResolution: Bundler` |

`tsconfig.json` is a solution file referencing `tsconfig.app.json` (source)
and `tsconfig.node.json` (`vite.config.ts`). Both use `noEmit`.

Exact npm scripts:

| Command | Runs |
|---|---|
| `npm run dev` | `vite` |
| `npm run build` | `tsc -p tsconfig.app.json --noEmit && vite build` |
| `npm run preview` | `vite preview` |
| `npm run lint` | `eslint .` |
| `npm run lint:fix` | `eslint . --fix` |
| `npm run format` | `prettier --write .` |
| `npm run format:check` | `prettier --check .` |
| `npm run typecheck` | `tsc -p tsconfig.app.json --noEmit` |
| `npm test` | `vitest run` |
| `npm test:watch` | `vitest` |

Prettier: single quotes, trailing commas, semicolons, 100 columns
(`.prettierrc.json`). ESLint uses a flat config with `js.configs.recommended`,
`tseslint.configs.recommended`, `react-hooks` recommended rules,
`react-refresh/only-export-components` as a warning, and Prettier compatibility.

### File tree and real status

```
frontend/
├── index.html                    # root div + /src/main.tsx; title "RehabLoop — movement measurement (prototype)"
├── vite.config.ts                # host 0.0.0.0, port 5173, polling watch, Vitest jsdom
├── package.json / package-lock.json
├── tsconfig*.json
├── eslint.config.js / .prettierrc.json / .prettierignore
├── Dockerfile                    # targets: deps, dev (default CMD), build (preview)
├── .dockerignore / README.md
└── src/
    ├── main.tsx                  # StrictMode + BrowserRouter + App (WORKING)
    ├── App.tsx                   # header, DEMO BUILD badge, nav with 8 links, AppRoutes, footer SafetyBanner (WORKING)
    ├── index.css                 # all styling; no CSS modules yet (WORKING)
    ├── app/routes.tsx            # 8 routes + wildcard -> AuthScreen (WORKING, no guards)
    ├── components/
    │   ├── SafetyBanner.tsx      # exact safety copy (WORKING)
    │   └── ScreenPlaceholder.tsx # shared placeholder shell (WORKING; not final UI)
    ├── features/
    │   ├── sessions/AuthScreen.tsx, PatientHomeScreen.tsx, CameraSetupScreen.tsx,
    │   │   LiveSessionScreen.tsx, SessionResultScreen.tsx   # PLACEHOLDERS
    │   ├── protocols/ProtocolDetailScreen.tsx, ClinicianDashboardScreen.tsx  # PLACEHOLDERS
    │   └── recovery-twin/RecoveryTwinScreen.tsx            # PLACEHOLDER
    ├── lib/
    │   ├── api.ts                # BASE_URL, ApiError, api.* helpers, sessionStreamUrl() (WORKING, no auth header)
    │   ├── supabase.ts           # configured/null client (WORKING, unused by screens)
    │   ├── mocks/events.ts       # 4 measurements + 2 warnings, all simulated (WORKING)
    │   └── mocks/index.ts        # re-export
    ├── types/index.ts            # wire types (WORKING; see type drift in 6.4)
    ├── test/setup.ts             # jest-dom/vitest matchers
    └── App.test.tsx              # 2 passing smoke tests
```

Conventions: PascalCase component files and exports, camelCase helpers,
kebab-case folders, one component per file, tests colocated as `Name.test.tsx`
(not yet present beyond `App.test.tsx`). Import shared wire types from
`src/types`; do not redefine them in feature folders. No `any` in new code.
Keep the safety banner visible. Note that `SafetyBanner` currently renders
twice per screen (inside `ScreenPlaceholder` and in the `App` footer), which is
why the smoke test uses `getAllByText`.

## 3. Running it

### Whole stack (recommended for integration)

```bash
copy .env.example .env        # PowerShell; from repo root; fill values locally
docker compose up --build
# frontend http://localhost:5173
# API health http://localhost:8000/api/v1/health
# vision health http://localhost:8001/health
```

The Compose `frontend` service builds target `dev` from `node:20.18.1-bookworm-slim`,
runs as user `node`, bind-mounts `./frontend:/app` with an anonymous volume for
`/app/node_modules`, and starts `npm run dev -- --host 0.0.0.0`. `vite.config.ts`
sets `server.watch.usePolling` to true unless `VITE_POLLING=false`, which is
needed for reliable hot reload with Docker Desktop/Windows bind mounts.

If port 5173, 8000 or 8001 is already allocated, stop the other stack first
(`docker compose ps` / `docker compose down` in that project). This machine has
previously had a different project holding 8000 and 5173.

There is also `docker-compose.cpu.yml` on this branch for the CPU MoveNet path;
it is a Lennox-owned file and does not change the frontend command.

### Frontend only

```bash
cd frontend
npm ci
npm run dev                  # http://localhost:5173
npm run lint
npm run typecheck
npm test
npm run build
```

`npm ci` uses the committed `package-lock.json`; if dependencies change, run
`npm install` and commit both `package.json` and `package-lock.json`.

### Environment variables

All `VITE_*` values are **public** build-time config. Secrets never go here.
CI supplies dummy values; no repository secrets are needed.

| Variable | Read by | Meaning | Default |
|---|---|---|---|
| `VITE_SUPABASE_URL` | `src/lib/supabase.ts` | Public Supabase project URL | empty |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.ts` | Public anon/publishable key, RLS-scoped; never an auth bypass | empty |
| `VITE_API_BASE_URL` | `src/lib/api.ts` | FastAPI base URL | `http://localhost:8000` |
| `VITE_FRAME_SAMPLE_RATE` | `.env.example` and Compose only | Intended camera sampling target, 5–10 fps | `8` |
| `VITE_POLLING` | `vite.config.ts` via `process.env` | Set `false` to stop polling watch locally | unset (polling on) |

When both Supabase values are empty, `supabaseConfigured` is false and
`supabase` is `null`; the app still renders but there is no signed-in session.
Do not fake one. Composing passes `VITE_FRAME_SAMPLE_RATE` into the container,
but no source file reads it yet — sampling is unimplemented.

## 4. Required screens

Every screen must handle **loading**, **empty**, **error**, **camera denied**
where relevant, and **vision service unavailable** where relevant. The auth,
camera setup and live session screens now implement those flows. Other rows
remain the work list.

| # | Route | File | Purpose | Data source |
|---|---|---|---|---|
| 1 | `/` | `features/sessions/AuthScreen.tsx` | Supabase sign-in or development-only local synthetic patient; role verified server-side | Supabase Auth + `GET /api/v1/me` |
| 2 | `/home` | `features/sessions/PatientHomeScreen.tsx` | Assigned protocol, next guidance, recent session status; read-only demo if no approved protocol | `GET /api/v1/patients/me/protocols`, patient progress |
| 3 | `/protocols/:id` | `features/protocols/ProtocolDetailScreen.tsx` | Name, instructions, side, target range, stop instructions, version; confirm understanding | assigned protocol from `/patients/me/protocols` |
| 4 | `/setup` | `features/sessions/CameraSetupScreen.tsx` | Consent before camera permission, assigned protocol, live preview and framing checklist | `getUserMedia`, consent row, session API |
| 5 | `/sessions/:id/live` | `features/sessions/LiveSessionScreen.tsx` | Stream frames, reps, projected angle, quality, pause/resume/end | `WS /sessions/{id}/stream` |
| 6 | `/sessions/:id/result` | `features/sessions/SessionResultScreen.tsx` | Measured summary, quality note, event list, AI explanation | `GET /sessions/{id}`, `POST /sessions/{id}/summary` |
| 7 | `/clinician` | `features/protocols/ClinicianDashboardScreen.tsx` | Patient list, protocol editor, sessions, trends, review notes | `GET /me`, progress, `PATCH /protocols/{id}` |
| 8 | `/twin` | `features/recovery-twin/RecoveryTwinScreen.tsx` | 3D avatar, metric selection, scrubber, two-session comparison | session angle trace from `GET /sessions/{id}` |

`src/app/routes.tsx` also maps `*` to `AuthScreen`. There are no route guards;
an unauthenticated user currently reaches every screen. Adding a UI guard is
fine for presentation, but backend authorization remains authoritative.

### Per-screen build notes

1. **Authentication** — obtain a Supabase access token, store it for the API
   client's `Authorization: Bearer` header, then call `GET /api/v1/me` to learn
   the role. For local backend demo only, `backend/app/core/auth.py` accepts
   `demo-patient-token` and `demo-clinician-token` when `APP_ENV=local`; these
   are not real credentials and must never be baked into a release build.
   States: signed out, loading profile, error, patient landing, clinician
   landing, camera-declined/non-camera review.
2. **Patient home** — list assigned protocols; if none is clinician-approved,
   show read-only demo mode and suggest no exercise. Link to protocol detail
   and prior sessions. States: loading, empty, error, demo mode.
3. **Protocol detail** — render name, instructions, side, target range, stop
   instructions and version from the assigned protocol. Confirm understanding
   before allowing setup. Never let the patient edit approved parameters.
   States: loading, missing protocol, error, confirmation gate.
4. **Camera setup** — secure-context check, consent copy acceptance **before**
   `getUserMedia`, live preview, framing illustration, checklist (side view,
   hip/knee/ankle visible, stable mount, even light, one person), retry and
   cancel. Start only when checks pass. States: camera denied, framing failure,
   consent required, vision unavailable, loading, error.
5. **Live session** — send `FrameEvent`s over the session WebSocket, render
   only events that pass quality gates, show projected angle estimate, reps and
   state, and provide pause/resume/end/hide-overlay. Stop tracks and close the
   socket on pause, end, route change or disconnect. States: camera denied,
   vision unavailable (`VISION_UNAVAILABLE`), paused, low quality,
   `RATE_LIMITED`, `BAD_FRAME_ORDER`, reconnecting.
6. **Session result** — fetch canonical metrics, render data-quality note and
   event list. Render numbers from the stored session record, never from LLM
   text. Label AI copy "AI-generated explanation of recorded measurements" and
   show a deterministic fallback when the summary provider fails. States:
   loading, saved, unsaved/retry, error, summary fallback.
7. **Clinician dashboard** — patient list, protocol editor that creates a new
   version, session review, trend charts and notes. No automatic treatment-plan
   updates. States: no assigned patients, loading, error, access revoked.
8. **Recovery Twin** — see Section 8.

## 5. Running the UI against the API and mocks

### 5.1 Mocks first

`src/lib/mocks/events.ts` provides `SIMULATED_LABEL`, `mockMeasurements` (four
events: `REST`, `EXTENDING`, `TARGET_HOLD`, `RETURNING`), `mockQualityWarnings`
(two: low-confidence ankle, multiple persons), and `mockEventStream()` which
yields all six. Every event has `simulated: true` and model
`fixture-simulated`. When you use them, show a visible SIMULATED badge —
`SIMULATED_LABEL` exists as a constant but no component renders it yet. Never
let a mock value look like live inference.

### 5.2 API client

`src/lib/api.ts` exposes:

| Export | Behaviour |
|---|---|
| `BASE_URL` | `import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'` |
| `ApiError` | carries `status` and the `{detail, code}` body |
| `api.health()` | `GET /api/v1/health` |
| `api.me()` | `GET /api/v1/me` |
| `api.myProtocols()` | `GET /api/v1/patients/me/protocols` |
| `api.getSession(id)` | `GET /api/v1/sessions/{id}` |
| `api.progress(patientId)` | `GET /api/v1/patients/{id}/progress` |
| `api.createSummary(id)` | `POST /api/v1/sessions/{id}/summary` |
| `sessionStreamUrl(sessionId, token)` | builds `ws(s)://.../api/v1/sessions/{id}/stream?token=...` |

The helper sends the current Supabase access token or a session-scoped local
demo token in `Authorization: Bearer`. The local token is offered only in Vite
development; backend development auth still requires `APP_ENV=local`.

### 5.3 WebSocket contract

Client frame (`backend/app/schemas/stream.py`): `type: "frame"`, `session_id`,
`sequence >= 0`, `timestamp_ms >= 0`, `image_b64` with maximum encoded length
2,000,000 characters, and no extra fields. The server rejects non-increasing
sequence/timestamps with `BAD_FRAME_ORDER`, skips frames over the configured
rate with `RATE_LIMITED`, and returns `UNPROCESSABLE` for invalid payloads or
session mismatch. A missing/short-lived token produces `UNAUTHENTICATED` and
close code 4401.

Server events: `measurement` (`sequence`, `timestamp_ms`,
`projected_knee_angle_deg`, `rep_count`, `state`, `quality`, `model_version`,
`simulated`), `quality_warning` (`reason`, `message`, `rep_count`,
`timestamp_ms`, `model_version`, `simulated`), and `error` (`code`, `message`).
Angles are rounded to one decimal place. On a 503 the server closes with code
1013; pause the UI and show "vision service unavailable" rather than inventing
data.

Session start can return a short-lived `stream_token`; pass that value to
`sessionStreamUrl()` as the `token` query parameter. It is not a user JWT and
must not be persisted long-term.

### 5.4 Type alignment still to review

The session flow types now include health storage mode, profile, protocol,
quality confidence, warning metadata, persistence metadata and the short-lived
stream token. Remaining broader type work includes progress and summary
response fields. Keep any wire-shape changes aligned with
`docs/api_contract.md`, backend schemas, mocks and both developer guides, with
approval from both developers.

### 5.5 Contract items pending your review

`docs/api_contract.md` marks these as PROPOSED on `feature/lennox`:

- health `storage_mode`; `persisted` on protocol/session/progress/summary;
- `stream_token` from session start;
- consent record requirements (`purpose=camera_processing`,
  `consent_version=camera-processing-v1`) and an unrevoked consent record;
- summary fields `generated_by`, `source`, `model_id`, disclaimer, `persisted`;
- `simulated` on measurement and quality_warning events;
- JSON frame size limit, rate/order rejection and error codes;
- one-decimal angle rounding and `persisted=false` in memory mode.

Review them explicitly in the PR. Your approval is required before merge into
`develop`.

## 6. Camera, consent and framing

- `getUserMedia` needs a secure context (HTTPS or localhost). If unavailable,
  explain in plain language and offer non-camera review of saved data.
- Ask for consent before calling `getUserMedia`; only after acceptance should
  you write the consent markers with the exact `purpose` and
  `consent_version` values listed in the contract's PROPOSED section, then send
  the consent id with `POST /sessions/{id}/start`.
- `VITE_FRAME_SAMPLE_RATE` is the intended 5–10 fps target; the backend enforces
  `MAX_FRAME_RATE` and rejects non-increasing timestamps. Use timestamps, not
  frame counts, for tempo.
- Use a side view, stable mount, hip/knee/ankle visible, even lighting and one
  person in frame. Errors are instructions ("Move back until your full leg is
  visible"), not codes.
- A failed quality gate means "measurement unavailable": no angle, no rep,
  no invented interpolation. Stop tracks and close the socket on
  pause/end/route-change/disconnect.
- Playwright's fake camera is a test pattern, not a person. It verifies UI and
  plumbing only, never pose quality.

## 7. Recovery Twin (3D)

`three`, `@react-three/fiber` and `@react-three/drei` are installed but no 3D
component exists; `RecoveryTwinScreen.tsx` is a placeholder with explanatory
text. When implementing it: use a neutral, non-identifiable rigged GLB with a
checked redistribution licence; drive the joint rotation from the same
measured projected angle trace shown in the metrics; provide a timeline scrubber
that syncs labels, session dates, protocol version, quality and model/mapping
version; compare two sessions with accessible labels as well as colour; show a
visible gap on missing/low-quality frames instead of interpolating. It
visualises the measured movement plane only — never claim true 3D
biomechanics, anatomical accuracy or clinical meaning.

## 8. UX, safety copy and accessibility

`SafetyBanner.tsx` currently says: "Prototype, not a medical device. RehabLoop
measures estimated movement from one camera view. It does not diagnose, treat
or advise. Angles are projected estimates, not clinical measurements. A
clinician owns the exercise protocol and interprets the results." Keep this
visible on all screens.

- Label every angle "projected knee angle estimate"; round to one decimal
  (the backend already rounds). No false precision.
- No diagnosis, prescription, "recovery", "safe to continue" or treatment
  language. AI text is an explanation of recorded measurements and sits beside
  the exact stored numbers.
- Do not rely on colour alone: pair status colour with icons and text. Provide
  large, distinct camera/pause/end controls, readable contrast, keyboard
  operation and reduced-width layouts.
- Provide the non-camera review path and plain-language errors.
- **Clinical gate:** with no clinician-approved protocol, stay in read-only
  demo mode and never suggest or start an exercise.
- Auth/RLS: UI role only chooses what to display. The Supabase anon key is
  public and RLS-scoped; the service-role key must never appear in frontend
  code, `VITE_*` variables, the bundle or chat. CI greps `frontend/` for
  `SUPABASE_SERVICE_ROLE_KEY` and fails the build if found.

## 9. Testing

Current state: `src/App.test.tsx` has two Vitest tests (shell/safety notice and
mock `simulated` flags); both pass. `vite.config.ts` sets `environment: 'jsdom'`,
`globals: true`, and `setupFiles: ['./src/test/setup.ts']` (jest-dom matchers).

Run locally:

```bash
npm test              # one-shot
npm test:watch        # watch mode
npm run lint && npm run typecheck && npm run build
```

CI `.github/workflows/ci.yml` frontend job: `actions/setup-node@v4` with Node
22 and npm caching on `frontend/package-lock.json`, then `npm ci`, `npm run
lint`, `npm run typecheck`, `npm test`, `npm run build`. `npm ci` and `build`
receive dummy `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and
`VITE_API_BASE_URL`; no secrets are configured.

Tests to add as you implement:

- Per-screen loading, empty, error, camera-denied and vision-unavailable states.
- Event handling: valid measurement, quality warning, simulated badge, duplicate
  and out-of-order sequence, socket close, 1013 and 4401 close codes.
- Camera: mocked `getUserMedia` success/denial, secure-context failure, tracks
  stopped on unmount, frame sampling at the configured rate.
- Auth: Bearer header attached, 401/403 rendering, role-aware landing.
- Copy safety: no diagnosis language, projected-estimate label present.
- Responsive and keyboard-only checks.

Playwright MCP is assigned to Steve in `docs/mcp_setup.md` on the
`chore/mcp-setup` branch. Its smoke test starts the frontend, navigates to the
home page and takes a snapshot with a fake media stream; that tests plumbing,
not pose quality. Check your branch for the config before using it.

## 10. Git, PRs and definition of done

From `docs/GIT_WORKFLOW.md`: work on `feature/steve`, PR into `develop`; nobody
pushes directly to `main` or `develop`; `develop` merges to `main` only for a
release/demo. Steve reviews frontend; Lennox reviews his areas; shared files
and contract changes need both. CODEOWNERS currently resolves Steve to
`@Pinyotimo` and Lennox to `@Le-n-n-ox`. Branch protection on `main` and
`develop` requires a PR, the passing `ci` check, up-to-date branches, and blocks
force pushes and deletions.

Before committing:

```bash
git status
git ls-files | grep -E '(^|/)\.env($|\.)'   # must print nothing
git diff --cached | grep -i 'service_role\|api_key'   # must print nothing
```

PR checklist: checks green; docs and contract updated if behaviour changed;
both owners approved for shared/contract changes; no secrets, `.env`, weights
or patient data; safety review complete; "does this change the API contract?"
answered in the description.

Definition of done: it runs from a clean checkout, checks pass, behaviour is
documented, safety rules hold, the right owner(s) reviewed it, and it is merged
through a PR into `develop`.

## 11. Glossary

- **Projected angle** — 2D hip/knee/ankle angle from one camera; an estimate.
- **Landmark / keypoint** — named point (`selected_hip`, `selected_knee`, `selected_ankle`).
- **Rep** — one valid state-machine cycle; never counted on unreliable frames.
- **Quality gate** — rule that rejects unusable frames before measurement.
- **Fixture** — labelled synthetic input; output must be marked `simulated`.
- **MoveNet** — CPU pose model used by the current real-vision path.
- **Stream token** — short-lived token from session start used only for the WebSocket.
- **`persisted` / `storage_mode`** — proposed response flags showing whether data is durable.
- **Recovery Twin** — rigged avatar driven by measured projected motion.
- **RLS** — Supabase Row Level Security; the real authorization boundary.

## 12. Placeholder and TODO inventory

| File | Status |
|---|---|
| `features/**/*.tsx` | Auth, camera setup, live session and results are implemented; other screens remain placeholders |
| `components/ScreenPlaceholder.tsx` | Shared placeholder shell, intentionally temporary |
| `App.tsx` | Working shell; "DEMO BUILD" badge is not a SIMULATED badge |
| `lib/mocks/events.ts` | Working fixtures; no UI currently renders `SIMULATED_LABEL` |
| `lib/api.ts` | Bearer-authenticated helpers plus session start/complete and WebSocket URL |
| `lib/supabase.ts` | Supabase Auth and RLS-scoped consent insert use the public client |
| `types/index.ts` | Session flow types aligned; progress and summary fields need review |
| 3D dependencies | Installed, no scene component |
| Camera code | Camera setup and session streaming implemented |
| Charts | Absent |
| Auth guards | Absent |

## 13. Known limitations and unverified areas

No true 3D biomechanics, no clinical validation, no real-time guarantee, no
multi-exercise catalogue and no patient-facing diagnosis. Fixture mode is
synthetic and labelled. The live API does not send pose landmarks to the
browser, so a skeleton overlay is unavailable. `VITE_FRAME_SAMPLE_RATE` is
consumed and capped at 8 fps. Contract items in Section
5.5 are implemented on `feature/lennox` but not yet approved by you. The
Playwright MCP files are on an unmerged branch. The CPU MoveNet path is
described in `docs/model-smoke-test.md`.

## 14. First tasks for Steve

These implementation tasks reflect the current repository state:

0–4 h (foundation already scaffolded; finish the integration plumbing):
1. Wire `Authorization: Bearer <token>` into `src/lib/api.ts` and add a real
   WebSocket client using `sessionStreamUrl(sessionId, stream_token)`. Review
   `docs/api_contract.md` PROPOSED items and the type drift in Section 5.4 with
   Lennox.
2. Replace `AuthScreen` with Supabase sign-in and `GET /api/v1/me` role landing;
   add a presentation-only guard so unauthenticated users cannot reach
   protected routes.

4–8 h (read-only flows):
3. Implement patient home and protocol detail against the assigned-protocol
   endpoint, including the clinician-approved gate and read-only demo mode.
4. Implement camera setup: consent copy first, secure-context check, framing
   guide and non-camera review path. Do not call `getUserMedia` before consent.

8–16 h (live loop):
5. Implement frame sampling at 5–10 fps, the WebSocket client, metric cards,
   quality warnings and pause/resume/end, starting with labelled mock events.
6. Prove the camera-denied and vision-unavailable states with no fabricated
   data, and keep the non-camera review path working.

Acceptance for this slice: a clinician-approved protocol can be viewed, a
session can be started with consent, mock measurement events drive real UI
states, and all screens render safely without camera access.

## 15. Further reading

- `docs/ARCHITECTURE.md` — boundaries and data flow
- `docs/api_contract.md` — HTTP/WebSocket/error/state contracts and PROPOSED items
- `docs/BACKEND_STATUS.md` — what the backend currently implements and its limits
- `docs/model-smoke-test.md` — fixture and MoveNet CPU paths
- `docs/GIT_WORKFLOW.md` — branches, PRs and branch protection

## Current UI implementation note

The scaffold inventory and first-task list above predate the latest frontend
work. Authentication now supports Supabase sign-in plus a development-only
synthetic patient. Camera Setup records consent, opens a real browser preview,
loads assigned protocols, checks the user's framing confirmation, and starts a
backend session. Live Session samples camera frames, renders stream metrics and
quality feedback, and supports pause, resume, and end. The result route fetches
the canonical backend session metrics.

The current stream contract does not send pose landmarks to the browser, so a
skeleton overlay is not implemented. The consent wording is prototype copy and
needs Steve's review before production rollout. `docs/camera-setup.md` and
`frontend/README.md` contain current local testing steps.
