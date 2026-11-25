# Contributing to RehabLoop

Two developers, two areas, one shared contract.

## Branches

- `feature/steve` — Steve owns `frontend/`.
- `feature/lennox` — Lennox owns `backend/`, `vision_service/`, `supabase/`, `fixtures/`.
- `develop` — integration branch. All PRs target this.
- `main` — releases and demos only.

Never push directly to `main` or `develop`. See `docs/GIT_WORKFLOW.md`.

## Before you open a PR

1. Read `docs/api_contract.md`. Does this change the HTTP or WebSocket contract?
   If yes, say so in the PR description and get approval from both Steve and
   Lennox.
2. Run the checks for your area: frontend `npm ci && npm run lint && npm run
   typecheck && npm test && npm run build`; backend/vision `ruff check .`,
   `ruff format --check .`, `mypy app`, `pytest`.
3. Add or update tests and docs for anything you change.
4. Verify no secrets, `.env` files, model weights or patient data are staged:
   `git status` and `git ls-files`.
5. Fill in the PR template, including the safety review.

## Commit style

Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `build:`, `ci:`,
`test:`, `refactor:` with a short imperative subject.

## Safety is binding

No diagnosis, treatment advice or false precision. No real patient data or raw
video in the repository. Fixture output must be labelled simulated. Read
`SECURITY.md`, `docs/ARCHITECTURE.md`, and `docs/backend_guide.md`.
