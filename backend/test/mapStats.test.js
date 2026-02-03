import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateMapStats } from '../dist/backend/src/analysis/scoutingAnalysis.js';

function mkMatch({ id, startTime, mapName, teamId = 't1', teamName = 'Team', opponentId = 't2', teamWon }) {
  return {
    id,
    seriesId: `s-${id}`,
    startTime,
    mapName,
    teams: [
      { teamId, teamName, score: teamWon ? 13 : 7, isWinner: teamWon, players: [] },
      { teamId: opponentId, teamName: 'Opp', score: teamWon ? 7 : 13, isWinner: !teamWon, players: [] },
    ],
  };
}

test('calculateMapStats aggregates by map and sorts by matches played', () => {
  const matches = [
    mkMatch({ id: '1', startTime: '2026-01-01T00:00:00Z', mapName: 'Mirage', teamWon: true }),
    mkMatch({ id: '2', startTime: '2026-01-02T00:00:00Z', mapName: 'Mirage', teamWon: false }),
    mkMatch({ id: '3', startTime: '2026-01-03T00:00:00Z', mapName: 'Mirage', teamWon: true }),
    mkMatch({ id: '4', startTime: '2026-01-04T00:00:00Z', mapName: 'Inferno', teamWon: true }),
  ];

  const stats = calculateMapStats(matches, 't1');
  assert.equal(stats.length, 2);
  assert.equal(stats[0].mapName, 'Mirage');
  assert.equal(stats[0].matchesPlayed, 3);
  assert.equal(stats[0].winRate, 2 / 3);
  assert.equal(stats[1].mapName, 'Inferno');
  assert.equal(stats[1].matchesPlayed, 1);
  assert.equal(stats[1].winRate, 1);
});

test('calculateMapStats can resolve the team by name', () => {
  const matches = [
    mkMatch({ id: '1', startTime: '2026-01-01T00:00:00Z', mapName: 'Ascent', teamName: 'Example', teamWon: true }),
    mkMatch({ id: '2', startTime: '2026-01-02T00:00:00Z', mapName: 'Ascent', teamName: 'Example', teamWon: true }),
  ];

  const stats = calculateMapStats(matches, 'example');
  assert.deepEqual(stats, [{ mapName: 'Ascent', matchesPlayed: 2, winRate: 1 }]);
});
