"""Constrained NVIDIA summary layer. Numeric metrics in, validated text out."""

from __future__ import annotations

import json
import re
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx

from ..core.config import Settings
from ..schemas.summary import SummaryContent, SummaryResult
from .schemas_metrics import SessionMetrics

NON_CLINICAL_DISCLAIMER = (
    "RehabLoop provides non-clinical measurements; "
    "a qualified clinician interprets this information."
)

# Match concepts, including common inflections, while allowing ordinary phrases such as
# "a clinician can review this session".
DISALLOWED_CLAIMS = re.compile(
    r"\b(?:diagnos\w*|treat\w*|prescri\w*|medicat\w*|prognos\w*|recover\w*|"
    r"adv(?:ice|is\w*)|suggest\w*|recommend\w*|should|must|ought|try|"
    r"progress(?:ion|ive|ed)?\s+(?:the\s+)?exercise|new\s+exercise|"
    r"increase\s+(?:the\s+)?(?:reps|load|range)|decrease\s+(?:the\s+)?(?:reps|load|range)|"
    r"medically\s+safe|treatment\s+effectiveness)\b",
    re.IGNORECASE,
)
NUMBER_PATTERN = re.compile(r"(?<![\w.])-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(?![\w.])")
NUMBER_WORDS = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fifty": 50,
    "sixty": 60,
    "seventy": 70,
    "eighty": 80,
    "ninety": 90,
}
NUMBER_WORD_PATTERN = re.compile(
    r"\b(?:" + "|".join(NUMBER_WORDS) + r")\b",
    re.IGNORECASE,
)


def build_prompt(metrics: SessionMetrics) -> tuple[str, str]:
    """Build a prompt from the minimised metrics object only."""
    system = (
        "Explain only the supplied numeric session measurements in neutral, non-clinical language. "
        "Do not diagnose, advise treatment, change exercise or protocol parameters, discuss "
        "medication, or predict recovery. Do not add numbers. Return one JSON object with exactly "
        "these keys: headline, what_was_measured, observed_values, data_quality_note, "
        "clinician_review_note. observed_values must be an array of strings."
    )
    user = json.dumps(metrics.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    return system, user


def _summary_text(content: SummaryContent) -> str:
    return " ".join(
        [
            content.headline,
            content.what_was_measured,
            *content.observed_values,
            content.data_quality_note,
            content.clinician_review_note,
        ]
    )


def validate_summary(payload: dict[str, Any], metrics: SessionMetrics) -> SummaryContent | None:
    """Validate shape, safety language, and every number against input metrics."""
    try:
        content = SummaryContent.model_validate(payload)
    except (TypeError, ValueError):
        return None

    text = _summary_text(content)
    if DISALLOWED_CLAIMS.search(text):
        return None

    canonical_numbers = {
        Decimal(str(value))
        for value in metrics.model_dump().values()
        if isinstance(value, (int, float)) and not isinstance(value, bool)
    }
    for token in NUMBER_PATTERN.findall(text):
        try:
            value = Decimal(token)
        except InvalidOperation:
            return None
        if value not in canonical_numbers:
            return None
    for token in NUMBER_WORD_PATTERN.findall(text):
        if Decimal(NUMBER_WORDS[token.lower()]) not in canonical_numbers:
            return None
    return content


def deterministic_summary(metrics: SessionMetrics) -> SummaryResult:
    """Build a stable, non-clinical summary without claiming persistence."""
    if metrics.projected_knee_angle_min_deg is None or metrics.projected_knee_angle_max_deg is None:
        angle_note = (
            "Projected angle range was unavailable because no valid estimates were collected."
        )
    else:
        angle_note = (
            "The projected angle range recorded was "
            f"{metrics.projected_knee_angle_min_deg:g} to "
            f"{metrics.projected_knee_angle_max_deg:g} degrees."
        )
    return SummaryResult(
        headline="Session measurements recorded",
        what_was_measured=(
            "The application measured projected knee movement and counted completed repetitions."
        ),
        observed_values=[
            f"{metrics.completed_reps} of {metrics.target_reps} configured "
            "repetitions were counted.",
            angle_note,
        ],
        data_quality_note=(
            f"{metrics.usable_frame_pct:g}% of sampled frames met the configured landmark "
            "quality checks."
        ),
        clinician_review_note=(
            "The assigned physiotherapist can review this session alongside the care plan."
        ),
        source="deterministic_fallback",
        model_id=None,
        disclaimer=NON_CLINICAL_DISCLAIMER,
        generated_by="deterministic",
    )


async def generate_summary(
    metrics: SessionMetrics,
    settings: Settings,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> SummaryResult:
    """Call NVIDIA once, retry once after any failure, then use a safe template."""
    if not settings.nvidia_api_key.get_secret_value() or not settings.nvidia_model_id:
        return deterministic_summary(metrics)

    system, user = build_prompt(metrics)
    timeout = httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0)
    for _attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=timeout, transport=transport) as client:
                response = await client.post(
                    f"{settings.nvidia_base_url.rstrip('/')}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.nvidia_api_key.get_secret_value()}"
                    },
                    json={
                        "model": settings.nvidia_model_id,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": user},
                        ],
                    },
                )
                response.raise_for_status()
                raw_content = response.json()["choices"][0]["message"]["content"]
                validated = validate_summary(json.loads(raw_content), metrics)
                if validated is None:
                    continue
            return SummaryResult(
                **validated.model_dump(),
                source="nvidia",
                model_id=settings.nvidia_model_id,
                disclaimer=NON_CLINICAL_DISCLAIMER,
                generated_by="nvidia",
            )
        except Exception:  # noqa: BLE001 - every provider, parsing, or client failure retries once
            continue

    return deterministic_summary(metrics)
