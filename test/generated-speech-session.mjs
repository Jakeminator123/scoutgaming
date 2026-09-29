import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSpeechSessionManager, sessionReserveMicroUsd, SPEECH_SESSION_POLICY } from '../web/generated-speech-session.mjs';

const response = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-session-'));
  const configuration = { directory, apiKey: 'private-api-fixture', endpointId: 'fixture-endpoint',
    workerSecret: 'worker-secret-fixture-at-least-32-characters', origin: 'https://game.example.test',
    reserveUsd: options.reserveUsd ?? '0.50', dailyBudgetUsd: options.dailyBudgetUsd ?? '9.94' };
  let time = Date.parse('2026-09-29T08:00:00Z'), connected = false, busy = false, jobNumber = 0;
  const calls = [], jobs = new Map(), managers = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, ...init });
    if (url.endsWith('/run')) {
      if (options.submit) return options.submit(url, init);
      const id = `job-${++jobNumber}`; jobs.set(id, 'IN_PROGRESS'); return response({ id, status: 'IN_QUEUE' });
    }
    const id = url.split('/').at(-1);
    if (url.includes('/status/')) {
      if (options.status) return options.status(id, init);
      if (jobs.get(id) === 'IN_PROGRESS' && options.connect !== false) connected = true;
      return response({ id, status: jobs.get(id) });
    }
    if (url.includes('/cancel/')) { jobs.set(id, 'CANCELLED'); connected = false; return response({ id, status: 'CANCELLED' }); }
    assert.fail('unexpected endpoint');
  };
  const dependencies = { workerState: () => ({ workers: connected ? 1 : 0, busy: busy ? 1 : 0, available: connected && !busy ? 1 : 0 }),
    fetchImpl, now: () => time,
    sleep: async (ms, signal) => { time += ms; signal?.throwIfAborted(); },
    readyTimeoutMs: 1000, idleTimeoutMs: options.idleTimeoutMs ?? 60000 };
  const create = (configPatch = {}, dependencyPatch = {}) => {
    const manager = createSpeechSessionManager({ ...configuration, ...configPatch }, { ...dependencies, ...dependencyPatch });
    managers.push(manager); return manager;
  };
  const input = { beforeCostly: async () => {} };
  t.after(async () => { await Promise.all(managers.map(manager => manager.close())); await rm(directory, { recursive: true, force: true }); });
  return { configuration, directory, calls, jobs, create, input, fetchImpl,
    finish() { for (const id of jobs.keys()) jobs.set(id, 'COMPLETED'); connected = false; },
    busy(value) { busy = value; }, setTime(value) { time = Date.parse(value); } };
}
const starts = calls => calls.filter(call => call.url.endsWith('/run'));

test('cost amounts are exact micro-USD and missing/unconfirmed configuration fails closed', async t => {
  assert.equal(sessionReserveMicroUsd('0.50'), 500000);
  assert.equal(sessionReserveMicroUsd('9.94'), 9940000);
  for (const value of ['', undefined, '0', '10.000001', 'NaN', '1e-3', '0.0000001', '-1']) assert.equal(sessionReserveMicroUsd(value), null);
  const f = await fixture(t);
  for (const patch of [{ reserveUsd: '' }, { dailyBudgetUsd: '' }, { dailyBudgetUsd: '10.01' }, { reserveUsd: '10', dailyBudgetUsd: '9.94' }]) {
    assert.throws(() => f.create(patch), { code: 'generated_speech_session_not_configured' });
  }
  f.create(); assert.equal(f.calls.length, 0, 'no startup worker or billing loop');
});

