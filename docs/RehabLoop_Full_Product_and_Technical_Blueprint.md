# REHABLOOP

## AI-ASSISTED REHABILITATION
## MOVEMENT & RECOVERY INTELLIGENCE

**PRODUCT REQUIREMENTS • CLINICAL SAFETY • TECHNICAL ARCHITECTURE • BUILD PLAN**

**Observe movement. Measure change. Keep the clinician in control.**

![Cover concept interface mock-up](RehabLoop_Full_Product_and_Technical_Blueprint_media/media/image1.png)

Conceptual interface mock-up. Metrics are illustrative, not clinical
findings.

| **DOCUMENT DETAILS** | **VALUE**                                                                             |
|----------------------|---------------------------------------------------------------------------------------|
| Version              | 1.0 - Product and Technical Blueprint                                                 |
| Prepared             | 24 November 2026                                                                      |
| Product stage        | Competition prototype / proposed MVP                                                  |
| Target team          | 2 developers; 48-hour build window                                                    |
| Core stack           | React + TypeScript, FastAPI, Supabase, NVIDIA API, Meta Sapiens2                      |
| Primary pathway      | Clinician-prescribed knee rehabilitation exercise, single-camera 2D movement analysis |

| **STATUS** Prototype design only - not a cleared medical device or diagnostic system. Real-patient deployment requires clinical governance, licence and privacy review, and validation. |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# Document map

| **SECTION** | **CONTENT**                                            |
|-------------|--------------------------------------------------------|
| 01          | Executive summary and product definition               |
| 02          | Problem, target users and value proposition            |
| 03          | Product scope, goals and non-goals                     |
| 04          | User journeys and screen requirements                  |
| 05          | MVP clinical workflow and exercise protocol            |
| 06          | Meta Sapiens2 vision model selection                   |
| 07          | Pose-processing and movement analytics design          |
| 08          | Interactive 3D Recovery Twin                           |
| 09          | NVIDIA AI layer and output controls                    |
| 10          | System architecture and deployment topology            |
| 11          | API design and event contracts                         |
| 12          | Supabase data model and security policies              |
| 13          | Privacy, safety, clinical governance and Kenya context |
| 14          | Testing strategy and measurable success criteria       |
| 15          | 48-hour two-developer implementation plan              |
| 16          | Repository structure, setup and environment variables  |
| 17          | Demo scenario, pitch and judge questions               |
| 18          | Risk register and mitigations                          |
| 19          | Roadmap and post-competition plan                      |
| A           | Appendix: example payloads, prompts and SQL starter    |
| B           | References and verification notes                      |

How to read this blueprint: Sections 1-5 define the product and scope;
Sections 6-12 define the technology and implementation; Sections 13-14
define safety and evidence; Sections 15-19 define delivery and future
development. Appendices provide starter implementation material.

# 01. Executive summary and product definition

RehabLoop is an AI-assisted rehabilitation monitoring platform that
helps a physiotherapist review a patient's exercise-session performance
between in-person appointments. A patient follows an exercise protocol
that has already been selected and configured by a qualified clinician.
With the patient's permission, the application uses a camera and Meta's
Sapiens2 human-pose model to estimate body keypoints, then calculates
movement measurements such as projected joint angle, repetition count,
tempo and measurement confidence.

The system records structured session measurements, displays progress
over time and prepares a plain-language session summary. A
physiotherapist remains responsible for the exercise prescription,
target range, interpretation and any change to the care plan. The AI
does not diagnose the cause of pain, decide whether an exercise is safe,
or independently increase exercise difficulty.

![Proposed logical architecture](RehabLoop_Full_Product_and_Technical_Blueprint_media/media/image2.png)

Figure 1. Proposed logical architecture; camera inference and numeric
measurement are separate from language-model summarisation.

## Product definition

| **ITEM**            | **DEFINITION**                                                                                                                |
|---------------------|-------------------------------------------------------------------------------------------------------------------------------|
| Product             | RehabLoop - AI-assisted rehabilitation movement and recovery intelligence.                                                    |
| Primary user        | A patient completing a clinician-prescribed rehabilitation exercise at home or in a supervised demonstration.                 |
| Professional user   | A physiotherapist who configures protocols, reviews session evidence and decides what action is appropriate.                  |
| Primary output      | A session record containing measured repetitions, projected movement range, tempo, data-quality indicators and trend history. |
| Core differentiator | Camera-based observation plus reproducible numeric movement analysis, not a free-form health chatbot.                         |
| MVP pathway         | One patient, one camera, one side-view exercise protocol, one body region: knee extension in a seated position.               |

## What the MVP proves

- A Meta Sapiens2 pose model can be integrated into a separate Python
  inference service and produce keypoint outputs for approved test
  footage or permitted demonstration inputs.

- The system can map the required landmarks, reject low-confidence
  frames and calculate a repeatable projected knee-angle time series.

- A repetition state machine can count defined movement cycles using
  clinician-configured target parameters rather than generative model
  guesses.

- Session metrics can be saved to Supabase, shown in a progress
  dashboard and summarised by an NVIDIA-hosted language model under a
  strict schema.

- A rigged 3D avatar can visualise the measured exercise plane and
  historical changes without claiming that the MVP reconstructs true 3D
  biomechanics.

| **TECHNICAL REALITY** Important model distinction: Meta Sapiens2 Pose is a 2D whole-body keypoint model. It does not by itself provide a clinically validated motion-capture system, exercise prescription, or fully accurate 3D skeletal reconstruction. The system around it must perform tracking, signal processing, calibration, validation and safe presentation. |
|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 02. Problem, target users and value proposition

## Problem statement

Rehabilitation often includes exercises performed outside the clinic.
Between appointments, the clinician may receive little objective
information about how consistently the patient performed the prescribed
movement or whether the movement measurements changed over time.
Patients may also find it difficult to understand whether they are
following the intended movement pattern. RehabLoop is designed to
improve visibility between sessions by capturing structured, reviewable
movement evidence.

## The initial user problem

| **CURRENT GAP**                                              | **REHABLOOP RESPONSE**                                           | **LIMITATION**                                                           |
|--------------------------------------------------------------|------------------------------------------------------------------|--------------------------------------------------------------------------|
| The clinician cannot observe every home exercise session.    | An optional camera-based session record with measured outputs.   | Camera measurement is not a replacement for direct clinical examination. |
| Patients may not know how many repetitions were completed.   | A repetition counter using a transparent movement state machine. | Counter pauses when required landmarks are unreliable.                   |
| Progress is discussed from memory or subjective description. | A session timeline and historical metrics.                       | Metrics show movement trends, not recovery diagnosis.                    |
| A clinician has limited time to review raw video.            | Compact numeric summaries and selected event markers.            | No automated clinical conclusion; clinician reviews context.             |
| Patients need understandable feedback.                       | Plain-language explanation based on validated numeric results.   | No new advice, diagnosis or exercise changes from the LLM.               |

## Target users

> 1\. Patients or rehabilitation participants who have already received
> a clinician-approved exercise protocol and can safely perform it in
> the chosen setting.
>
> 2\. Physiotherapists who need a structured view of exercise-session
> measurements between appointments.
>
> 3\. Clinic administrators or supervisors who manage enrolment and
> system access; this role does not automatically grant access to all
> patient measurements.

## Initial market and usage assumptions

- The first prototype is designed for a Kenya-based demonstration, but
  the MVP does not depend on facility integrations, national health
  records or insurer systems.

- The first exercise is selected for a controlled side-view camera setup
  and a small set of measurable lower-limb landmarks.

- The project team can obtain a compatible GPU environment for Sapiens2
  inference or must use a documented inference test mode until one is
  available.

- The product has not yet been validated with patients or clinicians.
  These are stakeholder-validation tasks, not assumptions to present as
  established market evidence.

## Value proposition

| **VALUE** For physiotherapists: RehabLoop turns a portion of between-visit exercise activity into structured evidence they can review. For patients: it makes prescribed exercise sessions easier to follow and progress easier to understand. The clinician remains in control of care decisions. |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

## Discovery questions to validate before scaling

- Which rehabilitation pathway has the highest unmet need for
  between-visit measurement in the partner clinic?

- Which one or two movement metrics do physiotherapists actually trust
  and use when reviewing an exercise session?

- What camera setup is realistic for patients using ordinary phones or
  laptops in their homes?

- What proportion of patients can position the camera and remain fully
  visible without assistance?

- What consent, data-retention and review workflow would a Kenyan clinic
  require before a pilot?

# 03. Product scope, goals and non-goals

## MVP goals

- Demonstrate human-pose inference using the selected Meta Sapiens2 Pose
  checkpoint, subject to licence clearance.

- Support one exercise protocol configured by a physiotherapist or test
  administrator.

- Measure projected knee angle from mapped hip, knee and ankle landmarks
  in a consistent side-view setup.

- Count repetitions with confidence-aware state transitions and
  configurable thresholds.

- Record session-level summary metrics and show changes across two or
  more test sessions.

- Provide an interactive dashboard and a simple rigged 3D avatar whose
  movement is driven by the same displayed measurements.

- Generate a short, structured session explanation through the NVIDIA
  API using numeric metrics only.

## Explicit non-goals for the 48-hour MVP

- No diagnosis of stroke, arthritis, ligament injury, muscle weakness,
  neurological disease or any other condition.

- No autonomous treatment plan, exercise prescription, exercise
  progression, medication advice or prediction of recovery time.

- No automated assessment of whether a patient is medically fit to
  exercise.

- No multi-exercise catalogue, multi-camera reconstruction, fall
  detection, gait analysis, remote emergency monitoring or hospital
  integration.

- No facial recognition, identity matching, patient identification from
  gait, emotion detection or general behavioural profiling.

- No storage of raw video by default. The MVP stores structured output
  only unless a separately approved and consented test requires
  temporary media retention.

- No claims of clinical accuracy, safety, diagnostic performance,
  improved outcomes or regulatory clearance.

## Scope prioritisation

| **PRIORITY**         | **FEATURES**                                                                                                                                                                 | **ACCEPTANCE CONDITION**                                                          |
|----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------|
| P0 - Must ship       | Consent screen; camera preview; Sapiens2 pose inference; lower-body landmark mapping; projected knee-angle calculation; repetition count; session save; clinician dashboard. | End-to-end demo runs on a known test setup and can explain each displayed metric. |
| P1 - Strong addition | NVIDIA summary; historical trend chart; 3D avatar driven by measured angle; exportable session report.                                                                       | Summary values match stored values; avatar follows session timeline.              |
| P2 - Defer           | Multiple exercises; true 3D pose/depth; phone-native apps; notifications; facility integrations; population analytics.                                                       | Only after model, privacy and clinical validation gates.                          |

