import test from 'node:test';
import assert from 'node:assert/strict';

import { generateHowToWinEngine } from '../dist/backend/src/analysis/scoutingAnalysis.js';

function mkMatch({
  id,
  seriesId,
  startTime,
  mapName,
  teamId,
  teamName,
  teamScore,
  oppScore,
  won,
}) {
  return {
    id,
    seriesId,
    startTime,
    mapName,
    teams: [
      { teamId, teamName, score: teamScore, isWinner: won, players: [] },
      { teamId: 'opp', teamName: 'Opponent', score: oppScore, isWinner: !won, players: [] },
    ],
  };
}

test('generateHowToWinEngine returns scored candidates and selected tips', () => {
  const teamId = 't1';

  const matches = [
    // Two losses on Overpass => low-sample map recommendation must be marked low confidence.
    mkMatch({ id: '1', seriesId: 's1', startTime: '2026-01-01T00:00:00Z', mapName: 'Overpass', teamId, teamName: 'Team', teamScore: 9, oppScore: 13, won: false }),
    mkMatch({ id: '2', seriesId: 's2', startTime: '2026-01-02T00:00:00Z', mapName: 'Overpass', teamId, teamName: 'Team', teamScore: 8, oppScore: 13, won: false }),
    // Four losses on Mirage => higher-sample map weakness should score higher.
    mkMatch({ id: '3', seriesId: 's3', startTime: '2026-01-03T00:00:00Z', mapName: 'Mirage', teamId, teamName: 'Team', teamScore: 7, oppScore: 13, won: false }),
    mkMatch({ id: '4', seriesId: 's4', startTime: '2026-01-04T00:00:00Z', mapName: 'Mirage', teamId, teamName: 'Team', teamScore: 10, oppScore: 13, won: false }),
    mkMatch({ id: '5', seriesId: 's5', startTime: '2026-01-05T00:00:00Z', mapName: 'Mirage', teamId, teamName: 'Team', teamScore: 11, oppScore: 13, won: false }),
    mkMatch({ id: '6', seriesId: 's6', startTime: '2026-01-06T00:00:00Z', mapName: 'Mirage', teamId, teamName: 'Team', teamScore: 9, oppScore: 13, won: false }),
  ];

  const engine = generateHowToWinEngine(matches, teamId);
  assert.ok(engine);
  assert.equal(typeof engine.formula, 'string');
  assert.ok(engine.formula.includes('impact'));

  assert.ok(Array.isArray(engine.selected));
  assert.ok(engine.selected.length > 0);
  assert.ok(engine.selected.length <= 5);

  assert.ok(Array.isArray(engine.candidates));
  assert.ok(engine.candidates.length > 0);

  const overpass = engine.candidates.find(c => c.id === 'map-weakness:Overpass');
  assert.ok(overpass);
  assert.equal(overpass.breakdown.confidence, 'Low');
  assert.ok(overpass.status.includes('LowConfidence'));
  assert.ok(overpass.evidence.includes('Low confidence'));

  const mirage = engine.candidates.find(c => c.id === 'map-weakness:Mirage');
  assert.ok(mirage);
  assert.ok(mirage.breakdown.impact > overpass.breakdown.impact);
});

test('generateHowToWinEngine includes why-not-picked for non-selected candidates when >5 candidates exist', () => {
  const teamId = 't1';
  const start = new Date('2026-01-01T00:00:00Z').getTime();

  const maps = ['A', 'B', 'C', 'D', 'E', 'F'];
  const matches = [];
  let id = 1;
  for (const mapName of maps) {
    for (let i = 0; i < 4; i++) {
      matches.push(
        mkMatch({
          id: String(id++),
          seriesId: `s-${mapName}-${i}`,
          startTime: new Date(start + id * 1000).toISOString(),
          mapName,
          teamId,
          teamName: 'Team',
          teamScore: 7,
          oppScore: 13,
          won: false,
        })
      );
    }
  }

  const engine = generateHowToWinEngine(matches, teamId);
  assert.ok(engine.candidates.length >= 6);

  const notSelected = engine.candidates.find(c => c.status === 'NotSelected' || c.status === 'LowConfidenceNotSelected');
  assert.ok(notSelected);
  assert.ok(notSelected.whyNotSelected);
  assert.ok(String(notSelected.whyNotSelected).includes('cutoff'));
});
