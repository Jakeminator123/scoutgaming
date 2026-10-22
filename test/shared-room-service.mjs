import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { createSharedRoomService } from '../services/game/shared-room-service.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const request = () => new Request('https://engine.invalid/shared-room/room-a', { headers: { origin: 'https://player.invalid' } });
function setup(t, hooks = {}) {
  const calls = [], ports = {}, config = {}, pool = { connect() { assert.fail('Composition must not create SQL outside its adapters'); }, query() {}, end() { assert.fail('Pool belongs to application'); } };
  const health = { running: false, failed: false, inFlight: false, lastSuccessAt: null, lastErrorAt: null };
  const binding = { actorId: 'actor-a', sessionId: 'digest-a', roomId: 'room-a', operatorId: 'operator-a', packageRevision: 3, expiresAt: Date.now() + 60000 };
  const options = { pool, walletMode: 'demo', origin: 'https://player.invalid', engineOrigin: 'https://engine.invalid',
    scope: { environment: 'test', workspaceId: 'workspace-a' }, auth: {}, repository: {}, lockTimeoutMs: 200, statementTimeoutMs: 500 };
  const dependencies = {
    createAccess(value) { config.access = value; return {
      async authorize(req, context) { calls.push(['authorize', req, context]); return hooks.authorize ? hooks.authorize(req, context) : binding; },
      async revalidate(value, context) { calls.push(['revalidate', value, context]); return hooks.revalidate ? hooks.revalidate(value, context) : value; },
    }; },
    createReceiver(value) { config.receiver = value; return {
      async assertInstalled() { calls.push(['receiver-installed']); await hooks.installed?.(); },
      async sink(row) { calls.push(['persist', row]); return hooks.sink ? hooks.sink(row) : 'applied'; },
      async current(room) { calls.push(['current', room]); return hooks.current ? hooks.current(room) : { roomId: room, ver: 7 }; },
    }; },
    createRuntime(value) { config.runtime = value; return {
      async start() { calls.push(['runtime-start']); await hooks.start?.(); health.running = true; },
      async stop() { calls.push(['runtime-stop']); await hooks.stop?.(); health.running = false; },
      health: () => health,
      coordinator: { async snapshot(room, actor) { calls.push(['snapshot', room, actor]); return hooks.snapshot ? hooks.snapshot(room, actor) : { roomId: room, presentationVer: 7, me: { id: actor } }; } },
    }; },
    createChannel(value) { ports.channel = value; return {
      async prepare(req) { calls.push(['prepare']); const accepted = await value.authorize(req, { roomId: 'room-a', signal: req.signal }); return { attach: () => accepted }; },
      emitCommitted(room) { calls.push(['hint', room]); },
      emitActorsCommitted(actors, options) { calls.push(['actor-hint', actors, options]); },
      close() { calls.push(['channel-close']); hooks.channelClose?.(); },
    }; },
    createUpgrade(value) { config.upgrade = value; return {
      handleUpgrade(req, socket, head) { calls.push(['upgrade', req, socket, head]); return req.url === '/unowned' ? false : value.channel.prepare(req); },
      async close() { calls.push(['upgrade-close']); await hooks.upgradeClose?.(); },
    }; },
  };
  const service = createSharedRoomService(options, dependencies);
  t.after(() => service.close().catch(() => {}));
  return { service, calls, ports, config, pool, options, dependencies, health, binding };
}
const count = (h, name) => h.calls.filter(call => call[0] === name).length;

// These are composition/port tests. HTTP framing, SQL atomicity and channel
// projections have their own real adapter tests; no listener or database is run.
test('construction shares explicit app ports/pool without I/O and rejects an implicit/external wallet', async t => {
  const h = setup(t);
  assert.deepEqual(h.calls, []);
  assert.equal(h.config.receiver.pool, h.pool); assert.equal(h.config.runtime.pool, h.pool);
  assert.equal(h.config.receiver.lockTimeoutMs, 200); assert.equal(h.config.runtime.statementTimeoutMs, 500);
  for (const key of ['scope', 'repository', 'auth']) assert.equal(h.config.access[key], h.options[key]);
  assert.equal(h.config.upgrade.origin, h.options.origin); assert.equal(h.config.upgrade.engineOrigin, h.options.engineOrigin);
  for (const walletMode of [undefined, 'external', '']) assert.throws(() => createSharedRoomService({ ...h.options, walletMode }, h.dependencies), { statusCode: 503 });
  assert.deepEqual(h.service.health(), { state: 'idle', ready: false, failed: false, inFlight: false, lastSuccessAt: null, lastErrorAt: null });
});