| **SCOPE CONTROL** The team should protect the P0 path. A polished dashboard without real Sapiens2 inference and deterministic movement calculations is not an acceptable substitute for the core demonstration. If the Meta model cannot be legally or technically run during the sprint, label the fallback clearly as a simulated keypoint test, not a live model result. |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 04. User journeys and screen requirements

## Patient journey

> 1\. Sign in or open an approved demo account. The patient sees the
> assigned exercise protocol and the name of the clinician or supervisor
> who configured it.
>
> 2\. Review the exercise instructions and camera-position guide. The
> application confirms that the exercise is prescribed and explains that
> the camera measures movement only.
>
> 3\. Read and accept the camera-processing consent for this session.
> Camera access is optional; declining it must not block the user from
> viewing previously saved information.
>
> 4\. Start the camera preview. The app checks that one person is
> visible, the relevant side of the body is not cropped and the camera
> is approximately side-on.
>
> 5\. Start the session. The browser samples frames and sends them to
> the vision service. The service returns keypoints and confidence
> values.
>
> 6\. Movement analytics calculates projected knee angle and repetition
> states. The live interface displays only measurements that pass the
> quality checks.
>
> 7\. End the session. Structured metrics are saved. The user sees the
> measured session record and a short, non-clinical explanation.
>
> 8\. The patient can review the trend over time and share the report
> with the assigned physiotherapist.

## Physiotherapist journey

> 1\. Authenticate with a clinician role and view only assigned
> patients.
>
> 2\. Create or select an exercise protocol, including side,
> repetitions, target range, allowed camera view, hold duration and
> notes.
>
> 3\. Confirm the patient has been instructed in the exercise and that
> the protocol is appropriate for the individual.
>
> 4\. Review completed sessions, data-quality warnings, repetitions,
> projected angle range and historical trend.
>
> 5\. Add a clinical note or mark the session for follow-up. The
> application must not automatically update the treatment plan.
>
> 6\. Modify the protocol only through an explicit clinician action,
> preserving the previous protocol version for audit.

## Required screens

| **SCREEN**              | **PRIMARY CONTENT**                                                                                                 | **IMPORTANT INTERACTION**                                              |
|-------------------------|---------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------|
| 1\. Authentication      | Patient / clinician sign-in; role-aware landing page.                                                               | Role is verified server-side; UI role is not an authorization control. |
| 2\. Patient home        | Assigned protocol, next session guidance, recent session status.                                                    | Open protocol; review prior sessions.                                  |
| 3\. Protocol detail     | Exercise name, clinician instructions, side, target range and stop instructions.                                    | Confirm understanding; begin setup.                                    |
| 4\. Camera setup        | Live preview, framing guide, consent state, lighting / visibility checklist.                                        | Allow camera; retry; cancel; start only when checks pass.              |
| 5\. Live session        | Camera view with pose overlay, repetition count, current projected angle, quality indicator and pause/end controls. | Pause, resume, end, hide overlay.                                      |
| 6\. Session result      | Measured summary, data-quality note, event list and AI-generated explanation.                                       | Save / return / share with assigned clinician.                         |
| 7\. Clinician dashboard | Patient list, protocol editor, sessions, trend charts and review notes.                                             | Assign protocol; review session; add note.                             |
| 8\. Recovery Twin       | 3D avatar, joint/metric selection, scrubber and session comparison.                                                 | Replay a recorded session and compare dates.                           |

![Conceptual live-session interface](RehabLoop_Full_Product_and_Technical_Blueprint_media/media/image1.png)

Figure 2. Conceptual live-session screen. The skeletal overlay and data
are schematic placeholders for the implemented pipeline.

## Accessibility and usability requirements

- Large controls and readable contrast; the camera start, pause and end
  controls must be clearly distinguishable.

- All important instructions must be readable without relying only on
  colour. Use labels and icons alongside status colour.

- Provide a camera-framing illustration and plain-language error
  messages such as "Move back until your full leg is visible".

- Do not display precision that the camera cannot support. Round angles
  and label them as projected estimates.

- Support a non-camera review mode so patients can still see prescribed
  instructions and prior reports when camera permission is unavailable.

# 05. MVP clinical workflow and exercise protocol

## Selected demonstration exercise

The MVP uses a clinician-configured seated knee-extension exercise as a
controlled demonstration pathway. The user sits on a stable chair, turns
side-on to the camera and performs the movement only if it has already
been prescribed by a qualified physiotherapist. This is a
product-scoping choice for a measurable single-plane motion; it is not a
recommendation that every person with knee pain or injury should perform
this exercise.

## Protocol record - example fields

| **FIELD**          | **EXAMPLE / RULE**                                                                                                          |
|--------------------|-----------------------------------------------------------------------------------------------------------------------------|
| Protocol name      | Seated knee extension - demonstration protocol                                                                              |
| Target side        | Left or right; one side per session for MVP.                                                                                |
| Clinical owner     | Assigned physiotherapist or approved demo supervisor.                                                                       |
| Target repetitions | Configurable by clinician; example fixture: 8.                                                                              |
| Target angle range | Configured per patient by clinician; do not use a universal medical threshold.                                              |
| Hold duration      | Optional and clinician-configured.                                                                                          |
| Tempo guidance     | Optional, expressed as a non-clinical timing cue.                                                                           |
| Camera position    | Side view; hip, knee and ankle visible; camera stable at an appropriate height.                                             |
| Stop instruction   | Stop the session if the patient experiences concerning discomfort or feels unsafe; follow the clinician's own instructions. |
| Protocol version   | Every change creates a new version and retains who approved it and when.                                                    |

## Session lifecycle

| **STATE**       | **MEANING**                                                    | **TRANSITION**                                    |
|-----------------|----------------------------------------------------------------|---------------------------------------------------|
| DRAFT           | Session record created but camera not yet active.              | Start after consent and setup checks.             |
| READY           | Consent active and camera setup passed.                        | Begin sampled-frame processing.                   |
| ACTIVE          | Inference and movement analytics running.                      | Pause, complete, or abort.                        |
| PAUSED          | User or system paused processing.                              | Resume only after user action and quality check.  |
| COMPLETED       | Session ended and final metrics persisted.                     | Summary may be generated.                         |
| ABORTED         | Session stopped before completion.                             | Store reason; do not infer missing metrics.       |
| REVIEW_REQUIRED | Data-quality or user-reported issue needs professional review. | Clinician reviews; no automated treatment action. |

## Camera setup checklist

- Use a stable device and a stable camera mount; avoid handheld
  recording for live measurement.

- Position the camera to capture the hip, knee and ankle of the selected
  leg in the same frame.

- Use a side-on view and adequate lighting. Avoid backlighting and busy
  backgrounds where possible.

- Keep the person fully in frame, including the foot and upper leg
  landmarks required by the movement rule.

- Keep one participant in the frame. If more than one person is
  detected, stop or ask the user to clear the frame.

- The application must show a data-quality status. It must not imply
  that camera alignment has been clinically certified.

| **CLINICAL GATE** Before the exercise starts, the patient must confirm that the exercise was assigned by a clinician. If no clinician-approved protocol exists, the application must remain in a read-only demo mode and must not suggest an exercise. |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 06. Meta Sapiens2 vision model selection

## Selected Meta model

The selected Meta model family is Sapiens2, with the Sapiens2 Pose task
used for 2D human pose estimation. For the first implementation, use the
Sapiens2-0.4B pose checkpoint as the initial benchmark candidate. The
official model zoo lists pose checkpoints at 0.4B, 0.8B, 1B and 5B
parameter sizes. The pose task outputs 308 whole-body keypoints,
including detailed face, hand and foot keypoints, using the Sociopticon
keypoint format. The application only needs a documented subset of
lower-body and torso landmarks for the knee exercise. [1][2]

| **ITEM**           | **SELECTED CONFIGURATION**                     | **WHY / NOTE**                                                                                                           |
|--------------------|------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------|
| Model family       | Meta Sapiens2                                  | Meta human-centric vision model family.                                                                                  |
| Task               | 2D human pose estimation                       | Outputs image-plane body keypoints; not a clinical diagnosis or 3D motion-capture solution.                              |
| Initial checkpoint | facebook/sapiens2-pose-0.4b                    | Smallest pose checkpoint listed in the official Sapiens2 model zoo; benchmark before fixing.                             |
| Larger candidates  | 0.8B, 1B, 5B                                   | Evaluate only if 0.4B accuracy is insufficient and GPU/latency budget allows.                                            |
| Keypoint format    | 308 points; Sociopticon format                 | Do not hard-code guessed indices. Resolve names/indices from the released keypoint specification and pin a mapping file. |
| Person detector    | facebook/detr-resnet-101-dc5                   | The Sapiens2 pose guide documents this detector in its pose-inference workflow.                                          |
| Runtime            | Separate Python inference service              | Official repository states Python >=3.12 and PyTorch >=2.7 for the package.                                            |
| Execution          | Self-hosted inference on a GPU-enabled machine | Sapiens2 is loaded from downloaded model weights; it is not called through the NVIDIA language-model API.                |

## Why Sapiens2, not SAM 2

Meta's SAM 2 is primarily a promptable image/video segmentation model:
it segments a selected object and tracks the mask through video. That is
useful for foreground or body-region segmentation, but it does not
directly provide the named human joint keypoints RehabLoop needs.
Sapiens2 is specifically documented for human-centric tasks including
pose estimation, body-part segmentation, surface normals and pointmaps.
Therefore Sapiens2 Pose is the correct Meta model family for this
project's first movement-analysis path. [1][3]

## Model inference topology

> 1\. The browser obtains camera permission and captures frames only
> after the user starts a session.
>
> 2\. A frame sampler limits how many frames leave the browser. A first
> prototype target is a configurable 5-10 frames per second; this is an
> engineering target to benchmark, not a guaranteed Sapiens2 speed.
>
> 3\. Frames are sent to a private FastAPI vision endpoint over a secure
> connection. The inference service normalises image orientation and
> size, runs person detection and pose inference, then returns keypoint
> coordinates and confidence.
>
> 4\. A parser maps the official Sapiens2 output into RehabLoop internal
> named landmarks. The mapping is versioned and tested against fixed
> sample frames.
>
> 5\. The service returns keypoints, model version, frame timestamp,
> inference duration and quality metadata. It does not return a
> diagnosis.
>
> 6\. The backend movement engine calculates joint angles and repetition
> events. Structured results are sent to the browser over WebSocket or
> an equivalent streaming channel.

