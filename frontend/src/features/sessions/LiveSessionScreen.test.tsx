import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LiveSessionScreen } from './LiveSessionScreen';
import { api, sessionStreamUrl } from '../../lib/api';
import {
  getActiveCameraStream,
  setActiveCameraStream,
  stopActiveCameraStream,
} from '../../lib/camera';
import type { SessionSummary } from '../../types';

vi.mock('../../lib/api', () => ({
  api: {
    startSession: vi.fn(),
    completeSession: vi.fn(),
  },
  sessionStreamUrl: vi.fn(() => 'ws://localhost:8000/test-stream'),
}));

vi.mock('../../lib/camera', () => ({
  getActiveCameraStream: vi.fn(),
  setActiveCameraStream: vi.fn(),
  stopActiveCameraStream: vi.fn(),
}));

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    window.setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      act(() => this.onopen?.());
    }, 0);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    act(() => this.onclose?.());
  }

  emit(payload: object) {
    act(() => this.onmessage?.({ data: JSON.stringify(payload) }));
  }
}

const sessionResponse = {
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
  stream_token: 'new-token',
} as SessionSummary;

describe('LiveSessionScreen', () => {
  const cameraStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
  const resumedStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
  const getUserMedia = vi.fn();

  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
    vi.mocked(getActiveCameraStream).mockReturnValue(cameraStream);
    vi.mocked(api.startSession).mockResolvedValue(sessionResponse);
    vi.mocked(api.completeSession).mockResolvedValue(sessionResponse);
    getUserMedia.mockResolvedValue(resumedStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,ZmFrZQ==',
    );
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(2);
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(640);
    vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(480);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('streams frames and metrics, then stops and resumes the camera on controls', async () => {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={[
          {
            pathname: '/sessions/session-1/live',
            state: {
              streamToken: 'token-1',
              consentRecordId: 'consent-1',
              protocolName: 'Synthetic protocol',
            },
          },
        ]}
      >
        <Routes>
          <Route path="/sessions/:id/live" element={<LiveSessionScreen />} />
          <Route path="/sessions/:id/result" element={<p>Session result route</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Streaming')).toBeInTheDocument();
    expect(sessionStreamUrl).toHaveBeenCalledWith('session-1', 'token-1');
    await waitFor(() => expect(MockWebSocket.instances[0]?.sent.length).toBeGreaterThan(0));
    const frame = JSON.parse(MockWebSocket.instances[0].sent[0]) as {
      type: string;
      image_b64: string;
    };
    expect(frame.type).toBe('frame');
    expect(frame.image_b64).toBe('ZmFrZQ==');

    MockWebSocket.instances[0].emit({
      type: 'measurement',
      sequence: 0,
      timestamp_ms: 100,
      projected_knee_angle_deg: 84.2,
      rep_count: 2,
      state: 'RETURNING',
      quality: { usable: true, reason: null, confidence: 0.9 },
      model_version: 'fixture-simulated',
      simulated: true,
    });
    expect(await screen.findByText('84°')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('SIMULATED fixture inference')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pause session' }));
    expect(stopActiveCameraStream).toHaveBeenCalled();
    expect(
      await screen.findByText('Camera is off while this session is paused.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Resume session' }));
    expect(await screen.findByText('Streaming')).toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(api.startSession).toHaveBeenCalledWith('session-1', 'consent-1');
    expect(setActiveCameraStream).toHaveBeenCalledWith(resumedStream);
  });
});
