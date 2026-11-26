# MoveNet pipeline — status and measured performance

Owner: Lennox. Answers the inspection questions from the "read the project
first" ask: what's actually implemented today, measured directly against
this repo's code and against the running containers, not assumed.

## Integration facts

1. **Variant**: MoveNet SinglePose **Lightning** (not Thunder, not MultiPose).
   `vision_service/app/config.py` (`movenet_model_name`), confirmed against
   the model card URL in `vision_service/config/movenet_keypoint_mapping.yaml`.
2. **Runtime**: TFLite via Google's LiteRT (`ai_edge_litert.compiled_model`),
   CPU only. Runs entirely in `vision_service` (backend process), **not** in
   the browser — the frontend only captures and streams raw frames
   (`getUserMedia` + sampling per `docs/api_contract.md`); there is no
   in-browser pose model, so there is no training/serving runtime mismatch to
   reconcile.
3. **Input preprocessing**: `vision_service/app/movenet_runner.py` —
   base64-decoded JPEG/PNG → RGB → resize-with-pad to 192×192 (MoveNet's
   fixed input size) → raw pixel array. Frame rate is capped by
   `MAX_FRAME_RATE` (default 8 fps) and enforced server-side in the WebSocket
   handler (`backend/app/api/v1/router.py`).
4. **Keypoint output**: full COCO-17 output read from the model, then mapped
   down to three named points (`selected_hip`/`selected_knee`/`selected_ankle`)
   via `vision_service/config/movenet_keypoint_mapping.yaml` (left = indices
   11/13/15, right = 12/14/16, per the official model card). Confidence below
   `required_confidence` (0.6) marks a landmark invalid. Coordinates are
   normalized (0–1) plus pixel coordinates; `valid`/`confidence` carried
   per-point.
5. **How keypoints are consumed**: `backend/app/services/movement_engine.py` —
   confidence-gated, EMA-smoothed, a 2D projected joint angle at the knee
   (law of cosines on the hip/knee/ankle vectors), fed into a rep-counting
   state machine (`REST → EXTENDING → TARGET_HOLD → RETURNING → REST`). All
   thresholds are clinician-supplied `RepConfig` values, never hardcoded.
6. **Existing ML code/models/checkpoints**: none. There is no training
   pipeline, no PyTorch, no checkpoints directory. The only "model" in the
   repo is the pretrained, frozen MoveNet `.tflite` file (mounted from
   outside Git) — see `CLAUDE.md` for why that's deliberate, not a gap.
7. **Frontend API contracts** (`docs/api_contract.md`): the WebSocket stream
   contract (`FrameEvent` in, `MeasurementEvent`/`QualityWarningEvent` out),
   the session lifecycle state machine, and the fixed non-clinical summary
   schema are all load-bearing — any change here needs Steve's review per
   `AGENTS.md`, and nothing in this document proposes changing them.
8. **Docs vs. code discrepancies found**: none currently open. One real one
   existed and was fixed this session (not just a doc mismatch — an actual
   runtime bug): `vision_service/app/inference.py` reported the MoveNet
   YAML's mapping version even in fixture/simulated mode, while the backend
   expected a distinct value for fixture sessions, causing every fixture-mode
   frame to fail `MAPPING_VERSION_MISMATCH`. See `docs/BACKEND_STATUS.md`'s
   2026-11-26 entry for the fix and live verification.

## Measured performance (this machine, CPU-only)

Hardware: Intel Core Ultra 7 155U (12 cores), ~15.5 GB RAM, **no NVIDIA
GPU, no CUDA** (`nvidia-smi` not found). This matches the project's existing
architectural choice — `docker-compose.cpu.yml` runs MoveNet on CPU via
LiteRT, with `OMP_NUM_THREADS`/`MKL_NUM_THREADS` capped at 2 by default.

Real measured inference times against the actually-running Dockerized
vision service this session (not estimates):
- Synthetic validated test frame, in-container smoke test: **47.3 ms**
  per inference.
- Same frame via the new `video_file_replay.py` harness (24 frames): mean
  **15.8 ms** per inference.
- Prior session (`docs/BACKEND_STATUS.md`, 2026-11-25): 14.8 ms and 35.3 ms
  on separate runs.

At `MAX_FRAME_RATE=8` (the configured sampling cap), the budget per frame is
125 ms; observed inference is roughly 15–50 ms — comfortably within budget
with wide headroom, even accounting for the rest of the per-frame pipeline
(frame decode, landmark mapping, movement-engine processing, which are all
lightweight deterministic operations, not profiled separately here since
none of them have shown up as a bottleneck). **No performance optimization
work is indicated** — the existing CPU-only setup already meets the
configured frame rate with margin to spare. If a real deployment target ever
needs higher throughput or lower latency than this, that would be the
trigger to revisit (e.g. batching, a smaller input size, or the Thunder vs.
Lightning trade-off), not a default thing to chase now.

## Existing robustness coverage

`backend/scripts/generate_synthetic_fixtures.py` already produces labelled
fixtures covering several of the "edge case" categories that would
otherwise need new tests: `dropout.json` (temporary landmark/person loss),
`low_confidence.json` (unreliable landmarks), `partial_reps.json`
(incomplete repetitions), `second_person_in_frame.json` (multiple people),
`noisy.json` (coordinate/angle jitter). This already covers most of what a
"robust testing" pass would otherwise need to build from scratch for the
*measurement* pipeline (as opposed to a classifier, which doesn't exist).
