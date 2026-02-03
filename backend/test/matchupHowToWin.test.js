import test from 'node:test';
import assert from 'node:assert/strict';

import { generateHowToWinMatchup } from '../dist/backend/src/analysis/scoutingAnalysis.js';

test('generateHowToWinMatchup recommends advantageous maps and warns on disadvantage maps', () => {
  const usId = 'us';
  const oppId = 'opp';

  const mkMatch = ({ id, mapName, ourScore, oppScore, ourWon }) => ({
    id,
    seriesId: `s-${id}`,
    startTime: '2026-01-01T00:00:00Z',
    mapName,
    teams: [
      { teamId: usId, teamName: 'Us', score: ourScore, isWinner: ourWon, players: [] },
      { teamId: oppId, teamName: 'Them', score: oppScore, isWinner: !ourWon, players: [] },
    ],
  });

  const ourMatches = [
    mkMatch({ id: '1', mapName: 'Ascent', ourScore: 13, oppScore: 7, ourWon: true }),
    mkMatch({ id: '2', mapName: 'Ascent', ourScore: 13, oppScore: 11, ourWon: true }),
    mkMatch({ id: '3', mapName: 'Bind', ourScore: 9, oppScore: 13, ourWon: false }),
  ];

  const opponentMatches = [
    // Same maps, but flipped results to create a clear delta
    {
      id: 'o1',
      seriesId: 'so1',
      startTime: '2026-01-01T00:00:00Z',
      mapName: 'Ascent',
      teams: [
        { teamId: oppId, teamName: 'Them', score: 7, isWinner: false, players: [] },
        { teamId: 'x', teamName: 'Other', score: 13, isWinner: true, players: [] },
      ],
    },
    {
      id: 'o2',
      seriesId: 'so2',
      startTime: '2026-01-02T00:00:00Z',
      mapName: 'Bind',
      teams: [
        { teamId: oppId, teamName: 'Them', score: 13, isWinner: true, players: [] },
        { teamId: 'x', teamName: 'Other', score: 10, isWinner: false, players: [] },
      ],
    },
  ];

  const tips = generateHowToWinMatchup(ourMatches, usId, opponentMatches, oppId);
  assert.ok(Array.isArray(tips));
  assert.ok(tips.length > 0);
  assert.ok(tips.length <= 5);

  const insights = tips.map(t => t.insight).join(' | ');
  assert.ok(insights.includes('Prioritize Ascent'));
  assert.ok(insights.includes('Avoid Bind'));
});

test('generateHowToWinMatchup provides useful guidance even when there are no shared maps', () => {
  const usId = 'us';
  const oppId = 'opp';

  const ourMatches = [
    {
      id: 'u1',
      seriesId: 'su1',
      startTime: '2026-01-01T00:00:00Z',
      mapName: 'Ascent',
      teams: [
        { teamId: usId, teamName: 'Us', score: 13, isWinner: true, players: [] },
        { teamId: 'x', teamName: 'Other', score: 7, isWinner: false, players: [] },
      ],
    },
    {
      id: 'u2',
      seriesId: 'su2',
      startTime: '2026-01-02T00:00:00Z',
      mapName: 'Ascent',
      teams: [
        { teamId: usId, teamName: 'Us', score: 13, isWinner: true, players: [] },
        { teamId: 'x', teamName: 'Other', score: 10, isWinner: false, players: [] },
      ],
    },
  ];

  const opponentMatches = [
    {
      id: 'o1',
      seriesId: 'so1',
      startTime: '2026-01-01T00:00:00Z',
      mapName: 'Bind',
      teams: [
        { teamId: oppId, teamName: 'Them', score: 13, isWinner: true, players: [] },
        { teamId: 'y', teamName: 'Other', score: 8, isWinner: false, players: [] },
      ],
    },
    {
      id: 'o2',
      seriesId: 'so2',
      startTime: '2026-01-02T00:00:00Z',
      mapName: 'Bind',
      teams: [
        { teamId: oppId, teamName: 'Them', score: 13, isWinner: true, players: [] },
        { teamId: 'y', teamName: 'Other', score: 11, isWinner: false, players: [] },
      ],
    },
  ];

  const tips = generateHowToWinMatchup(ourMatches, usId, opponentMatches, oppId);
  assert.ok(Array.isArray(tips));
  assert.ok(tips.length > 0);

  const insights = tips.map(t => t.insight).join(' | ');
  assert.ok(insights.includes('Steer the series toward Ascent'));
  assert.ok(insights.includes('Avoid Bind'));
});
