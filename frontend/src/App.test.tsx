import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const createMockResponse = (data: unknown, ok = true) =>
  ({
    ok,
    json: async () => data,
  }) as any;

let fetchMock: ReturnType<typeof vi.fn>;

describe('App', () => {
  beforeEach(() => {
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.startsWith('/api/health')) return createMockResponse({ status: 'ok', message: 'ok' });
      if (url.startsWith('/api/demo-teams')) return createMockResponse({ teams: [] });
      if (url.startsWith('/api/teams/search')) return createMockResponse([]);
      if (url.startsWith('/api/scout')) return createMockResponse({});

      throw new Error(`Unhandled fetch URL in test: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);
    // No `team` param here, otherwise App auto-runs scouting during URL hydration.
    window.history.replaceState({}, '', '/?foo=bar');
  });

  it('resets form inputs when changing game', async () => {
    const user = userEvent.setup();
    render(<App />);

    const compare = screen.getByRole('checkbox', { name: /compare/i });
    const opponentA = screen.getByLabelText('Opponent team name') as HTMLInputElement;

    await user.type(opponentA, 'SomeTeam');
    expect(opponentA.value).toBe('SomeTeam');

    await user.click(compare);
    expect(compare).toBeChecked();

    const opponentB = screen.getByLabelText('Opponent B team name') as HTMLInputElement;
    await user.type(opponentB, 'OtherTeam');
    expect(opponentB.value).toBe('OtherTeam');

    const lolRadio = screen.getByRole('radio', { name: /league of legends/i });
    await user.click(lolRadio);

    expect(screen.getByLabelText('Opponent team name')).toHaveValue('');
    expect(screen.queryByLabelText('Opponent B team name')).toBeNull();
    expect(compare).not.toBeChecked();
    expect(window.location.search).toBe('');
  });

  it('shows a centered spinner while generating (and keeps button text unchanged)', async () => {
    const user = userEvent.setup();

    let resolveScout: (value: any) => void;
    const scoutPromise = new Promise<any>((resolve) => {
      resolveScout = resolve;
    });

    const mockReport = {
      opponentName: 'SomeTeam',
      game: 'VALORANT',
      winProbability: 62,
      evidence: {
        startTime: '2026-01-01T00:00:00.000Z',
        endTime: '2026-02-01T00:00:00.000Z',
        matchesAnalyzed: 1,
        mapsPlayed: 1,
        seriesIds: [],
        winRateConfidence: 'Low',
      },
      dataSources: [
        {
          id: 'mock',
          name: 'Mock data',
          purpose: 'Test fixture',
          used: true,
        },
      ],
      keyInsights: ['Plays fast early rounds'],
      howToWin: [
        {
          insight: 'Play slow defaults and punish over-aggression',
          evidence: 'High aggression profile over a small sample',
        },
      ],
      topMaps: [
        {
          mapName: 'Ascent',
          matchesPlayed: 1,
          winRate: 1,
        },
      ],
      roster: [
        {
          id: 'p1',
          name: 'Player One',
          teamId: 't1',
          role: 'IGL',
        },
      ],
      aggression: 'High',
      avgScore: 13,
      matchesAnalyzed: 1,
    };

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.startsWith('/api/health')) return createMockResponse({ status: 'ok', message: 'ok' });
      if (url.startsWith('/api/demo-teams')) return createMockResponse({ teams: [] });
      if (url.startsWith('/api/teams/search')) return createMockResponse([]);
      if (url.startsWith('/api/scout')) return scoutPromise;

      throw new Error(`Unhandled fetch URL in test: ${url}`);
    });

    render(<App />);

    await user.type(screen.getByLabelText('Opponent team name'), 'SomeTeam');

    const submit = screen.getByRole('button', { name: 'Generate Report' });
    expect(submit).toBeEnabled();

    await user.click(submit);

    // Full-page spinner overlay should appear.
    expect(await screen.findByRole('status', { name: 'Generating report' })).toBeInTheDocument();

    // Button text should not change; it should be disabled + grayed out.
    expect(screen.getByRole('button', { name: 'Generate Report' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Generate Report' })).toHaveStyle({
      backgroundColor: 'rgb(154, 165, 177)'
    });

    // Finish the request and ensure the spinner disappears.
    resolveScout!(createMockResponse(mockReport));
    await waitForElementToBeRemoved(() => screen.queryByRole('status', { name: 'Generating report' }));
  });
});
