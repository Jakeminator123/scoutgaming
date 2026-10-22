import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { createSharedRoomCommand } from '../services/game/shared-room-command.mjs';

const origin = 'https://player.example.test', engineOrigin = 'https://engine.example.test';
const path = '/api/shared-room/room-a/command';
const input = { op: 'ready', commandId: 'request-1', windowId: 'window-a' };
const bytes = value => new TextEncoder().encode(value);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function request(options = {}) {
  const method = options.method ?? 'POST';
  const headers = new Headers({ host: new URL(options.urlOrigin ?? origin).host, origin, 'content-type': 'application/json', ...options.headers });
  for (const key of options.omit ?? []) headers.delete(key);
  const body = Object.hasOwn(options, 'body') ? options.body : JSON.stringify(input);
  return new Request((options.urlOrigin ?? origin) + (options.path ?? path), { method, headers, signal: options.signal,
    ...(!['GET', 'HEAD'].includes(method) && body !== undefined ? { body, ...(body instanceof ReadableStream ? { duplex: 'half' } : {}) } : {}) });
}
function output(roomId = 'room-a') {
  return { result: { op: 'ready', version: 1, started: false }, replay: false,
    snapshot: { contract: 'blackjack-table/1', roomId, version: 1, presentationVer: 0,
      configVersion: 'config-a', windowId: 'window-a', me: { id: 'player-a', available: 100 } } };
}
function setup(options = {}) {
  const calls = [];
  const service = { async command(req, fields) { calls.push({ request: req, ...fields }); return options.command ? options.command(req, fields) : output(fields.roomId); } };
  return { calls, service, handle: createSharedRoomCommand({ service, origin, ...options }) };
}
async function json(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('cdn-cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  return response.json();
}

test('valid HTTP command invokes only service.command with exact request, server room and parsed input', async () => {
  const h = setup(), req = request(), response = await h.handle(req);
  assert.deepEqual(await json(response, 200), output()); assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].request, req); assert.equal(h.calls[0].signal, req.signal); assert.equal(h.calls[0].roomId, 'room-a');
  assert.deepEqual(h.calls[0].input, { roomId: 'room-a', ...input }); assert.equal(Object.isFrozen(h.calls[0].input), true);
});

test('other paths return null; owned malformed, encoded, duplicate and queried paths never invoke the service', async () => {
  const h = setup();
  for (const other of ['/', '/api/table', '/api/shared-rooms/room-a/command', '/api/shared-room-other']) assert.equal(await h.handle(request({ path: other })), null);
  for (const invalid of ['/api/shared-room', '/api/shared-room/', path + '/', path + '?id=other', path + '?', path + '#part',
    '/api/shared-room/Room-A/command', '/api/shared-room//room-a/command', '/api/shared-room/%72oom-a/command',
    '/api/shared-room/%2572oom-a/command', '/api/shared-room/room-a%2Fother/command', '/api/shared-room/' + 'a'.repeat(129) + '/command']) {
    await json(await h.handle(request({ path: invalid })), 400);
  }
  const canonical = request();
  for (const url of [origin + '/api/shared-room/a/../room-a/command', origin + '/api/shared-room/%2e%2e/api/shared-room/room-a/command']) {
    await json(await h.handle({ url, method: canonical.method, headers: canonical.headers, signal: canonical.signal, body: canonical.body }), 400);
  }
  assert.equal(h.calls.length, 0);
});

test('only POST is accepted and rejection advertises the method without consuming data', async () => {
  const h = setup();
  for (const method of ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']) {
    const response = await h.handle(request({ method })); assert.equal(response.headers.get('allow'), 'POST');
    await json(response, 405);
  }
  assert.equal(h.calls.length, 0);
});

test('Origin and Host are mandatory; only canonical URL/Host pairs are accepted, including the explicit engine proxy', async () => {
  const h = setup({ engineOrigin });
  for (const options of [{ omit: ['origin'] }, { omit: ['host'] }, { headers: { origin: engineOrigin } },
    { headers: { origin: origin + '/' } }, { headers: { origin: origin + ', ' + origin } },
    { headers: { host: 'foreign.test', 'x-forwarded-host': 'player.example.test' } },
    { headers: { host: 'player.example.test, player.example.test' } },
    { urlOrigin: engineOrigin, headers: { host: 'player.example.test' } },
    { headers: { host: 'engine.example.test' } }, { urlOrigin: 'https://untrusted.example.test' }]) {
    await json(await h.handle(request(options)), 403);
  }
  assert.equal(h.calls.length, 0);
  await json(await h.handle(request({ urlOrigin: engineOrigin })), 200);
  await json(await h.handle(request()), 200); assert.equal(h.calls.length, 2);
  await json(await setup().handle(request({ urlOrigin: engineOrigin })), 403);
});

