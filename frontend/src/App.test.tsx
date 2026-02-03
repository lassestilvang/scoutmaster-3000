import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
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

  afterEach(() => {
    vi.useRealTimers();
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

  it('adds autocomplete to the optional our-team input (and excludes the opponent team)', async () => {
    const user = userEvent.setup();

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.startsWith('/api/health')) return createMockResponse({ status: 'ok', message: 'ok' });
      if (url.startsWith('/api/demo-teams')) return createMockResponse({ teams: [] });

      if (url.startsWith('/api/teams/search')) {
        const u = new URL(url, 'http://localhost');
        const q = u.searchParams.get('q');

        if (q === 'Be') {
          return createMockResponse([
            { id: 't1', name: 'Alpha' },
            { id: 't2', name: 'Beta' },
          ]);
        }
        return createMockResponse([]);
      }

      if (url.startsWith('/api/scout')) return createMockResponse({});

      throw new Error(`Unhandled fetch URL in test: ${url}`);
    });

    render(<App />);

    await user.type(screen.getByLabelText('Opponent team name'), 'Alpha');

    const ourInput = screen.getByLabelText('Your team name (optional)') as HTMLInputElement;
    expect(ourInput.getAttribute('list')).toBe('team-suggestions-our');

    await user.type(ourInput, 'Be');
    await new Promise((r) => setTimeout(r, 450));

    const list = document.getElementById('team-suggestions-our') as HTMLDataListElement;
    const values = Array.from(list.querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value);

    expect(values).toContain('Beta');
    expect(values).not.toContain('Alpha');
  });

  it('does not show suggestions again after selecting an autocomplete option', async () => {
    const user = userEvent.setup();

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.startsWith('/api/health')) return createMockResponse({ status: 'ok', message: 'ok' });
      if (url.startsWith('/api/demo-teams')) return createMockResponse({ teams: [] });

      if (url.startsWith('/api/teams/search')) {
        const u = new URL(url, 'http://localhost');
        const q = u.searchParams.get('q');

        if (q === 'Be') {
          return createMockResponse([
            { id: 't2', name: 'Beta' },
          ]);
        }
        return createMockResponse([]);
      }

      if (url.startsWith('/api/scout')) return createMockResponse({});

      throw new Error(`Unhandled fetch URL in test: ${url}`);
    });

    render(<App />);

    const opponent = screen.getByLabelText('Opponent team name') as HTMLInputElement;
    await user.type(opponent, 'Be');
    await new Promise((r) => setTimeout(r, 450));

    const list = document.getElementById('team-suggestions') as HTMLDataListElement;
    const valuesBefore = Array.from(list.querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value);
    expect(valuesBefore).toContain('Beta');

    // Simulate selecting the suggestion by completing the exact name (no debounce pause).
    await user.type(opponent, 'ta');
    expect(opponent).toHaveValue('Beta');

    await waitFor(() => {
      const valuesAfter = Array.from(list.querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value);
      expect(valuesAfter).toEqual([]);
    });

    // Wait longer than the debounce window; no new suggestions should reappear.
    await new Promise((r) => setTimeout(r, 450));
    const valuesLater = Array.from(list.querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value);
    expect(valuesLater).toEqual([]);

    const searchCalls = fetchMock.mock.calls.filter(([input]) => {
      const u = typeof input === 'string' ? input : input.toString();
      return u.startsWith('/api/teams/search');
    });
    expect(searchCalls).toHaveLength(1);
  });

  it('prevents generating a report when our team equals the opponent team', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('Opponent team name'), 'SameTeam');
    await user.type(screen.getByLabelText('Your team name (optional)'), 'SameTeam');

    await user.click(screen.getByRole('button', { name: 'Generate Report' }));

    expect(screen.getByText('Your team cannot be the same as the opponent.')).toBeInTheDocument();

    const scoutCalls = fetchMock.mock.calls.filter(([input]) =>
      typeof input === 'string' ? input.startsWith('/api/scout') : input.toString().startsWith('/api/scout')
    );
    expect(scoutCalls).toHaveLength(0);
  });

  it('prevents generating a compare report when team A equals team B', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('checkbox', { name: /compare/i }));

    await user.type(screen.getByLabelText('Opponent team name'), 'SameTeam');
    await user.type(screen.getByLabelText('Opponent B team name'), 'SameTeam');

    await user.click(screen.getByRole('button', { name: 'Generate Report' }));

    expect(screen.getByText('Team A and Team B must be different.')).toBeInTheDocument();

    const scoutCalls = fetchMock.mock.calls.filter(([input]) =>
      typeof input === 'string' ? input.startsWith('/api/scout') : input.toString().startsWith('/api/scout')
    );
    expect(scoutCalls).toHaveLength(0);
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

  it('moves Copy share link next to Export PDF and shows a success tooltip after copying', async () => {
    const user = userEvent.setup();

    const writeText = vi.fn(async (_: string) => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
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
      if (url.startsWith('/api/scout')) return createMockResponse(mockReport);

      throw new Error(`Unhandled fetch URL in test: ${url}`);
    });

    render(<App />);

    // Copy share link should no longer be in the top control bar.
    expect(screen.queryByRole('button', { name: /copy share link/i })).toBeNull();

    await user.type(screen.getByLabelText('Opponent team name'), 'SomeTeam');
    await user.click(screen.getByRole('button', { name: 'Generate Report' }));

    const exportPdf = await screen.findByRole('button', { name: /export pdf/i });
    const copyShare = screen.getByRole('button', { name: /copy share link/i });
    expect(exportPdf.parentElement).toContainElement(copyShare);

    await user.click(copyShare);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    expect(writeText.mock.calls[0][0]).toContain('game=valorant');
    expect(writeText.mock.calls[0][0]).toContain('team=SomeTeam');

    expect(screen.getByRole('status', { name: 'Share link copied' })).toBeInTheDocument();

    await new Promise((r) => setTimeout(r, 1750));
    expect(screen.queryByRole('status', { name: 'Share link copied' })).toBeNull();
  });
});
