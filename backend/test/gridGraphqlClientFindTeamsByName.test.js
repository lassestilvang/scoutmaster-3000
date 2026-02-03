import test from 'node:test';
import assert from 'node:assert/strict';

import { GridGraphqlClient } from '../dist/backend/src/data/gridGraphqlClient.js';

function okJson(data) {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('GridGraphqlClient.findTeamsByName filters by game using permissive title matching', async () => {
  const fetchImpl = async (_input, init) => {
    const body = init && typeof init.body === 'string' ? JSON.parse(init.body) : {};
    assert.ok(String(body.query || '').includes('query FindTeams'), 'expected FindTeams query');

    return okJson({
      teams: {
        edges: [
          {
            node: {
              id: 't-val-1',
              name: 'Cloud9',
              title: { name: 'VALORANT Champions Tour' },
              titles: [],
            },
          },
          {
            node: {
              id: 't-lol-1',
              name: 'T1',
              title: { name: 'League of Legends' },
              titles: [],
            },
          },
          {
            node: {
              id: 't-val-2',
              name: 'Some VCT Team',
              title: { name: 'VCT EMEA' },
              titles: [],
            },
          },
        ],
      },
    });
  };

  const client = new GridGraphqlClient('api-key', {
    fetchImpl,
    enableDiskCache: false,
    enableKvCache: false,
  });

  const val = await client.findTeamsByName('c', 10, 'VALORANT');
  assert.deepEqual(
    val.map(t => t.id),
    ['t-val-1', 't-val-2'],
    'should keep VALORANT/VCT titled teams'
  );

  const lol = await client.findTeamsByName('t', 10, 'LOL');
  assert.deepEqual(
    lol.map(t => t.id),
    ['t-lol-1'],
    'should keep League of Legends titled teams'
  );
});

test('GridGraphqlClient.findTeamsByName falls back to unfiltered candidates when filtering would eliminate all', async () => {
  const fetchImpl = async () => {
    return okJson({
      teams: {
        edges: [
          {
            node: {
              id: 't-other-1',
              name: 'Ambiguous Team',
              title: { name: 'Counter-Strike' },
              titles: [],
            },
          },
        ],
      },
    });
  };

  const client = new GridGraphqlClient('api-key', {
    fetchImpl,
    enableDiskCache: false,
    enableKvCache: false,
  });

  const r = await client.findTeamsByName('a', 10, 'VALORANT');
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 't-other-1');
});
