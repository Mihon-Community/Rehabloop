# Pose-estimation model landscape — research only

Owner: Lennox. **No code, model weights, or datasets were touched.** This is
a measurement-accuracy survey only, scoped by `CLAUDE.md`'s "Dataset and
model-handling rules" (alternative *pose-estimation* model research is
explicitly permitted). It does not propose any movement-classification,
exercise-recognition, or recovery/diagnosis model — that stays out of scope.

**Tooling note**: the Hugging Face Hub MCP tools named in the task brief
(`hf_fs`, `hub_repo_search`, `hub_repo_details`) were not exposed to this
subagent invocation, so no live Hub query was run. What follows is drawn
from each project's own public model card / paper, from memory as of this
assistant's training cutoff — not a benchmark I ran, and not a Hub lookup.
Anyone acting on this should re-verify current license text and model-card
numbers directly before any decision, exactly as the "don't trust mocked
data" rule in this project already requires for code.

## Current baseline

MoveNet SinglePose **Lightning**, COCO-17 output, Apache-2.0, TFLite via
LiteRT, ~15–50ms/inference measured on this machine (`docs/movenet_pipeline_status.md`).
192×192 input. No measured bottleneck against the 125ms/frame budget at 8fps.

## Candidate alternatives surveyed

### 1. MoveNet SinglePose **Thunder** (Google, same family)