test('receiver readiness precedes runtime start; admission stays shut until both finish', async t => {
  const installed = deferred(), running = deferred(); const h = setup(t, { installed: () => installed.promise, start: () => running.promise });
  const first = h.service.start(); assert.equal(h.service.start(), first);
  await turn(); assert.equal(count(h, 'receiver-installed'), 1); assert.equal(count(h, 'runtime-start'), 0);
  await assert.rejects(h.service.handleUpgrade(request()), { statusCode: 503 }); assert.equal(count(h, 'authorize'), 0);
  assert.equal(h.service.handleUpgrade({ url: '/unowned' }), false);
  installed.resolve(); await turn(); assert.equal(count(h, 'runtime-start'), 1);
  assert.equal(h.service.health().ready, false); await assert.rejects(h.service.handleUpgrade(request()), { statusCode: 503 });
  running.resolve(); await first; assert.equal(h.service.health().ready, true);
  const raw = {}, head = Buffer.alloc(0), req = request(); const admission = await h.service.handleUpgrade(req, raw, head);
  assert.equal(admission.attach(), h.binding); assert.equal(h.calls.at(-1)[0], 'authorize');
  const upgrade = h.calls.filter(call => call[0] === 'upgrade').at(-1); assert.equal(upgrade[1], req); assert.equal(upgrade[2], raw); assert.equal(upgrade[3], head);
  await h.service.start(); assert.equal(count(h, 'runtime-start'), 1);
});

test('receiver/schema and runtime startup failures retain the error, close admission and cannot restart', async t => {
  for (const failureAt of ['installed', 'start']) {
    const failure = new Error('private connection detail'); const h = setup(t, { [failureAt]: () => { throw failure; } });
    await assert.rejects(h.service.start(), error => error === failure);
    assert.equal(h.service.health().state, 'failed'); assert.equal(h.service.health().failed, true);
    assert.equal(h.service.health().ready, false); assert.equal(count(h, 'runtime-start'), failureAt === 'start' ? 1 : 0);
    assert.equal(count(h, 'runtime-stop'), 1); assert.equal(count(h, 'channel-close'), 1); assert.equal(count(h, 'upgrade-close'), 1);
    await assert.rejects(h.service.handleUpgrade(request()), { statusCode: 503 });
    await assert.rejects(h.service.start(), { statusCode: 503 });
    assert.doesNotMatch(JSON.stringify(h.service.health()), /private|connection/);
  }
});

test('stop during schema readiness drains it and never starts a late runtime', async t => {
  const hold = deferred(); const h = setup(t, { installed: () => hold.promise });
  const starting = h.service.start(), rejected = assert.rejects(starting, { name: 'AbortError' }); await turn();
  let closed = false; const closing = h.service.close().then(() => { closed = true; });
  assert.equal(h.service.health().ready, false); assert.equal(count(h, 'channel-close'), 1); assert.equal(count(h, 'runtime-stop'), 1);
  await turn(); assert.equal(closed, false); hold.resolve(); await rejected; await closing;
  assert.equal(count(h, 'runtime-start'), 0); assert.equal(h.service.health().state, 'stopped');
  await assert.rejects(h.service.start(), { statusCode: 503 });
});

test('stop during runtime startup drains start and stop before the application may close its pool', async t => {
  const starting = deferred(), stopping = deferred(); const h = setup(t, { start: () => starting.promise, stop: () => stopping.promise });
  const started = h.service.start(), rejected = assert.rejects(started, { name: 'AbortError' }); await turn();
  assert.equal(count(h, 'runtime-start'), 1);
  const closing = h.service.close(); assert.equal(h.service.stop(), closing); assert.equal(h.service.close(), closing);
  let closed = false; closing.then(() => { closed = true; }); starting.resolve(); await turn();
  assert.equal(closed, false); await assert.rejects(h.service.handleUpgrade(request()), { statusCode: 503 });
  stopping.resolve(); await rejected; await closing;
  assert.equal(count(h, 'runtime-stop'), 1); assert.equal(h.service.health().state, 'stopped');
});

