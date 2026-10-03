import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createOperatorSpeechQa } from '../web/operator-speech-qa.mjs';
import { createPostgresOperatorSpeechQa } from '../web/postgres-operator-speech-qa.mjs';

const SCOPE = { environment: 'qa', workspaceId: 'fixture' };
const ID = '8b59aa63-a431-4e7c-977d-cd514349cd1b';
const SHA = 'a'.repeat(64), ORIGIN = 'https://operator.example.test', PATH = '/api/bo/speech-qa';
const gate = { id: ID, createdAt: 100000, expiresAt: 160000 };
function memory({ active = true, used = 0 } = {}) {
  const campaign = { environment_id: 'qa', workspace_id: 'fixture', campaign_id: ID, created_at_ms: '100000', expires_at_ms: '160000', source_sha256: SHA };
  let data = { gate: active ? structuredClone(campaign) : null, campaign, attempts: Array.from({ length: used }, (_, i) => ({
    environment_id: 'qa', workspace_id: 'fixture', campaign_id: ID, attempt: i + 1, turn: 1, reserved_at_ms: '100000', actor: null, source_sha256: SHA })),
    budget: { environment_id: 'qa', version: 1, daily_budget_micro_usd: '1000000', created_at_ms: '99999' },
    lease: { environment_id: 'qa', resource: 'operator-qa', holder_id: 'legacy-import', fence: '1', expires_at_ms: '0', recovery_only: false } };
  let tail = Promise.resolve(), time = 100001, failure = null;
  const trace = [], result = value => ({ rows: value == null ? [] : structuredClone(Array.isArray(value) ? value : [value]) });
  const pool = { async connect() {
    let began = false, snapshot, unlock;
    return { async query(sql, values = []) {
      const tag = /\/\* operator-qa:([^*]+) \*\//.exec(sql)?.[1] ?? sql;
      trace.push(tag);
      if (failure === tag && tag !== 'lost-commit') { failure = null; throw Error('private postgresql://secret@host'); }
      if (sql.startsWith('BEGIN')) { assert.equal(began, false); began = true; return result(); }
      if (sql.startsWith('SET LOCAL')) { assert.equal(began, true); return result(); }
      if (tag === 'lock') { const previous = tail; tail = new Promise(resolve => { unlock = resolve; }); await previous; snapshot = structuredClone(data); return result(); }
      if (tag === 'COMMIT') {
        began = false; snapshot = null; unlock?.(); unlock = null;
        if (failure === 'lost-commit') { failure = null; throw Error('private lost commit response'); }
        return { ...result(), command: 'COMMIT' };
      }
      if (tag === 'ROLLBACK') { if (snapshot) data = snapshot; began = false; snapshot = null; unlock?.(); unlock = null; return result(); }
      assert.ok(began && snapshot, 'SQL must run under transaction lock');
      if (tag === 'clock') return result({ now_ms: String(time) });
      if (tag === 'lease') return result(data.lease?.environment_id === values[0] ? data.lease : null);
      if (tag === 'budget') return result(data.budget?.environment_id === values[0] ? data.budget : null);
      const scoped = row => row?.environment_id === values[0] && row?.workspace_id === values[1];
      if (tag === 'gate') return result(scoped(data.gate) ? data.gate : null);
      if (tag === 'campaign') return result(scoped(data.campaign) && data.campaign?.campaign_id === values[2] ? data.campaign : null);
      if (tag === 'attempts') return result(data.attempts.filter(row => scoped(row) && row.campaign_id === values[2]));
      if (tag === 'reserve') {
        assert.equal(data.attempts.some(row => scoped(row) && row.campaign_id === values[2] && row.attempt === values[3]), false);
        data.attempts.push({ environment_id: values[0], workspace_id: values[1], campaign_id: values[2], attempt: values[3], turn: values[4], reserved_at_ms: String(values[5]), actor: values[6], source_sha256: null });
        return result();
      }
      if (tag === 'claim') { Object.assign(data.lease, { holder_id: values[1], fence: String(values[2]), expires_at_ms: String(values[3]) }); return result({ fence: data.lease.fence }); }
      if (tag === 'release') {
        if (data.lease?.environment_id !== values[0] || data.lease.holder_id !== values[1] || Number(data.lease.fence) !== values[2]) return result();
        data.lease.expires_at_ms = '0'; return result({ fence: data.lease.fence });
      }
      throw Error(`Unknown fixture query ${tag}`);
    }, release() { assert.equal(began, false); assert.equal(unlock, null); } };
  } };
  return { pool, trace, read: () => data, clock: () => time, setTime: value => { time = value; }, fail: tag => { failure = tag; },
    create: scope => createPostgresOperatorSpeechQa({ pool, scope: scope ?? SCOPE }),
    reserve: adapter => adapter.reserve({ gate, turn: 1, authorize: async () => ({ actor: 'current-admin' }) }) };
}

