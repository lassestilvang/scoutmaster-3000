import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateWinRate } from '../dist/backend/src/analysis/scoutingAnalysis.js';

function mkMatch({
  id,
  startTime,
  mapName = 'Ascent',
  teamId = 't1',
  teamName = 'Team',
  opponentId = 't2',
  opponentName = 'Opp',
  teamWon,
}) {
  return {
    id,
    seriesId: `s-${id}`,
    startTime,
    mapName,
    teams: [
      { teamId, teamName, score: teamWon ? 13 : 7, isWinner: teamWon, players: [] },
      { teamId: opponentId, teamName: opponentName, score: teamWon ? 7 : 13, isWinner: !teamWon, players: [] },
    ],
  };
}

test('calculateWinRate returns 0 for empty input', () => {
  assert.equal(calculateWinRate([], 't1'), 0);
});

test('calculateWinRate rounds to the nearest integer percentage', () => {
  const matches = [
    mkMatch({ id: '1', startTime: '2026-01-01T00:00:00Z', teamWon: true }),
    mkMatch({ id: '2', startTime: '2026-01-02T00:00:00Z', teamWon: true }),
    mkMatch({ id: '3', startTime: '2026-01-03T00:00:00Z', teamWon: false }),
  ];

  // 2 / 3 => 66.666... => 67
  assert.equal(calculateWinRate(matches, 't1'), 67);
});

test('calculateWinRate can resolve the team by name (case-insensitive)', () => {
  const matches = [
    mkMatch({ id: '1', startTime: '2026-01-01T00:00:00Z', teamName: 'Test Team', teamWon: true }),
    mkMatch({ id: '2', startTime: '2026-01-02T00:00:00Z', teamName: 'Test Team', teamWon: false }),
  ];

  assert.equal(calculateWinRate(matches, 'test team'), 50);
});