- **What it is**: the higher-accuracy sibling already named as the natural
  comparison point in `docs/movenet_pipeline_status.md`'s own "trigger to
  revisit" note. Same COCO-17 output, same TF/LiteRT runtime, 256×256 input
  (vs. Lightning's 192×192).
- **License**: Apache-2.0 — same as the model already in use.
- **Keypoint remapping**: **none**. Identical COCO-17 index ordering, same
  official model card as the one `vision_service/config/movenet_keypoint_mapping.yaml`
  already cites. The existing YAML's `sides.{left,right}.{hip,knee,ankle}`
  indices (11/13/15, 12/14/16) apply unchanged.
- **CPU cost (per Google's own model card)**: roughly 2–4x Lightning's
  FLOPs/latency for the larger input and deeper backbone — documented as a
  speed/accuracy trade, not a free upgrade. On this machine's measured
  15–50ms Lightning baseline, Thunder would plausibly land somewhere in the
  30–150ms range; still likely inside the 125ms budget, but with much less
  margin, and this is an estimate, not something measured here.
- **Accuracy signal**: Google's model card reports Thunder with higher PCK
  (percentage of correct keypoints) than Lightning, particularly on harder
  poses and smaller/occluded joints — plausibly relevant to ankle keypoints
  during knee extension (ankle often partially occluded or near frame edge
  in a seated exercise setup).
- **Why it's the lowest-friction candidate**: zero remapping, zero new
  license review, same runtime code path (`movenet_runner.py` already reads
  `movenet_model_name`/`movenet_model_path` from config) — only the model
  file and `INPUT_SIZE` constant would need to change, and the existing
  keypoint-mapping YAML's `required_confidence`/version-gating logic needs
  no change at all.

### 2. BlazePose / MediaPipe Pose (Google)

- **What it is**: Google's other pretrained pose family, used in MediaPipe.
  Full/lite/heavy variants, designed for mobile/CPU.
- **License**: Apache-2.0.
- **Keypoint remapping**: **required**. BlazePose outputs 33 landmarks, not
  COCO-17 — different count and ordering (includes extra foot/heel points
  not in COCO). The hip/knee/ankle indices in `movenet_keypoint_mapping.yaml`
  do not carry over; a new mapping file (new `version`, per the adapter's
  existing versioning design in `keypoint_adapter.py`) and a fresh
  engineering visual-review pass (same kind already done for MoveNet, per
  the YAML's own `notes` field) would be needed before this could be used,
  per the "never guess pose keypoint indices" rule.
- **CPU cost**: BlazePose's own documentation reports "lite" variants
  competitive with or faster than MoveNet Lightning on mobile CPUs; "full"/
  "heavy" variants trade speed for accuracy, similar to the Lightning/
  Thunder trade-off.
- **Accuracy signal**: the extra foot-area landmarks (heel, foot index)
  could in principle sharpen ankle-angle measurement for a knee-extension
  exercise, but this is speculative without an actual side-by-side.

### 3. RTMPose (OpenMMLab / MMPose)

- **What it is**: a 2023 lightweight pose-estimation family from the MMPose
  project, published with an explicit focus on real-time CPU/mobile
  deployment (`rtmpose-t`/`-s`/`-m` variants), COCO-17 keypoint output by
  default.
- **License**: Apache-2.0 for the MMPose codebase/framework; individual
  pretrained checkpoints' license terms should be re-checked on the actual
  Hub/repo page before any use, since checkpoint licensing can differ from
  code licensing and depends on the training dataset's own terms (COCO
  annotations are CC BY 4.0; underlying COCO images have mixed per-image
  licenses) — this needs verification, not an assumption, exactly per
  `AGENTS.md`'s dataset-license rule.
- **Keypoint remapping**: **likely none to minimal**. Default RTMPose
  configs use standard COCO-17 ordering, the same ordering the project's
  YAML already encodes — but the exact output tensor layout (and whether a
  given exported/converted CPU build keeps that ordering) would need
  confirming against the specific checkpoint and export path, not assumed.
- **CPU cost**: the RTMPose paper reports tiny/small variants targeting
  single-digit-to-low-double-digit millisecond CPU latency in their own
  benchmarks (different hardware than this project's; not independently
  reproduced here).
- **Accuracy signal**: published COCO keypoint AP for RTMPose variants is
  reported higher than MoveNet Lightning's at comparable latency tiers —
  but this project has no MoveNet LiteRT-vs-RTMPose-TFLite/ONNX head-to-head,
  and "a paper's own benchmark on different hardware" is not evidence of a
  gain on this machine or on seated-knee-extension footage specifically.

### 4. YOLOv8-Pose / YOLO11-Pose (Ultralytics)

- **What it is**: pose heads on the YOLO detection family, COCO-17 output,
  several size tiers (n/s/m/l/x) trading CPU cost for accuracy.
- **License**: **AGPL-3.0** for the open-source code and default pretrained
  weights, with a separate paid Ultralytics Enterprise license required for
  closed-source commercial use. This is a real license blocker worth
  flagging on its own, independent of accuracy: RehabLoop would need either
  to open-source under AGPL terms or buy a commercial license before
  shipping this, which is a business decision, not an engineering one.
- **Keypoint remapping**: **none** — COCO-17, same ordering as MoveNet's
  model card.
- **CPU cost / accuracy**: the nano (`n`) tier is documented as roughly
  comparable in latency to MoveNet Lightning on CPU; published COCO
  keypoint AP for the larger tiers exceeds Lightning's, at correspondingly
  higher CPU cost. Given the license issue above, this one is noted for
  completeness rather than as a practical candidate right now.

## Summary table

| Model | License | Remap needed? | CPU cost vs. Lightning | Notable blocker |
|---|---|---|---|---|
| MoveNet Thunder | Apache-2.0 | None | ~2–4x (documented, not measured) | Reduced latency margin |
| BlazePose | Apache-2.0 | Yes (33 vs 17 pts) | Lite ≈ comparable; full/heavy higher | New mapping + visual review needed |
| RTMPose | Apache-2.0 (framework); verify checkpoint terms | Likely none–minimal | Tiny/small reported low-ms | License/provenance of specific checkpoint unverified |
| YOLOv8/11-Pose | AGPL-3.0 (or paid commercial) | None | n-tier ≈ comparable; larger tiers higher | License cost/obligation, not technical |

## Verdict

Not justified right now. The project's own measured numbers
(15–50ms against a 125ms budget) show no bottleneck to fix, and every
alternative surveyed here carries a real cost MoveNet Lightning doesn't:
either a license question to resolve (RTMPose checkpoint provenance,
YOLOv8-Pose's AGPL/commercial terms) or a keypoint remapping plus a fresh
clinical-engineering visual review (BlazePose), or a latency-margin
reduction with no measured accuracy gain on this project's own footage
(Thunder). If accuracy — not speed — ever becomes a documented problem
(e.g. systematic ankle-angle error observed against a ground-truth
reference like UI-PRMD's Vicon/Kinect joint angles, already catalogued in
`docs/rehab_dataset_landscape.md`), MoveNet Thunder is the lowest-friction
first thing to try, since it is same-license, same-runtime, and
zero-remapping — but that is a future bake-off to run with real measurement
data, not a change to make now.
