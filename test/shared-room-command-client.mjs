import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { setImmediate as turn } from 'node:timers/promises';
import { createSharedRoomCommandClient } from '../services/game/public/shared-room-command-client.mjs';
import { createSharedRoomCommand } from '../services/game/shared-room-command.mjs';
import { projectSharedRoomSnapshot } from '../services/game/shared-room-channel.mjs';

const roomId = 'room-a', ready = { op: 'ready', windowId: 'window-a' };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const code = expected => failure => failure?.code === expected;
const snapshot = () => ({ contract: 'blackjack-table/1', roomId, version: 1, presentationVer: 0,
  configVersion: 'config-a', windowId: 'window-a', me: { id: 'alice', available: 100 } });
const envelope = (op = 'ready') => ({ result: op === 'pause' ? { op, pausedUntil: 1000 }
  : op === 'ready' ? { op, version: 1, started: false } : { op, version: 1 }, replay: false, snapshot: snapshot() });
function fixture(fetchPort = () => Response.json(envelope()), options = {}) {
  const calls = []; let ids = 0;
  const client = createSharedRoomCommandClient({ roomId, randomUUID: () => `command-${++ids}`, timeoutMs: 1000,
    fetchImpl(url, init) { calls.push({ url, init }); return fetchPort(url, init, calls.length); }, ...options });
  return { client, calls, ids: () => ids };
}

test('same-origin POST is fixed; successful response returns only result/replay and freezes the submitted copy', async () => {
  const gate = deferred();
  const h = fixture(async (_url, init) => { await gate.promise; assert.equal(JSON.parse(init.body).seats[0], 2);
    return Response.json({ ...envelope('join'), result: { op: 'join', version: 1, memberGen: 1, seats: [2], seatGen: [0, 0, 1, 0, 0, 0, 0] } }); });
  const intent = { op: 'join', memberGen: 0, seats: [2], seatGens: { 2: 0 } };
  assert.equal(h.client.state, 'idle');
  const pending = h.client.send(intent);
  assert.equal(h.client.state, 'sending'); intent.seats[0] = 6; intent.seatGens[2] = 99;
  const { url, init } = h.calls[0];
  assert.equal(url, '/api/shared-room/room-a/command');
  assert.equal(init.method, 'POST'); assert.equal(init.credentials, 'same-origin'); assert.equal(init.mode, 'same-origin');
  assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store');
  assert.deepEqual(init.headers, { 'Content-Type': 'application/json' });
  assert.equal(Object.isFrozen(init), true); assert.equal(Object.isFrozen(init.headers), true);
  assert.deepEqual(JSON.parse(init.body), { op: 'join', memberGen: 0, seats: [2], seatGens: { 2: 0 }, commandId: 'command-1' });
  gate.resolve(); const reply = await pending;
  assert.deepEqual(Object.keys(reply).sort(), ['commandId', 'replay', 'result', 'status']);
  assert.equal(reply.status, 'ok'); assert.equal(Object.isFrozen(reply.result.seats), true);
  assert.equal(h.client.state, 'idle'); assert.equal(h.ids(), 1);
});

