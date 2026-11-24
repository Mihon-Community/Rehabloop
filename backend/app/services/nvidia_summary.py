"""Constrained NVIDIA summary layer. Numbers in, explanatory words out.

Blueprint section 9: no diagnosis, no prescription, no invented values. The
frontend renders canonical metrics, not numbers copied from the LLM.
"""

from __future__ import annotations

import json
import re

import httpx

from ..core.config import Settings
from .schemas_metrics import SessionMetrics

DISALLOWED_CLAIMS = (
    "diagnos",
    "prescrib",
    "recommend",
    "recovered",
    "medically safe",
    "treatment effectiveness",
)


def build_prompt(metrics: SessionMetrics) -> tuple[str, str]:
    system = (
        "You explain an already-computed rehabilitation exercise session. You are not a "
        "clinician and must not diagnose, prescribe, predict recovery, or change the "
        "protocol. Use only the supplied measurements. If quality is low, say the "
        "measurement is unavailable. Return JSON only with keys: headline, "
        "what_was_measured, observed_values, data_quality_note, clinician_review_note."
    )
    user = json.dumps(metrics.model_dump(), sort_keys=True)
    return system, user


def validate_summary(payload: dict, metrics: SessionMetrics) -> bool:
    """Reject unsafe or value-changing model output."""
    required = {
        "headline",
        "what_was_measured",
        "observed_values",
        "data_quality_note",
        "clinician_review_note",
    }
    if not required.issubset(payload):
        return False
    if not isinstance(payload["observed_values"], list):
        return False
    text = " ".join(
        [str(payload.get(k, "")) for k in required if k != "observed_values"]
        + [str(v) for v in payload["observed_values"]]
    ).lower()
    if any(term in text for term in DISALLOWED_CLAIMS):
        return False
    # Any number the model states must be a canonical metric value (no invented values).
    canonical = {f"{v:g}" for v in metrics.model_dump().values() if isinstance(v, (int, float))}
    for token in re.findall(r"-?\d+(?:\.\d+)?", text):
        if token.lstrip("-") not in canonical and token not in canonical:
            return False
    return True


def deterministic_summary(metrics: SessionMetrics) -> dict:
    """Template fallback when NVIDIA is unavailable or output is rejected."""
    return {
        "headline": "Session measurements recorded",
        "what_was_measured": (
            "The application measured projected knee movement and counted completed repetitions."
        ),
        "observed_values": [
            (
                f"{metrics.completed_reps} of {metrics.target_reps} configured "
                "repetitions were counted."
            ),
            (
                "The projected angle range recorded was "
                f"{metrics.projected_knee_angle_min_deg:g} to "
                f"{metrics.projected_knee_angle_max_deg:g} degrees."
            ),
        ],
        "data_quality_note": (
            f"{metrics.usable_frame_pct:g}% of sampled frames met the configured landmark "
            "quality checks."
        ),
        "clinician_review_note": (
            "The assigned physiotherapist can review this session alongside the care plan."
        ),
        "generated_by": "deterministic",
    }


async def generate_summary(metrics: SessionMetrics, settings: Settings) -> dict:
    """Try the NVIDIA API, then fall back to the deterministic template."""
    if not settings.nvidia_api_key or not settings.nvidia_model_id:
        return deterministic_summary(metrics)
    system, user = build_prompt(metrics)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                f"{settings.nvidia_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {settings.nvidia_api_key.get_secret_value()}"},
                json={
                    "model": settings.nvidia_model_id,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "response_format": {"type": "json_object"},
                },
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            payload = json.loads(content)
        if validate_summary(payload, metrics):
            payload["generated_by"] = "nvidia"
            return payload
    except Exception:  # noqa: BLE001 - any dependency failure must fall back safely
        pass
    return deterministic_summary(metrics)
