import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installGenerationsApi } from '../web/generations-api.mjs';

const dir = mkdtempSync(join(tmpdir(), 'gen-'));
const id = '11111111-2222-4333-8444-555555555555';
const bytes = Buffer.from('0123456789abcdef');
writeFileSync(join(dir, `${id}.mp4`), bytes);
writeFileSync(join(dir, 'catalog.json'), JSON.stringify([{ id, prompt: 'deal one card', model: 'seedance_2_5', at: '2026-09-17T16:24' }, { id: '99999999-2222-4333-8444-555555555555', prompt: 'missing file', model: 'kling3_0' }]));
const token = 'read-me';
const handle = installGenerationsApi({ catalogPath: join(dir, 'catalog.json'), genDir: dir, verdicts: () => ({ [id]: { verdict: 'want', reason: '' } }),
  tokenDigests: () => [createHash('sha256').update(token).digest('hex')], publicUrl: 'https://x.test' });
const srv = createServer(async (req, res) => { if (!await handle(req, res, new URL(req.url, 'http://l').pathname)) { res.writeHead(404); res.end(); } });
await new Promise(r => srv.listen(0, r));
const base = `http://127.0.0.1:${srv.address().port}`;
const get = (p, h = {}) => fetch(base + p, { headers: h });
const auth = { authorization: `Bearer ${token}` };

test('no token = 401, wrong token = 401', async () => {
  assert.equal((await get('/api/v1/generations')).status, 401);
  assert.equal((await get('/api/v1/generations', { authorization: 'Bearer nope' })).status, 401);
});
test('list carries prompt, verdict, size, hash and download url; missing file has no url', async () => {
  const r = await get('/api/v1/generations', auth); assert.equal(r.status, 200);
  const { count, items } = await r.json(); assert.equal(count, 2);
  const g = items.find(x => x.id === id);
  assert.equal(g.prompt, 'deal one card'); assert.equal(g.verdict, 'want'); assert.equal(g.size, 16);
  assert.equal(g.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(g.downloadUrl, `https://x.test/api/v1/generations/${id}/video`);
  assert.equal(items.find(x => x.id !== id).downloadUrl, null);
  assert.ok(!JSON.stringify(items).includes(dir), 'no filesystem path leaks');
});
test('video streams whole file and honours byte ranges', async () => {
  const r = await get(`/api/v1/generations/${id}/video`, auth);
  assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'video/mp4'); assert.equal(Buffer.from(await r.arrayBuffer()).toString(), '0123456789abcdef');
  const p = await get(`/api/v1/generations/${id}/video`, { ...auth, range: 'bytes=4-7' });
  assert.equal(p.status, 206); assert.equal(p.headers.get('content-range'), 'bytes 4-7/16'); assert.equal(Buffer.from(await p.arrayBuffer()).toString(), '4567');
  const tail = await get(`/api/v1/generations/${id}/video`, { ...auth, range: 'bytes=-3' });
  assert.equal(Buffer.from(await tail.arrayBuffer()).toString(), 'def');
  assert.equal((await get(`/api/v1/generations/${id}/video`, { ...auth, range: 'bytes=99-' })).status, 416);
});
test('unknown ids, path tricks and writes are refused', async () => {
  assert.equal((await get('/api/v1/generations/99999999-2222-4333-8444-555555555555/video', auth)).status, 404);
  assert.equal((await get('/api/v1/generations/..%2Fcatalog.json/video', auth)).status, 404);
  assert.equal((await get('/api/v1/generations/not-a-uuid/video', auth)).status, 404);
  assert.equal((await fetch(base + '/api/v1/generations', { method: 'POST', headers: auth })).status, 405);
  assert.equal((await fetch(base + `/api/v1/generations/${id}/video`, { method: 'DELETE', headers: auth })).status, 405);
});
test.after(() => srv.close());
