import test from 'node:test';
import assert from 'node:assert/strict';

import { generateHowToWin } from '../dist/backend/src/analysis/scoutingAnalysis.js';

function mkMatch({ id, startTime, mapName, teamWon }) {
  return {
    id,
    seriesId: `s-${id}`,
    startTime,
    mapName,
    teams: [
      { teamId: 't1', teamName: 'Opponent', score: teamWon ? 13 : 7, isWinner: teamWon, players: [] },
      { teamId: 't2', teamName: 'Other', score: teamWon ? 7 : 13, isWinner: !teamWon, players: [] },
    ],
  };
}

test('generateHowToWin includes a map-weakness recommendation when a weak map has enough sample', () => {
  const matches = [
    // 3 wins on Mirage
    mkMatch({ id: '1', startTime: '2026-01-01T00:00:00Z', mapName: 'Mirage', teamWon: true }),
    mkMatch({ id: '2', startTime: '2026-01-02T00:00:00Z', mapName: 'Mirage', teamWon: true }),
    mkMatch({ id: '3', startTime: '2026-01-03T00:00:00Z', mapName: 'Mirage', teamWon: true }),
    // 3 losses on Inferno
    mkMatch({ id: '4', startTime: '2026-01-04T00:00:00Z', mapName: 'Inferno', teamWon: false }),
    mkMatch({ id: '5', startTime: '2026-01-05T00:00:00Z', mapName: 'Inferno', teamWon: false }),
    mkMatch({ id: '6', startTime: '2026-01-06T00:00:00Z', mapName: 'Inferno', teamWon: false }),
  ];

  const tips = generateHowToWin(matches, 't1');
  assert.ok(Array.isArray(tips));
  assert.ok(tips.length > 0);
  assert.ok(tips.length <= 5);

  const insights = tips.map(t => t.insight);
  assert.ok(insights.includes('Force the series to Inferno'));
  assert.ok(insights.includes('Punish narrow map pool'));

  for (const t of tips) {
    assert.equal(typeof t.insight, 'string');
    assert.equal(typeof t.evidence, 'string');
    assert.ok(t.evidence.length > 0);
  }
});
