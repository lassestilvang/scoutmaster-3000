import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { generateReportFromMatches } from '../dist/backend/src/scoutingService.js';
import { calculatePlayerTendencies, calculateRosterStability } from '../dist/backend/src/analysis/scoutingAnalysis.js';

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      const v = value[key];
      if (v === undefined) continue;
      out[key] = stableClone(v);
    }
    return out;
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableClone(value), null, 2);
}

function mkMatch({ id, seriesId, startTime, mapName, teamWon }) {
  const roster = [
    { id: 'p1', name: 'Alice', teamId: 't1' },
    { id: 'p2', name: 'Bob', teamId: 't1' },
  ];

  return {
    id,
    seriesId,
    startTime,
    mapName,
    teams: [
      { teamId: 't1', teamName: 'TestTeam', score: teamWon ? 13 : 7, isWinner: teamWon, players: roster },
      { teamId: 't2', teamName: 'Other', score: teamWon ? 7 : 13, isWinner: !teamWon, players: [] },
    ],
  };
}

test('golden: generated ScoutingReport stays stable for a deterministic fixture', async () => {
  const matches = [
    mkMatch({ id: 'm1', seriesId: 's1', startTime: '2026-01-01T00:00:00.000Z', mapName: 'Mirage', teamWon: true }),
    mkMatch({ id: 'm2', seriesId: 's2', startTime: '2026-01-02T00:00:00.000Z', mapName: 'Mirage', teamWon: true }),
    mkMatch({ id: 'm3', seriesId: 's3', startTime: '2026-01-03T00:00:00.000Z', mapName: 'Mirage', teamWon: true }),
    mkMatch({ id: 'm4', seriesId: 's4', startTime: '2026-01-04T00:00:00.000Z', mapName: 'Inferno', teamWon: false }),
    mkMatch({ id: 'm5', seriesId: 's5', startTime: '2026-01-05T00:00:00.000Z', mapName: 'Inferno', teamWon: false }),
    mkMatch({ id: 'm6', seriesId: 's6', startTime: '2026-01-06T00:00:00.000Z', mapName: 'Inferno', teamWon: false }),
  ];

  const teamRef = 't1';
  const playerTendencies = calculatePlayerTendencies(matches, teamRef);
  const rosterStability = calculateRosterStability(matches, teamRef);

  const report = await generateReportFromMatches(
    matches,
    teamRef,
    'FallbackName',
    { playerTendencies, rosterStability },
    undefined,
    'VALORANT'
  );

  const goldenRaw = await readFile(new URL('./fixtures/scoutingReport.golden.json', import.meta.url), 'utf8');
  const expected = JSON.parse(goldenRaw);

  assert.equal(stableStringify(report), stableStringify(expected));
});
