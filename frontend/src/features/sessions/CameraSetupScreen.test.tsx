import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CameraSetupScreen } from './CameraSetupScreen';
import { api } from '../../lib/api';
import { createCameraConsent, setActiveCameraStream } from '../../lib/camera';
import type { SessionSummary } from '../../types';

vi.mock('../../lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  api: {
    me: vi.fn(),
    myProtocols: vi.fn(),
    health: vi.fn(),
    createSession: vi.fn(),
    startSession: vi.fn(),
  },
}));

vi.mock('../../lib/camera', () => ({
  createCameraConsent: vi.fn(),
  setActiveCameraStream: vi.fn(),
  stopActiveCameraStream: vi.fn(),
}));

const protocol = {
  id: 'protocol-1',
  patient_id: 'patient-1',
  clinician_id: 'clinician-1',
  protocol_name: 'Synthetic seated movement protocol',
  version: 1,
  parameters: { side: 'right', target_reps: 5 },
  approved_at: '2026-01-01T00:00:00Z',
  active: true,
};

const startedSession = {
  session_id: 'session-1',
  protocol_id: 'protocol-1',
  protocol_version: 1,
  model_version: 'fixture-simulated',
  keypoint_mapping_version: 'test-map',
  analytics_version: 'test-analytics',
  status: 'active',
  metrics: {
    completed_reps: 0,
    target_reps: 5,
    projected_knee_angle_min_deg: 0,
    projected_knee_angle_max_deg: 0,
    projected_range_deg: 0,
    target_range_hit_count: 0,
    median_rep_duration_seconds: 0,
    usable_frame_pct: 0,
  },
  quality_flags: [],
  raw_video_stored: false,
  stream_token: 'short-lived-stream-token',
} as SessionSummary;

describe('CameraSetupScreen', () => {
  const cameraTrack = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const cameraStream = {
    getTracks: () => [cameraTrack],
  } as unknown as MediaStream;
  const getUserMedia = vi.fn();

  beforeEach(() => {
    vi.mocked(api.me).mockResolvedValue({ id: 'patient-1', role: 'patient', display_name: 'Test' });
    vi.mocked(api.myProtocols).mockResolvedValue([protocol]);
    vi.mocked(api.createSession).mockResolvedValue(startedSession);
    vi.mocked(api.startSession).mockResolvedValue(startedSession);
    vi.mocked(createCameraConsent).mockResolvedValue('consent-1');
    getUserMedia.mockResolvedValue(cameraStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('requires consent and framing checks before opening and starting the camera session', async () => {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={['/setup']}
      >
        <Routes>
          <Route path="/setup" element={<CameraSetupScreen />} />
          <Route path="/sessions/:id/live" element={<p>Live stream route</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Synthetic seated movement protocol')).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: /read this notice/i }));
    fireEvent.click(screen.getByRole('button', { name: /accept and enable camera/i }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
    expect(createCameraConsent).toHaveBeenCalledWith('patient-1');
    expect(setActiveCameraStream).toHaveBeenCalledWith(cameraStream);

    const startButton = screen.getByRole('button', { name: /start live session/i });
    expect(startButton).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /hip, knee, and ankle/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /camera is steady/i }));
    expect(startButton).toBeEnabled();

    fireEvent.click(startButton);
    expect(await screen.findByText('Live stream route')).toBeInTheDocument();
    expect(api.createSession).toHaveBeenCalledWith('protocol-1');
    expect(api.startSession).toHaveBeenCalledWith('session-1', 'consent-1');
  });
});
