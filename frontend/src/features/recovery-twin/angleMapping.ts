import type { AngleSample } from '@/types';

/**
 * Pure geometry, frame-selection and comparison logic for the Recovery Twin.
 *
 * It lives outside the R3F component so it can be tested without a WebGL
 * context — the angle-to-pose mapping was previously an inline expression
 * inside the canvas tree, which is why a 90-degree error in it went unnoticed.
 */

/**
 * The knee angle the rig's authored rest pose represents.
 *
 * `twin-rig.glb` places HipJoint, KneeJoint and AnkleJoint at the same height
 * (y = -0.15, all at z = 0), so the loaded pose is a straight leg. The backend
 * reports `projected_knee_angle_deg` as the interior hip-knee-ankle angle —
 * `degrees(acos(...))` in `backend/app/services/movement_engine.py` — where a
 * straight leg is 180 degrees and smaller values mean more flexion. The rep
 * state machine agrees: it treats a rising angle as EXTENDING.
 *
 * So the rest pose is 180 degrees, NOT 90.
 */
export const REST_POSE_ANGLE_DEG = 180;

/** Clinically meaningful bounds of the interior knee angle. */
export const MIN_ANGLE_DEG = 0;
export const MAX_ANGLE_DEG = 180;

/**
 * Hinge rotation, in degrees, for a measured knee angle.
 *
 * Negative rotates the shin down from straight, which is flexion: the rig's
 * hinge is such that a negative world-Z rotation lowers the lower leg. The
 * result is therefore always <= 0 — the schematic can never render the knee
 * extended past straight, which the previous mapping did on every repetition.
 */
export function kneeRotationDeg(angleDeg: number): number {
  const clamped = Math.min(Math.max(angleDeg, MIN_ANGLE_DEG), MAX_ANGLE_DEG);
  return clamped - REST_POSE_ANGLE_DEG;
}

/** Same mapping, in radians, as three.js wants it. */
export function kneeRotationRadians(angleDeg: number): number {
  return (kneeRotationDeg(angleDeg) * Math.PI) / 180;
}

/**
 * Index of the latest recorded frame reached `elapsedMs` after playback began
 * at `fromIndex`.
 *
 * Driven by the trace's own timestamps rather than a fixed wall-clock step, so
 * replay runs at the cadence the session was actually recorded at and stays
 * correct if that cadence is uneven. It only ever returns the index of a real
 * frame — it never interpolates between them and never skips one, because it
 * advances one frame at a time.
 */
export function frameAtElapsed(
  trace: Pick<AngleSample, 'timestamp_ms'>[],
  fromIndex: number,
  elapsedMs: number,
): number {
  if (trace.length === 0) return 0;
  const start = Math.min(Math.max(fromIndex, 0), trace.length - 1);
  const target = trace[start].timestamp_ms + Math.max(elapsedMs, 0);
  let index = start;
  while (index + 1 < trace.length && trace[index + 1].timestamp_ms <= target) {
    index += 1;
  }
  return index;
}

/** Nominal spacing of the trace, used to hold the final frame for one step. */
export function nominalStepMs(trace: Pick<AngleSample, 'timestamp_ms'>[]): number {
  if (trace.length < 2) return 0;
  const gaps: number[] = [];
  for (let i = 1; i < trace.length; i += 1) {
    gaps.push(trace[i].timestamp_ms - trace[i - 1].timestamp_ms);
  }
  gaps.sort((a, b) => a - b);
  // Median, so one long gap (a dropped stretch) does not set the pace.
  return gaps[Math.floor(gaps.length / 2)];
}

/**
 * Why two frames can or cannot be compared. Keeping this a discriminated union
 * means the UI states the actual reason instead of printing a dash and letting
 * the reader guess.
 */
export type Comparison =
  | { kind: 'comparable'; earlier: AngleSample; difference: number }
  | { kind: 'this-frame-missing'; earlier: AngleSample | null }
  | { kind: 'earlier-frame-missing'; earlier: AngleSample }
  | { kind: 'no-earlier-frame'; earlier: null };

/**
 * The earlier-session frame recorded at the same point in time, if there is
 * one.
 *
 * Matched on timestamp, not array position: two sessions are only comparable
 * where they recorded the same moment, and index alignment silently compares
 * unrelated moments as soon as the two traces differ in cadence or length.
 */
export function nearestByTimestamp(
  trace: AngleSample[],
  timestampMs: number,
  toleranceMs: number,
): AngleSample | null {
  let best: AngleSample | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const sample of trace) {
    const delta = Math.abs(sample.timestamp_ms - timestampMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = sample;
    }
  }
  return bestDelta <= toleranceMs ? best : null;
}

/**
 * Compares this session's frame with the earlier session's frame at the same
 * timestamp. A difference is produced only when both frames carry a real
 * measurement; anything else reports why not.
 */
export function compareAtFrame(
  thisSample: AngleSample | undefined,
  earlierTrace: AngleSample[],
  toleranceMs: number,
): Comparison {
  if (!thisSample) return { kind: 'no-earlier-frame', earlier: null };
  const earlier = nearestByTimestamp(earlierTrace, thisSample.timestamp_ms, toleranceMs);
  if (!earlier) return { kind: 'no-earlier-frame', earlier: null };
  if (thisSample.angle_deg === null) return { kind: 'this-frame-missing', earlier };
  if (earlier.angle_deg === null) return { kind: 'earlier-frame-missing', earlier };
  return {
    kind: 'comparable',
    earlier,
    // Rounded to the one decimal the trace itself carries, so the readout
    // cannot imply precision the stored values do not have.
    difference: Math.round((thisSample.angle_deg - earlier.angle_deg) * 10) / 10,
  };
}
