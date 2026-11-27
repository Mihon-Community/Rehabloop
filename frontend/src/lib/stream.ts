import type { MeasurementEvent, QualityWarningEvent } from '../types';

export interface StreamState {
  lastSequence: number;
  latest?: MeasurementEvent;
  warnings: QualityWarningEvent[];
}

// -1 so a legitimate first event at sequence 0 is not rejected as stale.
export const initialStreamState: StreamState = { lastSequence: -1, warnings: [] };

/**
 * Reject duplicate, stale or out-of-order frames (contract Section: WebSocket
 * event contract). Low-confidence measurements are NOT counted as reps: the
 * backend owns the state machine; the UI only displays what it receives.
 */
export function reduceStreamEvent(
  state: StreamState,
  event: MeasurementEvent | QualityWarningEvent,
): StreamState {
  if (!Number.isFinite(event.sequence) || event.sequence <= state.lastSequence) return state;

  if (event.type === 'measurement' && !event.quality.usable) {
    return { ...state, lastSequence: event.sequence };
  }

  if (event.type === 'measurement') {
    return { ...state, lastSequence: event.sequence, latest: event };
  }
  return { ...state, lastSequence: event.sequence, warnings: [...state.warnings, event] };
}
