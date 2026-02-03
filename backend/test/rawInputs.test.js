import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReportRawInputs } from '../dist/backend/src/analysis/scoutingAnalysis.js';

test('buildReportRawInputs produces a bounded, sorted normalized match list with results', () => {
  const teamId = 't1';

  const matches = [
    {
      id: 'm1',
      seriesId: 's1',
      startTime: '2026-01-01T00:00:00Z',
      mapName: 'Ascent',
      teams: [
        { teamId, teamName: 'Team A', score: 13, isWinner: true, players: [] },
        { teamId: 't2', teamName: 'Team B', score: 9, isWinner: false, players: [] },
      ],
    },
    {
      id: 'm2',
      seriesId: 's2',
      startTime: '2026-01-03T00:00:00Z',
      mapName: 'Bind',
      teams: [
        { teamId, teamName: 'Team A', score: 9, isWinner: false, players: [] },
        { teamId: 't2', teamName: 'Team B', score: 13, isWinner: true, players: [] },
      ],
    },
    {
      id: 'm3',
      seriesId: 's3',
      startTime: '2026-01-02T00:00:00Z',
      mapName: 'Haven',
      teams: [
        { teamId, teamName: 'Team A', score: 11, isWinner: false, players: [] },
        { teamId: 't3', teamName: 'Team C', score: 13, isWinner: true, players: [] },
      ],
    },
  ];

  const raw = buildReportRawInputs(matches, teamId, 2);
  assert.equal(raw.kind, 'NormalizedMatches');
  assert.equal(raw.totalMatches, 3);
  assert.equal(raw.shownMatches, 2);
  assert.equal(raw.truncated, true);
  assert.equal(raw.matches.length, 2);

  // Sorted newest first
  assert.equal(raw.matches[0].matchId, 'm2');
  assert.equal(raw.matches[0].result, 'L');
  assert.equal(raw.matches[0].opponentName, 'Team B');
  assert.equal(raw.matches[0].teamScore, 9);
  assert.equal(raw.matches[0].opponentScore, 13);

  assert.equal(raw.matches[1].matchId, 'm3');
  assert.equal(raw.matches[1].result, 'L');
  assert.equal(raw.matches[1].opponentName, 'Team C');
});
