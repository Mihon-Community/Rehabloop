"""Mocked HTTP checks for the constrained NVIDIA summary layer."""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest
from app.core.config import Settings
from app.services.nvidia_summary import (
    CLINICIAN_REVIEW_NOTE,
    NON_CLINICAL_DISCLAIMER,
    build_prompt,
    generate_summary,
    summary_response_format,
    validate_summary,
)
from app.services.schemas_metrics import SessionMetrics
from scripts.nvidia_smoke_test import LiveSmokeFailure, select_summary_model

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

PREVIOUS_METRICS = SessionMetrics(
    completed_reps=2,
    target_reps=8,
    projected_knee_angle_min_deg=75.0,
    projected_knee_angle_max_deg=115.0,
    target_range_hit_count=1,
    usable_frame_pct=92.0,
    session_duration_seconds=55.0,
)


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


def test_live_model_selection_excludes_instruct_named_translation_models() -> None:
    catalog = [
        "nvidia/riva-translate-4b-instruct-v2",
        "nvidia/nemotron-3.5-bolt-e4b",
    ]
    assert select_summary_model(catalog) == "nvidia/nemotron-3.5-bolt-e4b"
    with pytest.raises(LiveSmokeFailure, match="not_schema_approved"):
        select_summary_model(catalog, "nvidia/riva-translate-4b-instruct-v2")


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
    assert body["response_format"] == summary_response_format()
    assert body["stream"] is False
    assert "Authorization" in seen[0].headers


def test_clinician_review_note_is_never_provider_controlled() -> None:
    """Regression: a provider note can dismiss clinician review (e.g. "no review
    required") without tripping DISALLOWED_CLAIMS, since that phrase matches no
    banned word. This field must always be the fixed safety note instead."""
    content = {**VALID_CONTENT, "clinician_review_note": "No review is required for this session."}
    assert validate_summary(content, METRICS) is not None  # passes the regex/number gate

    def handler(_request: httpx.Request) -> httpx.Response:
        return _provider_response(content)

    result = asyncio.run(
        generate_summary(METRICS, _settings(), transport=httpx.MockTransport(handler))
    )
    assert result.source == "nvidia"
    assert result.clinician_review_note == CLINICIAN_REVIEW_NOTE


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


def test_single_session_prompt_is_unchanged_without_previous_metrics() -> None:
    """Regression: adding the comparison feature must not alter the existing,
    already-tested single-session request shape."""
    _, user = build_prompt(METRICS)
    assert json.loads(user) == METRICS.model_dump(mode="json")


def test_comparison_prompt_nests_current_and_previous() -> None:
    system, user = build_prompt(METRICS, PREVIOUS_METRICS)
    assert json.loads(user) == {
        "current": METRICS.model_dump(mode="json"),
        "previous": PREVIOUS_METRICS.model_dump(mode="json"),
    }
    assert "never" in system.lower() and "difference" in system.lower()


def test_validate_summary_allows_a_previous_value_only_when_previous_is_supplied() -> None:
    # 92.0 is only in PREVIOUS_METRICS's usable_frame_pct, not METRICS's.
    content = {**VALID_CONTENT, "headline": "Usable frames were 92.0 percent."}
    assert validate_summary(content, METRICS) is None
    assert validate_summary(content, METRICS, PREVIOUS_METRICS) is not None


def test_validate_summary_rejects_comparison_verdict_language() -> None:
    """Regression: a model comparing two sessions reaches for "better/worse/
    improved" rather than diagnosis/recovery words, and nothing caught that
    before DISALLOWED_CLAIMS was extended for this feature."""
    for phrase in (
        "Usable frames improved to 92.0 percent.",
        "The range got worse this session.",
        "Repetitions declined from 2 to 4.",
        "This is a regression in range of motion.",
    ):
        content = {**VALID_CONTENT, "headline": phrase}
        assert validate_summary(content, METRICS, PREVIOUS_METRICS) is None, phrase


def test_generate_summary_sends_both_sessions_when_previous_is_supplied() -> None:
    seen: list[httpx.Request] = []
    comparison_content = {
        **VALID_CONTENT,
        "headline": "Repetitions were 4 this session and 2 previously.",
    }

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return _provider_response(comparison_content)

    result = asyncio.run(
        generate_summary(
            METRICS,
            _settings(),
            previous_metrics=PREVIOUS_METRICS,
            transport=httpx.MockTransport(handler),
        )
    )

    assert result.source == "nvidia"
    body = json.loads(seen[0].content)
    sent_user = json.loads(body["messages"][1]["content"])
    assert sent_user == {
        "current": METRICS.model_dump(mode="json"),
        "previous": PREVIOUS_METRICS.model_dump(mode="json"),
    }


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
