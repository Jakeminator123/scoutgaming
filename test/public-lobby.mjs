import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publicLobbyFile, servePublicLobby, serveDesignPreview } from '../lab/lib/design-preview.mjs';
import { platformConfiguration, platformRoute } from '../apps/croupier-frontend/lib/platform-routing.mjs';
import { loadLobbyCatalog, lobbySelection, playUrlFor } from '../packages/design-preview/runtime/public-lobby-catalog.mjs';

function publication(slug, game = 'blackjack') {
  return { schemaVersion: 1, operator: { slug, name: `Bolag ${slug}` }, packageRevision: 2, rooms: [{
    id: 'shared-room', name: `Rum ${slug}`, game, laneId: 'test-composition',
    presentation: { id: 'test-composition', label: 'Publicerad miljö' }, dealerDefault: 'nora',
    dealers: [{ id: 'nora', label: 'Nora', presentation: 'original', independentLayers: false,
      table: { enabled: false, default: null, allowed: [] },
      background: { enabled: false, default: null, allowed: [], mode: 'baked' } }],
    playUrl: `/play/${game}?operator=${slug}&table=shared-room`,
  }] };
}

test('Vercel ingress owns the lobby prefix and transforms it to the mounted Studio path', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const index = config.rewrites.findIndex(row => row.source === '/lobby/:path*');
  assert.ok(index >= 0 && index < config.rewrites.findIndex(row => row.source === '/(.*)'));
  assert.equal(config.rewrites[index].destination.service, 'studio');
  for (const path of ['/lobby', '/lobby/_assets/lobby/app.js', '/admin', '/control/rooms', '/partner/login']) {
    const rule = config.services.studio.routes.find(row => new RegExp(row.src).test(path));
    assert.ok(rule, path);
    assert.equal(path.replace(new RegExp(rule.src), rule.transforms[0].args), '/studio' + path);
  }
});

test('public lobby routing preserves queries and leaves admin access on its existing route', () => {
  const config = platformConfiguration({ CROUPIER_VERCEL_UI: '1', CROUPIER_BACKEND_ORIGIN: 'https://engine.example',
    CROUPIER_PUBLIC_ORIGIN: 'https://www.example.com', CROUPIER_LAB_UI_ORIGIN: 'https://studio.example',
    CROUPIER_VERCEL_INGRESS_SECRET: 'a'.repeat(40) });
  for (const path of ['/lobby', '/lobby/', '/lobby/_assets/lobby/app.js', '/lobby/_assets/fonts/inter.woff2', '/admin', '/admin/lobby']) {
    assert.deepEqual(platformRoute(new URL(path + '?operator=alpha', config.publicOrigin), config),
      { kind: 'lab', destination: config.labUiOrigin + '/studio' + path + '?operator=alpha' });
  }
  assert.equal(platformRoute(new URL('/lobby-other', config.publicOrigin), config).kind, 'frontend');
});

test('public file selection rejects admin, data, traversal and unrelated documents', () => {
  assert.equal(publicLobbyFile([]), 'public-lobby/index.html');
  assert.equal(publicLobbyFile(['_assets', 'lobby', 'app.js']), 'public-lobby/app.js');
  assert.equal(publicLobbyFile(['_assets', 'fonts', 'inter.woff2']), 'fonts/inter.woff2');
  for (const path of [null, ['admin'], ['_data', 'catalog'], ['_assets', 'admin', 'app.js'],
    ['_assets', 'lobby', 'index.html'], ['_assets', 'lobby', '..', 'admin', 'app.js'], ['_assets', 'fonts', '..\\admin\\app.js']])
    assert.equal(publicLobbyFile(path), null);
});

