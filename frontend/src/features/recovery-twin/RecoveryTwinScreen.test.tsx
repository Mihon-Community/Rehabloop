import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AngleSample, SessionDetail } from '../../types';

/* The viewer is a WebGL component behind React.lazy; these tests are about the
   screen's frame selection and comparison text, so it is stubbed out to keep
   them fast and free of a canvas. The angle it is handed IS asserted — that is
   the contract between the readout and the pose. */
const avatarAngles: (number | null)[] = [];
vi.mock('./TwinAvatar', () => ({
  default: ({ angle, context }: { angle: number | null; context?: string }) => {
    avatarAngles.push(angle);
    return <div data-testid={`avatar-${context ?? 'primary'}`} data-angle={String(angle)} />;
  },
}));

vi.mock('../../lib/data', () => ({ loadSession: vi.fn() }));
import { loadSession } from '../../lib/data';
import { RecoveryTwinScreen } from './RecoveryTwinScreen';
import { demoCompareTrace } from '../../lib/mocks/fixtures';

const sample = (overrides: Partial<AngleSample> = {}): AngleSample => ({
  timestamp_ms: 0,
  angle_deg: 100,
  usable: true,
  rep_count: 0,
  state: 'REST',
  ...overrides,
});

function sessionWith(trace: AngleSample[]): SessionDetail {
  return {
    session_id: 'session-demo-1',
    protocol_version: 2,
    model_version: 'fixture-simulated',
    keypoint_mapping_version: 'fixture-knee-map',
    quality_flags: [],
    angle_trace: trace,
    events: [],
  } as unknown as SessionDetail;
}

async function renderScreen(trace: AngleSample[]) {
  avatarAngles.length = 0;
  vi.mocked(loadSession).mockResolvedValue({
    data: sessionWith(trace),
    source: 'simulated',
  } as never);
  render(
    <MemoryRouter>
      <RecoveryTwinScreen />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByLabelText(/timeline/i)).toBeInTheDocument());
}

const timeline = () => screen.getByLabelText(/timeline/i);

