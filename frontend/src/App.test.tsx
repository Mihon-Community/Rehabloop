import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { mockMeasurements, SIMULATED_LABEL } from './lib/mocks';

vi.mock('./lib/data', () => ({
  loadProtocols: vi.fn(async () => ({ data: [], source: 'simulated' })),
  loadSessions: vi.fn(async () => ({ data: [], source: 'simulated' })),
  loadSession: vi.fn(async () => ({ data: null, source: 'simulated' })),
  loadSummary: vi.fn(async () => ({ data: null, source: 'simulated', fallback: true })),
  loadProgress: vi.fn(async () => ({ data: [], source: 'simulated' })),
  loadMe: vi.fn(async () => ({
    data: { id: 'demo', role: 'patient', display_name: 'Demo' },
    source: 'simulated',
  })),
  demoPatients: [],
  demoProtocols: [],
  demoSessions: [],
}));

describe('RehabLoop public journey', () => {
  it('opens on the public landing page with safety messaging', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: /see how a prescribed movement was performed/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/prototype, not a medical device/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('navigation', { name: /public navigation/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /get started/i }).length).toBeGreaterThan(0);
  });

  it('shows the app shell with sign-out on a dashboard route', async () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('navigation', { name: /screens/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign out and return to landing page/i }),
    ).toBeInTheDocument();
  });

  it('labels every mock event as simulated', () => {
    expect(SIMULATED_LABEL).toContain('SIMULATED');
    for (const event of mockMeasurements) {
      expect(event.simulated).toBe(true);
    }
  });
});