## Compute and installation constraints

The Sapiens2 repository currently documents Python 3.12 or later and
PyTorch 2.7 or later for installation. The pose workflow documents
downloading the pose checkpoint from Hugging Face and using the person
detector. The official demo runs on a directory of frames and writes
visualisations plus per-image keypoint JSON files. This is useful for
the first model smoke test before live camera work. [2][4]

| **HARDWARE REALITY** Do not promise real-time performance until it has been measured on the exact GPU, driver, model checkpoint, image size and batch configuration available to the team. Keep the vision worker separate from the API process so model imports, CUDA memory and inference latency do not destabilise authentication or session routes. |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

## Recommended implementation stages

| **STAGE**            | **TASK**                                                                                                            | **EXIT CRITERION**                                                                |
|----------------------|---------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------|
| A. Smoke test        | Install Sapiens2, download the 0.4B pose checkpoint and detector, run official demo against approved sample frames. | Keypoint JSON and visualisation are produced; model version recorded.             |
| B. Landmark mapping  | Create a named lower-body mapping file from official keypoint definitions.                                          | Hip/knee/ankle points resolve correctly on a manually reviewed set.               |
| C. Video sampling    | Read a local clip and process sampled frames in order.                                                              | Timestamped keypoints produce a stable sequence, with low-quality frames flagged. |
| D. Live integration  | Connect browser camera sampling to the vision worker.                                                               | Live overlay updates within a tested target latency on the available GPU.         |
| E. Quality benchmark | Compare predictions to manually annotated test frames.                                                              | Report usable-frame rate and joint-position error before enabling metrics.        |

## Licensing and permitted-use gate - read before implementation

The Sapiens2 repository uses a separate Sapiens2 License Agreement. The
agreement grants a limited licence but includes restrictions, including
use for biometric processing and use that amounts to unauthorised or
unlicensed medical/health practice. It also requires compliance with
privacy, data-protection and security laws. Because RehabLoop processes
body movement for a health-related purpose, the team must not assume
this intended use is automatically permitted. Obtain a qualified
legal/licensing review of the exact model agreement and the intended
non-identification movement-analysis use before processing identifiable
people or moving beyond synthetic/test data. [5]

| **LICENCE CHECK** GO / NO-GO: Sapiens2 is the selected engineering target, but production or patient-facing use is blocked until the Sapiens2 terms have been reviewed for this specific rehabilitation movement-analysis purpose. If the terms do not permit the intended use, do not bypass them; obtain permission or select a model with suitable documented rights. |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 07. Pose-processing and movement analytics design

![Frame-to-feedback processing pipeline](RehabLoop_Full_Product_and_Technical_Blueprint_media/media/image3.png)

Figure 3. Frame-to-feedback pipeline. Every stage has a quality gate.

## Internal keypoint schema

Do not couple the rest of the application directly to Meta's raw output
ordering. Create a versioned adapter that emits a stable internal
structure. Each landmark contains normalised coordinates, original image
coordinates, confidence and a validity flag. Store the model checkpoint
name and mapping version with every session so results remain
interpretable if the model changes.

```json
{
  "frame_id": "frame-000123",
  "timestamp_ms": 4100,
  "model": "sapiens2-pose-0.4b",
  "mapping_version": "rehabloop-knee-map-1.0",
  "landmarks": {
    "selected_hip":   {"x": 0.48, "y": 0.39, "confidence": 0.91, "valid": true},
    "selected_knee":  {"x": 0.61, "y": 0.66, "confidence": 0.94, "valid": true},
    "selected_ankle": {"x": 0.78, "y": 0.69, "confidence": 0.89, "valid": true}
  },
  "inference_ms": 142
}
```

The coordinates above are illustrative only. They do not define Meta
keypoint indices or represent a clinically measured joint position.

## Quality gates

| **GATE**              | **CHECK**                                                                        | **SYSTEM BEHAVIOUR WHEN FAILED**                                                       |
|-----------------------|----------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| Person visibility     | One subject detected; required body region visible.                              | Do not calculate movement. Show framing instruction.                                   |
| Landmark confidence   | Required hip, knee and ankle points exceed a configurable engineering threshold. | Mark frame invalid; do not count it.                                                   |
| Landmark continuity   | Point movement is physically plausible between adjacent timestamps.              | Flag jump / occlusion; reset smoothing or repetition state if needed.                  |
| Camera view           | Side-view setup confirmed by guide and reviewed during calibration.              | Label measurements unavailable or lower-confidence; do not present them as comparable. |
| Temporal signal       | Enough valid frames across the movement cycle.                                   | Do not create a rep event from incomplete data.                                        |
| Model/mapping version | Checkpoint and mapping version match the approved session configuration.         | Reject mixed-version sequences or mark them for review.                                |

## Projected knee-angle calculation

For each valid frame, estimate the angle at the knee using the
image-plane points for hip (A), knee (B) and ankle (C). Let u = A - B
and v = C - B. The projected angle is calculated as:

```text
cos(theta) = dot(u, v) / (norm(u) * norm(v))
theta_degrees = arccos(clip(cos(theta), -1, 1)) * 180 / pi
```

This is a two-dimensional projected angle from a single camera view. It
can be distorted by camera placement, limb rotation out of the image
plane, occlusion, clothing and keypoint error. It must be labelled
"projected knee angle estimate" rather than a validated anatomical
measurement. Use a consistent side view and calibrate against manually
reviewed reference frames.

## Noise reduction and missing data

- Apply a confidence gate before filtering. Never smooth a clearly
  invalid keypoint into a plausible-looking measurement.

- Use a simple exponential moving average or short median window to
  reduce jitter. The smoothing constant must be configurable and stored
  with the analytics version.

- Use timestamps, not frame counts, for tempo and hold-duration
  calculations because frame sampling may be irregular.

- If a required landmark is missing for longer than the configured gap,
  pause the rep state machine. Do not interpolate across a long
  occlusion.

- Keep both raw frame-level estimates in transient memory for processing
  and the session aggregates required for audit. Do not persist raw
  camera imagery by default.

## Repetition state machine

Use a deterministic state machine with clinician-configured movement
start/end ranges. The values below describe the logic only; all
thresholds are patient- and protocol-specific and must be approved by
the treating physiotherapist.

| **STATE**        | **ENTRY CONDITION**                                                         | **EXIT / ACTION**                                                                              |
|------------------|-----------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| REST             | Stable starting position inside configured rest range.                      | When angle moves beyond start threshold for minimum dwell time, enter EXTENDING.               |
| EXTENDING        | Angle changes in the prescribed direction and required landmarks are valid. | When configured target range is reached, enter TARGET_HOLD or RETURNING.                       |
| TARGET_HOLD      | Angle remains inside target range for configured duration.                  | After hold duration, enter RETURNING. If target not held, mark target not reached.             |
| RETURNING        | Angle returns toward the configured starting range.                         | When start range is reached and dwell time passes, increment one valid rep and return to REST. |
| INVALID / PAUSED | Low confidence, person lost, frame gap, or user pause.                      | No rep is counted. Reset or resume only after signal quality recovers.                         |

## Movement metrics

| **METRIC**                | **DEFINITION**                                                                        | **DISPLAY LABEL**                 |
|---------------------------|---------------------------------------------------------------------------------------|-----------------------------------|
| Valid repetitions         | Count of complete state-machine cycles meeting the configured rule.                   | Completed repetitions             |
| Projected range of motion | Max minus min projected knee angle during valid frames.                               | Projected movement range          |
| Target-range hit rate     | Share of valid repetitions that entered the clinician-configured target band.         | Repetitions reaching target range |
| Tempo                     | Elapsed time between defined state transitions for each valid repetition.             | Movement duration                 |
| Hold duration             | Time spent inside configured target band.                                             | Time in target range              |
| Usable-frame percentage   | Valid required-landmark frames divided by all expected sampled frames.                | Measurement quality               |
| Session trend             | Change in comparable session-level measurements under same protocol and camera setup. | Progress over time                |

| **METRIC SAFETY** Do not merge "measurement quality" and "clinical performance" into one score. A session can have a high usable-frame percentage and still show movement outside the configured target range. A low-quality session should show "insufficient data" rather than a red or green clinical judgement. |
|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 08. Interactive 3D Recovery Twin

The Recovery Twin is a central experience in RehabLoop: an interactive
avatar that makes the patient's movement history easier to inspect. It
must be connected to real session metrics rather than acting as a
decorative 3D object. In the MVP, however, its animation is driven by
measured 2D projected joint-angle values from a fixed side-view camera.
It is a visual representation of the measured exercise plane, not a full
3D reconstruction of the patient's anatomy.

## MVP 3D behaviour

- Render a neutral, non-identifiable, rigged human avatar using a
  standard GLB model and a React Three Fiber / Three.js scene.

- Map the selected knee-angle time series to the corresponding avatar
  joint rotation in the side-view plane.

- Display a timeline scrubber. Moving the scrubber updates the avatar to
  the selected timestamp and synchronises the metric labels.

- Allow comparison of two sessions using two colours or side-by-side
  avatar states, with accessible labels in addition to colour.

- Highlight the selected joint when the user selects a metric. The
  highlight must correspond to the actual metric being displayed.

- Show session dates, protocol version, measurement-quality information
  and model/mapping version alongside the animation.

- If a session has missing or low-quality frames, the avatar must
  visibly pause or show a gap instead of silently inventing continuous
  movement.

## 3D vs 2D: technical boundary

| **CAPABILITY**    | **MVP**                                                             | **LATER RESEARCH**                                                                               |
|-------------------|---------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| Joint coordinates | 2D image-plane landmarks from Sapiens2 Pose.                        | Depth-aware 3D coordinates with calibration and validation.                                      |
| Knee angle        | Projected angle from hip-knee-ankle points.                         | Validated 3D joint angle using a suitable kinematic model and ground-truth comparison.           |
| Avatar            | Rigged avatar animated in the measured movement plane.              | Patient-specific 3D motion reconstruction if evidence and model rights allow.                    |
| Progress display  | Trend charts + timeline replay + avatar pose at selected timestamp. | 3D trajectory and movement-envelope analysis validated against motion capture or clinical tools. |
| Clinical meaning  | Illustrates observed metric changes only.                           | Requires clinical validation before any interpretation of recovery or impairment.                |

