# RehabLoop vision service (Lennox, `feature/lennox`)

Standalone FastAPI pose service. `VISION_MODE=fixture` (default) replays labelled
synthetic keypoints and marks **every** response `simulated: true`. Real
`VISION_MODE=movenet` uses the locally mounted MoveNet SinglePose Lightning
model on CPU. See `../docs/model-smoke-test.md` for setup, licence, and limits.

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
pytest
ruff check .
ruff format --check .
mypy app
```

MoveNet's COCO-17 mapping is listed in `config/movenet_keypoint_mapping.yaml`.
Sapiens2 remains an optional legacy runner and is licence-gated.
