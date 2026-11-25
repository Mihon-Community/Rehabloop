# Demo runbook (stub)

Owner: both. Blueprint Sections 10, 14, 17 and 18.

## Before the demo

- Confirm the selected path is MoveNet or labelled fixture. Patient-facing use
  requires consent, privacy review and validation; do not treat pose estimates
  as clinically validated measurements.
- Start vision first, check `/health` (mode + simulated flag), then API, then UI.
- Verify no raw-video persistence and that the Supabase bucket is private.
- Confirm RLS matrix passes, synthetic accounts have the right roles, and no
  real patient data is present.
- Check NVIDIA key/model; test that removing the key yields the deterministic
  summary. Keep a labelled backup clip and synthetic keypoint sequence.

## During

- State clearly which path is live: real inference, processed clip, or labelled
  synthetic fixture. Show protocol -> consent -> framing -> session -> result ->
  trend -> Recovery Twin -> constrained explanation.
- Report measured test-set size and errors; never present math unit-test
  accuracy as clinical accuracy.

## After

- Delete temporary demo sessions per the retention plan, clear frame buffers,
  rotate any exposed secret, and record limitations truthfully.