## How the MVP avoids a misleading 3D claim

Sapiens2 provides a separate pointmap task described as per-pixel 3D
points, in addition to 2D pose estimation. That creates a research
direction for future depth-aware movement analysis, but it does not mean
the current single-camera pose workflow yields clinically reliable 3D
biomechanics. A future version must evaluate pointmap quality, camera
calibration, temporal consistency, occlusion behaviour and reference
measurements before using 3D output in patient-facing metrics.
[1][4]

![Product delivery progression from 2D MVP to depth-aware 3D research](RehabLoop_Full_Product_and_Technical_Blueprint_media/media/image4.png)

Figure 4. Product delivery progression from the 2D MVP to a depth-aware
3D research pathway.

## Suggested frontend packages

| **PACKAGE / APPROACH** | **PURPOSE**                  | **NOTE**                                                                |
|------------------------|------------------------------|-------------------------------------------------------------------------|
| three                  | 3D rendering engine.         | Use a small, optimised scene.                                           |
| @react-three/fiber     | React renderer for Three.js. | Optional but suitable for React-based interactive avatar UI.            |
| @react-three/drei      | Common helpers and controls. | Use only necessary components.                                          |
| GLB rigged avatar      | Neutral rigged model asset.  | Check redistribution licence and use a non-identifiable generic avatar. |

# 09. NVIDIA AI layer and output controls

The NVIDIA API is used as a language layer after movement analytics has
produced numeric results. It is not the pose-estimation engine. Meta
Sapiens2 runs locally or on a GPU-enabled vision worker. The NVIDIA API
receives a minimised session summary object, not the live video stream
or raw image frames.

## Allowed NVIDIA tasks

- Convert a verified session metrics object into a short
  patient-friendly explanation.

- Explain what each measured field means in neutral, non-diagnostic
  language.

- Draft a clinician-facing session note that repeats the measured values
  and highlights missing data.

- Translate or simplify approved static instructions if that capability
  is later tested and reviewed.

## Disallowed NVIDIA tasks

- Diagnosing an injury, condition or cause of pain.

- Declaring the patient recovered, deteriorating or medically safe to
  continue.

- Recommending a new exercise, changing the prescribed target or
  changing repetitions / load.

- Inventing measurements, filling missing values or converting a
  low-confidence estimate into a confident statement.

- Interpreting camera frames as clinical evidence unless a separate,
  approved model and workflow are explicitly validated.

## Processing sequence

> 1\. Movement engine finalises the session metrics and quality status
> in code.
>
> 2\. Backend removes direct identifiers and sends only the minimum
> fields needed for explanation, subject to privacy review and the
> chosen data-processing arrangements.
>
> 3\. NVIDIA API is called using a server-side key, a configurable model
> ID and a strict JSON response schema.
>
> 4\. Backend validates returned structure, checks that any numeric
> values match the canonical metrics, and rejects unsafe or unsupported
> claims.
>
> 5\. The interface displays the summary with a label such as
> "AI-generated explanation of recorded measurements" and keeps the
> measured data visible alongside it.
>
> 6\. If the API times out, returns invalid JSON or generates an
> unsupported statement, show a deterministic template instead.

## NVIDIA API integration assumptions

NVIDIA documents OpenAI-compatible hosted NIM API endpoints using
Bearer-token authentication and a common base URL. The exact model name
is selected from the available API Catalog and should be pinned in an
environment variable after a successful key test. The model list,
availability, rate limits and pricing may change; do not hard-code an
unverified model name into the product requirements. [6]

```dotenv
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_API_KEY=<server-side-secret>
NVIDIA_MODEL_ID=<model-id-tested-in-the-NVIDIA-API-Catalog>
```

## Prompt design - constrained summary

```text
SYSTEM:
You explain an already-computed rehabilitation exercise session.
You are not a clinician and must not diagnose, prescribe, predict recovery,
or change the exercise protocol. Use only the supplied measurements.
If a field is missing or quality is low, say that the measurement is unavailable.
Do not infer pain, injury severity, safety, or treatment effectiveness.
Return JSON only using the required schema.

INPUT:
protocol_name, side, completed_reps, target_reps,
projected_angle_min, projected_angle_max, target_range_hit_count,
valid_frame_pct, session_duration_seconds, comparison_context

OUTPUT:
headline, what_was_measured, observed_values,
data_quality_note, clinician_review_note
```

| **GROUND TRUTH** The model output is explanatory text, not the source of truth. The frontend should display the exact numeric fields from the stored session record, not values copied from the LLM response. |
|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 10. System architecture and deployment topology

![Application, vision, analytics, database and language-summary boundaries](RehabLoop_Full_Product_and_Technical_Blueprint_media/media/image2.png)

Figure 5. Application, vision, analytics, database and language-summary
boundaries.

## Component responsibilities

| **COMPONENT**          | **TECHNOLOGY**                       | **RESPONSIBILITY**                                                                                |
|------------------------|--------------------------------------|---------------------------------------------------------------------------------------------------|
| Patient / clinician UI | React + TypeScript                   | Auth-aware pages, camera permission, camera frame sampling, live metrics, charts and 3D twin.     |
| API service            | Python + FastAPI                     | Session lifecycle, protocol management, authorization, persistence, NVIDIA call and audit events. |
| Vision service         | Python 3.12+, PyTorch 2.7+, Sapiens2 | Person detection, pose inference, output parsing and inference metadata.                          |
| Movement engine        | Python module / service              | Landmark validation, signal smoothing, projected angles, rep state machine, session aggregates.   |
| Database               | Supabase Postgres                    | Users, roles, patient-clinician links, protocols, sessions, metrics, events and audit records.    |
| File storage           | Supabase private Storage bucket      | Optional approved assets; raw video disabled by default.                                          |
| Language model         | NVIDIA hosted API                    | Structured natural-language summary based only on approved numeric output.                        |

## Recommended separation

Keep the React application, API service and Sapiens2 inference runtime
as distinct logical components. The vision runtime is GPU-heavy, has its
own model and checkpoint dependencies, and may require a different
Python build than the regular API. A separate inference worker improves
fault isolation and allows the team to switch between local GPU
inference, a remote GPU host and a labelled test fixture without
redesigning the patient-facing application.

## Live data flow

> 1\. React requests a session token and checks current protocol and
> consent state.
>
> 2\. The browser uses getUserMedia for the camera after explicit
> permission. The API must be served in a secure context (HTTPS or
> localhost) for browser camera access. [7]
>
> 3\. A frame sampler extracts only the frames required for movement
> estimation and transmits compressed frames through a protected
> WebSocket or short-lived upload endpoint.
>
> 4\. The vision service returns 2D keypoints and confidence metadata.
> The movement engine processes them in timestamp order.
>
> 5\. The API sends live numeric events back to the browser. The
> Recovery Twin reads the same event stream to animate its rigged
> avatar.
>
> 6\. At session end, the API persists aggregates, rep events, quality
> flags, model version and protocol version to Supabase.
>
> 7\. The NVIDIA summary worker receives a minimal metrics object and
> stores the validated summary response.

## Deployment topology for the competition

| **SERVICE**     | **DEMO LOCATION**                                  | **NOTES**                                                                                    |
|-----------------|----------------------------------------------------|----------------------------------------------------------------------------------------------|
| Frontend        | Local developer machine or static HTTPS host.      | If remote camera access is required, use HTTPS. Localhost is accepted for local development. |
| FastAPI         | Local machine or small demo host.                  | Keep secrets in environment variables; never ship service-role credentials to browser.       |
| Sapiens2 worker | GPU-enabled workstation or permitted compute host. | Run preflight inference and latency test before live demonstration.                          |
| Supabase        | Hosted project.                                    | Use RLS; isolate test data; no real patient records in competition workspace.                |
| NVIDIA API      | Hosted endpoint.                                   | Use only server-side key and selected model ID.                                              |

## Fallback behaviour

- If camera permission is denied, allow protocol review and historical
  reports; do not silently switch to fabricated live data.

- If Sapiens2 is unavailable, show a clear "vision service unavailable"
  state. A separate demo fixture mode may replay labelled synthetic
  keypoints for UI testing only.

- If GPU inference is too slow, use a recorded clip processed offline
  for the competition demonstration and state that it is a processed
  clip, not a live session.

- If Supabase is unavailable, do not claim a session was saved. Offer a
  clear retry and keep the local session marked unsaved.

- If NVIDIA is unavailable, generate a deterministic non-AI summary from
  stored metrics.

# 11. API design and event contracts

All protected routes require a valid authenticated user. The API must
verify role and patient-clinician assignment on the server. The frontend
may hide unavailable controls, but backend authorization is
authoritative.

## HTTP endpoints

| **METHOD / PATH**                   | **PURPOSE**                                                    | **AUTHORIZATION**                                         |
|-------------------------------------|----------------------------------------------------------------|-----------------------------------------------------------|
| GET /api/v1/me                      | Current profile and role.                                      | Authenticated user.                                       |
| GET /api/v1/patients/me/protocols   | List protocols assigned to the patient.                        | Patient sees own assigned protocols.                      |
| POST /api/v1/protocols              | Create a protocol.                                             | Clinician with permission for the patient.                |
| PATCH /api/v1/protocols/{id}        | Create new protocol version / update status.                   | Assigned clinician only.                                  |
| POST /api/v1/sessions               | Create session in DRAFT state.                                 | Patient with assigned protocol or clinician-created demo. |
| POST /api/v1/sessions/{id}/start    | Confirm consent / setup and start session.                     | Session owner; valid consent required.                    |
| WS /api/v1/sessions/{id}/stream     | Receive sampled camera frames and return pose / metric events. | Short-lived session token bound to user and session.      |
| POST /api/v1/sessions/{id}/complete | Finalize aggregates and stop worker.                           | Session owner or authorized clinician.                    |
| GET /api/v1/sessions/{id}           | Fetch session summary.                                         | Patient owner or assigned clinician.                      |
| GET /api/v1/patients/{id}/progress  | Fetch comparable session trends.                               | Assigned clinician or patient owner.                      |
| POST /api/v1/sessions/{id}/summary  | Generate / regenerate controlled text summary.                 | Patient owner or assigned clinician.                      |
| GET /api/v1/health                  | Service health; no sensitive data.                             | Public or internal health check.                          |

