import test from 'node:test';
import assert from 'node:assert/strict';

function createRes() {
  const headers = {};
  let body = '';
  const res = {
    statusCode: 200,
    setHeader(k, v) {
      headers[String(k).toLowerCase()] = v;
    },
    end(chunk) {
      if (chunk) body += String(chunk);
      return undefined;
    },
  };
  return { res, headers, getBody: () => body };
}

test('/api/demo-teams returns hardcoded teams for VALORANT', async () => {
  const { default: handler } = await import('../../api/demo-teams.js');
  const { res, getBody } = createRes();

  await handler(
    { method: 'GET', url: '/api/demo-teams?game=valorant', headers: { host: 'localhost' } },
    res
  );

  assert.equal(res.statusCode, 200);
  const parsed = JSON.parse(getBody());
  assert.equal(parsed.game, 'VALORANT');
  assert.ok(Array.isArray(parsed.teams));
  assert.ok(parsed.teams.length > 0);
  assert.ok(parsed.teams.some((t) => t.name === 'Cloud9'));
});

test('/api/demo-teams returns hardcoded teams for LOL', async () => {
  const { default: handler } = await import('../../api/demo-teams.js');
  const { res, getBody } = createRes();

  await handler(
    { method: 'GET', url: '/api/demo-teams?game=lol', headers: { host: 'localhost' } },
    res
  );

  assert.equal(res.statusCode, 200);
  const parsed = JSON.parse(getBody());
  assert.equal(parsed.game, 'LOL');
  assert.ok(Array.isArray(parsed.teams));
  assert.ok(parsed.teams.length > 0);
  assert.ok(parsed.teams.some((t) => t.name === 'T1'));
});

test('/api/demo-teams without game returns both lists', async () => {
  const { default: handler } = await import('../../api/demo-teams.js');
  const { res, getBody } = createRes();

  await handler(
    { method: 'GET', url: '/api/demo-teams', headers: { host: 'localhost' } },
    res
  );

  assert.equal(res.statusCode, 200);
  const parsed = JSON.parse(getBody());
  assert.equal(parsed.game, null);
  assert.ok(Array.isArray(parsed.teams));
  assert.ok(parsed.teams.length >= 2);
  assert.ok(parsed.teams.some((t) => t.name === 'Cloud9'));
  assert.ok(parsed.teams.some((t) => t.name === 'T1'));
});

test('/api/demo-teams rejects non-GET methods', async () => {
  const { default: handler } = await import('../../api/demo-teams.js');
  const { res } = createRes();

  await handler(
    { method: 'POST', url: '/api/demo-teams?game=valorant', headers: { host: 'localhost' } },
    res
  );

  assert.equal(res.statusCode, 405);
});
