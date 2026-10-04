import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { installGenerationsApi } from '../web/generations-api.mjs';

const token = 'read-me';
const mapping = Object.freeze({ revision: 'fixture-revision', dealers: { astrid: { greenTakes: [] } } });
const handle = installGenerationsApi({
  tokenDigests: () => [createHash('sha256').update(token).digest('hex')],
  mapping: () => mapping,
  // Retired arguments are deliberately ignored. Supplying paths must never
  // re-enable the legacy package mount.
  catalogPath: 'Z:/retired/generations.json',
  genDir: 'Z:/retired/generations',
});
const server = createServer(async (req, res) => {
  if (!await handle(req, res, new URL(req.url, 'http://local').pathname)) {
    res.writeHead(404);
    res.end();
  }
});
await new Promise(resolve => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const auth = { authorization: `Bearer ${token}` };
const get = (path, headers = {}) => fetch(base + path, { headers });

test('mapping keeps bearer authentication and returns the active resolver output', async () => {
  assert.equal((await get('/api/v1/generations/mapping')).status, 401);
  assert.equal((await get('/api/v1/generations/mapping', { authorization: 'Bearer wrong' })).status, 401);
  const response = await get('/api/v1/generations/mapping', auth);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), mapping);
});

test('retired catalog and package routes cannot fall back to disk', async () => {
  for (const path of [
    '/api/v1/generations',
    '/api/v1/generations/11111111-2222-4333-8444-555555555555/video',
    '/api/v1/generations/not-a-generation/video',
  ]) {
    const response = await get(path, auth);
    assert.equal(response.status, 410);
    assert.deepEqual(await response.json(), { error: 'legacy generation catalog retired' });
  }
});

test('writes remain rejected and unrelated routes are not intercepted', async () => {
  assert.equal((await fetch(base + '/api/v1/generations/mapping', { method: 'POST', headers: auth })).status, 405);
  assert.equal((await get('/api/v1/other', auth)).status, 404);
});

test.after(() => server.close());
