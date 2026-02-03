import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeMapPlans } from '../dist/backend/src/data/normalizer.js';

test('normalizeMapPlans aggregates per-map outcomes and common agent comps (VAL)', () => {
  const teamId = 't1';

  const seriesStates = [
    {
      id: 's1',
      startedAt: '2026-01-01T00:00:00Z',
      finished: true,
      teams: [
        { id: teamId, name: 'Team A', score: 2, won: true },
        { id: 't2', name: 'Team B', score: 0, won: false },
      ],
      games: [
        {
          id: 'g1',
          map: { name: 'Ascent' },
          teams: [
            { id: teamId, name: 'Team A', score: 13, won: true },
            { id: 't2', name: 'Team B', score: 8, won: false },
          ],
        },
        {
          id: 'g2',
          map: { name: 'Bind' },
          teams: [
            { id: teamId, name: 'Team A', score: 10, won: false },
            { id: 't2', name: 'Team B', score: 13, won: true },
          ],
        },
      ],
      draftActions: [
        { type: 'PICK', drafter: { id: teamId }, draftable: { name: 'Jett', type: 'AGENT' } },
        { type: 'PICK', drafter: { id: teamId }, draftable: { name: 'Omen', type: 'AGENT' } },
        { type: 'PICK', drafter: { id: teamId }, draftable: { name: 'Sova', type: 'AGENT' } },
        { type: 'PICK', drafter: { id: teamId }, draftable: { name: 'Killjoy', type: 'AGENT' } },
        { type: 'PICK', drafter: { id: teamId }, draftable: { name: 'Skye', type: 'AGENT' } },
      ],
    },
    {
      id: 's2',
      startedAt: '2026-01-02T00:00:00Z',
      finished: true,
      teams: [
        { id: teamId, name: 'Team A', score: 2, won: true },
        { id: 't2', name: 'Team B', score: 0, won: false },
      ],
      games: [
        {
          id: 'g3',
          map: { name: 'Ascent' },
          teams: [
            { id: teamId, name: 'Team A', score: 13, won: true },
            { id: 't2', name: 'Team B', score: 7, won: false },
          ],
        },
      ],
      draftActions: [
        { type: 'PICK', drafter: { id: teamId }, draftable: { name: 'Raze', type: 'AGENT' } },
        { type: 'PICK', drafter: { id: teamId }, draftable: { name: 'Brimstone', type: 'AGENT' } },
        { type: 'PICK', drafter: { id: teamId }, draftable: { name: 'Sova', type: 'AGENT' } },
        { type: 'PICK', drafter: { id: teamId }, draftable: { name: 'Cypher', type: 'AGENT' } },
        { type: 'PICK', drafter: { id: teamId }, draftable: { name: 'Fade', type: 'AGENT' } },
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
      games: [
        {
          id: 'g4',
          map: { name: 'Haven' },
          teams: [
            { id: teamId, name: 'Team A', score: 13, won: true },
            { id: 't2', name: 'Team B', score: 11, won: false },
          ],
        },
      ],
      draftActions: [],
    },
  ];

  const plans = normalizeMapPlans(seriesStates, teamId);
  assert.ok(Array.isArray(plans));

  const ascent = plans.find(p => p.mapName === 'Ascent');
  assert.ok(ascent);
  assert.equal(ascent.matchesPlayed, 2);
  assert.equal(ascent.winRate, 1);
  assert.equal(ascent.siteTendenciesAvailable, false);
  assert.ok(ascent.commonCompositions);
  assert.equal(ascent.commonCompositions.length, 2);

  const compNames = ascent.commonCompositions.map(c => c.members.join('|')).sort();
  assert.deepEqual(compNames, [
    'Brimstone|Cypher|Fade|Raze|Sova',
    'Jett|Killjoy|Omen|Skye|Sova',
  ].sort());

  const bind = plans.find(p => p.mapName === 'Bind');
  assert.ok(bind);
  assert.equal(bind.matchesPlayed, 1);
  assert.equal(bind.winRate, 0);
  assert.ok(bind.commonCompositions);
  assert.equal(bind.commonCompositions.length, 1);
  assert.equal(bind.commonCompositions[0].members.join('|'), 'Jett|Killjoy|Omen|Skye|Sova');
  assert.equal(bind.commonCompositions[0].pickCount, 1);
  assert.equal(bind.commonCompositions[0].winRate, 0);

  const haven = plans.find(p => p.mapName === 'Haven');
  assert.ok(haven);
  assert.equal(haven.matchesPlayed, 1);
  assert.equal(haven.winRate, 1);
  assert.equal(haven.commonCompositions, undefined);
});
