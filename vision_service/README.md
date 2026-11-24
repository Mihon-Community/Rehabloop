# RehabLoop vision service (Lennox, `feature/lennox`)

Standalone FastAPI pose service. `VISION_MODE=fixture` (default) replays labelled
synthetic keypoints and marks **every** response `simulated: true`. Real
`VISION_MODE=sapiens` requires approved checkpoints and a resolved keypoint
mapping; it fails with `vision service unavailable` otherwise.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8001
pytest && ruff check . && mypy app
```

Never guess Sociopticon indices — see `config/keypoint_mapping.yaml` (placeholder).
