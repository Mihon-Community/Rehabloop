 den

# Frontend developer guide — Steve

Owner: **Steve** · branch: `feature/steve` · area: `frontend/`
Read first: `RehabLoop_Full_Product_and_Technical_Blueprint.md` (Sections 4, 5, 8,
10, 11, 13) and `docs/api_contract.md`. Architecture map: `docs/ARCHITECTURE.md`.

## 1. Your role

You build the patient and clinician experience: auth screens, protocol view,
consent, camera setup and sampling, live session, results, progress charts and
the 3D Recovery Twin. The product is a measurement tool with a clinician in
control — not a chatbot, not a coach, not a diagnostic app.

**In scope:** everything under `frontend/` — routes, components, feature folders,
API/WebSocket clients, mocks, tests, build config, styling and accessibility.

**Out of scope:** API behaviour, movement math, Sapiens2, Supabase schema, RLS,
NVIDIA. Those are Lennox's.

**You own:** `frontend/` (CODEOWNERS). Changes to `docs/`, `docker-compose*.yml`,
`.env.example`, `.github/` and root config are **shared** and need Lennox's
review. Any change to the HTTP or WebSocket contract needs a PR approved by
**both** you and Lennox — update `docs/api_contract.md` in the same PR. You may
hide a control in the UI, but the UI role is never an authorization control;
the backend verifies role and patient assignment.

## 2. Tech stack and conventions

Vite + React 18 + TypeScript (strict), React Router 6, `@supabase/supabase-js`
(anon key only), `three` + `@react-three/fiber` + `@react-three/drei` for the
Twin, Vitest + Testing Library for tests, ESLint (flat config) + Prettier.

```
frontend/
├── index.html
├── vite.config.ts            # dev server, polling watch for Docker/Windows, Vitest
├── src/
│   ├── main.tsx              # BrowserRouter + App
│   ├── App.tsx               # shell, nav, safety banner
│   ├── app/                  # routes + auth guards  (routes.tsx)
│   ├── components/           # reusable UI: SafetyBanner, ScreenPlaceholder, camera, cards, charts
│   ├── features/
│   │   ├── protocols/        # protocol detail + clinician dashboard screens
│   │   ├── sessions/         # auth, patient home, camera setup, live session, result
│   │   └── recovery-twin/    # 3D avatar + timeline scrubber
│   ├── lib/
│   │   ├── api.ts            # VITE_API_BASE_URL client, error contract, sessionStreamUrl()
│   │   ├── supabase.ts       # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY client
│   │   ├── mocks/events.ts   # labelled simulated WS events
│   │   └── types...          # (wire types live in src/types/)
│   ├── types/index.ts        # shared response/wire types — mirror api_contract.md
│   ├── test/setup.ts
│   └── App.test.tsx          # passing smoke test
└── Dockerfile / .dockerignore
```

Conventions: PascalCase component files and components; camelCase helpers;
kebab-case folders; one component per file; colocate a component's test as
`Name.test.tsx`; import shared types from `src/types`, never redefine wire
shapes locally. No `any` in new code. Prettier (single quotes, 100 cols) and
ESLint must pass. Keep the safety banner visible on every screen.

## 3. Running locally

With the whole stack (fixture mode, no GPU needed — recommended):

```bash
copy .env.example .env        # from repo root; fill in what you have
docker compose up --build
# frontend http://localhost:5173  API http://localhost:8000/api/v1/health  vision http://localhost:8001/health
```

Without Docker, frontend only:

```bash
cd frontend
npm ci
npm run dev                   # http://localhost:5173
npm run lint && npm run typecheck && npm test && npm run build
```

`npm ci` uses the committed `package-lock.json` — regenerate it with
`npm install` whenever dependencies change and commit both files.

Environment variables (all **public** build-time config; never put a secret in
`VITE_*`):

| Variable                   | Meaning                                               | Default                   |
| -------------------------- | ----------------------------------------------------- | ------------------------- |
| `VITE_SUPABASE_URL`      | Public Supabase project URL                           | empty                     |
| `VITE_SUPABASE_ANON_KEY` | Public anon key, subject to RLS — not an auth bypass | empty                     |
| `VITE_API_BASE_URL`      | FastAPI base URL                                      | `http://localhost:8000` |
| `VITE_FRAME_SAMPLE_RATE` | Camera sampling target, 5–10 fps                     | `8`                     |
| `VITE_POLLING`           | Set `false` to disable Docker polling watch locally | unset (polling on)        |

