"""Opt-in smoke check; live requests are always disabled in CI."""

from __future__ import annotations

import asyncio
import os

import pytest
from scripts.nvidia_smoke_test import run_smoke_test

_CI = os.environ.get("CI", "").strip().lower() in {"1", "true", "yes"}
_LIVE_ENABLED = os.environ.get("RUN_NVIDIA_LIVE") == "1" and not _CI


@pytest.mark.live
@pytest.mark.skipif(not _LIVE_ENABLED, reason="live NVIDIA checks are opt-in and disabled in CI")
def test_nvidia_live_summary() -> None:
    model_id, latency_ms = asyncio.run(run_smoke_test())
    assert model_id
    assert latency_ms > 0
