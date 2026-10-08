import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedProject, defaultPresentationLane } from '../lab/lib/studio-model.mjs';
import { createStudioRepository } from '../web/storage/studio-repository.mjs';
import { createStudioGamePolicy } from '../web/storage/studio-game-policy.mjs';
import { createOperatorPackageReader } from '../web/storage/operator-package-reader.mjs';
import { createGameEntrySelector, OPERATOR_NOT_FOUND_HTML, requestedOperator } from '../web/game-entry-operator.mjs';
import { decorateGameEntryHtml } from '../web/public/game-entry-contract.mjs';
import { gameLaneFromDocument } from '../web/public/game-lanes.mjs';
import { createStudioMemoryPool } from './fixtures/studio-memory-pool.mjs';
import { operatorPackageSql, operatorRow, packageRow } from './fixtures/operator-package-sql.mjs';

const scope = Object.freeze({ environment: 'test', workspaceId: 'croupier' });
const env = { CROUPIER_STUDIO_NEON_POLICY: '1' };
const html = '<!doctype html><html lang="sv"><body></body></html>';
const idle = dealerId => ({ dealerId, engineKey: 'idle-1/idle/idle', available: true });
const legacy = { schemaVersion: 1, id: 'legacy', label: 'Legacy', renderer: 'indexed-video', dealer: 'vera', mediaCollection: 'legacy-dealers' };
const mobile = { schemaVersion: 1, id: 'mobile-phone', label: 'Mobile Phone Lane', renderer: 'portrait-video', dealer: 'astrid', mediaCollection: 'astrid-presentation' };
const administration = (lanes = {}) => ({
  tiers: { classic: 'vera', high: 'astrid', vip: 'amira' },
  rooms: [{ id: 'room', name: 'Room', scene: 'Dark', felt: 'Green', dealer: 'vera', state: 'live' }],
  pitboss: { payout10x: true, streak5: true, randomWalkMin: 45 },
  tournaments: [], ...lanes,
});
const presentationLane = (id, dealers, dealer) => ({ ...defaultPresentationLane(), id, label: `${id} lane`, dealers,
  layers: { ...defaultPresentationLane().layers, dealer: { enabled: true, ...dealer } } });

// N3.4 adds data-game-choices from the active presentation lane even when the
// address has no ?operator=. Lane, dealer and presentation stay the saved
// catalogue values from 79737a5d. This attribute is the only byte change.
const standardChoices = {
  dealers: ['astrid'], dealerDefault: 'astrid', tableColors: [], tableDefault: null,
  background: { enabled: true, mode: 'baked', allowed: [], default: null },
};
const choicesAttr = ` data-game-choices="${JSON.stringify(standardChoices).replaceAll('"', '&quot;')}"`;
const before = (lane, dealer, presentation) => `<!doctype html><html data-game-path="/blackjack" data-game-lane="${lane}" data-game-dealer="${dealer}" data-game-presentation="${presentation}"${choicesAttr} lang="sv"><body></body></html>`;
const SNAPSHOT = {
  default: { '': before('mobile-phone', 'astrid', 'local'), '?lane=mobile-phone': before('mobile-phone', 'astrid', 'local'),
    '?lane=legacy': before('mobile-phone', 'astrid', 'local'), '?lane=legacy&dealer=mei': before('mobile-phone', 'astrid', 'local'),
    '?dealer=amira': before('mobile-phone', 'astrid', 'local'), '?lane=nope&dealer=vera': before('mobile-phone', 'astrid', 'local'),
    '?lane=a&lane=b': before('mobile-phone', 'astrid', 'local') },
  mixed: { '': before('mobile-phone', 'astrid', 'local'), '?lane=mobile-phone': before('mobile-phone', 'astrid', 'local'),
    '?lane=legacy': before('legacy', 'vera', 'original'), '?lane=legacy&dealer=mei': before('legacy', 'mei', 'original'),
    '?dealer=amira': before('mobile-phone', 'astrid', 'local'), '?lane=nope&dealer=vera': before('mobile-phone', 'astrid', 'local'),
    '?lane=a&lane=b': before('mobile-phone', 'astrid', 'local') },
};

