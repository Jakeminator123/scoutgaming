import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createStudioTables } from '../server/studio-tables.mjs';
import { sessionName } from '../server/shared-table.mjs';

const table = { name: 'Privé Blackjack', dealer: 'paow', room: 'azure', felt: 'emerald', lang: 'sv', limit: 'prive', logoPos: 'both' };

test('Table Studio saves a table under a unique slug that is a valid table session and survives a restart (John)', () => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'studio-')), 'tables.json');
  const tables = createStudioTables(file);
  const a = tables.create(table), b = tables.create(table);
  assert.equal(a.slug, 'prive-blackjack');
  assert.equal(b.slug, 'prive-blackjack-2');
  assert.equal(sessionName(a.slug), a.slug);
  assert.equal(tables.gameUrl(a), '/?dealer=paow&room=azure&lang=sv&session=prive-blackjack&table=prive-blackjack');
  assert.deepEqual(createStudioTables(file).get('prive-blackjack-2'), b);
  assert.equal(tables.get('__proto__'), null);
});

test('Table Studio rejects unknown choices and bad names', () => {
  const tables = createStudioTables(path.join(mkdtempSync(path.join(tmpdir(), 'studio-')), 't.json'));
  assert.throws(() => tables.create({ ...table, dealer: 'bob' }), /Invalid dealer/);
  assert.throws(() => tables.create({ ...table, room: '../x' }), /Invalid room/);
  assert.throws(() => tables.create({ ...table, name: '' }), /Invalid table name/);
  assert.throws(() => tables.create({ ...table, name: 'x'.repeat(29) }), /Invalid table name/);
  assert.equal(tables.create({ ...table, felt: 'custom', custom: 'red;}' }).custom, null);
});

test('Table Studio limits: each preset is the table a room plays with; other rooms keep the demo limits', async () => {
  const { LIMIT_PRESETS, DEFAULT_LIMITS } = await import('../server/studio-tables.mjs');
  const tables = createStudioTables(path.join(mkdtempSync(path.join(tmpdir(), 'studio-')), 't.json'));
  const high = tables.create({ ...table, name: 'Whales', limit: 'high' });
  assert.deepEqual(tables.limitsFor(high.slug), { ...LIMIT_PRESETS.high, preset: 'high', tableName: 'Whales' });
  assert.deepEqual(LIMIT_PRESETS.casual.chips, [1, 5, 10, 25, 50, 100]);
  assert.equal(LIMIT_PRESETS.high.max, 25000);
  assert.equal(tables.limitsFor('astrid'), DEFAULT_LIMITS);
  assert.equal(DEFAULT_LIMITS.sideMax, 2000);
});

test('Table Studio stores a raster logo and refuses SVG, remote URLs and oversize data', () => {
  const tables = createStudioTables(path.join(mkdtempSync(path.join(tmpdir(), 'studio-')), 't.json'));
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const t = tables.create({ ...table, logo: png, logoName: 'acme.svg' });
  assert.equal(t.logo, png);
  assert.equal(t.logoName, 'acme.svg');
  assert.equal(tables.create(table).logo, null);
  for (const logo of ['data:image/svg+xml;base64,PHN2Zz4=', 'https://example.com/logo.png', 'javascript:alert(1)', 'data:image/png;base64,' + 'A'.repeat(400000)])
    assert.throws(() => tables.create({ ...table, logo }), /Logo must be/);
});

test('Table Studio never takes a slug that is already a room people play at', () => {
  const tables = createStudioTables(path.join(mkdtempSync(path.join(tmpdir(), 'studio-')), 't.json'), { reserved: s => s === 'astrid' || s === 'party' });
  assert.equal(tables.create({ ...table, name: 'Astrid' }).slug, 'astrid-2');
  assert.equal(tables.create({ ...table, name: 'Party' }).slug, 'party-2');
});
