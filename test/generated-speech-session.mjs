import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSpeechSessionManager, sessionReserveMicroUsd, dailyBudgetMicroUsd, SPEECH_SESSION_POLICY } from '../services/game/generated-speech-session.mjs';

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

async function missingStatusFixture(t, { ageMs = SPEECH_SESSION_POLICY.reservationWindowMs, status = 404, dailyBudgetUsd, workerState } = {}) {
  const f = await fixture(t, { dailyBudgetUsd });
  await f.create().ensure(f.input);
  f.finish();
  f.setTime(new Date(Date.parse('2026-09-29T08:00:00Z') + ageMs).toISOString());
  const dependencies = { fetchImpl: async (url, init) => {
    if (url.endsWith('/status/job-1') || url.endsWith('/cancel/job-1')) {
      f.calls.push({ url, ...init });
      return new Response('private provider response must not escape', { status });
    }
    return f.fetchImpl(url, init);
  }, ...(workerState ? { workerState } : {}) };
  return { ...f, manager: f.create({}, dependencies), dependencies };
}

test('cost amounts are exact micro-USD and missing/unconfirmed configuration fails closed', async t => {
  assert.equal(dailyBudgetMicroUsd('20'), 20000000);
  assert.equal(dailyBudgetMicroUsd('20.000001'), null);
  assert.equal(sessionReserveMicroUsd('20'), null);
  assert.equal(sessionReserveMicroUsd('0.50'), 500000);
  assert.equal(sessionReserveMicroUsd('9.94'), 9940000);
  for (const value of ['', undefined, '0', '10.000001', 'NaN', '1e-3', '0.0000001', '-1']) assert.equal(sessionReserveMicroUsd(value), null);
  const f = await fixture(t);
  for (const patch of [{ reserveUsd: '' }, { dailyBudgetUsd: '' }, { dailyBudgetUsd: '20.000001' }, { reserveUsd: '10', dailyBudgetUsd: '9.94' }]) {
    assert.throws(() => f.create(patch), { code: 'generated_speech_session_not_configured' });
  }
  f.create({ dailyBudgetUsd: '20' }); assert.equal(f.calls.length, 0, 'no startup worker or billing loop');
});

test('default admission accepts a cold worker after 90 seconds without another paid job', async t => {
  const f=await fixture(t);let elapsed=0,allowConnection=true;
  const manager=f.create({}, {readyTimeoutMs:undefined,now:()=>Date.parse('2026-09-29T08:00:00Z')+elapsed,
    sleep:async ms=>{elapsed+=ms;},workerState:()=>{const ready=allowConnection&&elapsed>=135000;return {workers:Number(ready),busy:0,available:Number(ready)};}});
  await manager.ensure(f.input);
  assert.equal(elapsed,135000);assert.equal(starts(f.calls).length,1);
  assert.equal(f.calls.filter(call=>call.url.includes('/cancel/')).length,0);
  assert.equal(JSON.parse(starts(f.calls)[0].body).input.ttl,540);
  allowConnection=false;
});

