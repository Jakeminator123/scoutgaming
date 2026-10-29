// Begära material och nyckelrotation (ADMIN-FORENKLING 5.5) som journalposter i
// operator_audit_events, mot riktig PostgreSQL-SQL (PGlite). Före Studio-migrering
// 022 svarar servern 503 studio_migration_required och skriver ingenting
// (tolerant kod → migrering → kravhöjning).
import test from 'node:test';
import assert from 'node:assert/strict';
import { partnerPostgresFixture } from './fixtures/partner-postgres.mjs';

const journal = (f, operator = 'north') => f.rows(`SELECT operator_id,actor_id,access_class,action,resource_type,resource_id,changes
  FROM croupier_studio.operator_audit_events WHERE environment_id=$1 AND operator_id=$2 AND action LIKE 'request.%' ORDER BY action,actor_id`, [f.scope.environment, operator]);
const answer = async promise => { const response = await promise; return { status: response.status, body: await response.json() }; };
// Varje Studio-fråga som lagret skickar genom poolens klient, och ett valfritt injicerat fel.
function spyQueries(f, fault = () => null) {
  const connect = f.pool.connect.bind(f.pool), seen = [];
  f.pool.connect = async () => {
    const client = await connect();
    return { query: async (text, values) => { seen.push(String(text)); const error = fault(String(text)); if (error) throw error; return client.query(text, values); },
      release: (...args) => client.release(...args) };
  };
  return { seen, restore: () => { f.pool.connect = connect; } };
}

test('before migration 022 a request is refused with 503 studio_migration_required and nothing is written', async t => {
  const f = await partnerPostgresFixture(t, { deferOptional: ['022'] });
  const result = await answer(f.call('request', { body: { kind: 'material', message: 'Ny bakgrund till north-a' } }));
  assert.deepEqual(result, { status: 503, body: { error: 'Authentication unavailable', reason: 'studio_migration_required' } });
  assert.deepEqual(await journal(f), []);
  // Ledgern prövas före skrivningen: ingen journalrad försöks ens skrivas.
  const spy = spyQueries(f);
  try {
    assert.equal((await answer(f.call('request', { body: { kind: 'key-rotation' } }))).body.reason, 'studio_migration_required');
    assert.ok(spy.seen.some(text => text.includes('operator-store:partner-journal-ready')));
    assert.equal(spy.seen.some(text => text.includes('operator-store:audit-write')), false);
  } finally { spy.restore(); }
  // Behörigheten prövas före lagret: en roll utan rätten får fortfarande 403.
  assert.equal((await answer(f.call('request', { user: 'north-viewer', body: { kind: 'key-rotation' } }))).status, 403);
});

test('with 022 a failed write is a plain 503 without a migration reason, and nothing is written', async t => {
  const f = await partnerPostgresFixture(t);
  const spy = spyQueries(f, text => text.includes('operator-store:audit-write') ? Object.assign(new Error('injected'), { code: '08006' }) : null);
  try {
    assert.deepEqual(await answer(f.call('request', { body: { kind: 'material', message: 'Ny bakgrund' } })),
      { status: 503, body: { error: 'Authentication unavailable' } });
    assert.ok(spy.seen.some(text => text.includes('operator-store:audit-write')), 'the write was attempted after the ledger check');
  } finally { spy.restore(); }
  assert.deepEqual(await journal(f), []);
});

test('at most twenty requests per company and hour; the next is 429 partner_request_limit and nothing is written', async t => {
  const f = await partnerPostgresFixture(t);
  for (let n = 0; n < 20; n++) assert.equal((await answer(f.call('request', { body: { kind: n % 2 ? 'material' : 'key-rotation' } }))).status, 200, `request ${n + 1}`);
  assert.deepEqual(await answer(f.call('request', { user: 'north-editor', body: { kind: 'material' } })),
    { status: 429, body: { error: 'Too many attempts', reason: 'partner_request_limit' } });
  assert.equal((await journal(f)).length, 20);
  // Taket gäller bolaget: ett annat bolag påverkas inte.
  assert.equal((await answer(f.call('request', { user: 'south-admin', operator: 'south', body: { kind: 'material' } }))).status, 200);
});

test('after migration 022 requests follow role and company and land in the company journal only', async t => {
  const f = await partnerPostgresFixture(t);
  await t.test('material needs material.request (every standard role); key rotation needs integration.request (the administrator)', async () => {
    assert.deepEqual(await answer(f.call('request', { body: { kind: 'material', message: 'Ny bakgrund till north-a' } })),
      { status: 200, body: { ok: true, kind: 'material', message: 'Ny bakgrund till north-a' } });
    assert.equal((await answer(f.call('request', { user: 'north-editor', body: { kind: 'material' } }))).status, 200);
    assert.equal((await answer(f.call('request', { user: 'north-viewer', body: { kind: 'material' } }))).status, 200);
    assert.equal((await answer(f.call('request', { body: { kind: 'key-rotation' } }))).status, 200);
    assert.equal((await answer(f.call('request', { user: 'north-viewer', body: { kind: 'key-rotation' } }))).status, 403);
    assert.equal((await answer(f.call('request', { user: 'north-editor', body: { kind: 'key-rotation' } }))).status, 403);
    const rows = await journal(f);
    assert.deepEqual(rows.map(row => [row.action, row.actor_id, row.access_class, row.resource_type, row.resource_id]), [
      ['request.key-rotation', '42', 'partner', 'operator', 'north'],
      ['request.material', '42', 'partner', 'operator', 'north'], ['request.material', '43', 'partner', 'operator', 'north'],
      ['request.material', '44', 'partner', 'operator', 'north']]);
    assert.deepEqual(JSON.parse(rows[1].changes), { after: { message: 'Ny bakgrund till north-a' }, before: null });
  });

  await t.test('another company and malformed requests are refused without writing', async () => {
    const before = await journal(f);
    const foreign = await answer(f.call('request', { user: 'south-admin', body: { kind: 'material' } }));
    assert.deepEqual(foreign, { status: 403, body: { error: 'Access denied' } });
    for (const body of [{ kind: 'refund' }, { kind: 'material', operatorId: 'south' }, { kind: 'material', message: 'rad\nbrytning' },
      { kind: 'material', message: 'x'.repeat(501) }, { kind: 'material', message: ' kant ' }, { kind: 'material', message: '' }]) {
      assert.equal((await answer(f.call('request', { body }))).status, 400, JSON.stringify(body));
    }
    assert.deepEqual(await journal(f), before);
    assert.deepEqual(await journal(f, 'south'), []);
  });

  await t.test('the full journal shows the requests; the publication history does not', async () => {
    const full = await answer(f.call('journal'));
    assert.equal(full.status, 200);
    assert.deepEqual(full.body.entries.filter(entry => entry.action.startsWith('request.')).map(entry => entry.action).sort(),
      ['request.key-rotation', 'request.material', 'request.material', 'request.material']);
    const history = await answer(f.call('journal', { operator: 'north&kind=publications' }));
    assert.equal(history.status, 200);
    const published = await f.rows("SELECT count(*)::integer AS n FROM croupier_studio.operator_audit_events WHERE environment_id=$1 AND operator_id='north' AND action='package.publish'", [f.scope.environment]);
    assert.equal(history.body.entries.length, published[0].n);
  });
});