## WebSocket event contract

**Client → server: frame**

```json
{
  "type": "frame",
  "session_id": "uuid",
  "sequence": 41,
  "timestamp_ms": 12500,
  "image_b64": "<compressed-frame>"
}
```

**Server → client: valid measurement**

```json
{
  "type": "measurement",
  "sequence": 41,
  "timestamp_ms": 12500,
  "projected_knee_angle_deg": 67.8,
  "rep_count": 3,
  "state": "RETURNING",
  "quality": {"usable": true, "reason": null, "confidence": 0.89},
  "model_version": "sapiens2-pose-0.4b"
}
```

**Server → client: quality failure**

```json
{
  "type": "quality_warning",
  "sequence": 42,
  "reason": "ANKLE_LANDMARK_LOW_CONFIDENCE",
  "message": "Move until the full lower leg is visible.",
  "rep_count": 3
}
```


Payload examples are illustrative. Use binary WebSocket frames or a
compact encoding in the implementation; avoid Base64 overhead for a
high-rate stream if a more efficient transport is available.

## Error contract

| **HTTP / EVENT** | **MEANING**                                          | **CLIENT ACTION**                                                 |
|------------------|------------------------------------------------------|-------------------------------------------------------------------|
| 400              | Invalid request or schema.                           | Show a field-specific validation message.                         |
| 401              | Missing or expired authentication.                   | Re-authenticate.                                                  |
| 403              | Role or patient-assignment access denied.            | Show access denied; log security event.                           |
| 404              | Session / protocol not found or not visible to user. | Show not available; do not reveal existence to unauthorized user. |
| 409              | Invalid session state transition.                    | Refresh current session state and explain.                        |
| 422              | Frame / inference input not usable.                  | Show camera framing or quality help.                              |
| 429              | Rate limit / frame sampler overflow.                 | Reduce capture rate and retry.                                    |
| 502 / 503        | Vision or NVIDIA dependency unavailable.             | Pause or use deterministic summary fallback.                      |

## API implementation rules

- Validate every incoming body with Pydantic models and explicit maximum
  payload sizes.

- Use a session-specific streaming token, not a service-role key or a
  long-lived user token embedded in a WebSocket URL.

- Enforce sequence numbers and timestamps to detect duplicate, stale or
  out-of-order frames.

- Apply frame rate limits and per-user session concurrency limits.

- Log model version, mapping version, processing duration and quality
  outcomes without logging raw image content.

- Close the camera and WebSocket when the user ends or abandons a
  session.

# 12. Supabase data model and security policies

Supabase is the system of record for authenticated users,
clinician-patient assignment, exercise protocol versions, session
summaries, movement measurements, consent records and audit events. Raw
video is not stored in the MVP. Supabase Auth provides user
authentication and integrates with Postgres Row Level Security; Supabase
Storage access is also controlled with policies on storage objects.
[8][9]

## Logical entities

| **TABLE**               | **KEY FIELDS**                                                      | **PURPOSE**                                                  |
|-------------------------|---------------------------------------------------------------------|--------------------------------------------------------------|
| profiles                | id, role, display_name, created_at                                  | Application role/profile linked to auth.users.               |
| clinician_patient_links | clinician_id, patient_id, status, created_at                        | Explicit relationship controlling clinician visibility.      |
| exercise_protocols      | id, patient_id, clinician_id, version, parameters, approved_at      | Clinician-owned exercise configuration and version history.  |
| sessions                | id, patient_id, protocol_id, status, start/end, model_version       | One attempted exercise session.                              |
| session_metrics         | id, session_id, metric_key, value, unit, quality                    | Session-level calculated measurements.                       |
| rep_events              | id, session_id, rep_index, timestamps, angle range, validity        | Rep-level evidence for review.                               |
| session_flags           | id, session_id, flag_code, severity, details                        | Data-quality or review flags, not diagnoses.                 |
| consent_records         | id, patient_id, consent_version, granted_at, revoked_at             | Proof of camera-processing consent and its withdrawal state. |
| ai_summaries            | id, session_id, provider, model_id, schema_version, body, validated | Stored validated explanatory text.                           |
| audit_events            | id, actor_id, action, object_type, object_id, created_at            | Access and change accountability.                            |

## Relationship overview

auth.users 1---1 profiles

profiles(patient) 1---N sessions

profiles(clinician) N---N profiles(patient) via clinician_patient_links

profiles(clinician) 1---N exercise_protocols

exercise_protocols 1---N sessions

sessions 1---N session_metrics

sessions 1---N rep_events

sessions 1---N session_flags

sessions 1---0..1 ai_summaries (or multiple versioned summaries)

profiles 1---N consent_records

profiles 1---N audit_events as actor

## Security model

- Enable Row Level Security on every table exposed through the Supabase
  Data API. Tables without RLS can be accessed by roles with grants; the
  Supabase documentation specifically recommends enabling RLS on exposed
  tables. [8]

- Patients can read their own profile, protocols assigned to them,
  sessions, metrics, summaries and consent records. They cannot change
  clinician-approved protocol parameters.

- Clinicians can read data only for patients with an active row in
  clinician_patient_links. A clinician must not be able to enumerate
  unrelated patient IDs.

- Only authorized clinician roles can create or version protocols. The
  API verifies the assignment before writing.

- The Supabase service-role key stays on the backend only. It is never
  included in Vite environment variables, client bundles or browser
  network responses.

- Use a private Storage bucket if a specific approved file must be
  stored. RLS controls Storage operations; do not use a public bucket
  for patient-related assets. [9]

- Store authorization roles in trusted application-managed data or
  protected claims. Do not rely on user-editable profile metadata to
  grant clinician access.

- Create audit events for access grants, protocol changes, report
  exports, consent changes and any privileged administrative action.

## Example RLS policy approach

The following is a design pattern, not a complete migration. Add
indexes, grants and matching policies for each operation. Verify every
policy using patient, assigned-clinician, unassigned-clinician and
anonymous test accounts.

```sql
-- Example: patients may read their own sessions
alter table public.sessions enable row level security;

create policy "patient reads own sessions"
on public.sessions for select
to authenticated
using (patient_id = (select auth.uid()));

-- Example: assigned clinicians may read patient sessions
create policy "assigned clinician reads linked sessions"
on public.sessions for select
to authenticated
using (
  exists (
    select 1 from public.clinician_patient_links l
    where l.clinician_id = (select auth.uid())
      and l.patient_id = sessions.patient_id
      and l.status = 'active'
  )
);

-- Do not expose service-role credentials to the browser.
-- Add separate insert/update/delete policies per role and table.
```

## Retention and deletion policy for the prototype

| **DATA TYPE**             | **MVP DEFAULT**                                          | **CONTROL**                                                                       |
|---------------------------|----------------------------------------------------------|-----------------------------------------------------------------------------------|
| Raw camera frames / video | Not persisted. Process transiently in memory.            | Delete buffers immediately after inference; no video recording endpoint.          |
| Keypoint frame samples    | Transient in memory; only approved aggregates persisted. | Do not store full frame keypoints unless a specific validation study is approved. |
| Session metrics           | Retained for the agreed demo/test period.                | Use synthetic data in competition; define deletion schedule before pilot.         |
| Consent records           | Retain while needed to demonstrate consent and audit.    | Version and timestamp; record withdrawal.                                         |
| AI summary                | Retain with linked session and model/schema metadata.    | Delete with the corresponding session under the approved retention plan.          |
| Audit events              | Retain according to the applicable governance schedule.  | Restrict access and avoid content of sensitive payloads.                          |

# 13. Privacy, safety, clinical governance and Kenya context

## Product safety position

RehabLoop is an assistive measurement and session-documentation
prototype. It is not a clinician, diagnosis tool, triage system or
autonomous rehabilitation coach. The therapist defines the protocol and
interprets the measurements. Any displayed feedback must describe what
the software measured and how reliable the measurement was, not what the
patient medically should do.

## Kenyan data-protection considerations

Kenya's Data Protection Act, 2019 includes specific requirements for
processing personal data relating to health. Section 46 states that
health data may only be processed by or under the responsibility of a
healthcare provider, or by a person subject to professional secrecy
under law, with further conditions in the section. The project must
obtain legal advice on the controller/processor roles and the
appropriate health-provider relationship before handling real patient
health data. [10]

The Office of the Data Protection Commissioner (ODPC) has published
guidance on health data, including storage limitation and Data
Protection Impact Assessments where processing is likely to result in
high risk. The ODPC also classifies biometric data as sensitive personal
data in its public guidance. Because RehabLoop uses camera input and
derives body-movement measurements, the team must assess whether the
specific video and derived landmark processing is personal or biometric
data under the intended use and applicable law. Do not assume that
removing names automatically makes footage anonymous. [11][12]

## Sapiens2 licence and health-data restrictions

The Sapiens2 agreement itself contains restrictions relevant to this
design, including restrictions concerning biometric processing and
unauthorised or unlicensed medical/health practice. A legal/licensing
specialist must review whether the intended non-identification
rehabilitation movement analysis is permitted under the current Sapiens2
agreement and any applicable local rules. If the intended use is not
permitted, the project must obtain written permission or use a model
with rights that permit this work. The engineering team must not
interpret this document as a legal opinion. [5]

## Required pre-pilot governance checklist

- Identify the health provider or licensed clinical partner responsible
  for any processing of real patient health data.

- Document whether RehabLoop is controller, joint controller or
  processor for each data flow; agree roles contractually.

- Obtain a legal review of the Data Protection Act, ODPC health-data
  guidance, biometric-data guidance and any applicable Digital Health
  requirements.

- Complete a DPIA if required and document why the assessment was or was
  not required.

- Review the Sapiens2 licence and checkpoint terms specifically for the
  intended camera-based movement-analysis use.

- Obtain informed, specific consent for camera processing, explain the
  purpose, identify retention, and provide a clear way to stop
  processing and withdraw consent.

- Use a secure deployment, private storage, RLS, least privilege,
  encryption in transit and at rest where supported, and audit events.

- Define data retention and deletion periods; do not retain raw video by
  default.

- Set a documented incident process for accidental disclosure, loss of
  camera footage, or unauthorized access.