test('authenticated demand bootstraps a private ledger, pays once and reuses session across requests/restarts', async t => {
  const f = await fixture(t), manager = f.create();
  await assert.rejects(manager.ensure({ beforeCostly: async () => { throw Error('stale owner'); } }), /stale owner/);
  assert.equal(f.calls.length, 0);
  assert.deepEqual(await manager.ensure(f.input), { ready: true });
  const first = starts(f.calls)[0], submitted = JSON.parse(first.body);
  assert.deepEqual(submitted.policy, { executionTimeout: 600000, ttl: 660000 });
  assert.equal(submitted.input.op, 'session'); assert.equal(submitted.input.ttl, 540);
  assert.equal(submitted.input.ws_url, 'wss://game.example.test/lipsync-worker');
  assert.equal(submitted.input.ws_token, f.configuration.workerSecret);
  assert.match(submitted.input.worker_id, /^croupier-[a-f0-9]{32}$/);
  await manager.ensure(f.input);
  await f.create().ensure(f.input);
  assert.equal(starts(f.calls).length, 1);
  const files = await readdir(f.directory);
  assert.equal(files.filter(name => name.endsWith('.reservation.json')).length, 1);
  assert.ok(files.includes('gpu-budget-policy.json'));
  for (const file of files) assert.doesNotMatch(await readFile(join(f.directory, file), 'utf8'), /private-api-fixture|worker-secret-fixture/);
});

test('concurrent verified demand shares one pending submission, not duplicate GPU sessions', async t => {
  const f = await fixture(t), manager = f.create();
  const values = await Promise.all([manager.ensure(f.input), manager.ensure(f.input), manager.ensure(f.input)]);
  assert.ok(values.every(value => value.ready)); assert.equal(starts(f.calls).length, 1);
  f.busy(true);
  await assert.rejects(manager.ensure(f.input), { code: 'generated_speech_stream_busy' });
  assert.equal(f.calls.filter(call => call.url.includes('/cancel/')).length, 0, 'another speaker does not cancel an active utterance');
});

test('durable cost reservation precedes /run, counts failed/uncertain starts and blocks automatic paid retry', async t => {
  let directory;
  const f = await fixture(t, { submit: async () => {
    const files = await readdir(directory);
    assert.equal(files.filter(name => name.endsWith('.reservation.json')).length, 1);
    throw Error('uncertain https://provider.test/?token=SECRET');
  } });
  directory = f.directory;
  await assert.rejects(f.create().ensure(f.input), error => error.code === 'generated_speech_session_unavailable' && !error.message.includes('SECRET'));
  await assert.rejects(f.create().ensure(f.input), { code: 'generated_speech_session_submission_uncertain' });
  assert.equal(starts(f.calls).length, 1);
});

test('9.94 USD budget admits nineteen 0.50 reservations, never a reply count limit', async t => {
  const f = await fixture(t), manager = f.create();
  for (let i = 0; i < 19; i++) { await manager.ensure(f.input); f.finish(); }
  await assert.rejects(f.create().ensure(f.input), { code: 'generated_speech_daily_budget_exhausted', statusCode: 429 });
  assert.equal(starts(f.calls).length, 19);
  assert.equal(SPEECH_SESSION_POLICY.dailyMicroUsd, 10000000);
  // A restart with a larger env must not silently loosen the persisted policy.
  await assert.rejects(f.create({ dailyBudgetUsd: '10' }).ensure(f.input), { code: 'generated_speech_daily_budget_exhausted' });
});

test('session crossing UTC midnight reserves its full cost on both days; later days have their own budget', async t => {
  const f = await fixture(t, { dailyBudgetUsd: '0.50' }), manager = f.create();
  f.setTime('2026-09-29T23:59:00Z');
  await manager.ensure(f.input); f.finish();
  f.setTime('2026-09-30T00:01:00Z');
  await assert.rejects(manager.ensure(f.input), { code: 'generated_speech_daily_budget_exhausted' });
  f.setTime('2026-10-01T08:00:00Z');
  await manager.ensure(f.input); assert.equal(starts(f.calls).length, 2);
});

test('truncated policy, reservation and abandoned lock fail closed without a provider call', async t => {
  for (const name of ['gpu-budget-policy.json', `gpu-session-${'a'.repeat(32)}.reservation.json`, 'stream-session.lock']) {
    const f = await fixture(t); await writeFile(join(f.directory, name), '');
    await assert.rejects(f.create().ensure(f.input)); assert.equal(f.calls.length, 0);
  }
});