test('import without active gate remains disabled, retained attempts never create a gate or budget', async () => {
  const f = memory({ active: false, used: 3 }), before = structuredClone(f.read()), adapter = f.create();
  assert.deepEqual(await adapter.state(), { gate: null, attempts: 0 });
  await assert.rejects(f.reserve(adapter), { code: 'operator_speech_qa_disabled' });
  assert.deepEqual(f.read(), before);
  assert.equal(f.trace.includes('reserve'), false);
});

test('all three imported attempts survive adapter restart and cannot buy three fresh tries', async () => {
  const f = memory({ used: 3 });
  assert.deepEqual(await f.create().state(), { gate, attempts: 3 });
  for (let i = 0; i < 2; i++) await assert.rejects(f.reserve(f.create()), { code: 'operator_speech_qa_attempt_limit', statusCode: 429 });
  assert.equal(f.read().attempts.length, 3);
});

test('missing/malformed campaign, budget or original lease fail closed, no bootstrap', async () => {
  for (const mutate of [data => { data.campaign = null; }, data => { data.budget = null; }, data => { data.lease = null; },
    data => { data.lease.recovery_only = true; }, data => { data.budget.daily_budget_micro_usd = '0'; },
    data => { data.gate.expires_at_ms = '161000'; }, data => { data.campaign.source_sha256 = 'bad'; },
    data => { data.attempts[0].reserved_at_ms = '160000'; }, data => { data.attempts[0].actor = 'fabricated-owner'; }]) {
    const f = memory({ used: 1 }); mutate(f.read()); const before = structuredClone(f.read()), adapter = f.create();
    await assert.rejects(adapter.state()); await assert.rejects(f.reserve(adapter)); assert.deepEqual(f.read(), before);
  }
});

test('scope mismatch never selects another workspace campaign; expired gate retains attempts', async () => {
  const f = memory({ used: 2 });
  assert.deepEqual(await f.create({ ...SCOPE, workspaceId: 'other' }).state(), { gate: null, attempts: 0 });
  assert.deepEqual(await f.create({ ...SCOPE, environment: 'other' }).state(), { gate: null, attempts: 0 });
  f.setTime(gate.expiresAt);
  assert.deepEqual(await f.create().state(), { gate: null, attempts: 2 });
  await assert.rejects(f.reserve(f.create()), { code: 'operator_speech_qa_disabled' });
  assert.equal(f.read().attempts.length, 2);
});

test('reservation appends actual admin actor, turn and DB time; no invented legacy ownership', async () => {
  const f = memory({ used: 1 }), adapter = f.create();
  const reservation = await adapter.reserve({ gate, turn: 2, authorize: async () => ({ actor: 'operator-42' }) });
  assert.equal(reservation.attempt, 2); assert.equal(await reservation.check(), true);
  assert.deepEqual(f.read().attempts[0].actor, null);
  assert.deepEqual(f.read().attempts[1], { environment_id: 'qa', workspace_id: 'fixture', campaign_id: ID, attempt: 2, turn: 2, reserved_at_ms: '100001', actor: 'operator-42', source_sha256: null });
  await reservation.release(); assert.equal(f.read().lease.expires_at_ms, '0');
  assert.equal((await f.create().state()).attempts, 2);
});

test('parallel controllers serialize lock, consume once; abandoned reservation denies another model', async () => {
  const f = memory(), adapters = [f.create(), f.create()];
  const attempts = await Promise.allSettled(adapters.map(adapter => f.reserve(adapter)));
  assert.equal(attempts.filter(value => value.status === 'fulfilled').length, 1);
  assert.equal(attempts.find(value => value.status === 'rejected').reason.code, 'operator_speech_qa_busy');
  assert.equal(f.read().attempts.length, 1);
  await assert.rejects(f.reserve(f.create()), { code: 'operator_speech_qa_busy' });
  const first = attempts.find(value => value.status === 'fulfilled').value;
  await first.release(); const next = await f.reserve(f.create()); assert.equal(next.attempt, 2); await next.release();
});

