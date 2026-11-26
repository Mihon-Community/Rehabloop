# RehabLoop API contract — SHARED SOURCE OF TRUTH

Owner: **both developers**. Steve mocks against this document; Lennox implements
against it. **Any change to the HTTP endpoints, WebSocket events, error codes or
state names requires a PR that is explicitly approved by both Steve and Lennox.**
Update this file in the same PR as the code. See `GIT_WORKFLOW.md`.

This contract defines the current API. All paths are relative to the API base
URL (`VITE_API_BASE_URL`, default `http://localhost:8000`). All
protected routes require an authenticated user; the backend verifies role and
patient-clinician assignment on the server. The UI may hide controls but is
**never** an authorization control.

## Current implementation status (feature/lennox; pending Steve review)

The `feature/lennox` branch implements the documented HTTP handlers and the
session WebSocket flow. Fixture-derived measurement and quality events carry
`simulated: true`, and session summaries identify the fixture model version;
there is no placeholder success response. The branch also contains additive
contract details under **PROPOSED** below; Steve must review those shared API
changes before merge. This status describes branch implementation and does not
replace that review.

## HTTP endpoints

| Method / path | Purpose | Authorization | Body | Success |
|---|---|---|---|---|
| `GET /api/v1/me` | Current profile and role | Authenticated user | — | `{id, role, display_name}` |
| `GET /api/v1/patients/me/protocols` | Protocols assigned to the patient | Patient sees own assigned protocols | — | `Protocol[]` |
| `POST /api/v1/protocols` | Create a protocol | Clinician with active link to patient | `CreateProtocolRequest` | `Protocol` |
| `PATCH /api/v1/protocols/{id}` | New protocol version / status change | Assigned clinician only | `UpdateProtocolRequest` | `Protocol` |
| `POST /api/v1/sessions` | Create session in `draft` | Patient with assigned protocol, or clinician demo | `{protocol_id}` | `SessionSummary` |
| `POST /api/v1/sessions/{id}/start` | Confirm consent + setup, start | Session owner, valid consent required | `{consent_record_id, camera_checks_passed}` | `SessionSummary` |
| `WS /api/v1/sessions/{id}/stream` | Frames in, pose/metric events out | Short-lived session token bound to user + session | binary frame or `FrameEvent` | `MeasurementEvent` / `QualityWarningEvent` |
| `POST /api/v1/sessions/{id}/complete` | Finalize aggregates, stop worker | Session owner or authorized clinician | `{reason?}` | `SessionSummary` |
| `GET /api/v1/sessions/{id}` | Fetch session summary | Patient owner or assigned clinician | — | `SessionSummary` |
| `GET /api/v1/patients/{id}/progress` | Comparable session trends | Assigned clinician or patient owner | — | `{patient_id, sessions[]}` |
| `POST /api/v1/sessions/{id}/summary` | Generate / regenerate controlled summary | Patient owner or assigned clinician | `{regenerate?}` | `SummaryPayload` |
| `GET /api/v1/health` | Service health, no sensitive data | Public / internal | — | `{status, service, version, mode}` |

Vision service (separate, private): `GET /health` and `POST /infer`. It is not a
public API and is called by the backend movement pipeline, not directly by the
browser in the production topology.

### Naming and versioning rules

- All business endpoints are prefixed `/api/v1`. Only `GET /api/v1/health` is public.
- IDs are UUIDs. Timestamps are UTC ISO-8601 in HTTP bodies and integer
  milliseconds since session start in WebSocket events.
- Record `model_version`, `keypoint_mapping_version` and `analytics_version` on
  every session. Never mix versions inside one session without a review flag.
- `raw_video_stored` is always `false` in the MVP.

## WebSocket event contract

Transport uses a session-specific streaming token. Do **not** put a service-role
key or a long-lived user token in the URL. Enforce sequence numbers and
timestamps to reject duplicate, stale or out-of-order frames; enforce per-user
frame-rate and concurrency limits. Use binary frames or a compact encoding in
the implementation; the JSON below is the logical contract.

