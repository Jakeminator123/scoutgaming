// Roulette beside the blackjack (Emil 30 Oct): its tables, share links and game page live apart from the blackjack's.
// (Copied into kevin-staging as test/roulette.test.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRouletteTables } from '../server/roulette-tables.mjs';
import { createRouletteRoutes } from '../server/roulette-routes.mjs';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const katalog = JSON.parse(readFileSync(path.join(PUBLIC, 'roulette', 'katalog.json'), 'utf8'));
const table = { game: 'roulette', name: 'Onyx Privé', dealer: 'astrid2', wheel: 'klassisk', room: 'onyx', limit: 'rl-high', lang: 'en' };
const tmp = () => path.join(mkdtempSync(path.join(tmpdir(), 'roulette-')), 'roulette-tables.json');

test('a roulette table gets a unique slug, never a blackjack table\'s, and survives a restart', () => {
  const file = tmp(), blackjack = new Set(['onyx-prive']);
  const tables = createRouletteTables(file, katalog, { reserved: s => blackjack.has(s) });
  const a = tables.create(table, 'kevin'), b = tables.create(table);
  assert.equal(a.slug, 'onyx-prive-2');
  assert.equal(b.slug, 'onyx-prive-3');
  assert.equal(a.game, 'roulette');
  assert.equal(tables.gameUrl(a), '/roulette/?session=onyx-prive-2&table=onyx-prive-2&dealer=astrid2&wheel=klassisk&room=onyx&limit=rl-high');
  assert.deepEqual(createRouletteTables(file, katalog).get('onyx-prive-3'), b);
  assert.equal(tables.get('__proto__'), null);
});

test('a roulette table takes only the catalogue\'s choices', () => {
  const tables = createRouletteTables(tmp(), katalog);
  assert.throws(() => tables.create({ ...table, game: 'blackjack' }), /Invalid game/);
  assert.throws(() => tables.create({ ...table, dealer: 'bob' }), /Invalid dealer/);
  assert.throws(() => tables.create({ ...table, wheel: '../x' }), /Invalid wheel/);
  assert.throws(() => tables.create({ ...table, room: 'darkhall' }), /Invalid room/);
  assert.throws(() => tables.create({ ...table, limit: 'rl-motor' }), /Invalid limit/);
  assert.throws(() => tables.create({ ...table, name: 'x'.repeat(29) }), /Invalid table name/);
});

// a minimal response that records what the routes do
function fakeRes() {
  const r = { headers: { 'Content-Security-Policy': "default-src 'self'; script-src 'self'; img-src 'self' data:" }, status: 0, sent: null, body: null };
  return Object.assign(r, {
    getHeader: k => r.headers[k], setHeader: (k, v) => { r.headers[k] = v; },
    writeHead(code, h = {}) { r.status = code; Object.assign(r.headers, h); return r; }, end() { return r; },
  });
}
const routes = (extra = {}) => createRouletteRoutes({
  publicDir: PUBLIC, tablesFile: tmp(), sendFile: (req, res, f) => { res.status = 200; res.sent = f; },
  json: (res, code, o) => { res.status = code; res.body = o; }, body: async req => req.body, bo: { user: async h => h.who ?? null }, ...extra });

test('the roulette pages and links: own game page policy, blackjack links untouched, sign-in to build a table', async () => {
  const r = routes({ isOtherTable: s => s === 'blackjack-table' });
  const signedOut = fakeRes();
  assert.equal(await r.api({ method: 'POST', url: '/api/studio/roulette-table', headers: {}, body: table }, signedOut, 'studio/roulette-table'), true);
  assert.equal(signedOut.status, 401);
  const made = fakeRes();
  await r.api({ method: 'POST', url: '/api/studio/roulette-table', headers: { who: { user: 'kevin' } }, body: table }, made, 'studio/roulette-table');
  assert.equal(made.status, 201);
  assert.equal(made.body.owner, undefined);
  const read = fakeRes();
  await r.api({ method: 'GET', url: '/api/studio/roulette-table?slug=onyx-prive', headers: {} }, read, 'studio/roulette-table');
  assert.equal(read.body.wheel, 'klassisk');
  assert.equal(read.body.owner, undefined);
  assert.equal(await r.api({ method: 'GET', url: '/api/studio/table', headers: {} }, fakeRes(), 'studio/table'), false);

  const share = fakeRes();
  assert.equal(await r.http({ url: '/t/onyx-prive', headers: {} }, share), true);
  assert.equal(share.status, 302);
  assert.match(share.headers.Location, /^\/roulette\/\?session=onyx-prive&table=onyx-prive/);
  assert.equal(await r.http({ url: '/t/blackjack-table', headers: {} }, fakeRes()), false);
  assert.equal(await r.http({ url: '/t/nothing', headers: {} }, fakeRes()), false);
  assert.equal(await r.http({ url: '/?dealer=paow', headers: {} }, fakeRes()), false);
  assert.equal(await r.http({ url: '/studio/', headers: {} }, fakeRes()), false);

  const page = fakeRes();
  assert.equal(await r.http({ url: '/roulette/?table=onyx-prive', headers: {} }, page), true);
  assert.equal(page.sent, path.join(PUBLIC, 'roulette', 'index.html'));
  assert.match(page.headers['Content-Security-Policy'], /script-src 'self' blob: 'sha256-[A-Za-z0-9+/=]+'/);
  const asset = fakeRes();
  assert.equal(await r.http({ url: '/roulette/js/spel.mjs', headers: {} }, asset), false);
  assert.equal(asset.headers['Content-Security-Policy'], "default-src 'self'; script-src 'self'; img-src 'self' data:");
});

test('behind the demo gate the roulette page needs a studio table or a signed-in account', async () => {
  const r = routes({ gate: { on: true, passwordPage: '/studio/' } });
  await r.api({ method: 'POST', url: '/', headers: { who: { user: 'kevin' } }, body: table }, fakeRes(), 'studio/roulette-table');
  const anon = fakeRes();
  await r.http({ url: '/roulette/', headers: {} }, anon);
  assert.equal(anon.status, 302);
  assert.equal(anon.headers.Location, '/studio/');
  const viaTable = fakeRes();
  await r.http({ url: '/roulette/?table=onyx-prive', headers: {} }, viaTable);
  assert.equal(viaTable.status, 200);
  const signedIn = fakeRes();
  await r.http({ url: '/roulette/', headers: { who: { user: 'kevin' } } }, signedIn);
  assert.equal(signedIn.status, 200);
});

test('a roulette without its files turns itself off instead of stopping the server', async () => {
  const r = createRouletteRoutes({ publicDir: path.join(tmpdir(), 'no-such-public'), tablesFile: tmp() });
  assert.equal(await r.http({ url: '/roulette/', headers: {} }, fakeRes()), false);
  assert.equal(await r.api({ method: 'GET', url: '/', headers: {} }, fakeRes(), 'studio/roulette-table'), false);
  assert.equal(r.tables.get('x'), null);
});
