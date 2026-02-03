import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateWinRateTrend } from '../dist/backend/src/analysis/scoutingAnalysis.js';

function mkMatch({ id, startTime, teamId, opponentId, teamWon }) {
  return {
    id,
    seriesId: `s-${id}`,
    startTime,
    mapName: 'Ascent',
    teams: [
      { teamId, teamName: 'Team', score: teamWon ? 13 : 7, isWinner: teamWon, players: [] },
      { teamId: opponentId, teamName: 'Opp', score: teamWon ? 7 : 13, isWinner: !teamWon, players: [] },
    ],
  };
}

test('calculateWinRateTrend reports an upward trend when recent results improve', () => {
  const teamId = 't1';
  const oppId = 't2';

  const matches = [];

  // Older 5: all losses
  for (let i = 0; i < 5; i++) {
    matches.push(mkMatch({
      id: `old-${i}`,
      startTime: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
      teamId,
      opponentId: oppId,
      teamWon: false,
    }));
  }

  // Recent 5: all wins
  for (let i = 0; i < 5; i++) {
    matches.push(mkMatch({
      id: `new-${i}`,
      startTime: new Date(Date.UTC(2026, 0, 20 + i)).toISOString(),
      teamId,
      opponentId: oppId,
      teamWon: true,
    }));
  }

  const trend = calculateWinRateTrend(matches, teamId, 5);
  assert.ok(trend);
  assert.equal(trend.direction, 'Up');
  assert.equal(trend.deltaPctPoints, 100);
  assert.equal(trend.recentMatches, 5);
  assert.equal(trend.previousMatches, 5);
});

test('calculateWinRateTrend returns undefined when sample is too small', () => {
  const teamId = 't1';
  const oppId = 't2';

  const matches = [
    mkMatch({ id: '1', startTime: '2026-01-01T00:00:00Z', teamId, opponentId: oppId, teamWon: true }),
    mkMatch({ id: '2', startTime: '2026-01-02T00:00:00Z', teamId, opponentId: oppId, teamWon: false }),
    mkMatch({ id: '3', startTime: '2026-01-03T00:00:00Z', teamId, opponentId: oppId, teamWon: true }),
  ];

  const trend = calculateWinRateTrend(matches, teamId, 2);
  assert.equal(trend, undefined);
});