### Client → server: frame

```json
{
  "type": "frame",
  "session_id": "uuid",
  "sequence": 41,
  "timestamp_ms": 12500,
  "image_b64": "<compressed-frame>"
}
```

### Server → client: valid measurement

```json
{
  "type": "measurement",
  "sequence": 41,
  "timestamp_ms": 12500,
  "projected_knee_angle_deg": 67.8,
  "rep_count": 3,
  "state": "RETURNING",
  "quality": {"usable": true, "reason": null, "confidence": 0.89},
  "model_version": "movenet-singlepose-lightning"
}
```

`state` is one of the repetition states below. Angles are **projected 2D
estimates**; the UI must label them as such and round them.

### Server → client: quality failure

```json
{
  "type": "quality_warning",
  "sequence": 42,
  "reason": "ANKLE_LANDMARK_LOW_CONFIDENCE",
  "message": "Move until the full lower leg is visible.",
  "rep_count": 3
}
```

### Simulated events (fixture mode only)

Fixture-derived events carry `"simulated": true` and `model_version` starting
with `fixture-`. The UI must show a visible "SIMULATED" badge. Never present
fixture output as real inference. Steve's mock events in
`frontend/src/lib/mocks/events.ts` follow this rule.

### Server → client: error

```json
{"type": "error", "code": "STREAM_ERROR", "message": "..."}
```

## Error contract

Every non-2xx HTTP response and every error event uses
`{"detail": string, "code": string}` (plus field details for 422 where needed).

| HTTP | Meaning | Client action |
|---|---|---|
| 400 | Invalid request or schema | Show field-specific validation message |
| 401 | Missing or expired authentication | Re-authenticate |
| 403 | Role or patient-assignment denied | Show access denied; log security event |
| 404 | Session/protocol not found or not visible | Show not available; do not reveal existence |
| 409 | Invalid session state transition | Refresh current state and explain |
| 422 | Frame / inference input not usable | Show camera framing or quality help |
| 429 | Rate limit / sampler overflow | Reduce capture rate and retry |
| 502 / 503 | Vision or NVIDIA dependency unavailable | Pause, or use deterministic summary fallback |
| 500 | Unexpected server error with a sanitized response | Retry later; do not display internal error details |
| 501 | Reserved for an endpoint not yet implemented; no current route returns it | Show unavailable; never fake a result |

Validation rules: validate every body with Pydantic and explicit size limits;
log model version, mapping version, duration and quality outcomes — **never**
log raw image content.

## Session state machine

| State | Meaning | Transition |
|---|---|---|
| `draft` | Record created, camera not active | Start after consent + setup checks |
| `ready` | Consent active, setup passed | Begin sampled-frame processing |
| `active` | Inference + analytics running | Pause, complete or abort |
| `paused` | Processing paused | Resume only after user action + quality check |
| `completed` | Ended, final metrics persisted | Summary may be generated |
| `aborted` | Stopped early | Store reason; never infer missing metrics |
| `review_required` | Quality or user-reported issue | Clinician reviews; no automated action |

Invalid transitions return **409**. The backend is authoritative for state.

## Repetition state machine

| State | Entry | Exit / action |
|---|---|---|
| `REST` | Stable position inside configured rest range | Angle beyond start threshold for min dwell → `EXTENDING` |
| `EXTENDING` | Movement in prescribed direction, landmarks valid | Configured target range reached → `TARGET_HOLD` or `RETURNING` |
| `TARGET_HOLD` | Angle inside target range | After hold duration → `RETURNING`; if not held → target not reached |
| `RETURNING` | Angle returns toward start range | Start range + dwell → **increment one valid rep**, back to `REST` |
| `INVALID` / `PAUSED` | Low confidence, person lost, gap, user pause | No rep counted; reset/resume only after signal recovers |

All thresholds are patient- and protocol-specific, approved by the treating
physiotherapist. There is no universal medical threshold.

## Example payloads

Session metrics object (all numbers are illustrative fixtures, not clinical
thresholds):

