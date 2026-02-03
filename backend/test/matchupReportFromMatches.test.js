import test from 'node:test';
import assert from 'node:assert/strict';

import { generateMatchupReportFromMatches, generateReportFromMatches } from '../dist/backend/src/scoutingService.js';

function mkMatch({ id, seriesId, startTime, mapName, teamId, teamName, opponentId, opponentName, teamWon }) {
  const teamRoster = [
    { id: `${teamId}:p1`, name: `${teamName} Player 1`, teamId },
    { id: `${teamId}:p2`, name: `${teamName} Player 2`, teamId },
  ];

  return {
    id,
    seriesId,
    startTime,
    mapName,
    teams: [
      { teamId, teamName, score: teamWon ? 13 : 7, isWinner: teamWon, players: teamRoster },
      { teamId: opponentId, teamName: opponentName, score: teamWon ? 7 : 13, isWinner: !teamWon, players: [] },
    ],
  };
}

test('matchup: generateMatchupReportFromMatches returns two-sided matchup payload + transparency', async () => {
  const ourTeamId = 'tOur';
  const ourTeamName = 'OurTeam';
  const oppTeamId = 'tOpp';
  const oppTeamName = 'OppTeam';

  const ourMatches = [
    mkMatch({ id: 'our-m1', seriesId: 's1', startTime: '2026-01-01T00:00:00.000Z', mapName: 'Mirage', teamId: ourTeamId, teamName: ourTeamName, opponentId: 'tX', opponentName: 'Other', teamWon: true }),
    mkMatch({ id: 'our-m2', seriesId: 's2', startTime: '2026-01-02T00:00:00.000Z', mapName: 'Mirage', teamId: ourTeamId, teamName: ourTeamName, opponentId: 'tX', opponentName: 'Other', teamWon: true }),
    mkMatch({ id: 'our-m3', seriesId: 's3', startTime: '2026-01-03T00:00:00.000Z', mapName: 'Inferno', teamId: ourTeamId, teamName: ourTeamName, opponentId: 'tX', opponentName: 'Other', teamWon: false }),
    mkMatch({ id: 'our-m4', seriesId: 's4', startTime: '2026-01-04T00:00:00.000Z', mapName: 'Inferno', teamId: ourTeamId, teamName: ourTeamName, opponentId: 'tX', opponentName: 'Other', teamWon: false }),
  ];

  const opponentMatches = [
    mkMatch({ id: 'opp-m1', seriesId: 's10', startTime: '2026-01-01T00:00:00.000Z', mapName: 'Inferno', teamId: oppTeamId, teamName: oppTeamName, opponentId: 'tY', opponentName: 'Other2', teamWon: true }),
    mkMatch({ id: 'opp-m2', seriesId: 's11', startTime: '2026-01-02T00:00:00.000Z', mapName: 'Inferno', teamId: oppTeamId, teamName: oppTeamName, opponentId: 'tY', opponentName: 'Other2', teamWon: true }),
    mkMatch({ id: 'opp-m3', seriesId: 's12', startTime: '2026-01-03T00:00:00.000Z', mapName: 'Mirage', teamId: oppTeamId, teamName: oppTeamName, opponentId: 'tY', opponentName: 'Other2', teamWon: false }),
    mkMatch({ id: 'opp-m4', seriesId: 's13', startTime: '2026-01-04T00:00:00.000Z', mapName: 'Mirage', teamId: oppTeamId, teamName: oppTeamName, opponentId: 'tY', opponentName: 'Other2', teamWon: false }),
  ];

  const report = await generateMatchupReportFromMatches(
    ourMatches,
    ourTeamId,
    ourTeamName,
    opponentMatches,
    oppTeamId,
    oppTeamName,
    undefined,
    'VALORANT'
  );

  assert.equal(report.ourTeamName, ourTeamName);
  assert.equal(report.opponentName, oppTeamName);

  // Matchup mode overrides tips; opponent-only engine is stored under `matchup`.
  assert.equal(report.howToWinEngine, undefined);
  assert.ok(report.matchup);

  assert.equal(report.matchup.our.teamName, ourTeamName);
  assert.equal(report.matchup.opponent.teamName, oppTeamName);
  assert.equal(report.matchup.howToWinTransparency.kind, 'MatchupHeuristics');
  assert.equal(report.matchup.howToWinTransparency.basedOn.ourMatchesAnalyzed, ourMatches.length);
  assert.equal(report.matchup.howToWinTransparency.basedOn.opponentMatchesAnalyzed, opponentMatches.length);

  assert.ok(report.matchup.deltas.mapPool.length > 0);
  assert.ok(typeof report.matchup.our.winRate === 'number');
  assert.ok(typeof report.matchup.opponent.winRate === 'number');

  assert.ok(report.matchup.opponentHowToWinEngine);
  assert.ok(report.matchup.opponentHowToWinEngine.candidates.length > 0);
});

test('non-matchup: generateReportFromMatches still includes howToWinEngine', async () => {
  const matches = [
    mkMatch({ id: 'm1', seriesId: 's1', startTime: '2026-01-01T00:00:00.000Z', mapName: 'Mirage', teamId: 't1', teamName: 'TeamA', opponentId: 't2', opponentName: 'TeamB', teamWon: true }),
    mkMatch({ id: 'm2', seriesId: 's2', startTime: '2026-01-02T00:00:00.000Z', mapName: 'Inferno', teamId: 't1', teamName: 'TeamA', opponentId: 't2', opponentName: 'TeamB', teamWon: false }),
  ];

  const report = await generateReportFromMatches(matches, 't1', 'TeamA', undefined, undefined, 'VALORANT');
  assert.ok(report.howToWinEngine);
  assert.ok(report.howToWinEngine.candidates.length > 0);
});
