# Synthetic keypoint sequences

Labelled, deterministic 2D landmarks for engine and fixture-mode checks. These
files contain no person, patient, approved footage, or live model output.

- `clean_8_reps.json` — eight full cycles.
- `noisy.json` — the same cycles with seeded sub-degree jitter.
- `dropout.json` — an occlusion interrupts a partial cycle; only the later full
  cycle may count.
- `low_confidence.json` — required landmarks fail the confidence gate.
- `partial_reps.json` — the target is reached but not held long enough.
- `second_person_in_frame.json` — every frame has two people and must be
  rejected.
- `seated_knee_extension_synthetic.json` — original four-frame illustrative
  trace.

Regenerate the six current fixtures with:

```powershell
python backend/scripts/generate_synthetic_fixtures.py
```

Every consumer must preserve the top-level `simulated: true` label. Coordinate
values and configured angle bands are engineering fixtures, not clinical
thresholds or model-accuracy evidence.
