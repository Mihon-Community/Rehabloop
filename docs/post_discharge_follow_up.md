# Post-discharge follow-up through session records

**Status:** A narrow extension of the existing video-session flow. This does
not add a separate discharge, appointment, or hospital-record system.

## Purpose

When a clinician's existing approved protocol continues after discharge, the
patient's next recorded video session can serve as a follow-up to the previous
one. The session record should show what was measured in the current video and
how those same measurements compare with the patient's most recent comparable
video. The patient and clinician can then review the session history already
provided by RehabLoop.

This covers follow-up through RehabLoop's current rehabilitation workflow. It
does not record or decide discharge, and it does not create a new protocol.

## How it works

1. The patient completes a video session using their existing clinician-approved
   protocol. The current session record stores its date, protocol, measured
   values, and data-quality information as it does today.
2. The backend selects the same patient's latest earlier **completed session
   on the same protocol**. The existing summary path already looks up another
   same-protocol session and passes its numeric measurements to summary
   generation; it should explicitly ensure that the comparison session started
   before the current one.
3. The follow-up summary presents matching measurements side by side, labeled
   as current session and previous session. The session history supplies the
   dates so the reader can tell which videos are being compared.
4. If there is no earlier completed session on that protocol, the record shows
   only the current session. Sessions on different protocols are not compared,
   because their settings may differ.

The comparison should report the recorded values as values. In this scope it
does not calculate a percentage change or rate, or label a difference as good,
bad, improvement, decline, recovery, or clinical progression. Projected knee
angles remain rounded, clearly labeled estimates, and measurement quality and
limits remain visible.

## Make the record clear for physiotherapist review

Physiotherapy documentation guidance describes a progress report as a dated
account of current status in relation to earlier examinations, with relevant
tests and measurements recorded clearly. It also includes clinician-provided
context such as the intervention, the patient's response, the therapist's
assessment, and the plan. RehabLoop only has video-session measurements, so its
output should be a concise **session measurement summary for review**, not a
complete physiotherapy progress note or a substitute for the therapist's
clinical record. ([APTA: Documentation of a Visit](https://www.apta.org/your-practice/documentation/defensible-documentation/elements-within-the-patientclient-management-model/documentation-of-a-visit), [World Physiotherapy: Documentation and records management](https://www.world.physio/guideline/records-management))

Use a simple, consistently ordered record:

1. **Session context:** patient record identifier, current video date, exercise
   protocol and version, and whether the result is persisted or simulated.
2. **Current and previous measurements:** show each available measure in a
   labeled row, with units and the date of each video. For example: completed
   repetitions against the configured target; projected knee-angle range in
   degrees; and percentage of sampled frames that passed quality checks.
3. **Measurement quality:** state which measures are unavailable or limited by
   the recording quality. Label angle values as rounded 2D projected estimates
   from one camera view.
4. **Review context:** state that this is a recorded video-session comparison
   for the physiotherapist to interpret alongside the patient's full clinical
   context. Leave diagnosis, clinical assessment, and care-plan decisions to
   the physiotherapist.

For example, the result can use this layout (placeholders only, not patient
data):

| Measure | Current video (date) | Previous video (date) | Quality / context |
|---|---|---|---|
| Completed repetitions / configured target | `[count] / [target]` | `[count] / [target]` | Counted by the session movement logic |
| Projected knee-angle range | `[low] to [high] degrees` | `[low] to [high] degrees` | Rounded 2D estimate from one camera view |
| Usable sampled frames | `[percent]%` | `[percent]%` | Share of frames passing configured quality checks |

Write the measure name next to every value; do not show unexplained numbers or
unfamiliar abbreviations. Keep the same protocol and measurement definitions
for both sessions, and make missing or incomparable values explicit. These
choices follow professional guidance to keep records clear, accurate, dated,
and understandable to other care professionals. The exact documentation rules
depend on local professional and service requirements, so this layout is a
product design reference rather than a claim of regulatory compliance. ([HCPC:
Record-keeping expectations (UK)](https://www.hcpc-uk.org/standards/meeting-our-standards/record-keeping/our-expectations-for-your-record-keeping/))

## Fit into the project

Use the existing `sessions`, `session_metrics`, summary, and patient progress
flows. There is no need for a new table or appointment workflow. Keep the
comparison tied to the authenticated patient and same protocol on the backend;
the frontend must not choose another patient's or another protocol's previous
session.

The summary code already obtains prior same-protocol metrics, but the session
response currently omits session timestamps. Add the existing session start
time to the session/progress response, then show current and previous values
with those dates in the result/history view. The deterministic fallback
currently summarizes only the current session, so it should include the same
plain comparison when a prior session exists. This keeps follow-up available
when the language-model provider is unavailable.

Any UI work belongs with the existing session result/history screens and should
be coordinated with Steve, who owns `frontend/`. Reuse the current summary and
progress responses where possible. Add only the session timestamp or other
minimal comparison context needed by the existing result/history view, and
propose it in [`api_contract.md`](api_contract.md) for Steve and Lennox to
review.

## Scope limits

- Only compare completed sessions for the same patient and same protocol.
- If the current video is incomplete or its measurements fail quality checks,
  show that limitation; do not fill gaps or invent values.
- Keep comparison text descriptive. Clinicians interpret measurements; the
  system does not infer injury, safety, treatment needs, recovery, or prognosis.
- Do not imply that a session or summary is saved when the API reports
  `persisted=false`; label synthetic fixture output as simulated.
- Keep raw video transient. The follow-up uses the saved structured session
  measurements, not stored footage.

## Related project guidance

- [Backend implementation proposal](post_discharge_follow_up_backend.md)
- [Architecture](ARCHITECTURE.md)
- [API contract](api_contract.md)
- [Backend guide](backend_guide.md)