With empty Supabase values the app still renders in demo mode (`supabase` is
`null`); do not fake a signed-in session.

## 4. Required screens (blueprint Section 4)

Every screen must handle: **loading**, **empty**, **error**, **camera denied**
(where relevant) and **vision service unavailable** (where relevant). The
scaffolded screens document their required states inline; replace the
placeholder with real UI, keeping the SafetyBanner.

| # | Screen              | Purpose                                                                                                                    | Data source                                              | Required states                                                      |
| - | ------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| 1 | Authentication      | Patient/clinician sign-in; role-aware landing. Role is verified server-side.                                               | Supabase Auth + `GET /api/v1/me`                       | loading, signed out, error, non-camera review (declined)             |
| 2 | Patient home        | Assigned protocol, next guidance, recent session status. No approved protocol → read-only demo mode, suggest no exercise. | `GET /api/v1/patients/me/protocols`, patient progress  | loading, empty, error, demo mode                                     |
| 3 | Protocol detail     | Name, clinician instructions, side, target range, stop instructions, version. Confirm understanding.                       | assigned protocol from `/patients/me/protocols`        | loading, missing protocol, error, confirm gate                       |
| 4 | Camera setup        | Live preview, framing guide, consent state, lighting/visibility checklist. Start only when checks pass.                    | `getUserMedia`, local consent state                    | camera denied, framing fail, loading, error                          |
| 5 | Live session        | Pose overlay, rep count, current projected angle, quality indicator, pause/resume/end, hide overlay.                       | `WS /sessions/{id}/stream` (or labelled mocks)         | camera denied, vision unavailable, paused, low quality, reconnecting |
| 6 | Session result      | Measured summary, data-quality note, event list, AI explanation. Show canonical numbers only.                              | `GET /sessions/{id}`, `POST /sessions/{id}/summary`  | loading, unsaved/retry, error, summary fallback                      |
| 7 | Clinician dashboard | Patient list, protocol editor, sessions, trend charts, review notes. New version per change; no automatic plan update.     | `GET /me`, patient progress, `PATCH /protocols/{id}` | no assigned patients, loading, error, access revoked                 |
| 8 | Recovery Twin       | 3D avatar, joint/metric selection, timeline scrubber, two-session compare.                                                 | session angle trace from `GET /sessions/{id}`          | no session, missing/low-quality frames, compare mode                 |

Routes already exist in `src/app/routes.tsx`: `/`, `/home`, `/protocols/:id`,
`/setup`, `/sessions/:id/live`, `/sessions/:id/result`, `/clinician`, `/twin`.

## 5. Contracts and mocks first

`docs/api_contract.md` is the source of truth. Your wire types in
`src/types/index.ts` mirror it: `SessionStatus`, `RepState`, `FrameEvent`,
`MeasurementEvent`, `QualityWarningEvent`, `SessionSummary`, `SummaryPayload`.

1. Build against `src/lib/mocks/events.ts`. `mockEventStream()` yields the same
   events the real stream will. **Every mock event has `simulated: true`** and a
   `SIMULATED_LABEL` badge must be visible when you use them. Never let a mock
   value look like a live measurement.
2. When Lennox's stream is ready, swap the generator for the real client:
   `new WebSocket(sessionStreamUrl(sessionId, token))` from `src/lib/api.ts`.
   Handle `measurement`, `quality_warning` and `error` events; validate
   `sequence` (ignore stale/duplicate) and surface `quality.usable === false`.
3. Use `api.health/me/myProtocols/getSession/progress/createSummary`. `ApiError`
   exposes `status` and the `{detail, code}` body — map codes to the client
   actions in the contract's error table. On 502/503 pause and show the fallback,
   never invent a value.

## 6. Camera, consent and framing

- `getUserMedia` requires a **secure context** (HTTPS or localhost). If it is
  unavailable, show a plain-language explanation and offer non-camera review.
- Ask for **consent before** calling `getUserMedia`; record the consent id to
  send with `/sessions/{id}/start`. Declining must not block protocol review or
  saved reports.
