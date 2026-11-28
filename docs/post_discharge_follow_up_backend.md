# Post-discharge video follow-up: backend implementation

**Status:** Backend implementation proposal. It extends the existing session
and summary flow; it does not add discharge, appointment, or hospital-record
services.

## Goal

For a completed video session, provide a small, structured comparison with the
same patient's most recent earlier comparable session. The backend selects and
authorizes the comparison; the frontend only displays it. The record reports
measurements without interpreting them as recovery, clinical progress, or a
reason to change treatment.

## Comparison selection

Use the existing `sessions` and `session_metrics` data through the backend
repository. For the current session, select the latest session that:

- belongs to the same patient;
- is completed and started before the current session;
- uses the same protocol ID and version; and
- has compatible model, keypoint-mapping, and analytics versions.

If no such session exists, return no comparison and leave the current-session
record intact. Do not compare across patients, protocol versions, or measurement
versions. Do not use raw video; `STORE_RAW_VIDEO` remains false.

The existing summary service already retrieves prior same-protocol metrics for
summary generation. Tighten the selection to require that the prior session is
earlier than the current session and that the measurement versions are
compatible.

## Response and summary behavior

Make two small additive response changes for frontend rendering:

- Include the current session's existing `started_at` value in session and
  progress responses.
- Add an optional structured `comparison` object to the summary response. It
  should contain the prior session ID, start time, protocol/version identity,
  and canonical numeric metrics; use `null` when no comparable session exists.

The UI can then label current and previous values with their dates without
parsing generated prose or choosing its own comparison session. Record these
additive fields under **PROPOSED** in [`api_contract.md`](api_contract.md) and
get Steve's review before integrating the shared contract.

The existing generated summary may describe matching current and previous
measurements side by side, using only the supplied recorded values. Do not
compute or describe a difference as positive or negative, and do not use
improvement, decline, recovery, prognosis, or treatment language. Keep angles
rounded and labeled as projected estimates. Keep data-quality notes alongside
the comparison.

The deterministic fallback must also show the same side-by-side comparison
when prior metrics exist. It must remain useful if the language-model provider
is unavailable. Older cached summaries that lack comparison metadata may
return `comparison: null`; do not silently claim they contain a comparison.

## Persistence and access

This proposal uses existing session timestamps, metrics, and summary storage.
It requires no new database table or migration. Store any new summary metadata
inside the existing summary response/body only if that fits the approved
contract. Do not write from the browser or bypass the backend's existing
authorization and persistence paths.

Keep the existing rules:

- Patients can access only their own sessions; clinicians only sessions for
  patients they are assigned to.
- Return the actual `persisted` state. An in-memory result must not be described
  as saved.
- Send only validated numeric measurements to the summary provider, never
  frames, keypoints, or invented clinical context.
- Preserve simulated labeling for fixture-derived records.

## Completion criteria

- A completed session includes its start time in the API response.
- A comparison is returned only for the same patient and compatible earlier
  session; otherwise it is `null`.
- Current and previous values remain traceable to their canonical session
  metrics, including when the deterministic fallback is used.
- Existing authorization, persistence indicators, quality flags, and raw-video
  handling remain intact.
- No database migration is added for this feature unless implementation review
  finds that the existing stored fields cannot support it. Any migration must
  be additive and follow the authorized Supabase workflow.

## Ownership and related documents

`backend/` and `supabase/` are owned by Lennox. This document is a proposal and
does not change the shared API contract. API changes need Steve's review; any
future frontend work is described in the main scope document and coordinated
with Steve.

- [Post-discharge follow-up scope](post_discharge_follow_up.md)
- [API contract](api_contract.md)
- [Architecture](ARCHITECTURE.md)
- [Backend guide](backend_guide.md)
- [Supabase migrations](../supabase/migrations/README.md)