test('persisted applied/replay alone emits a hint; stale, failure and malformed results never do', async t => {
  const commit = deferred(); let result = commit.promise; const h = setup(t, { sink: () => result }); await h.service.start();
  const row = Object.freeze({ roomId: 'room-a', ver: 7, talkId: 'talk-a', payload: Object.freeze({}) });
  const delivery = h.config.runtime.sink(row); await turn(); assert.equal(count(h, 'hint'), 0);
  commit.resolve('applied'); assert.equal(await delivery, 'applied'); assert.equal(count(h, 'hint'), 1);
  assert.equal(h.calls.find(call => call[0] === 'persist')[1], row); // exact row, no local conversion/ack
  result = 'applied'; await h.config.runtime.sink(row); assert.equal(count(h, 'hint'), 2);
  result = 'stale'; assert.equal(await h.config.runtime.sink(row), 'stale'); assert.equal(count(h, 'hint'), 2);
  const failure = new Error('SQL unavailable'); result = Promise.reject(failure); await assert.rejects(h.config.runtime.sink(row), error => error === failure);
  result = 'unknown'; await assert.rejects(h.config.runtime.sink(row), TypeError); assert.equal(count(h, 'hint'), 2);
  await h.service.close(); result = 'applied'; assert.equal(await h.config.runtime.sink(row), 'applied'); assert.equal(count(h, 'hint'), 2);
});

test('read ports retain server actor/room and binding, abort on stop and drain outstanding SQL reads', async t => {
  const delayed = deferred(); let held = false;
  const h = setup(t, { snapshot: async (room, actor) => { if (held) await delayed.promise; return { roomId: room, me: { id: actor } }; } });
  await h.service.start();
  const signal = new AbortController().signal;
  assert.deepEqual(await h.ports.channel.readSnapshot('room-a', 'actor-a', { signal }), { roomId: 'room-a', me: { id: 'actor-a' } });
  assert.deepEqual(await h.ports.channel.readPresentation('room-a', { signal }), { roomId: 'room-a', ver: 7 });
  assert.equal(await h.ports.channel.revalidate(h.binding, { signal }), h.binding);
  assert.equal(h.calls.find(call => call[0] === 'revalidate')[1], h.binding);
  held = true; const reading = h.ports.channel.readSnapshot('room-a', 'actor-a', { signal }), aborted = assert.rejects(reading, { name: 'AbortError' });
  await turn(); assert.equal(h.service.health().inFlight, true);
  let closed = false; const closing = h.service.close().then(() => { closed = true; }); await turn(); assert.equal(closed, false);
  const before = count(h, 'current'); await assert.rejects(h.ports.channel.readPresentation('room-a', { signal }), { statusCode: 503 }); assert.equal(count(h, 'current'), before);
  delayed.resolve(); await aborted; await closing; assert.equal(h.service.health().inFlight, false);
});

test('close aborts and drains authorization; no admission escapes after its late result', async t => {
  const delayed = deferred(); let activeSignal;
  const h = setup(t, { authorize: async (_req, { signal }) => { activeSignal = signal; return delayed.promise; } });
  await h.service.start(); const admission = h.service.handleUpgrade(request()), aborted = assert.rejects(admission, { name: 'AbortError' }); await turn();
  let closed = false; const closing = h.service.close().then(() => { closed = true; }); assert.equal(activeSignal.aborted, true);
  await turn(); assert.equal(closed, false); delayed.resolve(h.binding); await aborted; await closing;
});

test('health excludes raw details and a failed scheduler closes readiness until recovery', async t => {
  const h = setup(t); await h.service.start();
  Object.assign(h.health, { failed: true, lastErrorAt: 1234, lastSuccessAt: 'private detail', error: 'secret', connection: 'private' });
  assert.deepEqual(h.service.health(), { state: 'running', ready: false, failed: true, inFlight: false, lastSuccessAt: null, lastErrorAt: 1234 });
  await assert.rejects(h.service.handleUpgrade(request()), { statusCode: 503 }); assert.equal(count(h, 'authorize'), 0);
  h.health.failed = false; assert.equal(h.service.health().ready, true);
});

test('cleanup failure still drains runtime, rejects shutdown and leaves admission closed', async t => {
  const failure = new Error('transport close failed'), drained = deferred();
  const h = setup(t, { upgradeClose: () => { throw failure; }, stop: () => drained.promise }); await h.service.start();
  const closing = h.service.close(), rejected = assert.rejects(closing, error => error instanceof AggregateError && error.errors.includes(failure));
  assert.equal(count(h, 'runtime-stop'), 1); drained.resolve(); await rejected;
  assert.equal(h.service.health().state, 'stopped'); assert.equal(h.service.health().failed, true);
  await assert.rejects(h.service.handleUpgrade(request()), { statusCode: 503 });
});