- Obtain clinical review of protocol language, target parameters, stop
  instructions and all patient-facing feedback.

## Clinical oversight and escalation

| **SCENARIO**                                | **APPLICATION RESPONSE**                                                                    | **HUMAN RESPONSIBILITY**                                                                 |
|---------------------------------------------|---------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------|
| User reports pain or feels unsafe           | Provide the configured stop instruction and stop/pause capture. Do not suggest a diagnosis. | Patient follows clinician / appropriate care instructions; clinician reviews the report. |
| Movement estimate is low confidence         | Show measurement unavailable; no rep count for affected interval.                           | Clinician decides whether a repeat session or in-person review is appropriate.           |
| Potentially unusual movement value          | Mark as a measurement requiring review; do not label injury or deterioration.               | Physiotherapist interprets in clinical context.                                          |
| Patient misses sessions                     | Show missing session status only if the feature is enabled and consented.                   | Clinician determines whether follow-up is needed.                                        |
| AI output suggests an exercise or diagnosis | Reject output through schema/policy validation; log model safety event.                     | Clinician retains treatment authority.                                                   |

| **DATA SAFETY** Competition demo rule: use synthetic or explicitly approved test data. Do not upload real patient records, identifiable patient video or health information to a third-party model endpoint unless the legal, contractual, privacy and consent requirements are satisfied. |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 14. Testing strategy and measurable success criteria

## Test layers

| **TEST LAYER**      | **WHAT TO TEST**                                                                        | **EVIDENCE TO KEEP**                                                 |
|---------------------|-----------------------------------------------------------------------------------------|----------------------------------------------------------------------|
| Model smoke test    | Sapiens2 checkpoint loads, detector runs, keypoint output appears.                      | Model ID, checkpoint hash, environment versions, output samples.     |
| Landmark adapter    | Mapped hip/knee/ankle keys correspond to correct anatomical points.                     | Manually reviewed overlay images and mapping test cases.             |
| Geometry unit tests | Angle calculation for known synthetic point configurations.                             | Expected vs actual angle tests; edge cases with zero-length vectors. |
| Signal tests        | Noise, missing frames, out-of-order timestamps and occlusions.                          | Test traces and expected state-machine transitions.                  |
| Rep counter tests   | Complete rep, partial rep, false start, pause and low-confidence interruption.          | Expected count and event table.                                      |
| API tests           | Auth, session state transitions, invalid payloads and dependency failures.              | Automated pytest output.                                             |
| RLS tests           | Patient A, Patient B, assigned clinician, unassigned clinician and anonymous access.    | SQL policy tests / integration test results.                         |
| UI tests            | Camera denial, setup failure, pause, reconnect, empty history and reduced screen width. | Screen recordings or annotated test checklist.                       |
| End-to-end demo     | Create protocol, consent, run session, persist metrics, view history, produce summary.  | A reproducible demo script and recorded run.                         |

## Measurable MVP acceptance targets

These are engineering acceptance targets for a competition prototype,
not clinical performance claims. The team must report the measured
results from its own test set, including failures.

| **MEASURE**                  | **MVP TARGET**                                                                                  | **HOW TO MEASURE**                                                             |
|------------------------------|-------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| Model smoke-test completion  | 100% of selected approved test images produce either a valid pose output or a clear rejection.  | Run fixed test fixture batch and compare output count.                         |
| Landmark mapping correctness | All required landmarks map to the correct named points on manually reviewed fixtures.           | Two-person review of overlay on at least 20 selected frames.                   |
| Angle calculation accuracy   | Within 5 degrees on synthetic geometry fixtures.                                                | Unit test against known coordinates; this validates math only, not Sapiens2.   |
| Rep counter logic            | 100% correct on scripted synthetic traces covering full, partial, interrupted and invalid reps. | Deterministic state-machine unit tests.                                        |
| Usable-frame visibility      | At least 80% usable frames in the controlled demo clip.                                         | Count valid frames / expected sampled frames. If below target, show the issue. |
| Session persistence          | 100% of completed demo sessions have metrics, protocol version and model version recorded.      | End-to-end DB check.                                                           |
| RLS isolation                | Zero cross-patient reads in the test matrix.                                                    | Test every role combination against real Supabase policies.                    |
| NVIDIA numeric consistency   | 100% of displayed values match canonical stored metrics.                                        | Compare summary JSON and persisted metrics.                                    |
| Video retention              | Zero raw video files persisted in the default MVP flow.                                         | Inspect storage bucket and backend logs.                                       |

## Dataset and test fixtures

- Create synthetic keypoint sequences for exact known angle and
  repetition cases.

- Build a small approved frame set covering front/side view differences,
  partial occlusion, poor light, loose clothing, body crop and
  multiple-person scenes.

- Label a small set of frames manually for the required landmarks;
  document that this is a small engineering fixture, not a clinical
  validation dataset.

- Include no-person, partial-person and out-of-frame fixtures to verify
  that the system rejects unusable input.

- Use identical camera position and protocol settings when comparing
  session metrics over time.

## How to report results to judges

Present the measured test-set size and observed errors. Separate three
distinct results: (1) pose detection quality, (2) movement-engine
correctness on known inputs, and (3) end-to-end application reliability.
Do not report the mathematical unit-test accuracy as if it were clinical
motion-estimation accuracy.

# 15. 48-hour two-developer implementation plan

The sprint preserves the two-person / 48-hour constraint. Both
developers should integrate against agreed contracts from the beginning.
The first priority is a thin vertical slice that runs through the actual
model, movement engine and persisted session record. The sprint should
not expand into multiple rehabilitation pathways.

## Work split

| **OWNER**                           | **PRIMARY RESPONSIBILITY**                                                                                                    | **DELIVERABLES**                                                                                            |
|-------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| Developer 1 - frontend / experience | React + TypeScript UI, Auth screens, protocol view, consent, camera setup, live session, dashboard, charts and Recovery Twin. | Clickable product experience; camera sampling; WebSocket client; demo flow; responsive UI.                  |
| Developer 2 - backend / AI / data   | FastAPI API, Supabase schema/RLS, Sapiens2 worker integration, landmark adapter, movement analytics, NVIDIA summary.          | Model smoke test; inference endpoint; session APIs; database migration; rep logic; tested summary endpoint. |
| Shared                              | Architecture contract, model/licence gate, end-to-end integration, safety review, testing and pitch.                          | A single reproducible demo with known limitations and truthful metrics.                                     |

## Timeboxed plan

| **TIME** | **DEVELOPER 1**                                                            | **DEVELOPER 2**                                                                       | **SHARED EXIT**                                                                                       |
|----------|----------------------------------------------------------------------------|---------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| 0-4 h    | Create Vite React TypeScript shell, route map, design tokens, auth layout. | Create FastAPI project, Supabase project/schema draft, environment loader.            | Agree JSON contracts, model licence review owner and demo assumptions.                                |
| 4-8 h    | Patient home, protocol detail and consent/setup screens.                   | Sapiens2 environment install; test checkpoint + detector; record load/inference time. | Model smoke-test decision. If blocked, use labelled synthetic keypoint test mode, not fake inference. |
| 8-16 h   | Camera preview, framing guide, frame sampling and WebSocket client.        | Vision service endpoint, output parser and named lower-body landmark adapter.         | First frame -> Sapiens2 -> named keypoint round trip.                                               |
| 16-24 h  | Live session UI, metric cards, pause/end states and skeleton overlay.      | Angle calculation, smoothing, rep state machine, session events and unit tests.       | Live or recorded-clip movement calculation with confidence-based rejection.                           |
| 24-32 h  | Session results, patient progress chart and clinician dashboard.           | Supabase writes/reads, RLS tests, NVIDIA summary endpoint.                            | A completed session persists and can be reopened by the correct role.                                 |
| 32-40 h  | 3D Recovery Twin using measured angle trace; polish and responsive checks. | Performance tuning, failure handling, audit logs and integration fixes.               | One complete end-to-end demo; capture benchmark evidence.                                             |
| 40-48 h  | Demo rehearsal, visual polish, pitch and screenshots.                      | Regression tests, environment checklist, backup prerecorded clip and database reset.  | Freeze scope; run a clean demo from a fresh start.                                                    |

## Parallelisation rules

- Frontend must use documented mock events only until the backend event
  contract is ready; then replace mocks with the real WebSocket client.

- Backend developer delivers the model smoke test before building the
  whole interface around assumed keypoint ordering.

- Both developers use the same `.env.example` keys and local run
  instructions. Never share real API keys in Git or chat.

- Freeze the exact exercise protocol and demo dataset by hour 8. No
  additional exercise is added during the sprint.

- Schedule at least two integration checkpoints: around hour 16 and hour
  32.

- Keep a fallback demonstration clip and labelled synthetic keypoint
  fixture. Clearly state when either is used.

## Definition of done at hour 48

- A new user can open the application and understand the product without
  explanation.

- A clinician/demo supervisor can configure the single selected
  protocol.

- A patient can review consent and start a camera or approved test-clip
  session.

- Sapiens2 inference runs on an approved test input, with model and
  mapping versions recorded.

- The movement engine produces a projected knee-angle trace and
  repetition events or clearly rejects poor-quality input.

- Session results are saved in Supabase and visible only to the correct
  test accounts.

- The 3D avatar or 2D progress visualisation reflects the selected
  session data.

- The NVIDIA summary is constrained and numeric values are
  cross-checked.

- The team can explain all unimplemented and unvalidated items without
  overstating results.

# 16. Repository structure, setup and environment

## Suggested repository layout

```text
rehabloop/
├── frontend/
│   └── src/
│       ├── app/                 # routes, auth guards
│       ├── components/          # camera, cards, charts, controls
│       ├── features/
│       │   ├── protocols/
│       │   ├── sessions/
│       │   └── recovery-twin/
│       ├── lib/                 # supabase client, API client
│       └── types/               # shared response types
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/v1/              # HTTP routes + WebSocket route
│   │   ├── core/                # settings, auth, logging
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   └── services/
│   │       ├── session_service.py
│   │       ├── movement_engine.py
│   │       ├── nvidia_summary.py
│   │       └── supabase_repository.py
│   └── tests/
├── vision_service/
│   ├── app/
│   │   ├── main.py
│   │   ├── inference.py         # Sapiens2 loading and prediction
│   │   ├── detector.py
│   │   ├── keypoint_adapter.py
│   │   └── schemas.py
│   ├── config/
│   │   └── keypoint_mapping.yaml
│   └── tests/
├── supabase/
│   ├── migrations/
│   └── seed/
├── fixtures/
│   ├── synthetic_keypoint_sequences/
│   └── approved_test_frames/
├── docs/
│   ├── model-smoke-test.md
│   ├── camera-setup.md
│   └── demo-runbook.md
├── .env.example
└── README.md
```

