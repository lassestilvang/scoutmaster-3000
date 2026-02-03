import test from 'node:test';
import assert from 'node:assert/strict';

import { filterMatchesByTimeframe } from '../dist/backend/src/analysis/scoutingAnalysis.js';

test('filterMatchesByTimeframe keeps only matches within trailing N days (best-effort)', () => {
  const now = new Date('2026-02-10T00:00:00Z').getTime();

  const mk = (id, startTime) => ({
    id,
    seriesId: `s-${id}`,
    startTime,
    mapName: 'Ascent',
    teams: [
      { teamId: 't1', teamName: 'Team A', score: 13, isWinner: true, players: [] },
      { teamId: 't2', teamName: 'Team B', score: 7, isWinner: false, players: [] },
    ],
  });

  const matches = [
    mk('old', '2026-01-01T00:00:00Z'),
    mk('recent', '2026-02-05T00:00:00Z'),
    mk('invalid', 'not-a-date'),
  ];

  const filtered = filterMatchesByTimeframe(matches, 14, now);
  const ids = filtered.map(m => m.id).sort();

  // 14d window from 2026-02-10 keeps 2026-02-05; drops 2026-01-01; invalid dates are kept best-effort.
  assert.deepEqual(ids, ['invalid', 'recent'].sort());
});