test('all fourteen intents cross the actual server parser and result projection without client game-state writes', async () => {
  const intents = [
    { op: 'join', memberGen: 0, seats: [0], seatGens: { 0: 0 } }, { op: 'leave', memberGen: 1 },
    { op: 'bet', windowId: 'window-a', seat: 0, field: 'main', chip: 5 }, { op: 'undo', windowId: 'window-a' },
    { op: 'clear', windowId: 'window-a' }, { op: 'doubleBets', windowId: 'window-a' },
    { op: 'allSeats', windowId: 'window-a', chip: 5 }, { op: 'repeat', windowId: 'window-a' }, ready,
    { op: 'act', roundId: 'round-a', turnSeq: 1, box: 0, handIndex: 0, action: 'stand' },
    { op: 'insurance', roundId: 'round-a', phase: 'insurance', take: false }, { op: 'next', roundId: 'round-a' }, { op: 'pause' }, { op: 'refill' },
  ];
  const calls = [], origin = 'https://player.example.test';
  const handle = createSharedRoomCommand({ origin, service: { async command(_req, { input }) {
    calls.push(input);
    const out = envelope(input.op);
    if (input.op === 'join') out.result = { op: 'join', version: 1, memberGen: 1, seats: [0], seatGen: [1, 0, 0, 0, 0, 0, 0] };
    if (['bet', 'undo', 'clear', 'doubleBets', 'allSeats', 'repeat'].includes(input.op)) out.result.reserved = 5;
    if (input.op === 'act') out.result.debits = [{ kind: 'double', amount: 5 }];
    if (input.op === 'pause') out.snapshot = null;
    return out;
  } } });
  const h = fixture((url, init) => handle(new Request(origin + url, { ...init,
    headers: { ...init.headers, host: 'player.example.test', origin, cookie: 'croupier_session=server-cookie' } })));
  for (const intent of intents) {
    const reply = await h.client.send(intent);
    assert.equal(reply.status, 'ok', intent.op); assert.equal(reply.result.op, intent.op);
    assert.equal(Object.hasOwn(reply, 'snapshot'), false); assert.equal(h.client.state, 'idle');
  }
  assert.equal(calls.length, 14); assert.equal(h.ids(), 14);
  assert.deepEqual(calls.map(input => input.commandId), Array.from({ length: 14 }, (_, i) => `command-${i + 1}`));
});

test('only one intent may be sending; concurrent sends and retries mint no additional ID', async () => {
  const gate = deferred(), h = fixture(() => gate.promise);
  const pending = h.client.send(ready);
  await assert.rejects(h.client.send({ op: 'refill' }), code('shared_room_command_busy'));
  await assert.rejects(h.client.retry(), code('shared_room_command_busy'));
  assert.equal(h.ids(), 1); assert.equal(h.calls.length, 1);
  gate.resolve(Response.json(envelope())); await pending;
  await assert.rejects(h.client.retry(), code('shared_room_no_pending_command'));
});

test('a committed command with a lost response retries exact bytes and ID through the real server boundary without a second effect', async () => {
  const receipts = new Map(), origin = 'https://player.example.test'; let effects = 0;
  const handle = createSharedRoomCommand({ origin, service: { async command(_req, { input }) {
    const prior = receipts.get(input.commandId);
    if (prior) assert.equal(prior, JSON.stringify(input));
    else { effects++; receipts.set(input.commandId, JSON.stringify(input)); }
    return { ...envelope(), replay: Boolean(prior) };
  } } });
  const h = fixture(async (url, init, attempt) => {
    const reply = await handle(new Request(origin + url, { ...init, headers: { ...init.headers, host: 'player.example.test', origin } }));
    if (attempt === 1) throw Error('response lost after commit, private network details');
    return reply;
  });
  const intent = { ...ready }, uncertain = await h.client.send(intent); intent.windowId = 'new-window';
  assert.deepEqual(uncertain, { status: 'uncertain', commandId: 'command-1', code: 'shared_room_command_uncertain' });
  assert.equal(h.client.state, 'uncertain'); assert.equal(effects, 1);
  await assert.rejects(h.client.send(intent), code('shared_room_command_busy'));
  assert.equal(h.calls.length, 1, 'no automatic retry');
  const replay = await h.client.retry();
  assert.equal(replay.status, 'ok'); assert.equal(replay.replay, true); assert.equal(h.client.state, 'idle');
  assert.equal(effects, 1); assert.equal(h.ids(), 1); assert.equal(h.calls[0].init.body, h.calls[1].init.body);
});