describe('Recovery Twin — frame selection', () => {
  it('shows the measured angle of the selected frame', async () => {
    await renderScreen([
      sample({ timestamp_ms: 0, angle_deg: 72 }),
      sample({ timestamp_ms: 500, angle_deg: 115.7, state: 'EXTENDING' }),
    ]);
    expect(screen.getByText('72.0°')).toBeInTheDocument();

    fireEvent.change(timeline(), { target: { value: '1' } });
    expect(screen.getByText('115.7°')).toBeInTheDocument();
  });

  it('hands the viewer exactly the angle it prints', async () => {
    await renderScreen([sample({ timestamp_ms: 0, angle_deg: 83.4 })]);
    expect(screen.getByText('83.4°')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-this session')).toHaveAttribute('data-angle', '83.4');
  });

  it('reports the frame position and recorded time', async () => {
    await renderScreen([
      sample({ timestamp_ms: 0 }),
      sample({ timestamp_ms: 500 }),
      sample({ timestamp_ms: 1000 }),
    ]);
    fireEvent.change(timeline(), { target: { value: '2' } });
    expect(screen.getByText(/Frame 3 of 3/)).toBeInTheDocument();
    expect(screen.getByText(/1\.0 s/)).toBeInTheDocument();
  });
});

describe('Recovery Twin — missing frames', () => {
  it('labels an unmeasured frame instead of printing a number', async () => {
    await renderScreen([
      sample({ timestamp_ms: 0, angle_deg: 100 }),
      sample({ timestamp_ms: 500, angle_deg: null, usable: false }),
    ]);
    fireEvent.change(timeline(), { target: { value: '1' } });

    expect(screen.getByText(/Measurement unavailable/i)).toBeInTheDocument();
    expect(screen.getByText('No measurement')).toBeInTheDocument();
    // Never a fabricated zero, and never the neighbouring frame's value.
    expect(screen.queryByText('0.0°')).not.toBeInTheDocument();
    expect(screen.queryByText('100.0°')).not.toBeInTheDocument();
  });

  it('passes null to the viewer for an unmeasured frame, not a stand-in', async () => {
    await renderScreen([sample({ timestamp_ms: 0, angle_deg: null, usable: false })]);
    expect(screen.getByTestId('avatar-this session')).toHaveAttribute('data-angle', 'null');
  });

  it('keeps an unmeasured frame on the timeline rather than skipping it', async () => {
    await renderScreen([
      sample({ timestamp_ms: 0 }),
      sample({ timestamp_ms: 500, angle_deg: null, usable: false }),
      sample({ timestamp_ms: 1000 }),
    ]);
    expect(timeline()).toHaveAttribute('max', '2');
    fireEvent.change(timeline(), { target: { value: '1' } });
    expect(screen.getByText(/Frame 2 of 3/)).toBeInTheDocument();
  });
});

describe('Recovery Twin — earlier-session comparison', () => {
  const openCompare = () =>
    fireEvent.click(screen.getByRole('button', { name: /compare with earlier session/i }));

  it('shows a signed difference when both frames have measurements', async () => {
    // demoCompareTrace[0] is the demo trace minus 2 degrees at 0 ms.
    const earlierAngle = demoCompareTrace[0].angle_deg ?? 0;
    await renderScreen([sample({ timestamp_ms: 0, angle_deg: earlierAngle + 5 })]);
    openCompare();
    expect(screen.getByText('+5.0°')).toBeInTheDocument();
  });

  it('uses a true minus sign for a reduced angle', async () => {
    const earlierAngle = demoCompareTrace[0].angle_deg ?? 0;
    await renderScreen([sample({ timestamp_ms: 0, angle_deg: earlierAngle - 3 })]);
    openCompare();
    expect(screen.getByText('−3.0°')).toBeInTheDocument();
  });

  it('withholds a difference and says why when this frame is unmeasured', async () => {
    await renderScreen([sample({ timestamp_ms: 0, angle_deg: null, usable: false })]);
    openCompare();
    expect(screen.getByText('Not comparable')).toBeInTheDocument();
    expect(screen.getByText(/this session has no measurement at this moment/i)).toBeInTheDocument();
  });

  it('withholds a difference and says why when the earlier session has no frame there', async () => {
    // Timestamps far outside the earlier trace, so nothing pairs with them.
    await renderScreen([sample({ timestamp_ms: 9_000_000, angle_deg: 100 })]);
    openCompare();
    expect(screen.getByText('Not comparable')).toBeInTheDocument();
    expect(screen.getByText(/recorded no frame at this moment/i)).toBeInTheDocument();
    expect(screen.getByText(/No frame is invented to fill the position/i)).toBeInTheDocument();
  });

  it('pairs frames by recorded timestamp, not by position in the array', async () => {
    // One frame, at the timestamp of the earlier trace's SECOND frame. Index
    // pairing would compare it against the earlier trace's first frame.
    const target = demoCompareTrace[1];
    await renderScreen([sample({ timestamp_ms: target.timestamp_ms, angle_deg: 100 })]);
    openCompare();
    const expected = 100 - (target.angle_deg ?? 0);
    expect(screen.getByText(`${expected > 0 ? '+' : '−'}${Math.abs(expected).toFixed(1)}°`))
      .toBeInTheDocument();
  });

  it('labels which session each viewer is showing', async () => {
    await renderScreen([sample({ timestamp_ms: 0, angle_deg: 100 })]);
    openCompare();
    expect(screen.getByRole('heading', { name: /this session/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /earlier session/i })).toBeInTheDocument();
    expect(screen.getByTestId('avatar-this session')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-earlier session')).toBeInTheDocument();
  });

  it('never claims the comparison measures recovery', async () => {
    await renderScreen([sample({ timestamp_ms: 0, angle_deg: 100 })]);
    openCompare();
    expect(screen.getByText(/not a measure of recovery/i)).toBeInTheDocument();
  });
});
