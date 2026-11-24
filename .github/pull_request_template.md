## What changed

<!-- Short description and why. Link issues. -->

## Tests

- [ ] Frontend: `npm ci && npm run lint && npm run typecheck && npm test && npm run build`
- [ ] Backend/vision: `ruff check . && ruff format --check . && mypy app && pytest`
- [ ] Docker: `docker compose config` (and `up --build` smoke if infra changed)

## Docs

- [ ] Docs updated if behaviour changed
- [ ] `docs/api_contract.md` updated if the contract changed

## Safety and secrets

- [ ] No secrets, `.env`, model weights, patient data or video in the diff
- [ ] No diagnosis/treatment language or false precision added
- [ ] Simulated fixture output remains labelled simulated; `STORE_RAW_VIDEO` still false
- [ ] Accessibility: no meaning conveyed by colour alone

## Does this change the API contract?

- [ ] No
- [ ] Yes — both Steve and Lennox have approved (required)

## Reviewers

<!-- Shared files and contract changes need both owners. -->