test('alternate credential mechanisms cannot reach the cookie-authenticated service', async () => {
  const h = setup();
  for (const headers of [{ authorization: 'Bearer private' }, { upgrade: 'websocket' }, { 'x-worker-id': 'worker' }, { 'sec-websocket-protocol': 'private' }]) {
    await json(await h.handle(request({ headers })), 403);
  }
  assert.equal(h.calls.length, 0);
});

test('JSON media type and UTF-8 are explicit; malformed data cannot produce a command', async () => {
  const h = setup();
  for (const type of ['text/plain', 'application/json, application/json', 'application/json; charset=latin1', 'application/x-www-form-urlencoded']) {
    await json(await h.handle(request({ headers: { 'content-type': type } })), 415);
  }
  await json(await h.handle(request({ omit: ['content-type'] })), 415);
  await json(await h.handle(request({ headers: { 'content-encoding': 'gzip' } })), 415);
  for (const body of ['', '{invalid', 'null', '[]', '5', bytes(new Uint8Array([0xff]).toString())]) {
    await json(await h.handle(request({ body })), 400);
  }
  await json(await h.handle(request({ body: new Uint8Array([0xff, 0xfe]) })), 400);
  assert.equal(h.calls.length, 0);
  await json(await h.handle(request({ headers: { 'content-type': 'application/json; charset="UTF-8"' } })), 200);
});

test('streaming body size counts wire bytes and bounds single chunks, declared lengths and incomplete UTF-8', async () => {
  const encoded = JSON.stringify({ ...input, commandId: 'ä'.repeat(60) }), wire = bytes(encoded), limit = wire.byteLength;
  const h = setup({ maxBodyBytes: limit });
  const stream = new ReadableStream({ start(controller) { for (const byte of wire) controller.enqueue(new Uint8Array([byte])); controller.close(); } });
  await json(await h.handle(request({ body: stream, headers: { 'content-length': String(limit) } })), 200);
  const small = setup({ maxBodyBytes: limit - 1 });
  await json(await small.handle(request({ body: wire })), 413);
  let cancelled = false;
  const tooBig = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(limit + 1)); }, cancel() { cancelled = true; } });
  await json(await small.handle(request({ body: tooBig })), 413); assert.equal(cancelled, true);
  await json(await small.handle(request({ headers: { 'content-length': String(limit + 1) } })), 413);
  for (const length of ['-1', 'garbage', '5, 5', '999999999999999999999']) await json(await h.handle(request({ headers: { 'content-length': length } })), 400);
  await json(await h.handle(request({ headers: { 'content-length': '1' } })), 400);
  assert.equal(small.calls.length, 0);
});

test('identity injection and invalid op fields are refused before service effects', async () => {
  const h = setup();
  for (const extra of [{ actorId: 'other' }, { roomId: 'other' }, { sessionId: 'other' }, { name: 'other' }, { configVersion: 'other' }, { digest: 'other' }, { unknown: 1 }, { op: 'unknown' }]) {
    await json(await h.handle(request({ body: JSON.stringify({ ...input, ...extra }) })), 400);
  }
  assert.equal(h.calls.length, 0);
});

test('abort before reading and during a pending stream cancels admission with no late effects', async () => {
  const h = setup(), before = new AbortController(); before.abort();
  await json(await h.handle(request({ signal: before.signal })), 503);
  let cancelled = false;
  const active = new AbortController(), entered = deferred();
  const stream = new ReadableStream({ pull() { entered.resolve(); return new Promise(() => {}); }, cancel() { cancelled = true; } });
  const pending = h.handle(request({ signal: active.signal, body: stream })); await entered.promise; active.abort();
  assert.deepEqual(await json(await pending, 503), { error: 'shared_room_command_cancelled' });
  assert.equal(cancelled, true); assert.equal(h.calls.length, 0);
});