```json
{
  "session_id": "00000000-0000-0000-0000-000000000123",
  "protocol_id": "00000000-0000-0000-0000-000000000456",
  "protocol_version": 1,
  "model_version": "movenet-singlepose-lightning",
  "keypoint_mapping_version": "rehabloop-movenet-knee-map-1.0",
  "analytics_version": "knee-extension-engine-0.1.0",
  "status": "completed",
  "metrics": {
    "completed_reps": 6,
    "target_reps": 8,
    "projected_knee_angle_min_deg": 71.2,
    "projected_knee_angle_max_deg": 118.4,
    "projected_range_deg": 47.2,
    "target_range_hit_count": 5,
    "median_rep_duration_seconds": 4.8,
    "usable_frame_pct": 89.5
  },
  "quality_flags": ["CAMERA_SIDE_VIEW_ASSUMED"],
  "raw_video_stored": false
}
```

NVIDIA summary schema — explanatory text only; the UI renders the canonical
numbers above, **never** numbers copied from `observed_values`:

```json
{
  "headline": "Session measurements recorded",
  "what_was_measured": "The application measured projected knee movement and counted completed repetitions.",
  "observed_values": [
    "6 of 8 configured repetitions were counted.",
    "The projected angle range recorded was 71.2 to 118.4 degrees."
  ],
  "data_quality_note": "89.5% of sampled frames met the configured landmark quality checks.",
  "clinician_review_note": "The assigned physiotherapist can review this session alongside the patient's care plan."
}
```

Internal named-keypoint frame (vision service → movement engine):

```json
{
  "frame_id": "frame-000123",
  "timestamp_ms": 4100,
  "model": "movenet-singlepose-lightning",
  "mapping_version": "rehabloop-knee-map-1.0",
  "landmarks": {
    "selected_hip":   {"x": 0.48, "y": 0.39, "confidence": 0.91, "valid": true},
    "selected_knee":  {"x": 0.61, "y": 0.66, "confidence": 0.94, "valid": true},
    "selected_ankle": {"x": 0.78, "y": 0.69, "confidence": 0.89, "valid": true}
  },
  "inference_ms": 142
}
```

Coordinates are illustrative and do **not** define Meta keypoint indices.

## Change control

1. Open a PR describing the contract change and why.
2. Update this file, the Pydantic schemas, the frontend types/mocks, and both
   developer guides if behaviour changes.
3. Get explicit approval from Steve **and** Lennox before merging into `develop`.
4. Bump a version/field only through a new `/api/v2` prefix if it breaks
   existing clients; additive optional fields are fine in v1.

## PROPOSED (needs Steve's review)

The following additive v1 fields/events are implemented in the backend branch
and need review before integration:

- Health adds storage_mode, with values memory or supabase.
- Protocol, session, progress, and summary responses add persisted. It is false
  for in-memory storage; those responses must not imply durable storage.
- Session start adds an optional stream_token in its response. The token is
  short-lived, bound to the patient and session, and is sent as the stream
  connection token. It is not a long-lived user JWT.
- Session start accepts only an unrevoked consent record for the patient with
  the scope metadata `purpose=camera_processing` and
  `consent_version=camera-processing-v1`. The frontend must write these markers
  only after acceptance of the approved camera-consent copy; they do not replace
  the consent text. Steve review is required before frontend integration.
- Summary responses retain generated_by and add source, model_id, a fixed
  non-clinical disclaimer, and persisted metadata.
- Measurement and quality_warning events add simulated. Fixture-generated
  events set it to true, with a fixture model version.
- The current stream implementation accepts JSON frame events with a maximum
  encoded frame length of 2,000,000 characters. It drops frames that exceed the
  configured server-side rate, rejects non-increasing sequence/timestamps, and
  emits RATE_LIMITED, BAD_FRAME_ORDER, UNPROCESSABLE, or VISION_UNAVAILABLE
  error events as applicable.
- Projected angles are rounded to one decimal place. Memory responses report
  persisted=false; only canonical numeric metrics, never frames or keypoints,
  can be sent to the NVIDIA summary service.