test('5xx and non-success HTTP statuses retain the same intent for explicit retry', async () => {
  for (const status of [201, 302, 500, 502, 503, 504]) {
    const h = fixture((_url, _init, attempt) => attempt === 1 ? Response.json(envelope(), { status }) : Response.json(envelope()));
    assert.equal((await h.client.send(ready)).status, 'uncertain');
    assert.equal(h.client.state, 'uncertain'); assert.equal(h.calls.length, 1);
    assert.equal((await h.client.retry()).status, 'ok');
    assert.equal(h.ids(), 1); assert.equal(h.calls[0].init.body, h.calls[1].init.body);
  }
});

test('only a correctly paired safe 4xx code is definitive and allows a new intent', async () => {
  for (const [httpStatus, value] of [[409, 'STALE_COMMAND'], [403, 'AUTHORITY_REJECTED'], [409, 'REFILL_REFUSED'],
    [401, 'shared_room_authentication_required'], [415, 'shared_room_json_required'], [400, 'shared_room_invalid_command']]) {
    const h = fixture(() => Response.json({ error: value }, { status: httpStatus }));
    assert.deepEqual(await h.client.send(ready), { status: 'rejected', commandId: 'command-1', httpStatus, code: value });
    assert.equal(h.client.state, 'idle');
    await assert.rejects(h.client.retry(), code('shared_room_no_pending_command'));
    await h.client.send(ready); assert.equal(h.ids(), 2);
  }
  for (const [status, body] of [[400, { error: 'STALE_COMMAND' }], [409, { error: 'UNKNOWN_PRIVATE_SQL_ERROR' }],
    [403, { error: 'AUTHORITY_REJECTED', detail: 'private' }], [429, { error: 'shared_room_forbidden' }]]) {
    const h = fixture(() => Response.json(body, { status }));
    assert.deepEqual(await h.client.send(ready), { status: 'uncertain', commandId: 'command-1', code: 'shared_room_command_uncertain' });
    assert.equal(h.client.state, 'uncertain');
  }
});

test('malformed, redirected or mismatched success cannot release the pending intent or expose snapshot/HTML/private errors', async () => {
  for (const body of [null, { ...envelope(), extra: true }, { ...envelope(), replay: 'yes' }, { ...envelope(), snapshot: null },
    { ...envelope(), snapshot: { ...snapshot(), roomId: 'other' } }, { ...envelope(), snapshot: { ...snapshot(), version: -1 } },
    { ...envelope(), snapshot: { ...snapshot(), contract: 'other' } }, { ...envelope(), snapshot: { ...snapshot(), me: null } },
    { ...envelope(), result: { op: 'refill', version: 1 } }, { ...envelope(), result: { op: 'ready', version: 1, started: 'yes' } },
    { ...envelope(), result: { ...envelope().result, ledger: ['private'] } }]) {
    const h = fixture(() => Response.json(body));
    assert.equal((await h.client.send(ready)).status, 'uncertain'); assert.equal(h.client.state, 'uncertain');
  }
  for (const response of [new Response('<html>private password</html>', { headers: { 'content-type': 'text/html' } }),
    new Response('{private', { headers: { 'content-type': 'application/json' } }),
    { ...Response.json(envelope()), redirected: true, status: 200 }]) {
    const h = fixture(() => response), reply = await h.client.send(ready);
    assert.deepEqual(reply, { status: 'uncertain', commandId: 'command-1', code: 'shared_room_command_uncertain' });
  }
});

test('non-string 4xx error codes cannot coerce into a definitive rejection and exact retry remains available', async () => {
  for (const value of [['STALE_COMMAND'], [['STALE_COMMAND']], null, 409, { toString: 'STALE_COMMAND' }]) {
    const h = fixture((_url, _init, attempt) => attempt === 1 ? Response.json({ error: value }, { status: 409 }) : Response.json(envelope()));
    assert.deepEqual(await h.client.send(ready), { status: 'uncertain', commandId: 'command-1', code: 'shared_room_command_uncertain' });
    assert.equal(h.client.state, 'uncertain');
    await assert.rejects(h.client.send({ op: 'refill' }), code('shared_room_command_busy'));
    assert.equal((await h.client.retry()).status, 'ok');
    assert.equal(h.ids(), 1); assert.equal(h.calls[0].init.body, h.calls[1].init.body);
  }
});