## Environment variables

| **VARIABLE**              | **LOCATION**                       | **RULE**                                                                            |
|---------------------------|------------------------------------|-------------------------------------------------------------------------------------|
| VITE_SUPABASE_URL         | Frontend build-time public config. | Public project URL only.                                                            |
| VITE_SUPABASE_ANON_KEY    | Frontend build-time public config. | Public anon key subject to RLS; never treat as a secret authorization bypass.       |
| SUPABASE_URL              | Backend environment.               | Server-side project URL.                                                            |
| SUPABASE_SERVICE_ROLE_KEY | Backend secret only.               | Never expose in frontend; bypasses RLS privileges.                                  |
| NVIDIA_API_KEY            | Backend secret only.               | Never expose to browser or commit to Git.                                           |
| NVIDIA_BASE_URL           | Backend environment.               | Default hosted API base URL from NVIDIA docs; verify selected account and endpoint. |
| NVIDIA_MODEL_ID           | Backend environment.               | Exact ID selected and tested in NVIDIA API Catalog.                                 |
| SAPIENS_CHECKPOINT_ROOT   | Vision worker environment.         | Directory containing approved local checkpoints.                                    |
| SAPIENS_POSE_MODEL        | Vision worker environment.         | Start with approved Sapiens2 0.4B pose checkpoint.                                  |
| SAPIENS_DETECTOR_MODEL    | Vision worker environment.         | Detector checkpoint / configuration.                                                |
| VISION_DEVICE             | Vision worker environment.         | cuda or cpu, after capability check.                                                |
| STORE_RAW_VIDEO           | Backend configuration.             | Default false; enabling requires separate approval and consent.                     |
| MAX_FRAME_RATE            | Backend configuration.             | A measured and configurable rate limit, not a fixed model guarantee.                |

## Local setup outline

```bash
# 1. Frontend
cd frontend
npm install
npm run dev

# 2. API (Python 3.12 environment recommended for shared compatibility)
cd ../backend
python -m venv .venv
# Activate the virtual environment for your OS.
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 3. Vision worker
cd ../vision_service
python -m venv .venv
# Install the Sapiens2 repository requirements in a compatible environment.
pip install -e /path/to/sapiens2
uvicorn app.main:app --reload --port 8001

# 4. Apply Supabase migrations and seed only synthetic demo accounts/data.
```

Exact PyTorch, CUDA, driver, OpenCV and checkpoint requirements must be
pinned after testing the target GPU. The Sapiens2 package requirements
and Python version are documented in the official repository; verify
current installation notes before setup. [4]

## Operational runbook

- Before a demo: check model checkpoint files, GPU availability, NVIDIA
  key, Supabase health, camera permission and the demo account roles.

- Start the vision worker first and run its model health check; then
  start the API and frontend.

- Verify that raw frame persistence is disabled and the private storage
  bucket is not publicly accessible.

- Run one short test session and inspect session rows, rep events and
  metrics before the audience arrives.

- Keep a known-good prerecorded clip and synthetic keypoint sequence as
  clearly-labelled backup paths.

- After demo: remove test sessions and any temporary assets according to
  the agreed retention plan; rotate any exposed secret.

# 17. Demo scenario, pitch and judge questions

## Three-minute demo script

| **TIME**  | **WHAT TO SHOW**                                      | **MESSAGE**                                                                                                 |
|-----------|-------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| 0:00-0:25 | Problem and patient / therapist workflow.             | Rehabilitation continues outside the clinic, but the clinician often has limited visibility between visits. |
| 0:25-0:55 | Clinician protocol screen.                            | The therapist sets the exercise and target parameters. RehabLoop does not prescribe the exercise.           |
| 0:55-1:20 | Consent and camera setup.                             | The patient controls camera access; the app checks framing before measurement starts.                       |
| 1:20-2:00 | Sapiens2 pose overlay and measured session.           | Meta Sapiens2 estimates 2D keypoints; our movement engine computes projected angle and valid repetitions.   |
| 2:00-2:30 | Session result + historical trend + 3D Recovery Twin. | The avatar and progress interface are driven by stored measurements, not decorative animation.              |
| 2:30-2:50 | NVIDIA-generated explanation and clinician review.    | NVIDIA explains existing measurements; the clinician remains the decision-maker.                            |
| 2:50-3:00 | Safety / impact / next step.                          | The next milestone is clinician-led validation, model licensing clearance and a supervised pilot.           |

## Competition pitch

RehabLoop is an AI-assisted rehabilitation monitoring platform.

Patients often continue prescribed exercises between physiotherapy
visits,

but their clinician may have limited objective visibility into those
sessions.

RehabLoop uses Meta Sapiens2 human-pose estimation to identify body
landmarks

from an approved camera view. Our own movement engine turns those
landmarks

into projected joint-angle traces, repetition events and
measurement-quality

indicators. We save the structured results, show progress over time and
use

NVIDIA AI only to explain the measurements in plain language.

The key difference is that RehabLoop does not replace the
physiotherapist.

The clinician sets the protocol, owns the targets and interprets the
evidence.

Our competition MVP focuses on one controlled knee-rehabilitation
pathway;

clinical validation, licensing review and a supervised pilot are the
next steps.

## Likely judge questions

| **QUESTION**                               | **RECOMMENDED ANSWER**                                                                                                                                                                                                             |
|--------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Is this a chatbot?                         | No. The core interaction is camera-based pose estimation and deterministic movement measurement. NVIDIA is used only to explain stored measurements.                                                                               |
| What does Meta contribute?                 | Sapiens2 is the human-centric vision model used for 2D pose estimation. It returns 308 whole-body keypoints; we map the relevant points and calculate movement metrics ourselves.                                                  |
| Is the 3D avatar a real 3D scan?           | No, not in the MVP. It is a rigged avatar driven by measured 2D projected movement. True depth-aware reconstruction is a later research and validation milestone.                                                                  |
| Can it tell whether a patient is healing?  | No. It records movement measurements and trends. A physiotherapist interprets them in clinical context.                                                                                                                            |
| What happens if the camera misses a joint? | The frame fails the quality gate. The application does not count a rep or invent the missing angle; it asks the user to adjust the view.                                                                                           |
| Why use NVIDIA?                            | The NVIDIA API provides a controlled language-summary layer. It does not perform pose detection or make treatment decisions.                                                                                                       |
| How do you protect patient data?           | Raw video is not stored by default; access is role-scoped with Supabase RLS; we use explicit consent and require Kenyan legal and clinical review before a patient pilot.                                                          |
| Can Sapiens2 be used in healthcare?        | We are treating the model licence as a go/no-go gate. Its terms include restrictions relevant to biometric processing and unauthorised medical practice; we will obtain a specific legal/licensing review before real-patient use. |

# 18. Risk register and mitigations

| **RISK**                                                         | **LIKELIHOOD / IMPACT** | **MITIGATION**                                                                                                                          | **OWNER**    |
|------------------------------------------------------------------|-------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|--------------|
| Sapiens2 licence does not permit intended movement-analysis use. | Unknown / Critical      | Review current licence before model deployment with identifiable people; obtain written permission or choose a rights-compatible model. | Project lead |
| Sapiens2 latency too high for live browser demo.                 | Medium / High           | Benchmark 0.4B first; reduce sampled FPS/resolution within model constraints; use a clearly labelled recorded-clip demo if needed.      | Developer 2  |
| GPU / CUDA setup fails.                                          | Medium / High           | Run smoke test in first 8 hours; pin environment; keep fallback keypoint fixture.                                                       | Developer 2  |
| Keypoint indices mapped incorrectly.                             | Medium / High           | Use official mapping docs; version the mapping; manually review overlays; unit-test named landmarks.                                    | Developer 2  |
| 2D camera angle creates misleading joint-angle values.           | High / High             | Restrict to side-view protocol; label as projected estimate; show setup guide and quality note; validate against manual references.     | Shared       |
| Pose estimate varies with clothing, lighting or occlusion.       | High / Medium           | Test diverse conditions; flag low confidence; no rep count on unreliable frames.                                                        | Developer 2  |
| Patient assumes the product is prescribing exercise.             | Medium / Critical       | Require clinician-owned protocol; plain-language scope notice; prohibit generated exercise prescriptions.                               | Developer 1  |
| NVIDIA summary invents or alters metric values.                  | Medium / High           | Pass metrics only; strict JSON; cross-check numeric fields; deterministic fallback.                                                     | Developer 2  |
| RLS misconfiguration exposes patient information.                | Medium / Critical       | RLS on all exposed tables; test multiple user roles; no service key in frontend; private storage.                                       | Developer 2  |
| Camera video or derived pose data is retained unexpectedly.      | Medium / High           | Default no-video storage; inspect network/storage; retention configuration and deletion tests.                                          | Shared       |
| Insufficient user / clinician validation.                        | High / Medium           | Conduct short discovery interviews; label assumptions; do not claim proven demand or outcomes.                                          | Project lead |
| 48-hour scope expansion prevents end-to-end demo.                | High / High             | One exercise, one camera, one model size; freeze features at hour 8; focus on vertical slice.                                           | Shared       |

## Pre-demo go/no-go checklist

- Model licence review status recorded; any non-cleared model usage is
  restricted to approved test fixtures.

- Vision service starts and returns model version, inference duration
  and keypoint response.

- No real patient data is present in demo database or object storage.

- RLS tests pass for patient, linked clinician, unlinked clinician and
  anonymous visitor.

- Session state transitions and metric calculations pass automated
  tests.

- AI summary values match canonical metrics; fallback summary works with
  the NVIDIA key removed.

- Camera is stopped and temporary frame buffers are cleared on
  pause/end/disconnect.

- The team can state limitations and can distinguish live inference,
  clip inference and synthetic test mode.

# 19. Roadmap and post-competition plan

![Product delivery progression from 2D MVP to depth-aware 3D research](RehabLoop_Full_Product_and_Technical_Blueprint_media/media/image4.png)

