import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api';
import type { Protocol } from '../types';

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return {
    ...actual,
    api: { getSession: vi.fn(), myProtocols: vi.fn() },
  };
});

import { api } from './api';
import { loadSession, toProtocolView } from './data';

const liveProtocol: Protocol = {
  id: '00000000-0000-0000-0000-000000000101',
  patient_id: '00000000-0000-0000-0000-000000000001',
  clinician_id: '00000000-0000-0000-0000-000000000002',
  protocol_name: 'Seated knee extension',
  version: 3,
  parameters: {
    side: 'right',
    camera: 'side',
    hold_ms: 400,
    target_reps: 8,
    target_min_deg: 110,
    target_max_deg: 125,
    rest_min_deg: 70,
    rest_max_deg: 80,
  },
  approved_at: '2026-11-24T12:05:27Z',
  active: true,
};

describe('loadSession fallback', () => {
  it('falls back to a labelled fixture when the id is unparseable', async () => {
    // Regression: the scaffold routes use `session-demo-1`, which the backend
    // rejects with 422 because the route declares a UUID. That used to escape
    // as a hard error reading "Session could not be loaded".
    vi.mocked(api.getSession).mockRejectedValue(
      new ApiError(422, { detail: 'Invalid request payload', code: 'VALIDATION_ERROR' }),
    );

    const result = await loadSession('session-demo-1');

    expect(result.source).toBe('simulated');
    expect(result.data.session_id).toBeTruthy();
  });

  it('rethrows a refusal instead of masking it with fixtures', async () => {
    vi.mocked(api.getSession).mockRejectedValue(
      new ApiError(401, { detail: 'Authentication required', code: 'UNAUTHENTICATED' }),
    );

    await expect(loadSession('00000000-0000-0000-0000-000000000001')).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe('toProtocolView', () => {
  it('derives approval from approved_at and active, not a non-existent field', () => {
    // The backend never sends `approved`; reading it directly filtered every
    // real protocol out of the patient home screen.
    expect(toProtocolView(liveProtocol).approved).toBe(true);
    expect(toProtocolView({ ...liveProtocol, approved_at: null }).approved).toBe(false);
    expect(toProtocolView({ ...liveProtocol, active: false }).approved).toBe(false);
  });

  it('reads the flat parameter keys the backend validates', () => {
    const view = toProtocolView(liveProtocol);
    expect(view.name).toBe('Seated knee extension');
    expect(view.side).toBe('right');
    expect(view.target_reps).toBe(8);
    expect(view.target_angle_min_deg).toBe(110);
    expect(view.target_angle_max_deg).toBe(125);
    expect(view.hold_duration_seconds).toBe(0.4);
    expect(view.camera_view).toBe('side');
  });

  it('leaves clinician-set fields undefined rather than inventing them', () => {
    const view = toProtocolView({ ...liveProtocol, parameters: {} });
    expect(view.target_reps).toBeUndefined();
    expect(view.target_angle_max_deg).toBeUndefined();
    expect(view.side).toBeUndefined();
    expect(view.instructions).toBeUndefined();
    expect(view.stop_instructions).toBeUndefined();
  });
});
