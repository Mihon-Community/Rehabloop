# MCP servers for RehabLoop

Hermes Agent MCP setup. This file contains **no secrets** — tokens stay in
Hermes's `.env` (`%LOCALAPPDATA%\hermes\.env` on this Windows install), never in
`config.yaml` and never in this repository.

On this install the config lives at
`C:\Users\Administrator\AppData\Local\hermes\config.yaml` (not `~/.hermes/config.yaml`).
Manage entries with `hermes mcp add ...` / `hermes config set ...`; verify each
with `hermes mcp test <name>` and `hermes mcp list`. After adding a server, run
`/reload-mcp` in an open Hermes session (or start a new one) to load its tools.

The tool surface is deliberately small because the team uses a free model.
Each entry sets `tools.include` where the server exposes more tools than we
need, and `tools.prompts: false` / `tools.resources: false` everywhere.

| Server | Who | Purpose |
|---|---|---|
| Supabase | Lennox | Dev-project schema, migrations, advisors |
| Context7 | Both | Current library/framework docs |
| Playwright | Steve | Browser smoke tests of the UI |
| Hugging Face | Lennox | Model cards and licence terms |

GitHub is deliberately **not** an MCP server here — use the `gh` CLI.

## Supabase (Lennox)

- URL:
  `https://mcp.supabase.com/mcp?project_ref=ikqarwytbcnpdofcrwgz&features=docs,database,debugging,development&read_only=true`
- Auth: browser OAuth, completed with `hermes mcp login supabase --flow browser`
  in an interactive terminal.
- Tools registered: `list_tables`, `list_migrations`, `get_advisors`,
  `search_docs`, `execute_sql`.
- Verify: `hermes mcp test supabase`.
- `read_only=true` is set because the bootstrap migration is applied and the
  security/performance advisors were reviewed. Remove that flag temporarily,
  with approvals on, to apply future migrations; restore it afterwards.
- This is the **dev project with synthetic data only**. Never insert real
  patient data. Keep approvals on once non-synthetic data exists.

## Context7 (both)

- URL: `https://mcp.context7.com/mcp` — no key needed to start.
- Tools registered: `resolve-library-id`, `query-docs`.
- Verify: `hermes mcp test context7`.
- If rate-limited, create a free key at `context7.com/dashboard` and set
  `CONTEXT7_API_KEY` in Hermes's `.env`. Do not put it in `config.yaml`.

## Playwright (Steve)

- Command: `npx @playwright/mcp@latest --config frontend/playwright-mcp.config.json`
  (on this Windows install the config path is stored as an absolute path so the
  subprocess finds it regardless of the working directory).
- Local config: `frontend/playwright-mcp.config.json` — Chromium with
  `--use-fake-ui-for-media-stream` and `--use-fake-device-for-media-stream`.
- Tools registered: `browser_navigate`, `browser_snapshot`, `browser_click`,
  `browser_take_screenshot`, `browser_close`, `browser_wait_for`.
- Verify: `hermes mcp test playwright`. If Chromium is missing, run
  `npx @playwright/mcp install-browser chromium`.
- Smoke test: start the frontend (`npm run dev`), navigate to the home page and
  take an accessibility snapshot.
- **The fake camera is a test pattern, not a person.** It exercises the UI and
  the camera/plumbing path only; it does **not** test pose quality or measurable
  knee angles. Never present its output as real inference.

## Hugging Face (Lennox)

- URL: `https://huggingface.co/mcp`.
- Preferred auth: browser OAuth — `hermes mcp login huggingface --flow browser`
  in an interactive terminal.
- Fallback: create a **read-only** Hugging Face token and set `HF_TOKEN` in
  Hermes's `.env`. The config can then use
  `headers: {Authorization: "Bearer ${HF_TOKEN}"}`; Hermes interpolates `${VAR}`
  from `.env` at load time. Never paste the token into `config.yaml`, the repo
  or chat.
- Tools registered: `hf_whoami`, `hub_repo_details`, `hf_fs`.
- Verify: `hermes mcp test huggingface`.
- Use it to read model cards and licence terms (for example
  `facebook/sapiens2-pose-0.4b`). Always verify licence text against the
  upstream source before relying on it.
- This server is **read-only usage** for the project; do not upload models,
  datasets or patient-derived material through it.

## Safety and secrets

- Never commit tokens, `.env` files, model weights, patient data or raw video.
- Supabase is for the dev project with synthetic data only.
- Keep Hermes approvals on once non-synthetic data exists.
- The Sapiens2 licence is a separate go/no-go gate; consult the source terms.

## Troubleshooting

- `auth=None` on `hermes mcp login <name>` means the entry was saved without an
  OAuth method. Restore `auth: oauth` and `enabled: true` under
  `mcp_servers.<name>`, then log in again.
- Tools not visible in an open session: run `/reload-mcp` or start a new session.
- `hermes mcp test <name>` lists all tools the server exposes; `hermes mcp list`
  shows how many are actually registered after filtering.