test('default cold-start allowance still cancels once at the bounded admission deadline', async t => {
  const f=await fixture(t,{connect:false});let elapsed=0;
  const manager=f.create({}, {readyTimeoutMs:undefined,now:()=>Date.parse('2026-09-29T08:00:00Z')+elapsed,sleep:async ms=>{elapsed+=ms;}});
  await assert.rejects(manager.ensure(f.input),{code:'generated_speech_session_start_timeout'});
  assert.equal(elapsed,SPEECH_SESSION_POLICY.admissionWindowMs);
  assert.equal(starts(f.calls).length,1);
  assert.equal(f.calls.filter(call=>call.url.includes('/cancel/')).length,1);
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
  assert.equal(SPEECH_SESSION_POLICY.dailyMicroUsd, 20000000);
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

test('expired missing status retires only the old session; a later explicit request uses the unchanged budget', async t => {
  const f = await missingStatusFixture(t);
  const reservation = (await readdir(f.directory)).find(name => name.endsWith('.reservation.json'));
  const original = await readFile(join(f.directory, reservation), 'utf8');
  const policy = await readFile(join(f.directory, 'gpu-budget-policy.json'), 'utf8');
  await assert.rejects(f.manager.ensure(f.input), { code: 'generated_speech_session_provider_not_found' });
  assert.equal(starts(f.calls).length, 1, 'the failing turn never starts a replacement');
  const receipt = JSON.parse(await readFile(join(f.directory, reservation.replace('.reservation.json', '.terminal.json')), 'utf8'));
  assert.equal(receipt.status, 'TIMED_OUT');
  assert.equal(receipt.reason, 'provider_status_not_found_after_expiry');
  assert.equal(await readFile(join(f.directory, reservation), 'utf8'), original);
  assert.equal(await readFile(join(f.directory, 'gpu-budget-policy.json'), 'utf8'), policy);
  assert.deepEqual(await f.create({}, f.dependencies).ensure(f.input), { ready: true });
  assert.equal(starts(f.calls).length, 2, 'only a later explicit request starts one replacement after restart');
  assert.equal((await readdir(f.directory)).filter(name => name.endsWith('.reservation.json')).length, 2);
  assert.equal(await readFile(join(f.directory, reservation), 'utf8'), original, 'old cost is never refunded');
});

test('missing status before expiry or while a worker remains cannot authorize retirement or retry', async t => {
  for (const options of [
    { ageMs: 0 },
    { ageMs: SPEECH_SESSION_POLICY.reservationWindowMs - 1 },
    { workerState: () => ({ workers: 1, available: 1, busy: 0 }) },
    { workerState: () => ({ workers: 1, available: 0, busy: 1 }) },
  ]) {
    const f = await missingStatusFixture(t, options);
    for (let attempt = 0; attempt < 2; attempt++) await assert.rejects(f.manager.ensure(f.input), { code: 'generated_speech_session_provider_not_found' });
    assert.equal(starts(f.calls).length, 1);
    assert.equal((await readdir(f.directory)).filter(name => name.endsWith('.terminal.json')).length, 0);
  }
});

test('provider authorization/server errors and submit 404 remain fail-closed without a terminal receipt', async t => {
  for (const [status, reason] of [[401, 'unauthorized'], [403, 'forbidden'], [500, 'http_failed']]) {
    const f = await missingStatusFixture(t, { status });
    await assert.rejects(f.manager.ensure(f.input), { code: `generated_speech_session_provider_${reason}` });
    assert.equal((await readdir(f.directory)).filter(name => name.endsWith('.terminal.json')).length, 0);
    assert.equal(starts(f.calls).length, 1);
  }
  const f = await fixture(t, { submit: async () => new Response('missing endpoint', { status: 404 }) });
  await assert.rejects(f.create().ensure(f.input), { code: 'generated_speech_session_provider_not_found' });
  await assert.rejects(f.create().ensure(f.input), { code: 'generated_speech_session_submission_uncertain' });
  assert.equal(starts(f.calls).length, 1);
  assert.equal((await readdir(f.directory)).filter(name => name.endsWith('.terminal.json')).length, 0);
});

test('retiring an expired provider record cannot refund its reservation or bypass the daily budget', async t => {
  const f = await missingStatusFixture(t, { dailyBudgetUsd: '0.50' });
  await assert.rejects(f.manager.ensure(f.input), { code: 'generated_speech_session_provider_not_found' });
  await assert.rejects(f.create({}, f.dependencies).ensure(f.input), { code: 'generated_speech_daily_budget_exhausted' });
  assert.equal(starts(f.calls).length, 1);
  assert.equal((await readdir(f.directory)).filter(name => name.endsWith('.reservation.json')).length, 1);
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
  // The idle timer starts async ledger I/O before provider cancellation.
  await t.waitFor(() => assert.equal(f.jobs.get('job-1'), 'CANCELLED'), { interval: 5, timeout: 1000 });
  assert.equal(starts(f.calls).length, 1);
});

test('idle cancellation persists its terminal receipt before the provider forgets the job', async t => {
  const f = await fixture(t, { idleTimeoutMs: 10 });
  await f.create().ensure(f.input);
  const reservation = (await readdir(f.directory)).find(name => name.endsWith('.reservation.json'));
  const reservationBefore = await readFile(join(f.directory, reservation), 'utf8');
  const policyBefore = await readFile(join(f.directory, 'gpu-budget-policy.json'), 'utf8');
  const receiptPath = join(f.directory, reservation.replace('.reservation.json', '.terminal.json'));
  await t.waitFor(async () => assert.deepEqual(JSON.parse(await readFile(receiptPath, 'utf8')), { status: 'CANCELLED' }),
    { interval: 5, timeout: 1000 });
  assert.equal(starts(f.calls).length, 1, 'idle cancellation never creates a replacement');
  let oldStatusReads = 0;
  const restarted = f.create({}, { fetchImpl: async (url, init) => {
    if (url.endsWith('/status/job-1')) { oldStatusReads++; return new Response('expired', { status: 404 }); }
    return f.fetchImpl(url, init);
  } });
  assert.deepEqual(await restarted.ensure(f.input), { ready: true });
  assert.equal(oldStatusReads, 0, 'the durable terminal receipt survives provider retention and process restart');
  assert.equal(starts(f.calls).length, 2, 'only the next explicit turn admits one new paid session');
  assert.equal(await readFile(join(f.directory, reservation), 'utf8'), reservationBefore);
  assert.equal(await readFile(join(f.directory, 'gpu-budget-policy.json'), 'utf8'), policyBefore);
});

test('cancel acknowledgement requires the exact job and a known terminal status', async t => {
  for (const reply of [
    () => response({ id: 'another-job', status: 'CANCELLED' }),
    () => response({ status: 'CANCELLED' }),
    () => response({ id: 'job-1', status: 'IN_PROGRESS' }),
    () => response({ id: 'job-1', status: 'UNKNOWN' }),
    () => new Response('unavailable', { status: 503 }),
    () => { throw Error('network unavailable'); },
  ]) {
    const f = await fixture(t);
    const manager = f.create({}, { fetchImpl: (url, init) => url.endsWith('/cancel/job-1') ? reply() : f.fetchImpl(url, init) });
    await manager.ensure(f.input);
    await manager.close();
    const files = await readdir(f.directory);
    assert.equal(files.filter(name => name.endsWith('.cancel.json')).length, 1, 'intent is retained');
    assert.equal(files.filter(name => name.endsWith('.terminal.json')).length, 0, 'intent and uncertain responses are not terminal evidence');
    assert.equal(starts(f.calls).length, 1);
  }
});

test('a verified cancellation receipt never refunds the reserved session cost', async t => {
  const f = await fixture(t, { dailyBudgetUsd: '0.50' }), manager = f.create();
  await manager.ensure(f.input);
  await manager.close();
  assert.equal((await readdir(f.directory)).filter(name => name.endsWith('.terminal.json')).length, 1);
  await assert.rejects(f.create().ensure(f.input), { code: 'generated_speech_daily_budget_exhausted' });
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

test('terminal provider state waits for the known relay worker to disconnect before replacing it', async t => {
  const f = await fixture(t);
  let connected = false, stopping = false, waited = 0;
  const manager = f.create({}, {
    workerState: () => ({ workers: connected ? 1 : 0, busy: 0, available: connected ? 1 : 0 }),
    fetchImpl: async (url, init) => {
      const result = await f.fetchImpl(url, init);
      if (url.includes('/status/') && f.jobs.get(url.split('/').at(-1)) === 'IN_PROGRESS') connected = true;
      if (url.endsWith('/run') && starts(f.calls).length === 2) assert.equal(connected, false, 'replacement never overlaps the previous worker');
      return result;
    },
    sleep: async () => { if (stopping) { waited++; connected = false; stopping = false; } },
  });
  await manager.ensure(f.input);
  f.jobs.set('job-1', 'CANCELLED'); stopping = true;
  await manager.ensure(f.input);
  assert.equal(waited, 1);
  assert.equal(starts(f.calls).length, 2);
});

test('a persisted terminal receipt still identifies its lingering reverse worker after restart', async t => {
  const f = await fixture(t), retired = [];
  let connected = true, waited = 0;
  const id = 'a'.repeat(32), workerId = `croupier-${id}`;
  await writeFile(join(f.directory, 'gpu-budget-policy.json'), JSON.stringify({ version: 1, dailyBudgetMicroUsd: 9940000 }));
  await writeFile(join(f.directory, `gpu-session-${id}.reservation.json`), JSON.stringify({
    id, workerId, endpointId: f.configuration.endpointId, createdAt: Date.parse('2026-09-29T07:59:00Z'),
    days: ['2026-09-29'], reservedMicroUsd: 500000,
  }));
  await writeFile(join(f.directory, `gpu-session-${id}.job.json`), JSON.stringify({ jobId: 'retired-job' }));
  await writeFile(join(f.directory, `gpu-session-${id}.terminal.json`), JSON.stringify({ status: 'CANCELLED' }));
  f.jobs.set('retired-job', 'CANCELLED');
  const manager = f.create({}, {
    workerState: requested => requested === workerId || !requested && connected
      ? { workers: connected ? 1 : 0, busy: 0, available: connected ? 1 : 0 }
      : { workers: starts(f.calls).length ? 1 : 0, busy: 0, available: starts(f.calls).length ? 1 : 0 },
    stopWorker: requested => { retired.push(requested); assert.equal(requested, workerId); },
    fetchImpl: async (url, init) => {
      assert.ok(!url.endsWith('/status/retired-job'), 'a durable terminal receipt must survive provider retention');
      if (url.endsWith('/run')) assert.equal(connected, false, 'the known reverse worker must finish draining first');
      return f.fetchImpl(url, init);
    },
    sleep: async () => { waited++; connected = false; },
  });
  await manager.ensure(f.input);
  assert.deepEqual(retired, [workerId]);
  assert.equal(waited, 1);
  assert.equal(starts(f.calls).length, 1, 'one replacement only after known old worker is retired');
});

test('idle time restarts after an owned utterance completes; unrelated activity cannot extend it', async t => {
  const f = await fixture(t, { idleTimeoutMs: 100 });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let stopped;
  const cancelled = new Promise(resolve => { stopped = resolve; });
  const manager = f.create({}, { stopWorker: stopped });
  await manager.ensure(f.input);
  const workerId = JSON.parse(starts(f.calls)[0].body).input.worker_id;
  t.mock.timers.tick(90);
  manager.activity(workerId);
  t.mock.timers.tick(20);
  assert.equal(f.calls.filter(call => call.url.includes('/cancel/')).length, 0);
  manager.activity('unrelated-worker');
  t.mock.timers.tick(79);
  assert.equal(f.calls.filter(call => call.url.includes('/cancel/')).length, 0);
  t.mock.timers.tick(1);
  assert.equal(await cancelled, workerId);
  assert.equal(starts(f.calls).length, 1, 'activity never renews a paid job or its TTL');
  assert.equal(JSON.parse(starts(f.calls)[0].body).input.ttl, 540);
});

test('provider failures yield fixed diagnostic codes without exposing input or response data', async t => {
  for (const [reply, code] of [
    [() => new Response('private key in body', { status: 403 }), 'forbidden'],
    [() => new Response('private invalid JSON'), 'invalid_json'],
    [() => response({ id: 'wrong-id-private', status: 'IN_PROGRESS' }), 'job_mismatch'],
    [id => response({ id, status: 'PRIVATE_STATUS' }), 'invalid_status'],
    [() => new Response('x'.repeat(9000)), 'response_too_large'],
  ]) {
    const f = await fixture(t, { status: reply });
    await assert.rejects(f.create().ensure(f.input), { code: `generated_speech_session_provider_${code}` });
  }
});

test('close joins an already pending idle cancellation and terminal write without another provider dispatch', async t => {
  const f = await fixture(t, { idleTimeoutMs: 10 });
  let releaseCancel, cancelStarted = false, closed = false;
  const held = new Promise(resolve => { releaseCancel = resolve; });
  const manager = f.create({}, { fetchImpl: async (url, init) => {
    if (url.includes('/cancel/')) { cancelStarted = true; await held; }
    return f.fetchImpl(url, init);
  } });
  await manager.ensure(f.input);
  await t.waitFor(() => assert.equal(cancelStarted, true), { interval: 5, timeout: 1000 });
  const closing = manager.close().then(() => { closed = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closed, false, 'close waits for the cancellation response and durable terminal receipt');
  releaseCancel(); await closing;
  assert.equal(f.calls.filter(call => call.url.includes('/cancel/')).length, 1);
  assert.equal(starts(f.calls).length, 1);
  const terminalFile = (await readdir(f.directory)).find(name => name.endsWith('.terminal.json'));
  assert.deepEqual(JSON.parse(await readFile(join(f.directory, terminalFile), 'utf8')), { status: 'CANCELLED' });
});
