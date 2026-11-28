import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api';
import { demoSessionDetail, deterministicSummary } from '../../lib/mocks/fixtures';
import { SessionResultScreen } from './SessionResultScreen';

vi.mock('../../lib/data', () => ({
  loadSession: vi.fn(),
  loadSummary: vi.fn(),
}));

import { loadSession, loadSummary } from '../../lib/data';

function renderResult() {
  render(
    <MemoryRouter>
      <SessionResultScreen />
    </MemoryRouter>,
  );
}

describe('session result explanation', () => {
  beforeEach(() => {
    vi.mocked(loadSession).mockResolvedValue({ data: demoSessionDetail, source: 'live' });
  });

  it('reports a refused explanation instead of loading forever', async () => {
    // Regression: a rejected summary used to reset state to "no summary yet",
    // which renders identically to a request still in flight, so the screen
    // showed "Preparing explanation…" indefinitely.
    vi.mocked(loadSummary).mockRejectedValue(
      new ApiError(409, {
        detail: 'Complete the session before requesting a summary',
        code: 'INVALID_STATE',
      }),
    );
    renderResult();

    expect(await screen.findByText(/no explanation available/i)).toBeInTheDocument();
    expect(screen.getByText(/this session was not completed/i)).toBeInTheDocument();
    expect(screen.queryByText(/preparing explanation/i)).not.toBeInTheDocument();
  });

  it('renders the explanation when one is returned', async () => {
    vi.mocked(loadSummary).mockResolvedValue({
      data: deterministicSummary(demoSessionDetail),
      source: 'live',
      fallback: false,
    });
    renderResult();

    expect(
      await screen.findByText(deterministicSummary(demoSessionDetail).headline),
    ).toBeInTheDocument();
    expect(screen.queryByText(/no explanation available/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/preparing explanation/i)).not.toBeInTheDocument();
  });
});
