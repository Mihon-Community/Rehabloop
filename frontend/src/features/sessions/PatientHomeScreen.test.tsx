import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DemoProvider } from '../../app/DemoProvider';
import type { Protocol } from '../../types';
import { PatientHomeScreen } from './PatientHomeScreen';

vi.mock('../../lib/data', () => ({
  loadProtocols: vi.fn(),
  loadSessions: vi.fn(async () => ({ data: [], source: 'simulated' })),
}));

import { loadProtocols } from '../../lib/data';

const protocol: Protocol = {
  id: 'p1',
  name: 'Seated knee extension — demonstration protocol',
  clinician_name: 'Clinician',
  side: 'right',
  target_reps: 8,
  target_angle_min_deg: 105,
  target_angle_max_deg: 120,
  instructions: 'Instructions',
  stop_instructions: 'Stop instructions',
  version: 1,
  approved: true,
  camera_view: 'side',
};

function renderHome() {
  render(
    <MemoryRouter>
      <DemoProvider>
        <PatientHomeScreen />
      </DemoProvider>
    </MemoryRouter>,
  );
}

describe('patient home clinical gate', () => {
  it('shows read-only demo mode and suggests no exercise without an approved protocol', async () => {
    vi.mocked(loadProtocols).mockResolvedValue({
      data: [{ ...protocol, approved: false }],
      source: 'simulated',
    });
    renderHome();
    expect(await screen.findByText(/read-only demo mode/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /review protocol/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no exercise is suggested/i)).toBeInTheDocument();
  });

  it('shows the assigned protocol and a review link when approved', async () => {
    vi.mocked(loadProtocols).mockResolvedValue({ data: [protocol], source: 'simulated' });
    renderHome();
    expect(await screen.findByRole('link', { name: /review protocol/i })).toBeInTheDocument();
    expect(screen.getByText(/clinician-approved protocol present/i)).toBeInTheDocument();
  });
});