test('pause permits a null snapshot; every other valid reply must match the room and result operation', async () => {
  const h = fixture(() => Response.json({ ...envelope('pause'), snapshot: null }));
  const reply = await h.client.send({ op: 'pause' });
  assert.deepEqual(reply, { status: 'ok', commandId: 'command-1', result: { op: 'pause', pausedUntil: 1000 }, replay: false });
  assert.equal(h.client.state, 'idle');
});

test('response byte limit covers chunked, declared, invalid UTF-8 and incomplete bodies and cancels the reader', async () => {
  for (const response of [() => new Response('x', { headers: { 'content-type': 'application/json', 'content-length': '1000' } }),
    () => new Response(new Uint8Array([0xc3, 0x28]), { headers: { 'content-type': 'application/json' } }),
    () => new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': 'bad' } })]) {
    const h = fixture(response, { maxResponseBytes: 64 }); assert.equal((await h.client.send(ready)).status, 'uncertain');
  }
  let cancelled = false;
  const h = fixture(() => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(65)); },
    cancel() { cancelled = true; } }), { headers: { 'content-type': 'application/json' } }), { maxResponseBytes: 64 });
  assert.equal((await h.client.send(ready)).status, 'uncertain'); assert.equal(cancelled, true);
});

test('default 256KiB budget accepts projected public form above 64KiB and preserves exact retry above 256KiB', async () => {
  // Synthetic stress shape within the actual public projector bounds, not an
  // observed oversized game response or evidence of a real round's card count.
  function projected(label) {
    const cards = Array.from({ length: 32 }, (_, i) => ({ r: '10', s: '♠', shoeDraw: 10000 + i }));
    const hand = box => ({ box, splitFrom: null, stake: 10, pp: 5, tp: 5, done: true, doubled: false, insured: false,
      result: 'win', sideReturn: 20, busted: false, cards,
      sideLabels: Array(4).fill(label), sideResults: {
        pp: { stake: 5, returned: 10, profit: 5, label, draws: [1, 2, 3] },
        tp: { stake: 5, returned: 10, profit: 5, label, draws: [1, 2, 3] },
      } });
    const hands = Array.from({ length: 28 }, (_, i) => hand(i % 7));
    return projectSharedRoomSnapshot({ ...snapshot(), phase: 'round', roundId: 'round-a', turnSeq: 1,
      owners: Array(7).fill('alice'), seatGen: Array(7).fill(1), bets: Array.from({ length: 7 }, () => ({ main: 10, pp: 5, tp: 5 })),
      round: { phase: 'settled', active: 0, holeDraw: null, boxes: Array.from({ length: 7 }, (_, i) => hand(i)), hands,
        dealer: cards, legalActions: [] },
      me: { id: 'alice', available: 100, lastSettlement: { roundId: 'previous-round', settledAt: 1000, returned: 10, staked: 5, net: 5, hands } },
    }, { roomId, actorId: 'alice' });
  }
  const accepted = { ...envelope(), snapshot: projected('x'.repeat(256)) };
  const oversized = { ...envelope(), snapshot: projected('界'.repeat(256)) };
  const byteLength = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;
  const acceptedBytes = byteLength(accepted), oversizedBytes = byteLength(oversized);
  assert.ok(acceptedBytes > 64 * 1024 && acceptedBytes <= 256 * 1024);
  assert.ok(oversizedBytes > 256 * 1024);
  const within = fixture(() => Response.json(accepted));
  assert.equal((await within.client.send(ready)).status, 'ok'); assert.equal(within.client.state, 'idle');
  const beyond = fixture((_url, _init, attempt) => Response.json(attempt === 1 ? oversized : accepted));
  assert.deepEqual(await beyond.client.send(ready), { status: 'uncertain', commandId: 'command-1', code: 'shared_room_command_uncertain' });
  assert.equal(beyond.client.state, 'uncertain');
  await assert.rejects(beyond.client.send({ op: 'refill' }), code('shared_room_command_busy'));
  assert.equal((await beyond.client.retry()).status, 'ok');
  assert.equal(beyond.ids(), 1); assert.equal(beyond.calls[0].init.body, beyond.calls[1].init.body);
  console.info('Synthetic projected JSON bytes (not observed gameplay):', JSON.stringify({ acceptedBytes, oversizedBytes }));
});