test('abort during service work propagates its signal and cannot deliver a late successful response', async () => {
  const entered = deferred(), release = deferred(), controller = new AbortController(); let signal;
  const h = setup({ command: async (_req, fields) => { signal = fields.signal; entered.resolve(); await release.promise; return output(); } });
  const pending = h.handle(request({ signal: controller.signal })); await entered.promise; controller.abort();
  assert.deepEqual(await json(await pending, 503), { error: 'shared_room_command_cancelled' }); assert.equal(signal.aborted, true);
  release.resolve(); await turn(); assert.equal(h.calls.length, 1);
});

test('domain and authentication errors retain safe statuses; SQL and unexpected details never leave the boundary', async () => {
  for (const [error, status, code] of [
    [Object.assign(Error('private stale details'), { code: 'STALE_COMMAND' }), 409, 'STALE_COMMAND'],
    [Object.assign(Error('private receipt details'), { code: 'REQUEST_REUSED' }), 409, 'REQUEST_REUSED'],
    [Object.assign(Error('private authority'), { code: 'AUTHORITY_REJECTED' }), 403, 'AUTHORITY_REJECTED'],
    [Object.assign(Error('private refill'), { code: 'REFILL_REFUSED' }), 409, 'REFILL_REFUSED'],
    [Object.assign(Error('private round'), { code: 'ROUND_IN_PROGRESS' }), 409, 'ROUND_IN_PROGRESS'],
    [Object.assign(Error('private auth details'), { statusCode: 401 }), 401, 'shared_room_authentication_required'],
    [Object.assign(Error('private role details'), { statusCode: 403, code: 'studio_forbidden' }), 403, 'shared_room_forbidden'],
    [Object.assign(Error('SELECT password FROM private'), { code: '23505', statusCode: 400 }), 503, 'shared_room_command_unavailable'],
    [Object.assign(Error('wrong status'), { code: 'shared_room_invalid_command', statusCode: 200 }), 400, 'shared_room_invalid_command'],
    [Error('database connection with private credentials'), 503, 'shared_room_command_unavailable'],
  ]) {
    const h = setup({ command: async () => { throw error; } });
    assert.deepEqual(await json(await h.handle(request()), status), { error: code }); assert.equal(h.calls.length, 1);
  }
});

test('the service public envelope is explicit, result projection strips private fields and invalid output fails closed', async () => {
  const expected = output(); expected.result = { op: 'ready', version: 1, started: true, roundId: 'round-a' };
  const h = setup({ command: async () => ({ ...expected, result: { ...expected.result, ledger: { other: 'private' }, startedSeq: 52 } }) });
  assert.deepEqual(await json(await h.handle(request()), 200), expected);
  for (const value of [null, { ...output(), error: 'private' }, { ...output(), replay: 'yes' },
    { ...output(), result: { op: 'ready', version: 1, started: 'yes' } }, { ...output(), result: { op: 'next', version: 1 } }, { ...output(), snapshot: { ...output().snapshot, roomId: 'other' } }]) {
    const bad = setup({ command: async () => value });
    assert.deepEqual(await json(await bad.handle(request()), 503), { error: 'shared_room_command_unavailable' });
  }
});

test('HTTP retries preserve exactly the submitted command ID and payload without automatic resubmission', async () => {
  const seen = new Map(); let effects = 0;
  const h = setup({ command: async (_req, { input }) => {
    const serialized = JSON.stringify(input), prior = seen.get(input.commandId);
    if (prior && prior !== serialized) throw Object.assign(Error('private'), { code: 'REQUEST_REUSED' });
    if (!prior) { effects++; seen.set(input.commandId, serialized); }
    return { ...output(), replay: Boolean(prior) };
  } });
  assert.equal((await json(await h.handle(request()), 200)).replay, false);
  assert.equal((await json(await h.handle(request()), 200)).replay, true); assert.equal(effects, 1);
  await json(await h.handle(request({ body: JSON.stringify({ ...input, windowId: 'other-window' }) })), 409);
  assert.equal(effects, 1); assert.equal(h.calls.length, 3);
});

test('factory configuration cannot silently broaden origin or body bounds', () => {
  for (const value of [{ origin: undefined }, { origin: origin + '/' }, { engineOrigin: 'https://user:pass@engine.example.test' },
    { maxBodyBytes: 0 }, { maxBodyBytes: Infinity }, { maxBodyBytes: 1024 * 1024 + 1 }, { service: {} }]) {
    assert.throws(() => createSharedRoomCommand({ service: { command() {} }, origin, ...value }));
  }
});
