import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizePlayerDraftPicks } from '../dist/backend/src/data/normalizer.js';
import { calculatePlayerTendencies, calculateRosterStability } from '../dist/backend/src/analysis/scoutingAnalysis.js';

test('calculatePlayerTendencies aggregates per-player map performance from match participation', () => {
  const teamId = 't1';

  const p1 = { id: 'p1', name: 'Player1', teamId };
  const p2 = { id: 'p2', name: 'Player2', teamId };

  const matches = [
    {
      id: 'g1',
      seriesId: 's1',
      startTime: '2026-01-03T00:00:00Z',
      mapName: 'Ascent',
      teams: [
        { teamId, teamName: 'Team A', score: 13, isWinner: true, players: [p1, p2] },
        { teamId: 't2', teamName: 'Team B', score: 9, isWinner: false, players: [] },
      ],
    },
    {
      id: 'g2',
      seriesId: 's2',
      startTime: '2026-01-02T00:00:00Z',
      mapName: 'Bind',
      teams: [
        { teamId, teamName: 'Team A', score: 9, isWinner: false, players: [p1] },
        { teamId: 't2', teamName: 'Team B', score: 13, isWinner: true, players: [] },
      ],
    },
    {
      id: 'g3',
      seriesId: 's3',
      startTime: '2026-01-01T00:00:00Z',
      mapName: 'Ascent',
      teams: [
        { teamId, teamName: 'Team A', score: 13, isWinner: true, players: [p1, p2] },
        { teamId: 't2', teamName: 'Team B', score: 11, isWinner: false, players: [] },
      ],
    },
  ];

  const tendencies = calculatePlayerTendencies(matches, teamId);
  assert.ok(Array.isArray(tendencies));

  const t1 = tendencies.find(t => t.playerId === 'p1');
  assert.ok(t1);
  assert.equal(t1.matchesPlayed, 3);
  assert.equal(t1.winRate, 2 / 3);
  assert.equal(t1.mapPerformance.find(m => m.mapName === 'Ascent')?.matchesPlayed, 2);

  const t2 = tendencies.find(t => t.playerId === 'p2');
  assert.ok(t2);
  assert.equal(t2.matchesPlayed, 2);
  assert.equal(t2.winRate, 1);
});

test('calculateRosterStability estimates core players and confidence from recent matches', () => {
  const teamId = 't1';
  const p1 = { id: 'p1', name: 'Player1', teamId };
  const p2 = { id: 'p2', name: 'Player2', teamId };

  const matches = [
    {
      id: 'g1',
      seriesId: 's1',
      startTime: '2026-01-03T00:00:00Z',
      mapName: 'Ascent',
      teams: [
        { teamId, teamName: 'Team A', score: 13, isWinner: true, players: [p1, p2] },
        { teamId: 't2', teamName: 'Team B', score: 9, isWinner: false, players: [] },
      ],
    },
    {
      id: 'g2',
      seriesId: 's2',
      startTime: '2026-01-02T00:00:00Z',
      mapName: 'Bind',
      teams: [
        { teamId, teamName: 'Team A', score: 9, isWinner: false, players: [p1] },
        { teamId: 't2', teamName: 'Team B', score: 13, isWinner: true, players: [] },
      ],
    },
    {
      id: 'g3',
      seriesId: 's3',
      startTime: '2026-01-01T00:00:00Z',
      mapName: 'Ascent',
      teams: [
        { teamId, teamName: 'Team A', score: 13, isWinner: true, players: [p1, p2] },
        { teamId: 't2', teamName: 'Team B', score: 11, isWinner: false, players: [] },
      ],
    },
  ];

  const stability = calculateRosterStability(matches, teamId);
  assert.ok(stability);
  assert.equal(stability.matchesConsidered, 3);
  assert.equal(stability.uniquePlayersSeen, 2);
  // threshold = ceil(3 * 0.8) = 3 => only p1 appears in all 3
  assert.deepEqual(stability.corePlayers.map(p => p.id).sort(), ['p1']);
  assert.equal(stability.confidence, 'Medium');
});

test('normalizePlayerDraftPicks aggregates per-player picks when drafter is a player id', () => {
  const teamId = 't1';

  const seriesStates = [
    {
      id: 's1',
      startedAt: '2026-01-01T00:00:00Z',
      finished: true,
      teams: [
        { id: teamId, name: 'Team A', score: 1, won: true, players: [{ id: 'p1', name: 'Player1' }, { id: 'p2', name: 'Player2' }] },
        { id: 't2', name: 'Team B', score: 0, won: false, players: [] },
      ],
      games: [],
      draftActions: [
        { type: 'PICK', drafter: { id: 'p1' }, draftable: { name: 'Jett', type: 'AGENT' } },
        { type: 'PICK', drafter: { id: 'p1' }, draftable: { name: 'Jett', type: 'AGENT' } },
        { type: 'PICK', drafter: { id: 'p2' }, draftable: { name: 'Omen', type: 'AGENT' } },
      ],
    },
    {
      id: 's2',
      startedAt: '2026-01-02T00:00:00Z',
      finished: true,
      teams: [
        { id: teamId, name: 'Team A', score: 0, won: false, players: [{ id: 'p1', name: 'Player1' }, { id: 'p2', name: 'Player2' }] },
        { id: 't2', name: 'Team B', score: 1, won: true, players: [] },
      ],
      games: [],
      draftActions: [
        { type: 'PICK', drafter: { id: 'p1' }, draftable: { name: 'Jett', type: 'AGENT' } },
      ],
    },
  ];

  const picksByPlayer = normalizePlayerDraftPicks(seriesStates, teamId);
  assert.ok(picksByPlayer.p1);
  const p1Jett = picksByPlayer.p1.find(p => p.name === 'Jett');
  assert.ok(p1Jett);
  assert.equal(p1Jett.pickCount, 3);
  assert.equal(p1Jett.winRate, 2 / 3);

  assert.ok(picksByPlayer.p2);
  const p2Omen = picksByPlayer.p2.find(p => p.name === 'Omen');
  assert.ok(p2Omen);
  assert.equal(p2Omen.pickCount, 1);
  assert.equal(p2Omen.winRate, 1);
});