test('timeout settles even if fetch ignores abort; late responses are cancelled and explicit retry keeps the same bytes', async () => {
  const late = deferred(); let lateCancelled = false;
  const h = fixture((_url, _init, attempt) => attempt === 1 ? late.promise : Response.json(envelope()), { timeoutMs: 10 });
  assert.equal((await h.client.send(ready)).status, 'uncertain'); assert.equal(h.calls[0].init.signal.aborted, true);
  assert.equal(h.client.state, 'uncertain');
  assert.equal((await h.client.retry()).status, 'ok');
  late.resolve(new Response(new ReadableStream({ cancel() { lateCancelled = true; } })));
  await turn(); assert.equal(lateCancelled, true); assert.equal(h.client.state, 'idle');
  assert.equal(h.ids(), 1); assert.equal(h.calls[0].init.body, h.calls[1].init.body);
});

test('caller abort before fetch and while reading retains intent, propagates cancellation and removes both signal listeners', async () => {
  const before = new AbortController(); before.abort();
  const h = fixture();
  assert.equal((await h.client.send(ready, { signal: before.signal })).status, 'uncertain');
  assert.equal(h.calls.length, 0); assert.equal(h.ids(), 1); assert.equal(getEventListeners(before.signal, 'abort').length, 0);
  assert.equal((await h.client.retry()).status, 'ok'); assert.equal(h.ids(), 1);
  const networkController = new AbortController();
  const network = fixture((_url, _init, attempt) => attempt === 1 ? new Promise(() => {}) : Response.json(envelope()));
  const waiting = network.client.send(ready, { signal: networkController.signal }); networkController.abort();
  assert.equal((await waiting).status, 'uncertain'); assert.equal(network.client.state, 'uncertain');
  assert.equal(getEventListeners(networkController.signal, 'abort').length, 0);
  assert.equal((await network.client.retry()).status, 'ok');
  assert.equal(network.calls[0].init.body, network.calls[1].init.body); assert.equal(network.ids(), 1);
  let cancelled = false; const reading = deferred(), controller = new AbortController();
  const active = fixture(() => new Response(new ReadableStream({ pull() { reading.resolve(); }, cancel() { cancelled = true; } }),
    { headers: { 'content-type': 'application/json' } }));
  const pending = active.client.send(ready, { signal: controller.signal });
  await reading.promise; controller.abort();
  assert.equal((await pending).status, 'uncertain'); assert.equal(cancelled, true);
  assert.equal(active.calls[0].init.signal.aborted, true); assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  assert.equal(getEventListeners(active.calls[0].init.signal, 'abort').length, 0);
});

