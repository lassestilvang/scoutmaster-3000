import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (!addr || typeof addr === 'string') {
        srv.close(() => reject(new Error('Failed to allocate free port')));
        return;
      }
      const p = addr.port;
      srv.close(() => resolve(p));
    });
  });
}

async function waitForHealthy(port, timeoutMs = 3000) {
  const started = Date.now();
  // Poll until the server responds.
  // This avoids depending on stdout timing.
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return;
    } catch {
      // keep polling
    }
    await new Promise(r => setTimeout(r, 75));
  }
  throw new Error(`Server did not become healthy within ${timeoutMs}ms`);
}

test('GET /api/demo-teams returns curated demo teams in local Express dev', async (t) => {
  const port = await getFreePort();
  const entry = path.join(process.cwd(), 'dist', 'backend', 'src', 'index.js');

  const proc = spawn(process.execPath, [entry], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  proc.stderr.on('data', (d) => { stderr += String(d); });

  t.after(() => {
    proc.kill();
  });

  await waitForHealthy(port);

  const resV = await fetch(`http://127.0.0.1:${port}/api/demo-teams?game=valorant`);
  assert.equal(resV.status, 200, `unexpected status: ${resV.status}; stderr=${stderr}`);
  const bodyV = await resV.json();
  assert.equal(bodyV.game, 'VALORANT');
  assert.ok(Array.isArray(bodyV.teams));
  assert.ok(bodyV.teams.length > 0);
  assert.equal(bodyV.teams[0].name, 'Cloud9');

  const resL = await fetch(`http://127.0.0.1:${port}/api/demo-teams?game=lol`);
  assert.equal(resL.status, 200);
  const bodyL = await resL.json();
  assert.equal(bodyL.game, 'LOL');
  assert.ok(Array.isArray(bodyL.teams));
  assert.ok(bodyL.teams.length > 0);
  assert.equal(bodyL.teams[0].name, 'Cloud9 Kia');

  const resAll = await fetch(`http://127.0.0.1:${port}/api/demo-teams`);
  assert.equal(resAll.status, 200);
  const bodyAll = await resAll.json();
  assert.equal(bodyAll.game, null);
  assert.ok(Array.isArray(bodyAll.teams));
  assert.ok(bodyAll.teams.length >= bodyV.teams.length + bodyL.teams.length);
});
