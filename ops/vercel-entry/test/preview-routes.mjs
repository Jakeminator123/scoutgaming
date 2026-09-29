import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { buildPreview } from '../preview/build.mjs';
import { prepareConfig } from '../preview/prepare.mjs';

const origin = 'https://isolated-croupier-preview.example.test';
const root = new URL('../../../', import.meta.url);
const production = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const template = await readFile(new URL('../preview/vercel.template.json', import.meta.url), 'utf8');
const preview = JSON.parse(template.replaceAll('__ISOLATED_BACKEND_ORIGIN__', origin));

test('Preview routes are isolated and forward only exact player/API and Astrid media paths', async () => {
  assert.equal(production.buildCommand, 'node build.mjs');
  assert.equal(Object.hasOwn(production, 'rewrites'), false);
  assert.ok(template.includes('__ISOLATED_BACKEND_ORIGIN__'));
  assert.ok(!template.includes('https://croupier-v2.onrender.com'));
  assert.equal(preview.buildCommand, 'node build.mjs');
  assert.ok(preview.rewrites.length > 20);
  const sources = preview.rewrites.map(route => route.source);
  assert.equal(new Set(sources).size, sources.length);
  for (const route of preview.rewrites) {
    assert.equal(new URL(route.destination).origin, origin);
    assert.equal(new URL(route.destination).pathname, route.source);
    assert.ok(route.source.startsWith('/') && !route.source.includes('%'));
    assert.ok(!route.source.includes('//') && !route.source.includes('..'));
    assert.ok(!['/api/:path*', '/(.*)', '/:path*'].includes(route.source));
  }
  for (const source of [
    '/api/auth/session', '/api/auth/player/login', '/api/auth/player/register',
    '/api/table', '/api/player', '/api/presentation/config', '/api/presentation/select',
    '/api/presentation/idle-advice', '/api/presentation/videos/:id', '/chat',
    '/dealers/astrid/scene.png', '/dealers/astrid/audio/en/bank.json',
    '/assets/table.png', '/kevin-cards/back-scout.png', '/sfx/ambience.mp3',
  ]) assert.ok(sources.includes(source), `missing ${source}`);
  for (const forbidden of [
    '/bo', '/bo/login.html', '/studio', '/lab', '/__cloud/health', '/api/bo/login',
    '/api/bo/players', '/api/auth/lab/start', '/api/auth/lab/check',
    '/api/v1/events', '/speech-stream', '/lipsync-worker',
    '/api/generated-speech/:id/audio', '/dealers/astrid/actor/:path*', '/review/:path*',
  ]) assert.ok(!sources.includes(forbidden), `unexpected ${forbidden}`);
  assert.deepEqual(sources.filter(source => source.includes(':')), ['/api/presentation/videos/:id']);
  // This is a configuration inventory, not an emulation of Vercel's route
  // parser. Encoded aliases and :id matching need a real Preview probe; the
  // backend separately validates video IDs as UUIDs.
  assert.deepEqual(sources.filter(source => source.startsWith('/api/bo/')), ['/api/bo/config']);
  assert.ok(sources.every(source => !source.startsWith('/review/') && !source.startsWith('/studio/')));
  assert.ok(preview.headers.some(row => row.source === '/api/(.*)'
    && row.headers.some(header => header.key === 'Cache-Control' && header.value === 'private, no-store')));
  assert.ok(!preview.headers.some(row => row.headers.some(header => header.key === 'x-vercel-enable-rewrite-caching')));
  for (const source of sources.filter(source => /\.(?:png|jpg|mp3|webm|json)$/.test(source)
    && !source.startsWith('/api/'))) await access(new URL(`web/public${source}`, root));
});

test('Preview builder requires the one isolated backend origin and hides unsupported dealer navigation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-vercel-preview-test-'));
  const output = pathToFileURL(`${join(directory, 'dist')}${sep}`);
  const configUrl = pathToFileURL(join(directory, 'vercel.json'));
  try {
    await assert.rejects(prepareConfig({ origin: 'https://croupier-v2.onrender.com',
      confirmedIsolated: true, output: configUrl }), /Production-backend/);
    await assert.rejects(prepareConfig({ origin, output: configUrl }), /Bekräfta/);
    assert.deepEqual(await readdir(directory), []);
    await prepareConfig({ origin, confirmedIsolated: true, output: configUrl });
    await assert.rejects(buildPreview({ origin: 'https://other.example.test', output, configUrl }), /CROUPIER_GAME_ORIGIN/);
    await buildPreview({ origin, output, configUrl });
    const game = await readFile(join(directory, 'dist/frontend-preview/game/index.html'), 'utf8');
    const css = await readFile(join(directory, 'dist/frontend-preview/preview-only.css'), 'utf8');
    const login = await readFile(join(directory, 'dist/blackjack-entry.mjs'), 'utf8');
    const guard = await readFile(join(directory, 'dist/frontend-preview/route-guard.js'), 'utf8');
    assert.match(game, /href="\/frontend-preview\/preview-only\.css"/);
    assert.match(game, /src="\/frontend-preview\/route-guard\.js"/);
    for (const [search, redirects] of [
      ['?dealer=astrid&presentation=local', 0],
      ['', 1],
      ['?dealer=vera&presentation=local', 1],
      ['?dealer=astrid&presentation=local&scene=review', 1],
    ]) {
      const calls = [];
      runInNewContext(guard, { URLSearchParams, location: { search, replace: path => calls.push(path) } });
      assert.equal(calls.length, redirects, `redirects for ${search}`);
      if (redirects) assert.equal(calls[0], '/frontend-preview/game/?dealer=astrid&presentation=local');
    }
    assert.match(css, /#dealer-picker \{ display: none !important; \}/);
    assert.match(login, /\/frontend-preview\/game\/\?dealer=astrid&presentation=local/);
    const bytes = async path => (await stat(path)).size;
    assert.ok(await bytes(join(directory, 'dist/app.mjs')) > 100000);
    assert.ok(await bytes(join(directory, 'dist/frontend-preview/preview-only.css')) < 512);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