test('body stalls share the same deadline and all own timers/listeners are removed on success, uncertainty and terminal stop', async t => {
  const set = globalThis.setTimeout, clear = globalThis.clearTimeout, timers = new Set();
  t.mock.method(globalThis, 'setTimeout', (callback, ms) => {
    const handle = set(() => { timers.delete(handle); callback(); }, ms); timers.add(handle); return handle;
  });
  t.mock.method(globalThis, 'clearTimeout', handle => { timers.delete(handle); clear(handle); });
  const success = fixture(); await success.client.send(ready); assert.equal(timers.size, 0);
  let cancelled = false;
  const stalled = fixture(() => new Response(new ReadableStream({ cancel() { cancelled = true; } }),
    { headers: { 'content-type': 'application/json' } }), { timeoutMs: 10 });
  assert.equal((await stalled.client.send(ready)).status, 'uncertain'); assert.equal(cancelled, true); assert.equal(timers.size, 0);
  const stopped = fixture(() => new Promise(() => {}));
  const controller = new AbortController(), pending = stopped.client.send(ready, { signal: controller.signal });
  stopped.client.stop(); stopped.client.stop();
  assert.deepEqual(await pending, { status: 'stopped', commandId: 'command-1', code: 'shared_room_client_stopped' });
  assert.equal(stopped.client.state, 'stopped'); assert.equal(timers.size, 0);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  assert.equal(getEventListeners(stopped.calls[0].init.signal, 'abort').length, 0);
  await assert.rejects(stopped.client.retry(), code('shared_room_client_stopped'));
  await assert.rejects(stopped.client.send(ready), code('shared_room_client_stopped'));
  assert.equal(stopped.ids(), 1); assert.equal(stopped.calls.length, 1);
  for (const state of ['idle', 'uncertain']) {
    const terminal = fixture(() => { throw Error('network'); });
    if (state === 'uncertain') await terminal.client.send(ready);
    terminal.client.stop(); assert.equal(terminal.client.state, 'stopped');
    await assert.rejects(terminal.client.send(ready), code('shared_room_client_stopped'));
    await assert.rejects(terminal.client.retry(), code('shared_room_client_stopped'));
    assert.equal(terminal.ids(), state === 'idle' ? 0 : 1);
  }
});

test('invalid intent, identity/credential/room overrides and getters cannot trigger fetch or mint an ID', async () => {
  const h = fixture(); let reads = 0;
  for (const intent of [null, {}, { op: 'unknown' }, { ...ready, actorId: 'mallory' }, { ...ready, roomId: 'other' },
    { ...ready, commandId: 'chosen-by-view' }, { ...ready, cookie: 'private' }, { ...ready, credentials: 'omit' },
    { ...ready, fetch: () => {} }, { op: 'join', memberGen: 0, seats: [0, 0], seatGens: {} },
    { op: 'join', memberGen: 0, seats: [8], seatGens: {} }, { op: 'refill', extra: 1 },
    Object.defineProperty({ windowId: 'window-a' }, 'op', { enumerable: true, get() { reads++; return 'ready'; } })]) {
    await assert.rejects(h.client.send(intent), code('shared_room_invalid_command'));
  }
  assert.equal(reads, 0); assert.equal(h.calls.length, 0); assert.equal(h.ids(), 0); assert.equal(h.client.state, 'idle');
});

test('invalid options cannot corrupt a simultaneously valid send or discard an uncertain retry', async () => {
  const gate = deferred(), h = fixture(() => gate.promise);
  const invalid = h.client.send(ready, { credentials: 'omit' });
  const valid = h.client.send(ready);
  await assert.rejects(invalid, code('shared_room_client_invalid_options')); assert.equal(h.ids(), 1);
  gate.resolve(Response.json(envelope())); assert.equal((await valid).status, 'ok');
  const uncertain = fixture(() => { throw Error('network'); }); await uncertain.client.send(ready);
  await assert.rejects(uncertain.client.retry({ signal: {} }), code('shared_room_client_invalid_options'));
  assert.equal(uncertain.client.state, 'uncertain'); assert.equal(uncertain.ids(), 1);
});

test('constructor bounds and invalid UUID fail closed without network calls', async () => {
  for (const options of [{ roomId: '../other' }, { roomId: 'Room-A' }, { roomId: 'a'.repeat(129) }, { timeoutMs: 0 },
    { timeoutMs: 30001 }, { maxResponseBytes: Infinity }, { maxResponseBytes: 1024 * 1024 + 1 }, { fetchImpl: null }]) {
    assert.throws(() => fixture(undefined, options), code('shared_room_client_invalid_options'));
  }
  const h = fixture(undefined, { randomUUID: () => 'invalid id' });
  await assert.rejects(h.client.send(ready), code('shared_room_client_invalid_id'));
  assert.equal(h.calls.length, 0); assert.equal(h.client.state, 'idle');
});
