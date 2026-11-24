"""Mocked HTTP checks for the constrained NVIDIA summary layer."""

from __future__ import annotations

import asyncio
import json

import httpx
from app.core.config import Settings
from app.services.nvidia_summary import (
    NON_CLINICAL_DISCLAIMER,
    generate_summary,
    validate_summary,
)
from app.services.schemas_metrics import SessionMetrics

METRICS = SessionMetrics(
    completed_reps=4,
    target_reps=8,
    projected_knee_angle_min_deg=70.0,
    projected_knee_angle_max_deg=120.5,
    target_range_hit_count=3,
    usable_frame_pct=87.5,
    session_duration_seconds=60.0,
)

VALID_CONTENT = {
    "headline": "Session measurements",
    "what_was_measured": "Projected knee movement and repetitions were measured.",
    "observed_values": ["4 of 8 configured repetitions were counted."],
    "data_quality_note": "87.5% of sampled frames met the configured checks.",
    "clinician_review_note": "The clinician can review these measurements.",
}


def _settings() -> Settings:
    return Settings(
        nvidia_api_key="test-key",
        nvidia_model_id="test/instruct-model",
        nvidia_base_url="https://nvidia.test/v1",
    )


def _provider_response(content: dict[str, object]) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "choices": [{"message": {"content": json.dumps(content)}}],
        },
    )


def test_validates_all_numbers_and_rejects_unsafe_or_extra_content() -> None:
    assert validate_summary(VALID_CONTENT, METRICS) is not None
    assert validate_summary({**VALID_CONTENT, "extra": "ignored?"}, METRICS) is None
    assert (
        validate_summary(
            {**VALID_CONTENT, "headline": "Eight configured repetitions were counted."}, METRICS
        )
        is not None
    )
    assert (
        validate_summary(
            {**VALID_CONTENT, "headline": "The 6 repetitions were successful."}, METRICS
        )
        is None
    )
    assert (
        validate_summary({**VALID_CONTENT, "headline": "Six repetitions were counted."}, METRICS)
        is None
    )
    assert (
        validate_summary(
            {**VALID_CONTENT, "clinician_review_note": "This recommends treatment."}, METRICS
        )
        is None
    )
    assert (
        validate_summary(
            {**VALID_CONTENT, "clinician_review_note": "You will recover in 3 weeks."}, METRICS
        )
        is None
    )


def test_sends_only_minimal_metrics_and_returns_validated_metadata() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return _provider_response(VALID_CONTENT)

    result = asyncio.run(
        generate_summary(METRICS, _settings(), transport=httpx.MockTransport(handler))
    )

    assert result.source == "nvidia"
    assert result.model_id == "test/instruct-model"
    assert result.generated_by == "nvidia"
    assert result.disclaimer == NON_CLINICAL_DISCLAIMER
    assert len(seen) == 1
    body = json.loads(seen[0].content)
    assert json.loads(body["messages"][1]["content"]) == METRICS.model_dump(mode="json")
    assert "Authorization" in seen[0].headers


def test_retries_once_after_provider_failure() -> None:
    calls = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(503)
        return _provider_response(VALID_CONTENT)

    result = asyncio.run(
        generate_summary(METRICS, _settings(), transport=httpx.MockTransport(handler))
    )

    assert calls == 2
    assert result.source == "nvidia"


def test_retries_invalid_summary_then_uses_deterministic_fallback() -> None:
    calls = 0
    invalid = {**VALID_CONTENT, "headline": "Completed 999 repetitions."}

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return _provider_response(invalid)

    result = asyncio.run(
        generate_summary(METRICS, _settings(), transport=httpx.MockTransport(handler))
    )

    assert calls == 2
    assert result.source == "deterministic_fallback"
    assert result.model_id is None
    assert result.generated_by == "deterministic"
    assert result.disclaimer == NON_CLINICAL_DISCLAIMER


def test_unconfigured_client_returns_deterministic_fallback() -> None:
    result = asyncio.run(
        generate_summary(
            METRICS,
            Settings(nvidia_base_url="https://nvidia.test/v1"),
        )
    )
    assert result.source == "deterministic_fallback"
    assert result.model_id is None
    assert result.disclaimer == NON_CLINICAL_DISCLAIMER
