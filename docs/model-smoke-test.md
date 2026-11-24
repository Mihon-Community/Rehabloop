# Model smoke test — Sapiens2 Pose 0.4B (stub)

Owner: Lennox. Blueprint Section 6, Stage A and Section 14.

**Gate first:** the Sapiens2 licence restricts biometric processing and
unauthorised medical/health practice. Do not run on identifiable people until a
qualified legal/licensing review clears the intended movement-analysis use.

## Fixture path (default, no GPU/weights)

```bash
docker compose up --build
curl localhost:8001/health   # mode=fixture, simulated=true
curl -X POST localhost:8001/infer -H 'Content-Type: application/json' \
  -d '{"sequence":1,"timestamp_ms":0,"image_b64":"aGVsbG8="}'
```
Every response has `simulated: true` and `model: fixture-simulated`. This is a
UI/pipeline test, not inference evidence.

## Real path (NVIDIA Container Toolkit required)

1. Install the NVIDIA Container Toolkit on the host and verify `nvidia-smi`.
2. Obtain the licensed Sapiens2 package and the approved 0.4B pose checkpoint +
   DETR detector. Set `SAPIENS_CHECKPOINT_ROOT` to that directory. Never commit
   or download weights into the repo.
3. `docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build`.
4. Run the official demo against approved frames; record checkpoint hash,
   model version, detector, image size, driver, GPU and inference time.
5. Resolve real Sociopticon indices into `vision_service/config/keypoint_mapping.yaml`
   from the official spec; the service refuses `sapiens` mode while they are null.
6. Store the evidence in this document; report pose quality separately from
   movement-engine math accuracy and end-to-end reliability.