async function fixture({ lanes = {}, projectLanes, operators, packages } = {}) {
  const pool = createStudioMemoryPool(), repository = createStudioRepository({ pool, scope });
  const project = createSeedProject();
  if (projectLanes) project.lanes = projectLanes;
  await repository.initializeDocument('project', { value: project, revision: 'project-original', actor: 'import' });
  await repository.initializeDocument('administration', { value: administration(lanes), revision: 'admin-original', actor: 'import' });
  const policy = createStudioGamePolicy({ repository, scope, dealerIdle: idle });
  const reads = { configuration: 0, saved: 0 };
  const counted = { readGameConfiguration: () => { reads.configuration += 1; return policy.readGameConfiguration(); },
    readSaved: () => { reads.saved += 1; return policy.readSaved(); } };
  const db = operatorPackageSql({
    operators: operators ?? [operatorRow(scope, 'sg-test', 'sg-test'), operatorRow(scope, 'no-package', 'no-package'),
      operatorRow(scope, 'paused', 'paused', 'suspended')],
    packages: packages ?? [packageRow(scope, 'sg-test', 1, ['legacy']), packageRow(scope, 'sg-test', 2, ['mobile-phone'], '{"felt":"#0a5"}')],
  });
  const logs = [];
  const log = (...line) => logs.push(line.join(' '));
  const packageReader = createOperatorPackageReader({ sql: db.sql, scope, log });
  const select = createGameEntrySelector({ policy: counted, packages: packageReader, log });
  const page = async query => {
    const entry = await select(new URLSearchParams(query));
    return entry.status === 404 ? { status: 404, body: OPERATOR_NOT_FOUND_HTML } : { status: 200, body: decorateGameEntryHtml(html, env, entry.selection), selection: entry.selection };
  };
  return { page, select, db, logs, reads };
}

test('without ?operator the saved catalogue entry is byte-identical to before and reads no operator data', async () => {
  for (const [name, lanes] of [['default', {}], ['mixed', { gameLane: 'mobile-phone', gameLanes: [mobile, legacy] }]]) {
    const { page, db, reads } = await fixture({ lanes });
    for (const [query, expected] of Object.entries(SNAPSHOT[name])) {
      const result = await page(query);
      assert.equal(result.body, expected, `${name} ${query}`);
      assert.deepEqual(result.selection.choices, standardChoices, `${name} ${query}`);
      assert.equal(result.selection.operator, undefined);
    }
    assert.deepEqual(db.calls, []);
    // The catalogue path now reads the saved project for gameChoices. It still
    // does not call readGameConfiguration or the operator tables.
    assert.equal(reads.saved, Object.keys(SNAPSHOT[name]).length);
    assert.equal(reads.configuration, 0);
  }
});

test('the code catalogue serves Dragge and Paow on their own portrait lanes only by ?lane=', async () => {
  const { page } = await fixture();
  for (const dealer of ['dragge', 'paow']) {
    const lane = `mobile-phone-${dealer}`;
    const result = await page(`?lane=${lane}&dealer=${dealer}`);
    assert.deepEqual([result.selection.lane, result.selection.dealer, result.selection.presentation], [lane, dealer, 'local']);
    assert.deepEqual(result.selection.choices.dealers, []);
    assert.match(result.body, new RegExp(`data-game-lane="${lane}" data-game-dealer="${dealer}" data-game-presentation="local"`));
    assert.equal((await page(`?dealer=${dealer}`)).body, SNAPSHOT.default['']);
  }
});

test('?operator=sg-test with package [mobile-phone] binds lane, operator, revision and branding', async () => {
  const { page, logs } = await fixture();
  const result = await page('?operator=sg-test');
  assert.equal(result.status, 200);
  assert.match(result.body, /data-game-lane="mobile-phone"/);
  assert.match(result.body, /data-game-operator="sg-test"/);
  assert.match(result.body, /^<!doctype html><html data-game-path="\/blackjack" data-game-lane="mobile-phone" data-game-dealer="astrid" data-game-presentation="local" data-game-operator="sg-test" data-game-package-revision="2" data-game-branding="\{&quot;felt&quot;:&quot;#0a5&quot;\}" data-game-choices="[^"]+" lang="sv">/);
  assert.deepEqual(result.selection.choices, standardChoices);
  assert.deepEqual(logs, []);
});

