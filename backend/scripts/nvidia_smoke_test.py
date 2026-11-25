"""Explicit live check for NVIDIA model discovery and a numeric-only summary."""

from __future__ import annotations

import asyncio
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

SUPPORTED_SUMMARY_MODELS = ("nvidia/nemotron-3.5-bolt-e4b",)


class LiveSmokeFailure(RuntimeError):
    """A sanitized live-check failure that never carries provider content."""

    def __init__(self, stage: str, reason: str) -> None:
        super().__init__(f"{stage}:{reason}")
        self.stage = stage
        self.reason = reason


def select_summary_model(model_ids: list[str], preferred: str = "") -> str:
    """Choose only a catalog-listed chat model with documented JSON-schema support."""
    available = set(model_ids)
    if preferred and preferred in model_ids:
        if preferred not in SUPPORTED_SUMMARY_MODELS:
            raise LiveSmokeFailure("selection", "configured_model_not_schema_approved")
        return preferred
    if preferred:
        raise LiveSmokeFailure("selection", "configured_model_not_listed")
    for candidate in SUPPORTED_SUMMARY_MODELS:
        if candidate in available:
            return candidate
    raise LiveSmokeFailure("selection", "no_supported_json_schema_chat_model")


async def run_smoke_test() -> tuple[str, float]:
    settings = Settings(_env_file=REPO_ROOT / ".env")
    api_key = settings.nvidia_api_key.get_secret_value()
    if not api_key:
        raise LiveSmokeFailure("configuration", "api_key_missing")

    headers = {"Authorization": f"Bearer {api_key}"}
    timeout = httpx.Timeout(connect=5.0, read=20.0, write=5.0, pool=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(
            f"{settings.nvidia_base_url.rstrip('/')}/models", headers=headers
        )
        if response.status_code != 200:
            raise LiveSmokeFailure("catalog", f"http_{response.status_code}")
        payload: Any = response.json()

    entries = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(entries, list):
        raise LiveSmokeFailure("catalog", "unexpected_response_shape")
    model_ids = [
        item["id"] for item in entries if isinstance(item, dict) and isinstance(item.get("id"), str)
    ]
    selected = select_summary_model(model_ids, settings.nvidia_model_id)

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
        raise LiveSmokeFailure("summary", "provider_result_not_accepted")
    return selected, latency_ms


def main() -> int:
    try:
        model_id, latency_ms = asyncio.run(run_smoke_test())
    except LiveSmokeFailure as exc:
        print(f"live_test=failed stage={exc.stage} reason={exc.reason}")
        print("No credential or provider response was printed.")
        return 1
    except Exception as exc:  # noqa: BLE001 - sanitize all live failure details
        print(f"live_test=failed stage=unexpected type={type(exc).__name__}")
        print("No credential or provider response was printed.")
        return 1

    # Keep the exact NVIDIA_MODEL_ID private in the ignored root .env.
    print(f"model_id_pinned={bool(model_id)}")
    print("live_summary=passed")
    print(f"observed_latency_ms={latency_ms:.0f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
