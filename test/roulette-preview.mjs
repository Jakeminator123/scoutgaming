import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRoulettePreview } from '../services/game/games/roulette/preview.mjs';
import { backendPlatformPath, platformRoute } from '../packages/navigation/server/platform-routing.mjs';
import { vercelIngressRequest } from '../ops/cloud/vercel-ingress.mjs';

async function fixture(t, options = {}) {
  let handler, time = 0;
  const server = createServer((req, res) => {
    handler(req, res).then(handled => { if (!handled) { res.writeHead(404); res.end(); } })
      .catch(() => { res.writeHead(500); res.end(); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.2', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.2:${server.address().port}`;
  handler = createRoulettePreview({ origin, now: () => time, ...options });
  return { origin, advance: ms => { time += ms; }, get: (path, options) => fetch(origin + path, options),
    spin: (options = {}) => fetch(origin + '/api/roulette-test/spin', {
      method: 'POST', ...options, headers: { origin, 'X-Roulette-Preview': '1', ...options.headers },
    }) };
}

test('standalone preview serves actual UI/assets and server crypto without accounts or storage', async t => {
  const f = await fixture(t);
  const page = await f.get('/roulette-test', { redirect: 'manual' });
  assert.equal(page.status, 200); assert.match(await page.text(), /Snurra på servern/);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(page.headers.get('x-robots-tag'), 'noindex, nofollow');
  for (const path of ['/roulette-test/app.mjs', '/roulette-test/style.css']) {
    const response = await f.get(path); assert.equal(response.status, 200); assert.ok((await response.text()).length > 100);
  }
  const redirect = await f.get('/roulette-test/', { redirect: 'manual' });
  assert.equal(redirect.status, 308); assert.equal(redirect.headers.get('location'), '/roulette-test');
  // Next's public ingress strips trailing slashes; the destination must serve directly.
  assert.equal((await f.get(redirect.headers.get('location'), { redirect: 'manual' })).status, 200);
  const head = await f.get('/roulette-test', { method: 'HEAD', redirect: 'manual' });
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  const a = await f.spin(), b = await f.spin();
  assert.equal(a.status, 200); assert.equal(a.headers.get('set-cookie'), null);
  assert.equal(a.headers.get('access-control-allow-origin'), null);
  const first = await a.json(), second = await b.json();
  assert.equal(first.demo, true); assert.equal(first.event.type, 'roulette.spin.resolved');
  assert.equal(first.event.operatorId, 'roulette-demo'); assert.equal(first.event.roomId, 'roulette-test');
  assert.notEqual(first.event.roundId, second.event.roundId); assert.notEqual(first.event.eventId, second.event.eventId);
  assert.ok(Number.isInteger(first.event.outcome.number) && first.event.outcome.number >= 0 && first.event.outcome.number <= 36);
  for (const path of ['/api/table', '/web/games/roulette/index.mjs', '/roulette-test/private.mjs']) {
    assert.equal((await f.get(path)).status, 404);
  }
});

test('requests cannot choose result, variant, tenant or round and cross-origin calls cannot draw', async t => {
  let draws = 0;
  const f = await fixture(t, { draw: () => { draws++; throw Error('must not draw'); } });
  for (const headers of [{ origin: 'https://other.invalid' }, { origin: 'null' }, { origin: '' },
    { 'X-Roulette-Preview': '' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    assert.equal((await f.spin({ headers })).status, 403);
  }
  assert.equal((await f.spin({ body: JSON.stringify({ number: 7, operatorId: 'real', roundId: 'same' }) })).status, 400);
  const query = await f.get('/api/roulette-test/spin?seed=7', { method: 'POST', headers: { origin: f.origin, 'X-Roulette-Preview': '1' } });
  assert.equal(query.status, 400);
  for (const method of ['GET', 'HEAD', 'PUT', 'OPTIONS']) {
    const response = await f.get('/api/roulette-test/spin', { method });
    assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'POST');
  }
  assert.equal((await f.get('/roulette-test/', { method: 'POST' })).status, 405);
  assert.equal(draws, 0);
});

test('burst limit refills over time without recording IPs or accepting cookie state', async t => {
  const f = await fixture(t);
  for (let n = 0; n < 30; n++) assert.equal((await f.spin()).status, 200);
  const limited = await f.spin(); assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '1');
  f.advance(1000); assert.equal((await f.spin()).status, 200); assert.equal((await f.spin()).status, 429);
});

test('entropy errors fail closed with a safe error and no fabricated event', async t => {
  const f = await fixture(t, { draw: () => { throw Error('private detail'); } });
  const response = await f.spin(); assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'roulette_draw_failed' });
});

test('Vercel and Render admit only the exact diagnostic routes through authenticated transport', () => {
  const publicOrigin = 'https://preview.example.test', transportOrigin = 'https://engine.example.test';
  const ingress = { publicOrigin, transportOrigin, secret: 'isolated-preview-fixture-secret-123456' };
  for (const path of ['/roulette-test', '/roulette-test/', '/roulette-test/app.mjs', '/roulette-test/style.css', '/api/roulette-test/spin']) {
    assert.equal(backendPlatformPath(path), true, path);
    assert.equal(platformRoute(new URL(publicOrigin + path), {
      publicOrigin, backendOrigin: transportOrigin, labUiOrigin: publicOrigin, unifiedUi: true, canonicalGame: true,
    }).kind, 'backend', path);
    const accepted = vercelIngressRequest({ method: 'POST', url: path, headers: {
      host: 'engine.example.test', 'x-croupier-vercel-secret': ingress.secret,
      'x-croupier-public-origin': publicOrigin, 'x-forwarded-host': 'preview.example.test', 'x-forwarded-proto': 'https',
      origin: publicOrigin, 'x-roulette-preview': '1',
    } }, ingress);
    assert.equal(accepted.accepted, true, path); assert.equal(accepted.headers['x-roulette-preview'], '1');
  }
  for (const path of ['/api/roulette-test/private', '/web/games/roulette/index.mjs', '/roulette-test/private.mjs']) {
    assert.equal(backendPlatformPath(path), false, path);
  }
  for (const path of ['/roulette-test', '/roulette-test/']) {
    const bookmark = vercelIngressRequest({ method: 'GET', url: path, headers: { host: 'engine.example.test' } }, ingress);
    assert.equal(bookmark.redirect, publicOrigin + '/roulette-test');
  }
  const direct = vercelIngressRequest({ method: 'POST', url: '/api/roulette-test/spin', headers: { host: 'engine.example.test' } }, ingress);
  assert.equal(direct.accepted, false);
});

test('product mounts diagnostics before player and guest handlers', async () => {
  const source = await readFile(new URL('../services/game/server.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('const server = createServer('), route = source.indexOf('&& await roulettePreview(req, res)) return;', start);
  assert.ok(route > start && route < source.indexOf('await auth.handle(req,res)', start));
  assert.ok(route < source.indexOf('await previewPlayer(req,res)', start));
});
