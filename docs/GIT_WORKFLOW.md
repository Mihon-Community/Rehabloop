# Git workflow (blueprint Section 10)

## Branches

```
main        <- releases and demos only; protected
  develop   <- integration branch; protected
    feature/steve    <- Steve, frontend/
    feature/lennox   <- Lennox, backend/ vision_service/ supabase/ fixtures/
```

- **Steve** works only on `feature/steve` (owns `frontend/`).
- **Lennox** works only on `feature/lennox` (owns `backend/`, `vision_service/`,
  `supabase/`, `fixtures/`).
- Both open PRs into `develop`. The other developer reviews anything outside
  their own area; shared files (`docs/`, `docker-compose*.yml`, `.env.example`,
  `.github/`, root config) need review from both.
- `develop` merges into `main` only for a release or demo.
- **Nobody pushes directly to `main` or `develop`.**
- An API/WebSocket contract change needs a PR approved by both Steve and Lennox
  (see `docs/api_contract.md`).

## Day-to-day

```bash
git fetch origin
git switch develop && git pull --ff-only
git switch -c feature/steve origin/develop   # or feature/lennox
# work, then:
git add -A && git commit -m "feat: <what>"
git push -u origin feature/steve
# open a PR into develop
```

Use Conventional Commits: `feat`, `fix`, `docs`, `chore`, `build`, `ci`, `test`,
`refactor`. Keep commits logical and small. Delete feature branches after merge.

## Before every commit

```bash
git status
git ls-files | grep -E '(^|/)\.env($|\.)'   # must print nothing
git diff --cached | grep -i 'service_role\|api_key'   # must print nothing
```
Never stage `.env`, secrets, tokens, model weights, patient data or raw frames.

## PR checklist

- [ ] Tests and lint/build pass for the changed area.
- [ ] Docs updated; `docs/api_contract.md` if the contract changed.
- [ ] Both developers approved if shared files or the API contract changed.
- [ ] No secrets, `.env`, weights, patient data or video in the diff.
- [ ] Safety review: no diagnosis/treatment language, no false precision,
      simulated output still labelled simulated, `STORE_RAW_VIDEO` still false.
- [ ] "Does this change the API contract?" answered in the PR description.

## Definition of done

A unit of work is done when it runs locally from a clean checkout, has passing
automated checks, is documented, respects the safety rules, is reviewed by the
right owner(s), and is merged through a PR into `develop` (or `main` for a
release/demo). At hour 48 the blueprint's full definition of done applies:
one complete, truthful end-to-end demo with known limitations.

## Branch protection (to set in GitHub when authenticated)

On `main` and `develop`: require a PR before merging, require the `ci` check to
pass, require branches to be up to date, block force pushes and deletions.
Require two approvals for changes touching `docs/api_contract.md` via CODEOWNERS.
