import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  compareAtFrame,
  frameAtElapsed,
  kneeRotationDeg,
  kneeRotationRadians,
  nearestByTimestamp,
  nominalStepMs,
  REST_POSE_ANGLE_DEG,
} from './angleMapping';
import { demoAngleTrace, demoCompareTrace } from '@/lib/mocks/fixtures';
import type { AngleSample } from '@/types';

const frame = (overrides: Partial<AngleSample> = {}): AngleSample => ({
  timestamp_ms: 0,
  angle_deg: 100,
  usable: true,
  rep_count: 0,
  state: 'REST',
  ...overrides,
});

describe('angle-to-pose mapping', () => {
  it('leaves the rig straight at full extension', () => {
    // The asset's authored rest pose is a straight leg, and the backend calls
    // that 180 degrees. Anything else here tilts the whole replay.
    expect(kneeRotationDeg(REST_POSE_ANGLE_DEG)).toBe(0);
    expect(kneeRotationRadians(180)).toBe(0);
  });

  it('never renders the knee extended past straight', () => {
    // The previous mapping was `angle - 90`, so every angle above 90 rotated
    // the shin ABOVE straight — the fixture peaks at 115.7, which appeared as
    // 25.7 degrees of hyperextension on every repetition.
    for (const sample of demoAngleTrace) {
      if (sample.angle_deg === null) continue;
      expect(kneeRotationDeg(sample.angle_deg)).toBeLessThanOrEqual(0);
    }
  });

  it('maps flexion to the magnitude the measurement actually states', () => {
    expect(kneeRotationDeg(90)).toBe(-90); // a right angle at the knee
    expect(kneeRotationDeg(72)).toBe(-108); // the fixture's flexed end
    expect(kneeRotationDeg(115.7)).toBeCloseTo(-64.3, 5);
  });

  it('is monotonic: a larger measured angle is always a straighter pose', () => {
    for (let a = 0; a < 180; a += 7) {
      expect(kneeRotationDeg(a + 1)).toBeGreaterThan(kneeRotationDeg(a));
    }
  });

  it('clamps impossible angles instead of rotating out of range', () => {
    expect(kneeRotationDeg(-40)).toBe(-180);
    expect(kneeRotationDeg(400)).toBe(0);
  });

  it('keeps the displayed number and the pose derived from one value', () => {
    // Guards against the two drifting apart: whatever is printed must be the
    // same number the rotation came from.
    for (const sample of demoAngleTrace) {
      if (sample.angle_deg === null) continue;
      const shown = sample.angle_deg;
      expect(kneeRotationDeg(shown)).toBeCloseTo(shown - 180, 10);
    }
  });
});

describe('frame-accurate playback', () => {
  it('runs at the cadence the trace was recorded at', () => {
    // The fixture is sampled every 500 ms. A fixed 600 ms step ran the replay
    // at 83% of real speed.
    expect(nominalStepMs(demoAngleTrace)).toBe(500);
    expect(frameAtElapsed(demoAngleTrace, 0, 0)).toBe(0);
    expect(frameAtElapsed(demoAngleTrace, 0, 500)).toBe(1);
    expect(frameAtElapsed(demoAngleTrace, 0, 5000)).toBe(10);
  });

  it('holds the current frame until the next one is actually due', () => {
    expect(frameAtElapsed(demoAngleTrace, 0, 499)).toBe(0);
    expect(frameAtElapsed(demoAngleTrace, 0, 999)).toBe(1);
  });

  it('never skips a frame, however far time jumps', () => {
    // A long stall must not step over frames: every index is visited.
    const seen = new Set<number>();
    for (let ms = 0; ms <= 12_000; ms += 100) {
      seen.add(frameAtElapsed(demoAngleTrace, 0, ms));
    }
    expect(seen.size).toBe(demoAngleTrace.length);
  });

  it('resumes from a scrubbed position rather than from the start', () => {
    expect(frameAtElapsed(demoAngleTrace, 10, 0)).toBe(10);
    expect(frameAtElapsed(demoAngleTrace, 10, 1000)).toBe(12);
  });

  it('stops at the final recorded frame instead of inventing more', () => {
    const last = demoAngleTrace.length - 1;
    expect(frameAtElapsed(demoAngleTrace, 0, 60_000)).toBe(last);
    expect(frameAtElapsed(demoAngleTrace, last, 10_000)).toBe(last);
  });

  it('survives an empty or single-frame trace', () => {
    expect(frameAtElapsed([], 0, 1000)).toBe(0);
    expect(frameAtElapsed([frame()], 0, 1000)).toBe(0);
    expect(nominalStepMs([])).toBe(0);
    expect(nominalStepMs([frame()])).toBe(0);
  });

  it('takes the median gap, so one dropped stretch does not set the pace', () => {
    const uneven = [0, 100, 200, 5000, 5100].map((t) => frame({ timestamp_ms: t }));
    expect(nominalStepMs(uneven)).toBe(100);
  });
});

