# Knee range-of-motion reference (for clinician protocol configuration)

Owner: Lennox. This is a cited external reference only. It does not set any
value in the application. `RepConfig` (in `backend/app/services/movement_engine.py`)
has no built-in angle defaults — `SessionService._protocol_configuration` requires
a clinician to supply `rest_min_deg`, `rest_max_deg`, `target_min_deg`, and
`target_max_deg` explicitly when creating a protocol. Use this page as a
starting point for that conversation, not as a substitute for it.

## Normal knee joint range of motion

| Movement | Range | Source |
|---|---|---|
| Extension | 5–10° | *Thieme Atlas of Anatomy*, pp. 398–399 (via [Wikipedia: Knee](https://en.wikipedia.org/wiki/Knee), citation [28]) |
| Flexion | 120–150° | *Thieme Atlas of Anatomy*, pp. 398–399 (via [Wikipedia: Knee](https://en.wikipedia.org/wiki/Knee), citation [28]) |

These are generic anatomical reference ranges for a healthy adult knee, not
rehab-protocol targets for any specific patient, condition, or recovery stage.
A qualified clinician must set the actual `rest_*`/`target_*` bands for a real
protocol based on the individual patient — never carry these numbers into the
app's configuration unreviewed, and never use them to imply what a given
patient's measured angle means clinically. RehabLoop's own output stays
non-clinical per `docs/model-smoke-test.md` and
`backend/app/services/nvidia_summary.py`.

## Test video sourcing

For local pose-detection testing (see `docs/model-smoke-test.md` → "Video file
replay"), generic, non-patient movement clips may be used. The following are
license-confirmed as of this writing (Pexels license: no attribution required,
modification and commercial use permitted, no implied endorsement) — download
them yourself via the site's own download button, save locally (e.g. into
`fixtures/approved_test_frames/`, which is gitignored), and never commit them:

- <https://www.pexels.com/video/people-doing-knee-exercise-6326749/>
- <https://www.pexels.com/video/a-woman-stretching-5510121/>
- <https://www.pexels.com/video/a-woman-doing-warm-up-exercise-5510139/>

These show generic exercise/stretching, not a clinical knee-extension protocol
specifically — they are useful for exercising the MoveNet keypoint pipeline,
not for validating rep-counting accuracy against a known protocol. For that,
a self-recorded clip of the actual target movement (consenting adult, by
agreement with the project) is more useful than generic stock footage.
