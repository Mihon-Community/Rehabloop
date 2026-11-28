"""Constrained NVIDIA summary layer. Numeric metrics in, validated text out."""

from __future__ import annotations

import json
import logging
import re
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx

from ..core.config import Settings
from ..schemas.summary import SummaryContent, SummaryResult
from .schemas_metrics import SessionMetrics

_logger = logging.getLogger(__name__)

NON_CLINICAL_DISCLAIMER = (
    "RehabLoop provides non-clinical measurements; "
    "a qualified clinician interprets this information."
)
# Fixed, never model-generated: DISALLOWED_CLAIMS blocks explicit diagnosis/
# recovery words, but a provider can still phrase this field as dismissing
# clinician review (e.g. "no review required") without tripping that regex.
# Treat it the same as the disclaimer — a constant safety contract, not prose
# the provider gets to choose.
CLINICIAN_REVIEW_NOTE = (
    "The assigned physiotherapist can review this session alongside the care plan."
)

# Match concepts, including common inflections, while allowing ordinary phrases such as
# "a clinician can review this session".
#
# better/worse/improv*/worsen*/declin*/regress* were added alongside the
# session-to-session comparison feature (build_prompt's previous_metrics):
# AGENTS.md requires cross-session changes to be reported as plain numbers,
# never as whether the patient got better or worse, and those are exactly the
# words a model reaches for when asked to compare two values. recover* already
# covered "recovering" but not this vocabulary.
DISALLOWED_CLAIMS = re.compile(
    r"\b(?:diagnos\w*|treat\w*|prescri\w*|medicat\w*|prognos\w*|recover\w*|"
    r"adv(?:ice|is\w*)|suggest\w*|recommend\w*|should|must|ought|try|"
    r"progress(?:ion|ive|ed)?\s+(?:the\s+)?exercise|new\s+exercise|"
    r"increase\s+(?:the\s+)?(?:reps|load|range)|decrease\s+(?:the\s+)?(?:reps|load|range)|"
    r"medically\s+safe|treatment\s+effectiveness|"
    r"better|worse|worsen\w*|improv\w*|declin\w*|regress\w*)\b",
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


def build_prompt(
    metrics: SessionMetrics, previous_metrics: SessionMetrics | None = None
) -> tuple[str, str]:
    """Build a prompt from the minimised metrics object, and optionally the
    same patient's previous completed session on the same protocol.

    previous_metrics changes only the user message's shape (adds a sibling
    "previous" key) and appends one system instruction block; the single-
    session prompt below is unchanged when it is None, so existing behaviour
    and tests are unaffected.
    """
    # The formatting sentences exist because the safety rules alone pushed models
    # into emitting observed_values as a bare list of digits — valid, and
    # useless to read. No example values are given here on purpose: a model that
    # copies an illustrative number would introduce a figure the session never
    # recorded, and validate_summary would then reject the whole response.
    #
    # "write the value itself as digits" is load-bearing, not styling. Asking
    # for units as English words without it made the model spell the numbers
    # out too ("one hundred eighteen point zero degrees"), which
    # NUMBER_WORD_PATTERN rejects — so the whole summary silently fell back to
    # the deterministic template. Measured against the live provider; keep the
    # digits instruction if this prompt is reworded.
    system = (
        "Explain only the supplied numeric session measurements in neutral, non-clinical language. "
        "Do not diagnose, advise treatment, change exercise or protocol parameters, discuss "
        "medication, or predict recovery. Do not add numbers. Return one JSON object with exactly "
        "these keys: headline, what_was_measured, observed_values, data_quality_note, "
        "clinician_review_note. Every field must refer to the specific values supplied below, not "
        "to session data in the abstract: prefer naming completed repetitions against target "
        "repetitions, the span between the lowest and highest projected knee angle, the "
        "percentage of usable frames, or the session duration, over generic phrasing such as "
        "'session metrics' or 'performance data'. headline must name at least one specific "
        "supplied value. what_was_measured must name the measurement categories actually present "
        "below, not a generic description. data_quality_note must describe what the supplied "
        "usable-frames percentage indicates about how much of the session was usable. Never use "
        "the literal field names below (the snake_case keys such as completed_reps or "
        "usable_frame_pct) in any field — always translate them into plain English words. "
        "observed_values must be an array of strings. "
        "Write each observed_values entry as a short readable phrase naming the measurement, the "
        "value supplied for it, and its unit, taking the unit from the field name: deg means "
        "degrees, pct means percent, seconds means seconds. Always write the value itself as "
        "digits. A bare list of numbers is not an "
        "acceptable answer. Reuse only the values given in the user message and never round, "
        "recompute or infer a figure. Describe angles as projected estimates from one camera "
        "view, not validated anatomical measurements."
    )
    if previous_metrics is None:
        user = json.dumps(metrics.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
        return system, user

    # AGENTS.md permits reporting a measured change across sessions, but only
    # as the two numbers themselves — never as whether it represents recovery,
    # progression, or improvement. Stating both raw values instead of a
    # computed difference keeps every number traceable to something the
    # session actually recorded, which is what validate_summary checks below.
    system += (
        " The user message also supplies this same patient's previous completed session on the "
        "same protocol, nested under previous, alongside this session's measurements nested under "
        "current. Every observed_values entry must compare current against previous for that "
        "measurement, not state the current value alone — do not put the comparison in "
        "clinician_review_note or any other field, only in observed_values. For every measurement "
        "that exists in both current and previous, state the two supplied numbers side by side as "
        "a plain comparison, for example naming the current value and the previous value for the "
        "same measurement. Never compute, round, or state a "
        "difference, percentage change, or rate of change — state only the two numbers exactly as "
        "supplied. Never describe the comparison as better, worse, improved, declined, progress, "
        "or regression, and never say whether it is a good or bad sign — state only that the two "
        "measured values are what they are. If a measurement in current has no matching value in "
        "previous, describe only the current value for it."
    )
    user = json.dumps(
        {
            "current": metrics.model_dump(mode="json"),
            "previous": previous_metrics.model_dump(mode="json"),
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return system, user


def summary_response_format() -> dict[str, Any]:
    """Ask compatible providers to constrain output to the exact summary schema."""
    return {
        "type": "json_schema",
        "json_schema": {
            "name": "rehabloop_summary",
            "strict": True,
            "schema": SummaryContent.model_json_schema(),
        },
    }


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


def validate_summary(
    payload: dict[str, Any],
    metrics: SessionMetrics,
    previous_metrics: SessionMetrics | None = None,
) -> SummaryContent | None:
    """Validate shape, safety language, and every number against input metrics.

    When previous_metrics is supplied, its values are canonical too, so a
    valid session-to-session comparison is not rejected as "an invented
    number" — but build_prompt never asks for anything except those two
    literal sets, so nothing outside them is ever legitimate here.
    """
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
    if previous_metrics is not None:
        canonical_numbers |= {
            Decimal(str(value))
            for value in previous_metrics.model_dump().values()
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
        clinician_review_note=CLINICIAN_REVIEW_NOTE,
        source="deterministic_fallback",
        model_id=None,
        disclaimer=NON_CLINICAL_DISCLAIMER,
        generated_by="deterministic",
    )


async def generate_summary(
    metrics: SessionMetrics,
    settings: Settings,
    *,
    previous_metrics: SessionMetrics | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> SummaryResult:
    """Call NVIDIA once, retry once after any failure, then use a safe template.

    previous_metrics, when supplied, is the same patient's previous completed
    session on the same protocol — see build_prompt for how that changes the
    request. The deterministic fallback stays single-session: it is a fixed
    template with no model risk, but comparison text is exactly the kind of
    prose this project writes by hand and reviews, not something to add to a
    hard-coded string casually.
    """
    if not settings.nvidia_api_key.get_secret_value() or not settings.nvidia_model_id:
        return deterministic_summary(metrics)

    system, user = build_prompt(metrics, previous_metrics)
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
                        "response_format": summary_response_format(),
                        "stream": False,
                        "temperature": 0.1,
                        "max_tokens": 512,
                    },
                )
                response.raise_for_status()
                raw_content = response.json()["choices"][0]["message"]["content"]
                validated = validate_summary(json.loads(raw_content), metrics, previous_metrics)
                if validated is None:
                    # Rejected by the safety/number checks, not a transport
                    # failure. Never log the text itself — it is unvalidated
                    # provider output.
                    _logger.warning(
                        "NVIDIA summary rejected by validation (model=%s, attempt=%d)",
                        settings.nvidia_model_id,
                        _attempt + 1,
                    )
                    continue
            return SummaryResult(
                **validated.model_dump(exclude={"clinician_review_note"}),
                source="nvidia",
                model_id=settings.nvidia_model_id,
                disclaimer=NON_CLINICAL_DISCLAIMER,
                clinician_review_note=CLINICIAN_REVIEW_NOTE,
                generated_by="nvidia",
            )
        except Exception as exc:  # noqa: BLE001 - any provider/parsing/client failure retries once
            # Without this the fallback is indistinguishable from success:
            # a bad model id, an expired key and a read timeout all produced
            # the same silent deterministic template, which is why the
            # provider path was unverifiable for so long. Log the failure
            # class only — never the response body or the API key.
            status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else None
            _logger.warning(
                "NVIDIA summary attempt %d/2 failed (model=%s, error=%s, status=%s)",
                _attempt + 1,
                settings.nvidia_model_id,
                type(exc).__name__,
                status,
            )
            continue

    _logger.warning(
        "NVIDIA summary unavailable after 2 attempts (model=%s); using deterministic template",
        settings.nvidia_model_id,
    )
    return deterministic_summary(metrics)
