# Model smoke test — Sapiens2 Pose 0.4B

Owner: Lennox. Blueprint Sections 6 and 14. Source of truth for the model:
`https://github.com/facebookresearch/sapiens2/blob/main/docs/POSE.md`.

**Licence gate:** the Sapiens2 licence restricts biometric processing,
identifying/re-identifying people and unlicensed medical/health practice. Do
not run on identifiable people until a legal/licensing review clears the
intended movement-analysis use.

## Fixture path (default, no GPU, no weights)

```bash
docker compose up --build
curl localhost:8001/health   # mode=fixture, simulated=true
curl -X POST localhost:8001/infer -H 'Content-Type: application/json' \
  -d '{"sequence":1,"timestamp_ms":0,"image_b64":"aGVsbG8="}'
```

Every fixture response has `simulated: true` and `model: fixture-simulated`.
It is a UI/pipeline test, never inference evidence.

## Real path

The vision service does **not** embed Sapiens2. It calls the documented
`sapiens/pose/tools/vis/vis_pose.py` CLI once per frame in a temporary
directory, reads the per-frame predictions JSON, and deletes the directory.
That tool performs DETR person detection and 308-keypoint pose inference.

**Spec divergence:** the model card mentions RTMDet for top-down pose, while
the official `POSE.md` publishes `facebook/detr-resnet-101-dc5` as the detector
and the demo script uses it. This repo follows `POSE.md`; verify before a real
run and set `SAPIENS_DETECTOR_MODEL` accordingly.

1. Choose a runtime:

   - **CPU only:** no NVIDIA setup is needed. Inference is expected to be slow
     and is intended for single-frame/offline checks, not live sessions. The
     `cpu` image uses CPU-only PyTorch wheels and limits PyTorch to two threads
     by default (`SAPIENS_CPU_THREADS` can change this).
   - **NVIDIA GPU:** install the NVIDIA driver + Container Toolkit and confirm
     a GPU is visible before using the GPU override.
2. Download approved checkpoints outside the repo (example layout from
   `POSE.md`):

   ```bash
   export SAPIENS_CHECKPOINT_ROOT=/path/to/sapiens2-host
   hf download facebook/sapiens2-pose-0.4b sapiens2_0.4b_pose.safetensors \
     --local-dir "$SAPIENS_CHECKPOINT_ROOT/pose"
   hf download facebook/detr-resnet-101-dc5 \
     --local-dir "$SAPIENS_CHECKPOINT_ROOT/detector/detr-resnet-101-dc5"
   ```

3. Obtain the licensed Sapiens2 source tree and set `SAPIENS_SOURCE_ROOT` to
   its root. It must contain `sapiens/pose/tools/vis/vis_pose.py` and the
   matching config directory. No source or weights are copied into the image.
4. Set in the gitignored `.env`:

   | Variable | Meaning |
   |---|---|
   | `VISION_MODE=sapiens` | Enables real inference |
   | `VISION_DEVICE=cpu` or `cuda` | Device passed to `vis_pose.py --device`; the Compose override selects this |
   | `SAPIENS_CHECKPOINT_ROOT` | Host checkpoint directory, mounted read-only at `/checkpoints` |
   | `SAPIENS_SOURCE_ROOT` | Host Sapiens2 source root, mounted read-only at `/sapiens` |
   | `SAPIENS_POSE_MODEL` | Default `facebook/sapiens2-pose-0.4b` |
   | `SAPIENS_DETECTOR_MODEL` | Default `facebook/detr-resnet-101-dc5` |
   | `SAPIENS_POSE_CONFIG` | Optional verified config path relative to `sapiens/pose` |
   | `SAPIENS_DATASET` | Demo dataset name used to derive the config path |
   | `SAPIENS_CHECKPOINT_FILE` | Optional checkpoint filename override |
   | `SAPIENS_TARGET_SIDE` | `left` (default) or `right` leg to map |

5. `vision_service/config/keypoint_mapping.yaml` is already resolved from the
   official `keypoints308.py`: left hip/knee/ankle = 11/13/15, right = 12/14/16.
   Status remains `...PENDING_MANUAL_REVIEW`: manually review overlays before
   trusting measurements. The service refuses to start in `sapiens` mode if
   the source, checkpoint, detector or config is missing.
6. Start with one override. The CPU target installs CPU-only PyTorch and the
   Sapiens2 runtime dependencies; the GPU target uses
   `vision_service/requirements-gpu.txt`:

   ```bash
   # CPU-only host
   docker compose -f docker-compose.yml -f docker-compose.cpu.yml up --build

   # NVIDIA host
   docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
   ```

   The CPU override requires `SAPIENS_CHECKPOINT_ROOT` and
   `SAPIENS_SOURCE_ROOT` in `.env`; it fails Compose interpolation if either is
   blank. It does not request an NVIDIA device. The source and weights remain
   read-only mounts outside the repo. If your licensed source revision needs
   additional packages, report the exact import error before changing the
   dependency list.
7. Verify: `curl localhost:8001/health` should report `mode=sapiens` and
   `simulated=false`; `POST /infer` should return `selected_hip`,
   `selected_knee` and `selected_ankle` with confidence and `valid` flags.
   A low-confidence landmark is marked invalid; low quality is never
   interpolated into a plausible-looking measurement. Multiple people or a
   missing predictions JSON produce HTTP 503 with `VISION_UNAVAILABLE`.
8. Record checkpoint hash, model version, detector, image size, CPU/GPU model,
   driver when applicable,
   and latency here. Report pose quality separately from movement-engine
   math accuracy and end-to-end reliability (blueprint Section 14).

Official demo smoke test before app integration (edit `INPUT`, `OUTPUT` and
`MODEL_NAME` in the script; the released script defaults to the 1B model):

```bash
cd "$SAPIENS_ROOT/sapiens/pose"
./scripts/demo/keypoints308.sh
```

## Verification status

The fixture path and mapping logic are covered by `vision_service/tests`.
The CPU and GPU paths have **not** been executed here: this host has no
available GPU or Docker daemon, and the Sapiens2 source and checkpoints are
absent. The ignored `.env` is prepared for the requested CPU setup, but no real
model health or inference result is available. Treat the first real run as the
smoke test that confirms dependencies, paths, performance, and output quality.

The Sapiens2 licence restricts biometric processing and places conditions on
health-data use and medical/health practice. Rehabilitation pose inference may
fall within those restrictions; legal/licensing clearance and acceptance of any
gated model terms are still required. Until then, keep to synthetic fixtures or
explicitly approved frames. See the
[official Sapiens2 licence](https://github.com/facebookresearch/sapiens2/blob/main/LICENSE.md).
