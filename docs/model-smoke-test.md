# Model smoke test — MoveNet SinglePose Lightning

Owner: Lennox. This is the default real pose model for CPU inference. The
[official model card](https://storage.googleapis.com/movenet/MoveNet.SinglePose%20Model%20Card.pdf)
specifies a 192×192 RGB input, 17 COCO keypoints, and confidence scores. The
model is licensed under Apache 2.0. See also
[TensorFlow's MoveNet guide](https://www.tensorflow.org/hub/tutorials/movenet).

## Fixture path

The normal local workflow defaults to `VISION_MODE=fixture`; fixture responses
are always marked `simulated: true`. Use this for UI and pipeline work without
camera images or model weights.

## CPU MoveNet path

MoveNet SinglePose Lightning is intended for latency-sensitive movement and
fitness applications. It returns one pose. When multiple people appear, it may
focus on the person closest to the image center; it does not provide reliable
multi-person selection or tracking. Treat its keypoints as estimates, not
validated anatomical measurements.

1. Download the official TensorFlow Hub LiteRT/TFLite artifact to a directory
   outside the repository. The model is Apache-2.0 licensed:

   ```text
   https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/float16/4?lite-format=tflite
   ```

2. Set these values in the gitignored root `.env`:

   | Variable | Meaning |
   |---|---|
   | `VISION_MODE=movenet` | Enables real MoveNet inference |
   | `VISION_DEVICE=cpu` | Uses the CPU runtime |
   | `MOVENET_MODEL_ROOT` | Host directory containing `movenet_singlepose_lightning.tflite` |
   | `MOVENET_MODEL_PATH=/models/movenet_singlepose_lightning.tflite` | Read-only container path |
   | `MOVENET_TARGET_SIDE=left` | Selects `left` or `right` leg |

   The model directory is mounted read-only. The model file must stay outside
   Git and is never copied into the Docker image.

3. Start the CPU vision service (or start the backend too if you want its API):

   ```powershell
   docker-compose -f docker-compose.yml -f docker-compose.cpu.yml up --build -d vision_service
   ```

4. Run the repeatable synthetic check from inside the container:

   ```powershell
   docker-compose -f docker-compose.yml -f docker-compose.cpu.yml exec -T vision_service python scripts/synthetic_movenet_smoke.py --url http://127.0.0.1:8001
   ```

   It checks `/health`, `/mapping`, and `/infer` using a generated 640×480
   seated figure held in memory. Expected output includes
   `valid_landmarks=3/3` and `Smoke test passed`. This verifies wiring only;
   it does not measure pose accuracy.

5. You can also open `http://localhost:8001/health` in a browser. It should
   report `mode=movenet`, `model=movenet-singlepose-lightning`, and
   `simulated=false`.

To start the backend and its required vision dependency, run:

```powershell
docker-compose -f docker-compose.yml -f docker-compose.cpu.yml up --build -d backend
```

The current frontend camera setup and live-session screens are placeholders;
they do not yet send real camera frames to the backend. Use the synthetic
service check above to verify MoveNet. Do not use it as clinical validation.

The mapping comes from the official model card's COCO-17 order: left
hip/knee/ankle = 11/13/15, right = 12/14/16. Output coordinates are mapped
back from the centered square padding to the original frame. Confidence below
0.6 marks a landmark invalid. Review synthetic overlays and movement output
before interpreting any result.

MoveNet's model licence does not replace consent, privacy, data-protection, or
clinical validation requirements. Obtain explicit consent before any
patient-facing use. Do not claim diagnosis, recovery, treatment, or clinical
accuracy based on model output.

## Optional Sapiens2 runner

The legacy Sapiens2 runner remains available in code but is not selected by the
CPU workflow. Its licence has restrictions that may prohibit biometric
processing, including rehabilitation movement analysis. Do not enable it unless
legal review confirms the exact intended use is allowed. See the
[official Sapiens2 licence](https://github.com/facebookresearch/sapiens2/blob/main/LICENSE.md).