test('unknown, suspended, malformed or ambiguous operators get the 404 page, never a guessed fallback', async () => {
  const { page, db } = await fixture();
  assert.match(OPERATOR_NOT_FOUND_HTML, /<title>Bolaget finns inte<\/title>/);
  for (const query of ['?operator=nobody', '?operator=paused']) assert.deepEqual(await page(query), { status: 404, body: OPERATOR_NOT_FOUND_HTML });
  const reads = db.calls.length;
  for (const query of ['?operator=', '?operator=Bad', '?operator=play', '?operator=sg-test&operator=sg-test', `?operator=${'a'.repeat(64)}`]) {
    assert.equal((await page(query)).status, 404, query);
  }
  assert.equal(db.calls.length, reads, 'malformed slugs never reach the database');
  assert.equal(requestedOperator(new URLSearchParams('lane=mobile-phone')), undefined);
  assert.equal(requestedOperator(new URLSearchParams('operator=sg-test')), 'sg-test');
  assert.equal(requestedOperator(new URLSearchParams('operator=sg-test&operator=x')), null);
});

test('unreadable operator storage keeps today\'s entry, logs once and never answers 404 or 500', async () => {
  const { page, db, logs } = await fixture({ lanes: { gameLane: 'mobile-phone', gameLanes: [mobile, legacy] } });
  db.state.fail = Object.assign(new Error('permission denied for table operators'), { code: '42501' });
  for (const [query, today] of [['?operator=sg-test', SNAPSHOT.mixed['']], ['?operator=nobody&lane=legacy&dealer=mei', SNAPSHOT.mixed['?lane=legacy&dealer=mei']]]) {
    const result = await page(query);
    assert.equal(result.status, 200);
    assert.equal(result.body, today);
  }
  assert.deepEqual(logs, ['[operator-package] read failed; game entry keeps the saved lane catalogue studio_storage_unavailable']);
});

test('an operator without a published package keeps today\'s lanes and only names the operator', async () => {
  const { page } = await fixture({ lanes: { gameLane: 'mobile-phone', gameLanes: [mobile, legacy] } });
  const result = await page('?operator=no-package&lane=legacy&dealer=mei');
  assert.deepEqual(result.selection, { lane: 'legacy', dealer: 'mei', presentation: 'original', operator: 'no-package', choices: standardChoices });
  assert.doesNotMatch(result.body, /data-game-package-revision|data-game-branding/);
});

test('package lanes narrow the catalogue; an empty intersection falls back to the saved lane with one warning', async () => {
  const lanes = { gameLane: 'mobile-phone', gameLanes: [mobile, legacy] };
  const narrowed = await fixture({ lanes, packages: [packageRow(scope, 'sg-test', 4, ['legacy'])] });
  for (const query of ['?operator=sg-test', '?operator=sg-test&lane=mobile-phone', '?operator=sg-test&lane=legacy']) {
    assert.equal((await narrowed.page(query)).selection.lane, 'legacy', query);
  }
  const empty = await fixture({ lanes, packages: [packageRow(scope, 'sg-test', 5, ['retired-lane'])] });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await empty.page('?operator=sg-test&lane=legacy');
    assert.deepEqual(result.selection, { lane: 'legacy', dealer: 'vera', presentation: 'original', operator: 'sg-test', packageRevision: 5, branding: {}, choices: standardChoices });
  }
  assert.deepEqual((await empty.page('?operator=sg-test')).selection.lane, 'mobile-phone');
  assert.deepEqual(empty.logs, ['[operator-package] sg-test r5: no package lane in the saved catalogue; using legacy']);
});

test('in operator context the Studio presentation lane narrows ?dealer=; without it today\'s rule stays', async () => {
  const lanes = { gameLane: 'mobile-phone', gameLanes: [mobile, legacy] };
  const projectLanes = [defaultPresentationLane(), presentationLane('legacy', ['vera', 'mei'], { default: 'mei', allowed: ['vera', 'mei'] })];
  const { page, logs } = await fixture({ lanes, projectLanes, packages: [packageRow(scope, 'sg-test', 3, ['legacy', 'mobile-phone'])] });
  assert.equal((await page('?operator=sg-test&lane=legacy&dealer=amira')).selection.dealer, 'mei');
  assert.equal((await page('?operator=sg-test&lane=legacy&dealer=vera')).selection.dealer, 'vera');
  assert.equal((await page('?operator=sg-test&lane=legacy')).selection.dealer, 'mei');
  assert.equal((await page('?operator=sg-test&dealer=vera')).selection.dealer, 'astrid');
  assert.deepEqual((await page('?operator=sg-test&lane=legacy')).selection.choices, {
    dealers: ['mei', 'vera'], dealerDefault: 'mei', tableColors: [], tableDefault: null,
    background: { enabled: true, mode: 'baked', allowed: [], default: null },
  });
  assert.equal((await page('?lane=legacy&dealer=amira')).selection.dealer, 'amira', 'no operator: dealer rule unchanged');
  assert.equal((await page('?lane=legacy')).selection.dealer, 'vera');
  assert.deepEqual(logs, []);
});

