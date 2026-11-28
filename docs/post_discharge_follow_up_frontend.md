# Post-discharge video follow-up: frontend implementation

**Status:** Frontend implementation proposal. This is a small addition to
RehabLoop's existing video-session result and history screens, not a new
follow-up or appointment system.

## Goal

After a completed video session, let the patient and physiotherapist review the
current recorded measurements beside the most recent earlier completed session
on the same protocol. The display should make the session dates, measure names,
units, and recording quality easy to scan. It presents measurements for
clinician review; it does not interpret them as clinical progress.

The comparison rule is owned by the backend. The frontend renders the selected
comparison and must not pick a prior session from another patient or protocol.

## Current frontend starting point

- `SessionResultScreen` already displays the current session's numeric
  measurements and summary text.
- `GET /api/v1/patients/{id}/progress` and a `loadProgress` helper already
  exist. The clinician dashboard uses the helper, while the patient home screen
  currently loads recent sessions from demo fixtures.
- The backend session response and frontend `SessionSummary` type do not
  currently include a session start time. The frontend `SessionRecord` shape
  expects a timestamp and flattened metrics, while the live progress response
  contains nested session metrics. `loadProgress` currently casts the response
  instead of mapping it into that display shape.
- The summary response contains explanatory text, not a structured previous
  session. The UI must not try to extract measurement values from that prose.

## Required contract and data handling

Before displaying a dated comparison, coordinate a small additive contract
change with the backend owner and record it under **PROPOSED** in
[`api_contract.md`](api_contract.md) for Steve and Lennox to review:

- Include the current session's `started_at` in session/progress data.
- Include an optional `comparison` object in the `POST
  /api/v1/sessions/{id}/summary` response. It should contain the prior session's
  ID, start time, protocol ID/version, and canonical metrics. Return
  `comparison: null` when there is no earlier completed session on the same
  protocol.
- Keep current and previous metrics numeric and traceable to their stored
  session records. Do not make the UI infer a comparison from generated text.

Normalize live progress responses in `lib/data.ts` instead of casting them:
map `session_id` to the display record ID, retain `started_at`, and flatten the
fields used by the session list and chart. Keep the existing simulated fixture
fallback visibly labeled. Use the authenticated patient's ID for the patient
history request.

## Screen changes

### Session result

Add a section to `SessionResultScreen` titled **Session-to-session measurement
comparison**. Use a semantic table with these columns:

| Measure | Current video (date) | Previous video (date) | Quality / context |
|---|---|---|---|
| Completed repetitions / configured target | Recorded count | Recorded count | Counted by session movement logic |
| Projected knee-angle range | Recorded range in degrees | Recorded range in degrees | Rounded 2D estimate from one camera view |
| Usable sampled frames | Recorded percentage | Recorded percentage | Share passing configured quality checks |

Show only available canonical values. Use 'Not recorded' or an equivalent
plain label for missing values; never turn missing data into zero. Keep quality
flags and the simulated/persisted state visible. Do not use color, arrows,
'better'/'worse' labels, or a calculated change to judge the result.

If there is no comparable earlier session, show a neutral message and retain
the current session measurements. If the comparison cannot load, say so without
hiding or replacing the current record. If the API reports `persisted=false`,
do not say the result was saved.

### Patient history

Connect the existing recent-session area in `PatientHomeScreen` to the live
progress helper for the signed-in patient. Keep the current fixture fallback
for demo/unavailable mode and show its simulated badge. Reuse the existing
history/chart components; no new navigation or appointment screen is needed.

### Clinician review

Reuse the existing clinician progress view and display the same paired values
when reviewing a selected patient's session. The API's patient assignment
checks remain authoritative; selecting a patient in the UI is not an access
control.

## Display and scope rules

- Put the session date, protocol/version, measure label, and unit beside every
  displayed value. Spell out labels instead of relying on unfamiliar
  abbreviations.
- Label knee angles as projected estimates from one camera view and round them
  as required by the API contract.
- Show quality limitations and unavailable measurements. Do not interpolate,
  invent, or compare sessions from different protocol versions.
- Keep the summary descriptive. Do not display a diagnosis, recovery claim,
  prognosis, treatment recommendation, or protocol change.
- Keep fixture values labeled simulated and preserve loading, empty, error, and
  not-persisted states.

## Acceptance criteria

- A result shows the current session and, when supplied by the backend, the
  correct previous completed session on the same protocol, with both dates.
- Missing or incomparable previous data produces a clear neutral state; the
  current session record remains visible.
- Patient history uses the authenticated patient's records in live mode and
  labels synthetic fallback data as simulated.
- The same comparison can be reviewed in the clinician's existing patient
  progress view without weakening server-side authorization.
- The display contains no calculated clinical judgment and makes the projected
  angle and recording-quality limits clear.

## Ownership and related documents

`frontend/` is owned by Steve. Coordinate implementation with Steve and keep
the API changes additive and under **PROPOSED** until the shared review is
complete. This document is a frontend plan; it does not authorize changing the
shared API contract by itself.

- [Post-discharge follow-up scope](post_discharge_follow_up.md)
- [Backend implementation proposal](post_discharge_follow_up_backend.md)
- [API contract](api_contract.md)
- [Frontend guide](frontend_guide.md)
- [Architecture](ARCHITECTURE.md)
