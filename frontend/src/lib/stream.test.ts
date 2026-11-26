import { describe, expect, it } from 'vitest';
import { demoMeasurements, demoWarnings } from './mocks/fixtures';
import { initialStreamState, reduceStreamEvent } from './stream';

describe('live stream event handling', () => {
  it('accepts an in-order measurement', () => {
    const next = reduceStreamEvent(initialStreamState, demoMeasurements[0]);
    expect(next.latest?.rep_count).toBe(0);
    expect(next.lastSequence).toBe(demoMeasurements[0].sequence);
  });

  it('ignores duplicate and out-of-order sequences', () => {
    const once = reduceStreamEvent(initialStreamState, demoMeasurements[1]);
    const duplicate = reduceStreamEvent(once, demoMeasurements[1]);
    const stale = reduceStreamEvent(once, { ...demoMeasurements[2], sequence: 1 });
    expect(duplicate).toBe(once);
    expect(stale).toBe(once);
  });

  it('never counts a low-quality measurement as the latest value', () => {
    const unusable = {
      ...demoMeasurements[0],
      sequence: 9,
      quality: { usable: false, reason: 'LANDMARK_LOW_CONFIDENCE', confidence: 0.2 },
    };
    const next = reduceStreamEvent(initialStreamState, unusable);
    expect(next.latest).toBeUndefined();
    expect(next.lastSequence).toBe(9);
  });

  it('collects quality warnings with their plain-language message', () => {
    const next = reduceStreamEvent(initialStreamState, demoWarnings[0]);
    expect(next.warnings[0].message).toMatch(/full lower leg is visible/);
  });
});