test('a presentation lane that shares no dealer with its server lane cannot select an unrenderable dealer', async () => {
  const projectLanes = [presentationLane('mobile-phone', ['vera'], { default: 'vera', allowed: ['vera'] })];
  const { page, logs } = await fixture({ projectLanes });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await page('?operator=sg-test&dealer=vera');
    assert.equal(result.selection.dealer, 'astrid');
    assert.equal(result.selection.presentation, 'local');
    assert.deepEqual(result.selection.choices.dealers, []);
    assert.equal(result.selection.choices.dealerDefault, null);
  }
  assert.deepEqual(logs, ['[operator-package] lane mobile-phone: presentation lane and server lane share no dealer; using astrid']);
});

test('gameChoices is escaped, and gameLaneFromDocument rejects a tampered list', async () => {
  const lane = defaultPresentationLane();
  lane.layers.table.colors = ['#112233', '#aabbcc'];
  lane.layers.table.default = '#112233';
  lane.layers.background.mode = 'image';
  lane.layers.background.allowed = ['rum"<script>'];
  lane.layers.background.default = 'rum"<script>';
  const { page } = await fixture({ projectLanes: [lane] });
  const result = await page('');
  assert.equal(result.selection.operator, undefined);
  assert.equal(result.body.includes('<script'), false);
  assert.match(result.body, /data-game-choices="[^"]*&quot;&lt;script&gt;/);
  const encoded = /data-game-choices="([^"]*)"/.exec(result.body)[1];
  const decoded = encoded.replace(/&(amp|quot|#39|lt|gt);/g, (_, name) => ({ amp: '&', quot: '"', '#39': "'", lt: '<', gt: '>' })[name]);
  const dataset = { gameLane: 'mobile-phone', gameDealer: 'astrid', gamePresentation: 'local', gameChoices: decoded };
  const choices = gameLaneFromDocument(dataset).choices;
  assert.deepEqual(choices.tableColors, ['#112233', '#aabbcc']);
  assert.equal(choices.tableDefault, '#112233');
  assert.equal(choices.background.mode, 'image');
  assert.equal(choices.background.allowed[0], 'rum"<script>');
  assert.throws(() => gameLaneFromDocument({ ...dataset, gameChoices: '{' }));
  assert.throws(() => gameLaneFromDocument({ ...dataset, gameChoices: 'null' }));
  assert.throws(() => gameLaneFromDocument({ ...dataset, gameChoices: JSON.stringify({ ...choices, extra: true }) }));
  assert.throws(() => gameLaneFromDocument({ ...dataset, gameChoices: JSON.stringify({ ...choices, dealers: ['astrid', 'astrid'] }) }));
  assert.throws(() => gameLaneFromDocument({ ...dataset, gameChoices: JSON.stringify({ ...choices, dealerDefault: 'mei' }) }));
  assert.throws(() => gameLaneFromDocument({ ...dataset, gameChoices: JSON.stringify({ ...choices, tableDefault: '#ffffff' }) }));
});

test('policy failures still reject so the server answers 503 as before', async () => {
  const failing = { readGameConfiguration: async () => { throw new Error('policy'); }, readSaved: async () => { throw new Error('policy'); } };
  const select = createGameEntrySelector({ policy: failing, packages: { resolve: async () => ({ operator: { id: 'x', slug: 'x' }, package: null }) }, log: () => {} });
  await assert.rejects(select(new URLSearchParams('')));
  await assert.rejects(select(new URLSearchParams('operator=sg-test')));
  assert.equal((await select(new URLSearchParams('operator=Bad'))).status, 404);
  assert.throws(() => createGameEntrySelector({ policy: {} }));
  assert.throws(() => createGameEntrySelector({ policy: failing, packages: {} }));
});
