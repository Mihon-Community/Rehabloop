import type { MeasurementEvent, QualityWarningEvent } from '../../types';

/**
 * SIMULATED fixture events for UI development. Every event is explicitly
 * labelled; this is NOT real Sapiens2 inference and must never be displayed
 * as such. Keep these in sync with docs/api_contract.md.
 */
export const SIMULATED_LABEL = 'SIMULATED — synthetic fixture, not real inference';

export const mockMeasurements: MeasurementEvent[] = [
  {
    type: 'measurement',
    sequence: 1,
    timestamp_ms: 0,
    projected_knee_angle_deg: 72.4,
    rep_count: 0,
    state: 'REST',
    quality: { usable: true, reason: null, confidence: 0.93 },
    model_version: 'fixture-simulated',
    simulated: true,
  },
  {
    type: 'measurement',
    sequence: 2,
    timestamp_ms: 500,
    projected_knee_angle_deg: 96.1,
    rep_count: 0,
    state: 'EXTENDING',
    quality: { usable: true, reason: null, confidence: 0.91 },
    model_version: 'fixture-simulated',
    simulated: true,
  },
  {
    type: 'measurement',
    sequence: 3,
    timestamp_ms: 1000,
    projected_knee_angle_deg: 118.2,
    rep_count: 0,
    state: 'TARGET_HOLD',
    quality: { usable: true, reason: null, confidence: 0.9 },
    model_version: 'fixture-simulated',
    simulated: true,
  },
  {
    type: 'measurement',
    sequence: 4,
    timestamp_ms: 1500,
    projected_knee_angle_deg: 73.0,
    rep_count: 1,
    state: 'RETURNING',
    quality: { usable: true, reason: null, confidence: 0.88 },
    model_version: 'fixture-simulated',
    simulated: true,
  },
];

export const mockQualityWarnings: QualityWarningEvent[] = [
  {
    type: 'quality_warning',
    sequence: 42,
    reason: 'ANKLE_LANDMARK_LOW_CONFIDENCE',
    message: 'Move until the full lower leg is visible.',
    rep_count: 3,
    simulated: true,
  },
  {
    type: 'quality_warning',
    sequence: 43,
    reason: 'MULTIPLE_PERSONS_DETECTED',
    message: 'Ask the other person to leave the frame before measuring.',
    rep_count: 3,
    simulated: true,
  },
];

/** One-shot async generator so screens can exercise loading/stream states. */
export async function* mockEventStream(): AsyncGenerator<MeasurementEvent | QualityWarningEvent> {
  for (const event of [...mockMeasurements, ...mockQualityWarnings]) {
    yield event;
  }
}
