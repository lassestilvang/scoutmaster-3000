import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const createMockResponse = (data: unknown, ok = true) =>
  ({
    ok,
    json: async () => data,
  }) as any;

describe('App', () => {
  beforeEach(() => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
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
});