test('admin authorization rechecks inside transaction after any queue wait, expiry during auth denies', async () => {
  const f = memory(); let release, entered, currentAdmin = true;
  const started = new Promise(resolve => { entered = resolve; }), blocked = new Promise(resolve => { release = resolve; });
  const first = f.create().reserve({ gate, turn: 1, authorize: async () => { entered(); await blocked; return null; } });
  await started;
  const queued = f.create().reserve({ gate, turn: 1, authorize: async () => currentAdmin ? { actor: 'revoked-admin' } : null });
  currentAdmin = false; release();
  await assert.rejects(first, { code: 'operator_speech_qa_auth_required' });
  await assert.rejects(queued, { code: 'operator_speech_qa_auth_required' });
  assert.equal(f.read().attempts.length, 0);
  await assert.rejects(f.create().reserve({ gate, turn: 1, authorize: async () => null }), { code: 'operator_speech_qa_auth_required' });
  await assert.rejects(f.create().reserve({ gate, turn: 1, authorize: async () => { f.setTime(gate.expiresAt); return { actor: 'admin' }; } }), { code: 'operator_speech_qa_disabled' });
  assert.equal(f.read().attempts.length, 0);
});

test('rollback before claim preserves imported attempts, uncertain commit preserves spent attempt and lock', async () => {
  const f = memory({ used: 1 }), before = structuredClone(f.read()); f.fail('claim');
  await assert.rejects(f.reserve(f.create()), { code: 'operator_speech_qa_unavailable' });
  assert.deepEqual(f.read(), before);
  f.fail('lost-commit'); await assert.rejects(f.reserve(f.create()), { code: 'operator_speech_qa_unavailable' });
  assert.equal(f.read().attempts.length, 2); await assert.rejects(f.reserve(f.create()), { code: 'operator_speech_qa_busy' });
});

test('stale fencing cannot release a newer reservation', async () => {
  const f = memory(), own = await f.reserve(f.create());
  f.read().lease.holder_id = 'new-holder'; f.read().lease.fence = '4';
  assert.equal(await own.check(), false);
  await assert.rejects(own.release(), { code: 'operator_speech_qa_stale' });
  assert.equal(f.read().lease.holder_id, 'new-holder'); assert.equal(f.read().lease.expires_at_ms, '160000');
});

async function controllerFixture(t, { used = 0, active = true, missing = false, directory, failModel = false } = {}) {
  const f = memory({ used, active }), cancelled = [], entries = [], controllers = [];
  let currentAdmin = true, modelCalls = 0, held = null, model;
  const stream = { status: () => ({ workers: 1, busy: 0, available: 1, pending: 0 }),
    acquireExclusive(owner) { assert.equal(held, null); held = owner; return () => { if (held === owner) held = null; }; },
    cancelOwner: owner => cancelled.push(owner),
    async prepare(input) { await input.beforeCostly(); entries.push(input); return { kind: 'generated-speech-stream', requestId: input.requestId, exactText: input.text, ticket: 'fake-ticket' }; } };
  const create = () => { const qa = createOperatorSpeechQa({ directory, origin: ORIGIN, now: f.clock, journalRequired: true, gateStore: missing ? undefined : f.create(),
    authenticate: () => currentAdmin ? { sub: 'operator-42', role: 'admin', auth_epoch: 1, source_stamp: 'current', exp: 3600 } : null,
    service: () => stream, decide: async (request, status, signal) => {
      modelCalls++; if (model) return model(request, status, signal); if (failModel) throw Error('private provider response');
      return { kind: 'generatedText', exactText: 'Mamma bakar bullar.', requestId: request.requestId, dealerId: status.dealerId };
    } }); controllers.push(qa); return qa; };
  async function call(qa, method = 'POST') {
    const req = Readable.from(method === 'POST' ? [JSON.stringify({ turn: 1 })] : []);
    Object.assign(req, { method, url: PATH, aborted: false, headers: { host: new URL(ORIGIN).host, origin: ORIGIN, 'sec-fetch-site': 'same-origin', cookie: 'bo_jwt=header.fixture.signature', 'content-type': 'application/json' } });
    const res = new EventEmitter(); Object.assign(res, { writableEnded: false, destroyed: false, code: null, value: null,
      writeHead(code) { this.code = code; }, end(bytes) { this.value = JSON.parse(bytes); this.writableEnded = true; this.emit('close'); } });
    assert.equal(await qa.handle(req, res, PATH), true); return { code: res.code, value: res.value, req };
  }
  t.after(async () => { currentAdmin = true; for (const qa of controllers) await call(qa, 'DELETE'); });
  return { ...f, create, call, entries, cancelled, setModel: value => { model = value; }, revoke: () => { currentAdmin = false; },
    complete: () => { held = null; }, get modelCalls() { return modelCalls; } };
}