test('failed cold startup cancels only its known job and never retries /run', async t => {
  const f = await fixture(t, { connect: false });
  await assert.rejects(f.create().ensure(f.input), { code: 'generated_speech_session_start_timeout', statusCode: 504 });
  assert.equal(starts(f.calls).length, 1);
  assert.equal(f.calls.filter(call => call.url.includes('/cancel/job-1')).length, 1);
  assert.equal(f.jobs.get('job-1'), 'CANCELLED');
});

test('disconnect cancels a known startup; stale requester cannot keep paying', async t => {
  const controller = new AbortController();
  const f = await fixture(t, { status: id => { controller.abort(); return response({ id, status: 'IN_QUEUE' }); } });
  await assert.rejects(f.create().ensure({ ...f.input, signal: controller.signal }), { code: 'generated_speech_session_cancelled' });
  assert.equal(starts(f.calls).length, 1);
  assert.ok(f.calls.some(call => call.url.includes('/cancel/job-1')));
});

test('idle session stops without automatically replenishing a worker', async t => {
  const f = await fixture(t, { idleTimeoutMs: 10 });
  await f.create().ensure(f.input);
  await new Promise(resolve => setTimeout(resolve, 35));
  assert.equal(f.jobs.get('job-1'), 'CANCELLED');
  assert.equal(starts(f.calls).length, 1);
});

test('unrelated connected worker cannot satisfy readiness for this reserved job', async t => {
  const f = await fixture(t, { connect: false });
  const manager = f.create({}, { workerState: id => ({ workers: starts(f.calls).length ? 1 : 0, busy: 0, available: id ? 0 : 1 }) });
  await assert.rejects(manager.ensure(f.input), { code: 'generated_speech_session_start_timeout' });
  assert.equal(starts(f.calls).length, 1);
  assert.ok(f.calls.some(call => call.url.includes('/cancel/job-1')));
});

test('near-expiry session stops and leaves relay before replacement admission', async t => {
  const f = await fixture(t), manager = f.create();
  await manager.ensure(f.input);
  f.setTime('2026-09-29T08:06:00Z');
  await manager.ensure(f.input);
  assert.equal(starts(f.calls).length, 2);
  const cancelled = f.calls.findIndex(call => call.url.includes('/cancel/job-1'));
  const newJob = f.calls.findIndex((call, i) => i > cancelled && call.url.endsWith('/run'));
  assert.ok(cancelled > 0 && newJob > cancelled);
  assert.equal(f.jobs.get('job-1'), 'CANCELLED');
});

test('separate managers cannot both reserve and submit while the first holds its disk lock', async t => {
  let release, submitted;
  const started = new Promise(resolve => { submitted = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { submit: async () => { submitted(); await held; throw Error('uncertain'); } });
  const first = f.create().ensure(f.input);
  await started;
  await assert.rejects(f.create().ensure(f.input), { code: 'generated_speech_session_busy' });
  release(); await assert.rejects(first);
  assert.equal(starts(f.calls).length, 1);
});

test('new verified demand suspends the previous idle timer while its status read is pending', async t => {
  const f = await fixture(t, { idleTimeoutMs: 50 });
  let polls = 0, release, started;
  const held = new Promise(resolve => { release = resolve; });
  const reading = new Promise(resolve => { started = resolve; });
  const manager = f.create({}, { fetchImpl: async (url, init) => {
    if (url.includes('/status/') && ++polls === 2) { started(); await held; }
    return f.fetchImpl(url, init);
  } });
  await manager.ensure(f.input);
  const second = manager.ensure(f.input);
  await reading;
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(f.calls.filter(call => call.url.includes('/cancel/')).length, 0);
  release(); await second;
  assert.equal(starts(f.calls).length, 1);
});