Figure 6. Phased roadmap. Each later phase is gated by evidence and
governance, not simply by code completion.

## Phase 1 - Competition MVP

- One clinician-configured knee exercise; single side-view camera;
  Sapiens2 2D pose; projected angle and repetition engine; Supabase
  session records; NVIDIA summary; 3D avatar driven by measured 2D
  motion.

- Synthetic or explicitly approved demo data. No diagnostic, treatment
  or clinical outcome claims.

## Phase 2 - Supervised feasibility pilot

- Partner with a licensed physiotherapy service and define clinical
  responsibility, patient eligibility and oversight.

- Complete licence/privacy review and DPIA determination; implement
  consent and retention controls.

- Evaluate camera setup success, usable-frame percentage, measurement
  repeatability and therapist review burden.

- Compare projected angle output against a suitable reference
  measurement process in a supervised, ethically approved study.

- Revise protocol configuration and patient-facing language based on
  physiotherapist feedback.

## Phase 3 - Expanded movement library

- Add further exercises only after the required landmarks, camera views
  and thresholds are specified and validated individually.

- Support additional body regions under clinician-configured protocols.

- Introduce therapist comments, adherence summaries and secure report
  export.

- Develop mobile-first capture and offline buffering only after
  connectivity and device testing.

## Phase 4 - 3D and advanced analytics research

- Evaluate Sapiens2 pointmap outputs, additional depth sensors or
  multi-view setups for depth-aware movement estimation.

- Use calibration targets and validated reference systems to test the
  accuracy of 3D measurements.

- Improve avatar movement using a validated kinematic representation,
  not guessed depth.

- Study whether additional metrics provide meaningful value to
  physiotherapists before exposing them to patients.

## Scale-up dependencies

| **DEPENDENCY**               | **REQUIRED EVIDENCE**                                                                                                        |
|------------------------------|------------------------------------------------------------------------------------------------------------------------------|
| Clinical partnership         | Named clinical owner, written workflow, approved protocol and review responsibility.                                         |
| Regulatory and legal pathway | Documented assessment of device/software classification, data protection, research ethics and applicable local requirements. |
| Model rights                 | Written review of Sapiens2 terms for the intended use, or a model with suitable permissions.                                 |
| Technical validity           | Repeatability, accuracy, robustness, latency and failure-mode data.                                                          |
| Operational readiness        | Support process, incident response, security monitoring, retention and deletion controls.                                    |

# Appendix A. Implementation examples

## A1. Example session metrics object

```json
{
  "session_id": "00000000-0000-0000-0000-000000000123",
  "protocol_id": "00000000-0000-0000-0000-000000000456",
  "protocol_version": 1,
  "model_version": "sapiens2-pose-0.4b",
  "keypoint_mapping_version": "rehabloop-knee-map-1.0",
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

All numeric values are example fixtures, not clinical thresholds or a
real patient measurement.

## A2. Example NVIDIA summary schema

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

The API must not trust values returned in `observed_values`. The
application should render canonical values from the stored metrics and
use the LLM response only for carefully validated explanatory wording.

## A3. Pseudocode for angle calculation

```python
def projected_joint_angle(a, b, c):
    # a=hip, b=knee, c=ankle; all are 2D image coordinates
    u = a - b
    v = c - b
    nu = norm(u)
    nv = norm(v)
    if nu == 0 or nv == 0:
        return None
    cosine = dot(u, v) / (nu * nv)
    cosine = max(-1.0, min(1.0, cosine))
    return degrees(acos(cosine))

# Only call after confidence, timestamp and visibility checks.
# The result is a projected 2D angle, not a validated anatomical angle.
```

## A4. Example environment file

```dotenv
# Frontend - public values only
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=http://localhost:8000

# Backend secrets
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NVIDIA_API_KEY=
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL_ID=

# Vision worker
SAPIENS_CHECKPOINT_ROOT=
SAPIENS_POSE_MODEL=facebook/sapiens2-pose-0.4b
SAPIENS_DETECTOR_MODEL=facebook/detr-resnet-101-dc5
VISION_DEVICE=cuda
MAX_FRAME_RATE=8
STORE_RAW_VIDEO=false
```

## A5. Database migration starter - core entities

```sql
-- Starter outline: review, complete and test before applying.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('patient','clinician','admin')),
  display_name text,
  created_at timestamptz not null default now()
);

create table public.clinician_patient_links (
  clinician_id uuid not null references public.profiles(id),
  patient_id uuid not null references public.profiles(id),
  status text not null check (status in ('pending','active','revoked')),
  created_at timestamptz not null default now(),
  primary key (clinician_id, patient_id)
);

create table public.exercise_protocols (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id),
  clinician_id uuid not null references public.profiles(id),
  protocol_name text not null,
  version integer not null default 1,
  parameters jsonb not null,
  approved_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(patient_id, protocol_name, version)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id),
  protocol_id uuid not null references public.exercise_protocols(id),
  status text not null check (status in ('draft','ready','active','paused','completed','aborted','review_required')),
  model_version text,
  mapping_version text,
  analytics_version text,
  started_at timestamptz,
  ended_at timestamptz,
  raw_video_stored boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.session_metrics (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  metric_key text not null,
  numeric_value double precision,
  text_value text,
  unit text,
  quality jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(session_id, metric_key)
);

create table public.rep_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  rep_index integer not null,
  start_ms bigint,
  end_ms bigint,
  min_angle_deg double precision,
  max_angle_deg double precision,
  valid boolean not null,
  quality jsonb not null default '{}'::jsonb,
  unique(session_id, rep_index)
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id),
  consent_version text not null,
  purpose text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.clinician_patient_links enable row level security;
alter table public.exercise_protocols enable row level security;
alter table public.sessions enable row level security;
alter table public.session_metrics enable row level security;
alter table public.rep_events enable row level security;
alter table public.consent_records enable row level security;

-- Add explicit SELECT / INSERT / UPDATE / DELETE policies for each role.
-- Test cross-patient isolation before any non-synthetic data is introduced.
```

| **SQL WARNING** This SQL is an implementation starter, not a production-ready migration. Add indexes, strict grants, complete RLS policies, triggers for updated_at, protocol version enforcement and policy tests before use. |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# Appendix B. References and verification notes

The following primary sources were consulted when preparing this
blueprint. Model versions, checkpoints, API catalogues, licensing terms
and regulatory guidance can change. Verify the exact live terms and
technical instructions again before implementation and before any
real-world deployment. Accessed 24 November 2026.

**[1] Meta AI / Facebook Research - Sapiens2 repository and model
overview -** https://github.com/facebookresearch/sapiens2

**[2] Meta AI / Facebook Research - Sapiens2 2D pose estimation guide
-** https://github.com/facebookresearch/sapiens2/blob/main/docs/POSE.md

**[3] Meta AI - Segment Anything Model 2 (SAM 2) overview -**
https://ai.meta.com/research/sam2/

**[4] Meta AI / Facebook Research - Sapiens2 model zoo and
installation requirements -**
https://github.com/facebookresearch/sapiens2/blob/main/docs/MODEL_ZOO.md

**[5] Meta - Sapiens2 License Agreement -**
https://github.com/facebookresearch/sapiens2/blob/main/LICENSE.md

**[6] NVIDIA - LLM NIM APIs / hosted inference API reference -**
https://docs.api.nvidia.com/nim/reference/llm-apis

**[7] MDN - MediaDevices.getUserMedia() camera permission and
secure-context behaviour -**
https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

**[8] Supabase - Postgres Row Level Security -**
https://supabase.com/docs/guides/database/postgres/row-level-security

**[9] Supabase - Storage access control -**
https://supabase.com/docs/guides/storage/security/access-control

**[10] Kenya Law - Data Protection Act, 2019 (consolidated source) -**
https://new.kenyalaw.org/akn/ke/act/2019/24/eng@2022-12-31/source.pdf

**[11] Office of the Data Protection Commissioner, Kenya - Guidance
Note on Processing of Health Data -**
https://www.odpc.go.ke/wp-content/uploads/2024/02/ODPC-Guidance-Note-on-Processing-of-Health-Data.pdf

**[12] Office of the Data Protection Commissioner, Kenya - Guidance
Note on Biometric Data -**
https://www.odpc.go.ke/wp-content/uploads/2025/11/ODPC-%E2%80%93-Guidance-Note-on-Biometric-Data.pdf

**[13] FastAPI - WebSockets -**
https://fastapi.tiangolo.com/advanced/websockets/

## Verification notes

- Sapiens2 is selected because Meta documents a dedicated 2D human-pose
  task with 308 keypoints and model sizes from 0.4B to 5B. Its pose
  guide also documents a person detector and example inference output.
  [1][2][4]

- The Sapiens2 repository documents Python >=3.12 and PyTorch >=2.7 as
  installation requirements. [4]

- The Sapiens2 agreement contains terms that require a specific licence
  review for the proposed health-related movement-analysis use. This
  blueprint does not interpret those terms as granting permission. [5]

- NVIDIA documents a hosted LLM API using an OpenAI-compatible
  chat-completions pattern and Bearer-token authentication. The exact
  model ID remains configurable until tested with the project key. [6]

- Supabase documentation describes RLS as row-level authorization and
  recommends enabling it on exposed tables. Storage access is also
  policy-controlled. [8][9]

- Kenyan data-protection sources describe additional safeguards for
  health data and biometric data. Obtain qualified local advice before a
  pilot. [10][11][12]

## Project decisions to confirm at kickoff

| **DECISION**      | **CURRENT BLUEPRINT ASSUMPTION**                                                                                             |
|-------------------|------------------------------------------------------------------------------------------------------------------------------|
| Meta vision model | Sapiens2 Pose 0.4B as initial candidate; use blocked pending licence review for identifiable health-related motion analysis. |
| Exercise pathway  | One clinician-configured seated knee-extension demonstration pathway.                                                        |
| AI provider       | NVIDIA hosted API for controlled session summaries only.                                                                     |
| Database          | Supabase Postgres + Auth + RLS; private storage optional and video off by default.                                           |
| Frontend          | React + TypeScript.                                                                                                          |
| Backend           | FastAPI on Python 3.12 environment; separate GPU inference worker.                                                           |
| 3D scope          | Rigged Recovery Twin driven by measured 2D projected motion; true 3D deferred.                                               |
| Team / timeline   | Two developers, 48-hour competition MVP.                                                                                     |