test('shared mode ignores valid disk gate when adapter missing or imported active gate absent', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-neon-operator-qa-'));
  t.after(async () => { assert.equal(dirname(directory), resolve(tmpdir())); assert.match(basename(directory), /^croupier-neon-operator-qa-/); await rm(directory, { recursive: true, force: true }); });
  await writeFile(join(directory, 'operator-qa.json'), JSON.stringify(gate), { mode: 0o600 });
  for (const options of [{ missing: true }, { active: false }]) {
    const f = await controllerFixture(t, { ...options, directory }), qa = f.create();
    assert.equal((await f.call(qa, 'GET')).value.enabled, false); assert.equal((await f.call(qa)).code, 503); assert.equal(f.modelCalls, 0);
  }
  assert.deepEqual(await readdir(directory), ['operator-qa.json']);
});

test('SQL imported failed attempts survive native controller restart; remaining attempt consumed before failed model', async t => {
  const f = await controllerFixture(t, { used: 2, failModel: true });
  const result = await f.call(f.create()); assert.equal(result.code, 502); assert.equal(result.value.attempt, 3);
  assert.equal(JSON.stringify(result.value).includes('private'), false);
  assert.equal((await f.call(f.create(), 'GET')).value.attempts, 3);
  assert.equal((await f.call(f.create())).code, 429); assert.equal(f.modelCalls, 1);
  assert.equal(f.read().attempts.length, 3); assert.equal(f.read().lease.expires_at_ms, '0');
});

test('successful SQL QA writes no gate/campaign/attempt/lock files even with a valid legacy directory', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-neon-operator-qa-'));
  t.after(async () => { assert.equal(dirname(directory), resolve(tmpdir())); assert.match(basename(directory), /^croupier-neon-operator-qa-/); await rm(directory, { recursive: true, force: true }); });
  await writeFile(join(directory, 'operator-qa.json'), JSON.stringify(gate), { mode: 0o600 });
  const f = await controllerFixture(t, { directory }), qa = f.create();
  assert.equal((await f.call(qa)).code, 200); assert.equal(f.modelCalls, 1);
  assert.deepEqual(await readdir(directory), ['operator-qa.json']); assert.equal(f.read().attempts.length, 1);
});

test('current auth, exact session and live gate still own prepared SQL QA stream after HTTP lock release', async t => {
  const f = await controllerFixture(t), qa = f.create(), result = await f.call(qa), input = f.entries[0];
  assert.equal(result.code, 200); assert.equal(f.read().lease.expires_at_ms, '0');
  assert.equal(await qa.resolveOwner(result.req, input.playerId), input.owner); await input.beforeCostly();
  const wrong = { headers: { ...result.req.headers, cookie: 'bo_jwt=header.other.signature' } };
  assert.equal(await qa.resolveOwner(wrong, input.playerId), null);
  f.revoke(); assert.equal(await qa.resolveOwner(result.req, input.playerId), null); await assert.rejects(input.beforeCostly());
  assert.equal(f.read().attempts.length, 1);
});

test('SQL gate/auth changes during model prevent prepare; failed reservation remains', async t => {
  for (const mode of ['expiry', 'auth', 'campaign-change']) {
    const f = await controllerFixture(t); f.setModel(async () => {
      if (mode === 'expiry') f.setTime(gate.expiresAt);
      if (mode === 'auth') f.revoke();
      if (mode === 'campaign-change') f.read().gate.expires_at_ms = '161000';
      return { kind: 'generatedText', exactText: 'Never sent.' };
    });
    const result = await f.call(f.create()); assert.notEqual(result.code, 200); assert.equal(f.modelCalls, 1); assert.equal(f.entries.length, 0);
    assert.equal(f.read().attempts.length, 1); assert.equal(f.read().lease.expires_at_ms, '0');
  }
});

test('DELETE during awaited SQL QA cancels own stream and preserves immutable attempt', async t => {
  const f = await controllerFixture(t), qa = f.create(); let release, entered;
  const started = new Promise(resolve => { entered = resolve; }), held = new Promise(resolve => { release = resolve; });
  f.setModel(async () => { entered(); await held; return { kind: 'generatedText', exactText: 'Cancelled.' }; });
  const pending = f.call(qa); await started; try { assert.equal((await f.call(qa, 'DELETE')).code, 200); } finally { release(); }
  assert.notEqual((await pending).code, 200); assert.equal(f.entries.length, 0); assert.equal(f.read().attempts.length, 1);
});