- Show a framing illustration and a checklist: side view, hip/knee/ankle visible,
  stable mount, even light, one person. Errors are instructions ("Move back
  until your full leg is visible"), not error codes.
- Sample at a configurable **5–10 fps** (`VITE_FRAME_SAMPLE_RATE`, capped by
  server `MAX_FRAME_RATE`). Use timestamps for tempo. Stop tracks and close the
  socket on pause/end/route-change/disconnect — no background camera.
- Quality flags come from the backend. A failed gate means "measurement
  unavailable", never a fabricated angle or a rep.

## 7. Recovery Twin (3D)

Use `three`, `@react-three/fiber`, `@react-three/drei` and a neutral,
non-identifiable rigged GLB (check its redistribution licence). Drive the joint
rotation from the **same measured projected angle trace** shown in the metrics —
the avatar is a visualisation of the recorded movement plane, not decoration and
not a 3D reconstruction. Include a timeline scrubber that syncs labels, session
dates, protocol version, measurement quality and model/mapping version. On
missing or low-quality frames, visibly pause/gap the avatar instead of
interpolating invented motion. Compare two sessions with labels as well as
colour. Sapiens2 pointmap research is future work; do not claim true 3D
biomechanics or anatomical accuracy.

## 8. UX, safety copy and accessibility

- Label every angle "projected knee angle estimate"; round to whole or one
  decimal — no false precision. Never present a validated clinical measurement.
- No diagnosis, prescription, "recovery", "safe to continue" or treatment
  language in any copy. AI text is labelled "AI-generated explanation of
  recorded measurements" and sits beside the exact stored numbers.
- Do not rely on colour alone: pair status colour with icons and text labels.
  Large, clearly distinct camera/pause/end controls and readable contrast.
- Provide the non-camera review mode and plain-language error messages.
- **Clinical gate:** if no clinician-approved protocol exists, stay in read-only
  demo mode and never suggest or start an exercise (blueprint Section 5).
- Auth/RLS: the UI role only controls what is displayed. The anon key is public
  and RLS-scoped; the **service-role key must never appear in frontend code,
  `VITE_*` variables or the bundle**.

## 9. Testing

Vitest + Testing Library (`npm test`, jsdom environment).

- Keep the smoke test green; add component tests for each screen's states.
- Test with mock events: valid measurement, quality warning, simulated badge,
  duplicate/out-of-order sequence, socket close.
- Camera tests: mocked `getUserMedia` success, denial, secure-context failure,
  tracks stopped on unmount; reduced-width and keyboard-only checks.
- Assert copy safety: no diagnosis language, projected-estimate label present.
- CI runs `npm ci`, lint, typecheck, test, build with no secrets.

## 10. Git, PRs and definition of done

Work on `feature/steve`, PR into `develop`; the other developer reviews shared
files. Never push to `main`/`develop`. See `docs/GIT_WORKFLOW.md` for the full
rules and branch protection checklist.

PR checklist: checks green; docs updated (contract too if touched); both owners
approved if shared/contract change; no secrets or patient data; safety review
done; "does this change the API contract?" answered.

A task is done when it runs from a clean checkout with passing checks, is
reviewed, documented and merged into `develop`.

## 11. Glossary

- **Projected angle** — 2D angle from hip/knee/ankle image points; an estimate.
- **Keypoint / landmark** — named body point from the pose model (`selected_hip`,
  `selected_knee`, `selected_ankle`).
- **Rep** — one complete state-machine cycle, never counted on low-quality frames.
- **Quality gate** — rule that rejects unusable frames before measurement.
- **Recovery Twin** — rigged avatar driven by measured projected motion.
- **RLS** — Supabase Row Level Security; the real authorization boundary.

## 12. Known limitations

No true 3D biomechanics, no clinical validation, no real-time guarantee, no
multi-exercise catalogue, no patient-facing diagnosis. Fixture mode is synthetic
and labelled. During the scaffold phase live endpoints return 501 and the API is
not yet connected — build against mocks. The blueprint's media folder was not
present in the repo, so its example screenshots are not bundled.

## 13. First tasks for Steve (blueprint Section 15, 0–16h)

0–8 h:

1. Vite React TS shell, route map, design tokens and auth layout (the scaffold
   gives you the shell — replace the placeholders and wire the routes/guards).
2. Patient home, protocol detail and consent/setup screens; agree the JSON
   contracts and demo assumptions with Lennox.

8–16 h:
3. Camera preview, framing guide, frame sampling and the WebSocket client —
   start from `mockEventStream()`, then swap to `sessionStreamUrl()` when the
   backend stream lands.
4. Confirm you can show camera-denied and vision-unavailable states without
   fabricating data, and keep the non-camera review path working.

See `docs/ARCHITECTURE.md` for the system boundaries.
