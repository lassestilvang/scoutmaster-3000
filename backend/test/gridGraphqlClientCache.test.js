import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { GridGraphqlClient } from '../dist/backend/src/data/gridGraphqlClient.js';

function okJson(data) {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('GridGraphqlClient coalesces concurrent identical requests', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    await new Promise(r => setTimeout(r, 30));
    return okJson({ allSeries: { edges: [] } });
  };

  const client = new GridGraphqlClient('api-key', {
    fetchImpl,
    enableDiskCache: false,
  });

  const [a, b] = await Promise.all([
    client.getRecentSeriesByTeam('t1', 10),
    client.getRecentSeriesByTeam('t1', 10),
  ]);

  assert.deepEqual(a, []);
  assert.deepEqual(b, []);
  assert.equal(calls, 1);
});

test('GridGraphqlClient persists cache to disk across instances', async () => {
  const tmpBase = path.join(process.cwd(), 'test', '.tmp-grid-cache-');
  await fs.mkdir(path.join(process.cwd(), 'test'), { recursive: true });
  const cacheDir = await fs.mkdtemp(tmpBase);

  try {
    let callsA = 0;
    const fetchA = async () => {
      callsA++;
      return okJson({ allSeries: { edges: [{ node: { id: 's1', startTimeScheduled: '2026-01-01T00:00:00Z' } }] } });
    };

    const clientA = new GridGraphqlClient('api-key', {
      fetchImpl: fetchA,
      cacheDir,
      enableDiskCache: true,
      ttlMs: 60_000,
    });

    const r1 = await clientA.getRecentSeriesByTeam('t1', 10);
    assert.equal(callsA, 1);
    assert.deepEqual(r1, [{ id: 's1', startTimeScheduled: '2026-01-01T00:00:00Z' }]);

    let callsB = 0;
    const fetchB = async () => {
      callsB++;
      return okJson({ allSeries: { edges: [] } });
    };

    const clientB = new GridGraphqlClient('api-key', {
      fetchImpl: fetchB,
      cacheDir,
      enableDiskCache: true,
      ttlMs: 60_000,
    });

    const r2 = await clientB.getRecentSeriesByTeam('t1', 10);
    assert.equal(callsB, 0, 'should hit disk cache instead of fetching');
    assert.deepEqual(r2, [{ id: 's1', startTimeScheduled: '2026-01-01T00:00:00Z' }]);
  } finally {
    await fs.rm(cacheDir, { recursive: true, force: true });
  }
});
