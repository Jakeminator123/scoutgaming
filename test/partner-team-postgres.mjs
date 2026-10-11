import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createPostgresStore } from '../web/storage/postgres-store.mjs';
import { createOperatorStore } from '../web/storage/operator-store.mjs';
import { handlePartnerAuth } from '../lab/lib/partner-session.mjs';
import { STANDARD_OPERATOR_ROLES } from '../lab/lib/operator-admin-api.mjs';
import { createOperatorJournal } from '../lab/lib/operator-journal.mjs';
import { planStudioMigrations, applyStudioMigrations } from '../ops/neon-studio/migrations.mjs';

const origin = 'https://n2-qa.example.invalid';
const host = 'n2-qa.example.invalid';
const scope = { environment: 'isolated-n2-qa', workspaceId: 'acceptance' };


// A real PostgreSQL acceptance suite. Never accepts Neon or a shared game DB.
// Both databases must be empty, fixture-named and served by one loopback-only cluster.
export async function runPartnerTeamPostgresChecks({ operatorPool, authPool, restart } = {}) {
  const checks = [];
  const check = async (name, fn) => { await fn(); checks.push(name); process.stdout.write(`PASS ${name}\n`); };
  const targets = [];
  for (const [pool, database] of [[operatorPool, 'n2_qa_operators'], [authPool, 'n2_qa_auth']]) {
    assert.equal(typeof pool?.connect, 'function');
    const target = (await pool.query("SELECT host(inet_server_addr()) AS address, current_user AS role, current_database() AS database, current_setting('listen_addresses') AS listeners, inet_server_port() AS port")).rows[0];
    assert.deepEqual({ ...target, port: undefined }, { address: '127.0.0.1', role: 'studio_qa', database, listeners: '127.0.0.1', port: undefined });
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM pg_namespace WHERE nspname IN ('croupier_auth','croupier_studio','croupier_game')")).rows[0].count, 0, 'must start from empty fixture databases');
    targets.push(target);
  }
  assert.equal(targets[0].port, targets[1].port);
  await check('fresh isolated auth and operator databases install production schemas', async () => {
    await authPool.query(await readFile(new URL('../ops/neon-game/product-schema.sql', import.meta.url), 'utf8'));
    const plan = await planStudioMigrations({ pool: operatorPool });
    await applyStudioMigrations({ pool: operatorPool, expectedTarget: plan.target, confirm: true });
    assert.equal((await planStudioMigrations({ pool: operatorPool })).toApply.length, 0);
    assert.ok((await operatorPool.query("SELECT to_regclass('croupier_studio.operator_audit_events') AS present")).rows[0].present);
  });
  const pass = randomBytes(16).toString('hex');
  const users = [['42', 'north-admin'], ['43', 'north-viewer'], ['44', 'north-editor'], ['45', 'outside-partner'], ['46', 'north-second-admin'], ['51', 'south-admin']];
  for (const [id, username] of users) {
    const salt = randomBytes(16).toString('hex');
    await authPool.query('INSERT INTO croupier_auth.users (id,username,email,salt,hash,role,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, username, `${username}@qa.invalid`, salt, scryptSync(pass, salt, 64).toString('hex'), 'partner', new Date().toISOString()]);
  }
  await authPool.query("SELECT setval(pg_get_serial_sequence('croupier_auth.users','id'),100)");
  let store = await createOperatorStore({ sql: operatorPool, scope });
  for (const operatorId of ['north', 'south', 'race']) {
    await store.createOperator({ actor: 'fixture', operatorId, slug: operatorId, name: operatorId });
    for (const role of STANDARD_OPERATOR_ROLES) await store.upsertRole({ actor: 'fixture', operatorId, roleId: role.id, label: role.label, permissions: [...role.permissions], delegable: role.delegable });
  }
  for (const [operatorId, rows] of [['north', [['42', 'partner-admin'], ['43', 'partner-viewer'], ['44', 'partner-editor'], ['46', 'partner-admin']]], ['south', [['51', 'partner-admin']]], ['race', [['42', 'partner-admin'], ['46', 'partner-admin']]]]) {
    for (const [userId, roleId] of rows) await store.upsertMembership({ actor: 'fixture', operatorId, userId, roleId, status: 'active' });
  }
  const emails = [];
  const auth = createPostgresStore({ pool: authPool });
  let config = { pool: operatorPool, scope, boDb: auth.boDb, gameDb: auth.db, allowedOrigins: [origin, 'https://n2-lab.example.invalid'], publicHosts: [host, 'n2-lab.example.invalid'], apiBase: '/studio/api/admin', authBase: '/studio/api/auth', publicOrigin: origin,
    rateLimit: async () => true, clientAddress: () => '192.0.2.1', mail: { send: async mail => { emails.push(mail); return { ok: true }; } }, journal: createOperatorJournal({ log: () => {} }) };
  const request = (path, { cookie, body, method = body ? 'POST' : 'GET' } = {}) => new Request(`${origin}/studio/api/partner/${path}`, {
    method, headers: { host, origin, 'sec-fetch-site': 'same-origin', ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const call = (path, options, configuration = config) => handlePartnerAuth(request(path, options), configuration);
  async function cookieFor(user, password = pass) {
    const response = await call('login', { body: { user, pass: password } });
    assert.equal(response.status, 200, `login ${user}`);
    const value = response.headers.getSetCookie().find(value => value.startsWith('partner_session='))?.split(';')[0];
    assert.ok(value); return value;
  }
  const admin = await cookieFor('north-admin');
  const viewer = await cookieFor('north-viewer');
  const countAudit = async () => Number((await operatorPool.query('SELECT count(*)::int AS count FROM croupier_studio.operator_audit_events')).rows[0].count);
  await check('separate auth pool authenticates and applies restricted team and journal access', async () => {
    assert.equal((await call('team?operator=north', { cookie: viewer })).status, 200);
    assert.equal((await call('journal?operator=north', { cookie: viewer })).status, 403);
    const before = await countAudit();
    assert.equal((await call('team?operator=north', { cookie: viewer, body: { action: 'role', userId: '44', roleId: 'partner-viewer', expectedRevision: 1 } })).status, 403);
    assert.equal(await countAudit(), before);
    assert.equal((await call('journal?operator=north', { cookie: admin })).status, 200);
  });
  await check('cross-tenant team reads writes and journal reads fail closed', async () => {
    const before = await countAudit();
    for (const path of ['team?operator=south', 'journal?operator=south']) assert.equal((await call(path, { cookie: admin })).status, 403);
    assert.equal((await call('team?operator=south', { cookie: admin, body: { action: 'invite', email: 'outside-partner@qa.invalid', roleId: 'partner-viewer' } })).status, 403);
    assert.equal(await store.getMembership('south', '45'), null);
    assert.equal(await countAudit(), before);
    const other = await createOperatorStore({ sql: operatorPool, scope: { ...scope, workspaceId: 'other' } });
    assert.equal(await other.getOperatorById('north'), null);
  });
  await check('simultaneous last-admin demotions serialize and preserve exactly one administrator', async () => {
    const before = await countAudit();
    const results = await Promise.allSettled(['42', '46'].map(userId => store.upsertMembership({ actor: 'fixture-admin', operatorId: 'race', userId, roleId: 'partner-viewer', status: 'active', expectedRevision: 1 })));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected' && result.reason.code === 'studio_last_operator_admin').length, 1);
    assert.equal((await store.listMemberships('race')).filter(member => member.roleId === 'partner-admin' && member.status === 'active').length, 1);
    assert.equal(await countAudit(), before + 1);
  });
  await check('two real HTTP writers with one revision accept one change and one durable audit', async () => {
    const before = await countAudit();
    const responses = await Promise.all(['partner-editor', 'partner-viewer'].map(roleId => call('team?operator=north', { cookie: admin, body: { action: 'role', userId: '43', roleId, expectedRevision: 1 } })));
    assert.deepEqual(responses.map(value => value.status).sort(), [200, 409]);
    assert.equal((await store.getMembership('north', '43')).revision, 2);
    assert.equal(await countAudit(), before + 1);
    const stale = await call('team?operator=north', { cookie: admin, body: { action: 'suspend', userId: '43', expectedRevision: 1 } });
    assert.equal(stale.status, 409); assert.equal(await countAudit(), before + 1);
  });
  await check('real PostgreSQL audit failure rolls back membership and revision atomically', async () => {
    const before = await countAudit();
    const member = await store.getMembership('north', '44');
    await operatorPool.query("ALTER TABLE croupier_studio.operator_audit_events ADD CONSTRAINT n2_qa_refuse_audit CHECK (resource_id <> '44') NOT VALID");
    try {
      const response = await call('team?operator=north', { cookie: admin, body: { action: 'role', userId: '44', roleId: 'partner-viewer', expectedRevision: member.revision } });
      assert.equal(response.status, 422);
      assert.deepEqual(await store.getMembership('north', '44'), member);
      assert.equal(await countAudit(), before);
    } finally { await operatorPool.query('ALTER TABLE croupier_studio.operator_audit_events DROP CONSTRAINT n2_qa_refuse_audit'); }
  });
  await check('operator-lock reauthorization rejects privileges revoked after session validation', async () => {
    const beforeTarget = await store.getMembership('north', '44');
    let intercepted = false;
    const wrapped = { query: (...args) => operatorPool.query(...args), async connect() {
      const client = await operatorPool.connect();
      return { release: () => client.release(), async query(sql, values) {
        if (!intercepted && typeof sql === 'string' && sql.includes('operator-store:lock-operator')) {
          intercepted = true;
          await store.upsertMembership({ actor: 'fixture-admin', operatorId: 'north', userId: '42', roleId: 'partner-viewer', status: 'active', expectedRevision: 1 });
        }
        return client.query(sql, values);
      } };
    } };
    const response = await call('team?operator=north', { cookie: admin, body: { action: 'role', userId: '44', roleId: 'partner-viewer', expectedRevision: beforeTarget.revision } }, { ...config, pool: wrapped });
    assert.equal(intercepted, true); assert.equal(response.status, 403);
    assert.deepEqual(await store.getMembership('north', '44'), beforeTarget);
    assert.equal((await call('journal?operator=north', { cookie: admin })).status, 403);
  });
  const second = await cookieFor('north-second-admin');
  await check('activation crosses separate pools once and persists membership audit without sending mail', async () => {
    const response = await call('team?operator=north', { cookie: second, body: { action: 'invite', email: 'new-person@qa.invalid', roleId: 'partner-viewer' } });
    assert.equal(response.status, 200); assert.equal(emails.length, 1);
    const invitation = JSON.stringify(emails[0]);
    const link = /https:\/\/n2-qa\.example\.invalid\/partner\/set-password\?t=([^\s"<>\\]+)/.exec(invitation);
    assert.ok(link, 'fixture delivery captures activation token locally');
    const token = decodeURIComponent(link[1]);
    const { rows: [account] } = await authPool.query('SELECT id FROM croupier_auth.users WHERE email=$1', ['new-person@qa.invalid']);
    assert.equal((await store.getMembership('north', String(account.id))).status, 'invited');
    const before = await countAudit();
    const activated = await call('set-password', { body: { token, password: 'fixture-new-password-only' } });
    assert.equal(activated.status, 200);
    assert.equal((await store.getMembership('north', String(account.id))).status, 'active');
    assert.equal(await countAudit(), before + 1);
    assert.equal((await call('set-password', { body: { token, password: 'fixture-replay-password' } })).status, 400);
    assert.equal(await countAudit(), before + 1);
    const cookie = await cookieFor('new-person@qa.invalid', 'fixture-new-password-only');
    assert.equal((await call('team?operator=north', { cookie })).status, 200);
    assert.equal((await call('team?operator=south', { cookie })).status, 403);
  });
  async function inviteFixture(email) {
    const response = await call('team?operator=north', { cookie: second, body: { action: 'invite', email, roleId: 'partner-viewer' } });
    assert.equal(response.status, 200);
    const invitation = JSON.stringify(emails.at(-1));
    const link = /https:\/\/n2-qa\.example\.invalid\/partner\/set-password\?t=([^\s"<>\\]+)/.exec(invitation);
    assert.ok(link);
    const { rows: [account] } = await authPool.query('SELECT id FROM croupier_auth.users WHERE email=$1', [email]);
    return { userId: String(account.id), token: decodeURIComponent(link[1]), email };
  }
  async function assertAuthRolledBack(invited) {
    const { rows: [account] } = await authPool.query('SELECT salt,hash FROM croupier_auth.users WHERE id=$1', [invited.userId]);
    assert.deepEqual(account, { salt: null, hash: null });
    assert.equal((await authPool.query('SELECT count(*)::int AS count FROM croupier_auth.tokens WHERE username=$1', [invited.email])).rows[0].count, 1);
  }
  await check('activation audit SQL failure rolls back auth token credentials and operator membership', async () => {
    const invited = await inviteFixture('audit-failure@qa.invalid');
    const membership = await store.getMembership('north', invited.userId);
    const before = await countAudit();
    await operatorPool.query("ALTER TABLE croupier_studio.operator_audit_events ADD CONSTRAINT n2_qa_refuse_activation CHECK (action <> 'membership.activate') NOT VALID");
    try {
      assert.equal((await call('set-password', { body: { token: invited.token, password: 'fixture-activation-audit-fail' } })).status, 503);
      await assertAuthRolledBack(invited);
      assert.deepEqual(await store.getMembership('north', invited.userId), membership);
      assert.equal(await countAudit(), before);
    } finally { await operatorPool.query('ALTER TABLE croupier_studio.operator_audit_events DROP CONSTRAINT n2_qa_refuse_activation'); }
    assert.equal((await call('set-password', { body: { token: invited.token, password: 'fixture-activation-retry' } })).status, 200);
    assert.equal((await store.getMembership('north', invited.userId)).status, 'active');
  });
  await check('separate auth COMMIT failure compensates membership and correlates durable events before retry', async () => {
    const invited = await inviteFixture('commit-failure@qa.invalid');
    const before = await countAudit();
    await authPool.query(`CREATE FUNCTION croupier_auth.n2_qa_commit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.email = 'commit-failure@qa.invalid' THEN RAISE EXCEPTION 'isolated fixture commit failure'; END IF; RETURN NULL; END $$;
      CREATE CONSTRAINT TRIGGER n2_qa_commit_failure AFTER UPDATE ON croupier_auth.users DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION croupier_auth.n2_qa_commit_failure()`);
    try {
      assert.equal((await call('set-password', { body: { token: invited.token, password: 'fixture-commit-failure-only' } })).status, 503);
      await assertAuthRolledBack(invited);
      const membership = await store.getMembership('north', invited.userId);
      assert.equal(membership.status, 'invited'); assert.equal(membership.revision, 3);
      assert.equal(await countAudit(), before + 2);
      const entries = (await store.listAuditEvents('north')).entries.filter(entry => entry.resourceId === invited.userId && ['membership.activate','membership.compensate'].includes(entry.action));
      assert.equal(entries.length, 2);
      assert.deepEqual(entries.map(entry => entry.action).sort(), ['membership.activate','membership.compensate']);
      assert.ok(entries.every(entry => entry.actor === invited.userId && entry.accessClass === 'activation'));
      assert.equal(entries[0].requestId, entries[1].requestId);
    } finally {
      await authPool.query('DROP TRIGGER n2_qa_commit_failure ON croupier_auth.users; DROP FUNCTION croupier_auth.n2_qa_commit_failure()');
    }
    assert.equal((await call('set-password', { body: { token: invited.token, password: 'fixture-commit-retry-only' } })).status, 200);
    assert.equal((await store.getMembership('north', invited.userId)).status, 'active');
    assert.equal((await store.getMembership('north', invited.userId)).revision, 4);
    assert.equal(await countAudit(), before + 3);
  });
  await check('journal is tenant scoped sanitized and cursor pagination survives new pool connections', async () => {
    const limited = await call('journal?operator=north&limit=2', { cookie: second });
    assert.equal(limited.status, 200);
    const limitedBody = await limited.json(); assert.equal(limitedBody.entries.length, 2);
    const first = await store.listAuditEvents('north', { limit: 2 });
    assert.equal(first.entries.length, 2); assert.ok(first.nextCursor);
    const cursor = Buffer.from(JSON.stringify(first.nextCursor)).toString('base64url');
    const page = await call(`journal?operator=north&cursor=${encodeURIComponent(cursor)}`, { cookie: second });
    assert.equal(page.status, 200);
    const next = await page.json(); assert.ok(next.entries.length > 0);
    assert.equal(next.entries.some(entry => first.entries.some(row => row.id === entry.id)), false);
    const serialized = JSON.stringify([...first.entries, ...next.entries]);
    for (const secret of [pass, 'new-person@qa.invalid', 'partner_session=', 'fixture-new-password-only']) assert.equal(serialized.includes(secret), false);
    if (restart) {
      const expected = await store.listAuditEvents('north');
      ({ operatorPool, authPool } = await restart());
      store = await createOperatorStore({ sql: operatorPool, scope });
      assert.deepEqual(await store.listAuditEvents('north'), expected);
      const reopened = createPostgresStore({ pool: authPool });
      config = { ...config, pool: operatorPool, boDb: reopened.boDb, gameDb: reopened.db };
      assert.equal((await call('journal?operator=north', { cookie: second })).status, 200);
    }
  });
  return { checks, operatorPool, authPool };
}

const configuration = process.env.CROUPIER_PARTNER_POSTGRES_QA_CONFIG;
if (process.env.NODE_TEST_CONTEXT || configuration) test('real isolated PostgreSQL verifies N2 team, permissions and durable audit', { skip: configuration ? false : 'isolated PostgreSQL fixture is not configured' }, async () => {
  const config = JSON.parse(await readFile(configuration, 'utf8'));
  const { Pool } = createRequire(new URL('../web/package.json', import.meta.url))('pg');
  const pools = ['operators', 'auth'].map(kind => {
    const url = new URL(config[`${kind}DatabaseUrl`]);
    assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.username, 'studio_qa');
    assert.equal(url.password, ''); assert.equal(url.pathname, `/n2_qa_${kind}`);
    return new Pool({ connectionString: url.href, max: 4, connectionTimeoutMillis: 5000, query_timeout: 15000 });
  });
  try { await runPartnerTeamPostgresChecks({ operatorPool: pools[0], authPool: pools[1] }); }
  finally { await Promise.all(pools.map(pool => pool.end())); }
});