test('anonymous lobby serves only its public build; private previews still require authorization', async () => {
  const root = await mkdtemp(join(tmpdir(), 'croupier-public-lobby-'));
  try {
    await mkdir(join(root, 'public-lobby')); await mkdir(join(root, 'admin'));
    await writeFile(join(root, 'public-lobby', 'index.html'), '<h1>Spellobby</h1>');
    await writeFile(join(root, 'public-lobby', 'app.js'), '0123456789');
    await writeFile(join(root, 'admin', 'index.html'), 'private admin');
    await writeFile(join(root, 'admin', 'hidden.js'), 'private admin script');
    await symlink(join(root, 'admin'), join(root, 'public-lobby', 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    const request = new Request('https://www.example.com/lobby');
    const response = await servePublicLobby(request, [], { root });
    assert.equal(response.status, 200); assert.match(await response.text(), /Spellobby/);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const ranged = await servePublicLobby(new Request(request, { headers: { range: 'bytes=2-5' } }), ['_assets', 'lobby', 'app.js'], { root });
    assert.equal(ranged.status, 206); assert.equal(await ranged.text(), '2345');
    const head = await servePublicLobby(new Request(request, { method: 'HEAD' }), [], { root });
    assert.equal(head.status, 200); assert.equal(await head.text(), '');
    assert.equal((await servePublicLobby(new Request(request, { method: 'POST' }), [], { root })).status, 405);
    assert.equal((await servePublicLobby(request, ['_assets', 'admin', 'app.js'], { root })).status, 404);
    assert.equal((await servePublicLobby(request, ['_assets', 'lobby', 'escape', 'hidden.js'], { root })).status, 404);
    await assert.rejects(serveDesignPreview(request, [], { root }), /authorization_required/);
    await assert.rejects(serveDesignPreview(request, ['lobby'], { root, authorize: async () => {
      throw Object.assign(new Error('N1 required'), { statusCode: 401 });
    } }), /N1 required/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('public readers retain tenant, game and dealer choices without calling admin APIs', async () => {
  const called = [];
  const catalog = await loadLobbyCatalog({ fetchImpl: async (path, options) => {
    called.push(path); assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error');
    const value = path === '/api/operators'
      ? { operators: ['alpha', 'beta'].map(slug => ({ slug, name: `Bolag ${slug}` })) }
      : publication(path.split('/')[3], path.includes('/beta/') ? 'roulette' : 'blackjack');
    return Response.json(value);
  } });
  assert.deepEqual(called, ['/api/operators', '/api/operators/alpha/rooms', '/api/operators/beta/rooms']);
  for (const [slug, game] of [['alpha', 'blackjack'], ['beta', 'roulette']]) {
    const selected = lobbySelection(catalog, { operatorId: slug, roomKey: `${slug}:shared-room`, dealerId: 'nora' });
    assert.equal(playUrlFor(selected), `/play/${game}?operator=${slug}&table=shared-room&dealer=nora`);
  }
  assert.equal(lobbySelection(catalog, { operatorId: 'beta', roomKey: 'alpha:shared-room', dealerId: 'nora' }).room, null);
});

test('unavailable or malformed public data fails closed; empty and withdrawn rooms stay empty', async () => {
  await assert.rejects(loadLobbyCatalog({ fetchImpl: async () => new Response(null, { status: 503 }) }));
  await assert.rejects(loadLobbyCatalog({ fetchImpl: async path => Response.json(path === '/api/operators'
    ? { operators: [{ slug: 'alpha', name: 'Alpha', private: true }] } : publication('alpha')) }));
  const directory = { operators: [{ slug: 'alpha', name: 'Alpha' }] };
  await assert.rejects(loadLobbyCatalog({ fetchImpl: async path => path === '/api/operators'
    ? Response.json(directory) : new Response(null, { status: 503 }) }));
  const withdrawn = await loadLobbyCatalog({ fetchImpl: async path => path === '/api/operators'
    ? Response.json(directory) : new Response(null, { status: 404 }) });
  assert.deepEqual(withdrawn, { operators: [], rooms: [], dealers: [] });
  assert.deepEqual(await loadLobbyCatalog({ fetchImpl: async () => Response.json({ operators: [] }) }), withdrawn);
  const injected = publication('alpha'); injected.rooms[0].playUrl = 'https://elsewhere.example/play';
  await assert.rejects(loadLobbyCatalog({ fetchImpl: async path => Response.json(path === '/api/operators' ? directory : injected) }));
});

import { animateScrollTo } from '../packages/design-preview/lobby/lib/scroll-motion.mjs';

test('cinematic scroll reaches its target and removes frames/listeners on finish, input or disposal', () => {
  for (const exit of ['complete', 'wheel', 'touchstart', 'keydown', 'pointerdown', 'unmount']) {
    let nextId = 0, done = 0;
    const frames = new Map(), listeners = new Map(), scrolls = [];
    const viewport = {
      scrollY: 10, performance: { now: () => 0 },
      requestAnimationFrame(fn) { frames.set(++nextId, fn); return nextId; },
      cancelAnimationFrame(id) { frames.delete(id); },
      addEventListener(name, fn) { listeners.set(name, fn); },
      removeEventListener(name) { listeners.delete(name); },
      scrollTo(options) { scrolls.push(options.top); },
    };
    const cancel = animateScrollTo(1000, 2400, () => done++, viewport);
    const tick = now => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); };
    tick(1200);
    assert.equal(scrolls[0], 505);
    if (exit === 'complete') tick(2400);
    else if (exit === 'unmount') cancel();
    else listeners.get(exit)();
    const count = scrolls.length;
    tick(3000); cancel();
    assert.equal(done, 1, exit);
    assert.equal(frames.size, 0, exit);
    assert.equal(listeners.size, 0, exit);
    assert.equal(scrolls.length, count, exit);
    assert.equal(scrolls.at(-1), exit === 'complete' ? 1000 : 505);
  }
});
