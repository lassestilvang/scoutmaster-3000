import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeCompositionStats, normalizeDraftStats } from '../src/data/normalizer.js';

test('normalizeDraftStats aggregates picks/bans and win rate for picks', () => {
  const teamId = 't1';
  const seriesStates: any[] = [
    {
      id: 's1',
      startedAt: '2026-01-01T00:00:00Z',
      finished: true,
      teams: [
        { id: teamId, name: 'Team A', score: 1, won: true },
        { id: 't2', name: 'Team B', score: 0, won: false },
      ],
      games: [],
      draftActions: [
        { type: 'PICK', drafter: { id: teamId }, draftable: { name: 'Jett', type: 'AGENT' } },
        { type: 'PICK', drafter: { id: teamId }, draftable: { name: 'Sova', type: 'AGENT' } },
        { type: 'BAN', drafter: { id: teamId }, draftable: { name: 'Ascent', type: 'MAP' } },
      ],
    },
    {
      id: 's2',
      startedAt: '2026-01-02T00:00:00Z',
      finished: true,
      teams: [
        { id: teamId, name: 'Team A', score: 0, won: false },
        { id: 't2', name: 'Team B', score: 1, won: true },
      ],
      games: [],
      draftActions: [
        { type: 'PICK', drafter: { id: teamId }, draftable: { name: 'Jett', type: 'AGENT' } },
        { type: 'BAN', drafter: { id: teamId }, draftable: { name: 'Ascent', type: 'MAP' } },
      ],
    },
  ];

  const stats = normalizeDraftStats(seriesStates as any, teamId);

  const jett = stats.find(s => s.heroOrMapName === 'Jett');
  assert.ok(jett);
  assert.equal(jett.pickCount, 2);
  assert.equal(jett.banCount, 0);
  assert.equal(jett.winRate, 0.5);

  const ascent = stats.find(s => s.heroOrMapName === 'Ascent');
  assert.ok(ascent);
  assert.equal(ascent.pickCount, 0);
  assert.equal(ascent.banCount, 2);
  assert.equal(ascent.winRate, 0);
});

test('normalizeCompositionStats groups per-series compositions and computes win rate', () => {
  const teamId = 't1';
  const seriesStates: any[] = [
    {
      id: 's1',
      startedAt: '2026-01-01T00:00:00Z',
      finished: true,
      teams: [
        { id: teamId, name: 'Team A', score: 1, won: true },
        { id: 't2', name: 'Team B', score: 0, won: false },
      ],
      games: [],
      draftActions: [
        { type: 'PICK', drafter: { id: teamId }, draftable: { name: 'Jett', type: 'AGENT' } },
        { type: 'PICK', drafter: { id: teamId }, draftable: { name: 'Sova', type: 'AGENT' } },
      ],
    },
    {
      id: 's2',
      startedAt: '2026-01-02T00:00:00Z',
      finished: true,
      teams: [
        { id: teamId, name: 'Team A', score: 0, won: false },
        { id: 't2', name: 'Team B', score: 1, won: true },
      ],
      games: [],
      draftActions: [
        { type: 'PICK', drafter: { id: teamId }, draftable: { name: 'Sova', type: 'AGENT' } },
        { type: 'PICK', drafter: { id: teamId }, draftable: { name: 'Jett', type: 'AGENT' } },
      ],
    },
    {
      id: 's3',
      startedAt: '2026-01-03T00:00:00Z',
      finished: true,
      teams: [
        { id: teamId, name: 'Team A', score: 1, won: true },
        { id: 't2', name: 'Team B', score: 0, won: false },
      ],
      games: [],
      draftActions: [
        { type: 'PICK', drafter: { id: teamId }, draftable: { name: 'Raze', type: 'AGENT' } },
        { type: 'PICK', drafter: { id: teamId }, draftable: { name: 'Omen', type: 'AGENT' } },
      ],
    },
  ];

  const comps = normalizeCompositionStats(seriesStates as any, teamId);

  const jettSova = comps.find(c => c.kind === 'AGENT' && c.members.join('|') === 'Jett|Sova');
  assert.ok(jettSova);
  assert.equal(jettSova.pickCount, 2);
  assert.equal(jettSova.winRate, 0.5);

  const omenRaze = comps.find(c => c.kind === 'AGENT' && c.members.join('|') === 'Omen|Raze');
  assert.ok(omenRaze);
  assert.equal(omenRaze.pickCount, 1);
  assert.equal(omenRaze.winRate, 1);
});
