"""Explicit live check for NVIDIA model discovery and a numeric-only summary."""

from __future__ import annotations

import asyncio
import re
import sys
from pathlib import Path
from time import perf_counter
from typing import Any

import httpx

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import Settings  # noqa: E402
from app.services.nvidia_summary import generate_summary  # noqa: E402
from app.services.schemas_metrics import SessionMetrics  # noqa: E402


def select_instruct_model(model_ids: list[str], preferred: str = "") -> str:
    """Choose a listed instruct model without pinning an ID in source code."""
    if preferred and preferred in model_ids:
        return preferred

    candidates = [
        model_id
        for model_id in model_ids
        if "instruct" in model_id.lower()
        and not any(term in model_id.lower() for term in ("embed", "reward", "guard"))
    ]
    if not candidates:
        raise RuntimeError("The model catalog returned no instruct models")

    def score(model_id: str) -> tuple[float, int, str]:
        normalized = model_id.lower()
        size_match = re.search(r"(?<!\d)(\d+(?:\.\d+)?)\s*b", normalized)
        size = float(size_match.group(1)) if size_match else 0.0
        family_score = int(any(term in normalized for term in ("llama", "nemotron", "qwen")))
        return (size, family_score, model_id)

    return max(candidates, key=score)


async def run_smoke_test() -> tuple[str, float]:
    settings = Settings(_env_file=REPO_ROOT / ".env")
    api_key = settings.nvidia_api_key.get_secret_value()
    if not api_key:
        raise RuntimeError("NVIDIA_API_KEY is not configured")

    headers = {"Authorization": f"Bearer {api_key}"}
    timeout = httpx.Timeout(connect=5.0, read=20.0, write=5.0, pool=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(
            f"{settings.nvidia_base_url.rstrip('/')}/models", headers=headers
        )
        if response.status_code != 200:
            raise RuntimeError(f"NVIDIA model catalog returned HTTP {response.status_code}")
        payload: Any = response.json()

    entries = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(entries, list):
        raise RuntimeError("NVIDIA model catalog response has an unexpected shape")
    model_ids = [
        item["id"] for item in entries if isinstance(item, dict) and isinstance(item.get("id"), str)
    ]
    selected = select_instruct_model(model_ids, settings.nvidia_model_id)

    sample = SessionMetrics(
        completed_reps=4,
        target_reps=8,
        projected_knee_angle_min_deg=72.0,
        projected_knee_angle_max_deg=118.0,
        target_range_hit_count=4,
        usable_frame_pct=92.0,
        session_duration_seconds=95.0,
    )
    selected_settings = settings.model_copy(update={"nvidia_model_id": selected})
    started = perf_counter()
    result = await generate_summary(sample, selected_settings)
    latency_ms = (perf_counter() - started) * 1000
    if result.source != "nvidia" or result.model_id != selected:
        raise RuntimeError("The live response did not pass summary validation")
    return selected, latency_ms


def main() -> int:
    try:
        model_id, latency_ms = asyncio.run(run_smoke_test())
    except Exception as exc:  # noqa: BLE001 - sanitize all live failure details
        print(f"live_test=failed ({type(exc).__name__}); no credential or response was printed")
        print("If /models is unavailable, select an instruct model from NVIDIA API Catalog docs.")
        return 1

    print(f"selected_model={model_id}")
    print("live_summary=passed")
    print(f"observed_latency_ms={latency_ms:.0f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
