import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateAggressionProfile } from '../dist/backend/src/analysis/scoutingAnalysis.js';

function mkMatch({ id, startTime, teamScore, opponentScore, teamWon }) {
  return {
    id,
    seriesId: `s-${id}`,
    startTime,
    mapName: 'Ascent',
    teams: [
      { teamId: 't1', teamName: 'Team', score: teamScore, isWinner: teamWon, players: [] },
      { teamId: 't2', teamName: 'Opp', score: opponentScore, isWinner: !teamWon, players: [] },
    ],
  };
}

test('calculateAggressionProfile returns High when average score is above 12', () => {
  const matches = [
    mkMatch({ id: '1', startTime: '2026-01-01T00:00:00Z', teamScore: 13, opponentScore: 7, teamWon: true }),
    mkMatch({ id: '2', startTime: '2026-01-02T00:00:00Z', teamScore: 13, opponentScore: 9, teamWon: true }),
  ];
  assert.equal(calculateAggressionProfile(matches, 't1'), 'High');
});

test('calculateAggressionProfile returns Medium when average score is above 8', () => {
  const matches = [
    mkMatch({ id: '1', startTime: '2026-01-01T00:00:00Z', teamScore: 10, opponentScore: 13, teamWon: false }),
    mkMatch({ id: '2', startTime: '2026-01-02T00:00:00Z', teamScore: 10, opponentScore: 7, teamWon: true }),
  ];
  assert.equal(calculateAggressionProfile(matches, 't1'), 'Medium');
});

test('calculateAggressionProfile returns Low when average score is 8 or below', () => {
  const matches = [
    mkMatch({ id: '1', startTime: '2026-01-01T00:00:00Z', teamScore: 8, opponentScore: 13, teamWon: false }),
    mkMatch({ id: '2', startTime: '2026-01-02T00:00:00Z', teamScore: 8, opponentScore: 7, teamWon: true }),
  ];
  assert.equal(calculateAggressionProfile(matches, 't1'), 'Low');
});