describe('missing frames', () => {
  const gaps = demoAngleTrace.filter((s) => s.angle_deg === null);

  it('the fixture really does contain unmeasured frames', () => {
    expect(gaps.length).toBeGreaterThan(0);
    for (const g of gaps) expect(g.usable).toBe(false);
  });

  it('a missing frame is still a real frame on the timeline', () => {
    // It must remain selectable and keep its timestamp: a gap is reported, not
    // stepped over.
    const index = demoAngleTrace.findIndex((s) => s.angle_deg === null);
    expect(index).toBeGreaterThan(-1);
    expect(frameAtElapsed(demoAngleTrace, index, 0)).toBe(index);
    expect(demoAngleTrace[index].timestamp_ms).toBe(index * 500);
  });

  it('yields no difference when this frame has no measurement', () => {
    const result = compareAtFrame(frame({ angle_deg: null }), [frame({ angle_deg: 90 })], 250);
    expect(result.kind).toBe('this-frame-missing');
    expect(result).not.toHaveProperty('difference');
  });

  it('yields no difference when the earlier frame has no measurement', () => {
    const result = compareAtFrame(frame({ angle_deg: 100 }), [frame({ angle_deg: null })], 250);
    expect(result.kind).toBe('earlier-frame-missing');
    expect(result).not.toHaveProperty('difference');
  });
});

describe('earlier-session comparison', () => {
  it('matches the earlier frame recorded at the same moment', () => {
    const thisSample = demoAngleTrace[4];
    const result = compareAtFrame(thisSample, demoCompareTrace, 250);
    expect(result.kind).toBe('comparable');
    if (result.kind !== 'comparable') return;
    expect(result.earlier.timestamp_ms).toBe(thisSample.timestamp_ms);
    expect(result.difference).toBeCloseTo(
      (thisSample.angle_deg ?? 0) - (result.earlier.angle_deg ?? 0),
      5,
    );
  });

  it('aligns by timestamp, not array position', () => {
    // An earlier session recorded at a different cadence: index 2 of this
    // trace is 1000 ms, which is index 4 of the earlier one.
    const earlier = [0, 250, 500, 750, 1000, 1250].map((t) =>
      frame({ timestamp_ms: t, angle_deg: t / 100 }),
    );
    const result = compareAtFrame(frame({ timestamp_ms: 1000, angle_deg: 20 }), earlier, 250);
    expect(result.kind).toBe('comparable');
    if (result.kind !== 'comparable') return;
    expect(result.earlier.timestamp_ms).toBe(1000);
    expect(result.difference).toBeCloseTo(10, 5);
  });

  it('reports no earlier frame when nothing was recorded near that moment', () => {
    const earlier = [frame({ timestamp_ms: 0 }), frame({ timestamp_ms: 500 })];
    // This session ran longer than the earlier one.
    const result = compareAtFrame(frame({ timestamp_ms: 9000 }), earlier, 250);
    expect(result.kind).toBe('no-earlier-frame');
    expect(result.earlier).toBeNull();
  });

  it('reports no earlier frame when there is no earlier session at all', () => {
    expect(compareAtFrame(frame(), [], 250).kind).toBe('no-earlier-frame');
  });

  it('honours the tolerance at its edges', () => {
    const earlier = [frame({ timestamp_ms: 0, angle_deg: 90 })];
    expect(nearestByTimestamp(earlier, 250, 250)?.timestamp_ms).toBe(0);
    expect(nearestByTimestamp(earlier, 251, 250)).toBeNull();
  });

  it('picks the closer of two candidates', () => {
    const earlier = [
      frame({ timestamp_ms: 400, angle_deg: 80 }),
      frame({ timestamp_ms: 600, angle_deg: 95 }),
    ];
    expect(nearestByTimestamp(earlier, 560, 250)?.angle_deg).toBe(95);
  });

  it('signs the difference from this session toward the earlier one', () => {
    const better = compareAtFrame(frame({ angle_deg: 110 }), [frame({ angle_deg: 100 })], 250);
    const worse = compareAtFrame(frame({ angle_deg: 90 }), [frame({ angle_deg: 100 })], 250);
    if (better.kind !== 'comparable' || worse.kind !== 'comparable') throw new Error('expected');
    expect(better.difference).toBeCloseTo(10, 5);
    expect(worse.difference).toBeCloseTo(-10, 5);
  });

  it('rounds the difference to the precision the trace carries', () => {
    const result = compareAtFrame(frame({ angle_deg: 100.26 }), [frame({ angle_deg: 100.0 })], 250);
    if (result.kind !== 'comparable') throw new Error('expected comparable');
    expect(result.difference).toBe(0.3);
  });

  it('is comparable at every frame of the shipped fixture pair', () => {
    // The two demo traces share a timebase, so each frame either compares or
    // states a missing measurement — never "no earlier frame".
    for (const sample of demoAngleTrace) {
      expect(compareAtFrame(sample, demoCompareTrace, 250).kind).not.toBe('no-earlier-frame');
    }
  });
});

