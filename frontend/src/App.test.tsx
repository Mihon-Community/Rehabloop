import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { mockMeasurements, SIMULATED_LABEL } from './lib/mocks';

describe('RehabLoop frontend smoke test', () => {
  it('renders the shell and the safety notice', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /rehabloop/i })).toBeInTheDocument();
    expect(screen.getAllByText(/prototype, not a medical device/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('navigation', { name: /screens/i })).toBeInTheDocument();
  });

  it('labels every mock event as simulated', () => {
    expect(SIMULATED_LABEL).toContain('SIMULATED');
    for (const event of mockMeasurements) {
      expect(event.simulated).toBe(true);
    }
  });
});