/* Joint positions as authored in public/models/twin-rig.glb (read from the
   glTF node translations). Hip, knee and ankle share a height, which is what
   makes the rest pose a straight leg; the shin points along +X from the knee,
   which is what fixes the sign of the hinge rotation. */
const HIP = new Vector3(0, -0.15, 0);
const KNEE = new Vector3(1.05, -0.15, 0);
const ANKLE = new Vector3(1.71, -0.15, 0);
const HINGE_AXIS = new Vector3(0, 0, 1);

/** Where the ankle ends up once the hinge is driven by a measured angle. */
function ankleAt(angleDeg: number): Vector3 {
  const offset = ANKLE.clone().sub(KNEE);
  offset.applyAxisAngle(HINGE_AXIS, kneeRotationRadians(angleDeg));
  return KNEE.clone().add(offset);
}

describe('angle-to-pose consistency against the rig geometry', () => {
  it('the asset really is authored as a straight leg', () => {
    // If this ever changes, REST_POSE_ANGLE_DEG has to change with it.
    expect(HIP.y).toBeCloseTo(KNEE.y, 10);
    expect(KNEE.y).toBeCloseTo(ANKLE.y, 10);
    expect(ANKLE.x).toBeGreaterThan(KNEE.x);
  });

  it('full extension leaves the ankle level with the knee', () => {
    expect(ankleAt(180).y).toBeCloseTo(KNEE.y, 10);
  });

  it('flexion lowers the ankle, never raises it', () => {
    // The sign of the hinge is the part a screenshot cannot settle: a +X limb
    // rotated by a negative Z angle moves down, which is flexion.
    expect(ankleAt(90).y).toBeLessThan(KNEE.y);
    expect(ankleAt(72).y).toBeLessThan(ankleAt(115.7).y);
    for (let a = 0; a <= 180; a += 10) {
      expect(ankleAt(a).y).toBeLessThanOrEqual(KNEE.y + 1e-9);
    }
  });

  it('reproduces the geometry the measurement describes', () => {
    // The rendered hip-knee-ankle angle must equal the measured angle: that is
    // the whole contract between the number and the pose.
    for (const measured of [45, 72, 90, 115.7, 150, 180]) {
      const ankle = ankleAt(measured);
      const toHip = HIP.clone().sub(KNEE).normalize();
      const toAnkle = ankle.clone().sub(KNEE).normalize();
      const rendered = (Math.acos(toHip.dot(toAnkle)) * 180) / Math.PI;
      expect(rendered).toBeCloseTo(measured, 4);
    }
  });

  it('the previous mapping did NOT reproduce it', () => {
    // Regression guard: `angle - 90` rendered 115.7 degrees as 154.3.
    const legacyRotation = ((115.7 - 90) * Math.PI) / 180;
    const offset = ANKLE.clone().sub(KNEE).applyAxisAngle(HINGE_AXIS, legacyRotation);
    const ankle = KNEE.clone().add(offset);
    const toHip = HIP.clone().sub(KNEE).normalize();
    const toAnkle = ankle.clone().sub(KNEE).normalize();
    const rendered = (Math.acos(toHip.dot(toAnkle)) * 180) / Math.PI;
    expect(rendered).toBeCloseTo(154.3, 1);
    expect(Math.abs(rendered - 115.7)).toBeGreaterThan(35);
  });
});
