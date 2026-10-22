import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as turn, setTimeout as delay } from 'node:timers/promises';
import { createSharedRoomClient } from '../services/game/public/shared-room-client.mjs';

const browserOrigin = 'https://game.invalid';
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function until(check) {
  const deadline = Date.now() + 1500;
  while (!check()) { if (Date.now() >= deadline) assert.fail('Expected client observation did not arrive'); await delay(1); }
}
function frame(version = 1, presentationVer = version) {
  return { type: 'shared-room-state', roomId: 'room-a', snapshot: {
    contract: 'blackjack-table/1', roomId: 'room-a', version, presentationVer,
    configVersion: 'config-a', windowId: 'window-a', phase: 'bets', deadline: 20000,
    owners: ['player-a', null, null, null, null, null, null],
    me: { id: 'player-a', active: true, available: 100, seats: [0] },
  }, presentation: presentationVer === 0 ? null : {
    roomId: 'room-a', ver: presentationVer, talkId: `talk-${presentationVer}`, auditSeq: presentationVer,
    status: 'ready', kind: 'window', configVersion: 'config-a', windowId: 'window-a',
    language: 'en', startAt: 1000, endAt: 2000,
    events: [{ type: 'speak', line: 'placebets', blocking: true }],
    lines: [{ index: 0, line: 'placebets', lineId: 'a'.repeat(32) }],
  } };
}
function setup(t, options = {}) {
  const sockets = [], calls = [], errors = [];
  let active = 0, peak = 0;
  class Socket extends EventTarget {
    readyState = options.initialReadyState ?? 1; listeners = new Map(); captured = new Map(); closed = []; sent = [];
    constructor(...args) { super(); this.args = args; sockets.push(this); }
    addEventListener(type, listener) { super.addEventListener(type, listener); this.listeners.set(type, listener); this.captured.set(type, listener); }
    removeEventListener(type, listener) { super.removeEventListener(type, listener); this.listeners.delete(type); }
    opened() { this.readyState = 1; this.dispatchEvent(new Event('open')); }
    message(value) { this.dispatchEvent(new MessageEvent('message', { data: typeof value === 'string' ? value : JSON.stringify(value) })); }
    ended(code = 1006) { this.readyState = 3; this.dispatchEvent(Object.assign(new Event('close'), { code })); }
    close(code, reason) { this.closed.push({ code, reason }); this.ended(code); }
    send(value) { this.sent.push(value); throw new Error('Client must be read-only'); }
  }
  const guarded = port => async (...args) => {
    active++; peak = Math.max(peak, active);
    try { return await port(...args); } finally { active--; }
  };
  const client = createSharedRoomClient({ roomId: 'room-a', browserOrigin, WebSocket: Socket,
    reconnectDelayMs: 5, callbackTimeoutMs: 500,
    ...options,
    restoreSnapshot: guarded(options.restoreSnapshot ?? ((s, context) => { calls.push(['snapshot', s.version, s.me.available]); assert.equal(context.roomId, 'room-a'); })),
    present: guarded(options.present ?? ((p, context) => { calls.push(['present', p.ver]); assert.equal(context.roomId, 'room-a'); })),
    onError: error => { errors.push(error); options.onError?.(error); },
  });
  t.after(() => client.stop());
  return { client, sockets, calls, errors, peak: () => peak };
}

test('construction is idle; explicit start uses only the exact same-origin room URL and stop releases listeners', async t => {
  const h = setup(t); await turn(); assert.equal(h.sockets.length, 0);
  h.client.start(); h.client.start(); assert.equal(h.sockets.length, 1);
  assert.deepEqual(h.sockets[0].args, ['wss://game.invalid/shared-room/room-a']);
  h.sockets[0].message(frame()); await until(() => h.calls.length === 2);
  assert.deepEqual(h.calls, [['snapshot', 1, 100], ['present', 1]]);
  assert.deepEqual(h.sockets[0].sent, []);
  h.client.stop(); h.client.stop(); assert.equal(h.sockets[0].listeners.size, 0);
  assert.throws(() => h.client.start(), /client_stopped/);
  assert.equal(h.sockets[0].closed.length, 1);
});

test('invalid or foreign origin, encoded/credential room paths and unbounded options fail before connection', t => {
  const valid = { roomId: 'room-a', browserOrigin, WebSocket: class {}, restoreSnapshot() {}, present() {} };
  for (const roomId of ['', '.', '..', 'room/a', '%72oom-a', 'room?a=b', 'room#token', 'a'.repeat(129)]) {
    assert.throws(() => createSharedRoomClient({ ...valid, roomId }));
  }
  for (const origin of ['https://game.invalid/', 'https://game.invalid?token=x', 'https://u:p@game.invalid', 'wss://game.invalid', '//game.invalid']) {
    assert.throws(() => createSharedRoomClient({ ...valid, browserOrigin: origin }));
  }
  for (const options of [{ maxMessageBytes: Infinity }, { maxPendingStates: 0 }, { maxReconnectAttempts: 6 }, { reconnectDelayMs: 0 }, { callbackTimeoutMs: 30001 }]) {
    assert.throws(() => createSharedRoomClient({ ...valid, ...options }));
  }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'location');
  try {
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'https://other.invalid' } });
    assert.throws(() => createSharedRoomClient(valid));
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'location', descriptor); else delete globalThis.location;
  }
  const local = setup(t, { browserOrigin: 'http://127.0.0.1:12345' }); local.client.start();
  assert.deepEqual(local.sockets[0].args, ['ws://127.0.0.1:12345/shared-room/room-a']);
});

test('snapshot completes before presentation; adjacent async callbacks never overlap', async t => {
  const entered = deferred(), release = deferred(), calls = [];
  const h = setup(t, {
    restoreSnapshot: async s => { calls.push(`snapshot:${s.version}:start`); if (s.version === 1) { entered.resolve(); await release.promise; } calls.push(`snapshot:${s.version}:end`); },
    present: async p => { calls.push(`present:${p.ver}`); await turn(); },
  });
  h.client.start(); h.sockets[0].message(frame(1)); await entered.promise;
  h.sockets[0].message(frame(2)); await turn();
  assert.deepEqual(calls, ['snapshot:1:start']);
  release.resolve(); await until(() => calls.includes('present:2'));
  assert.deepEqual(calls, ['snapshot:1:start', 'snapshot:1:end', 'present:1', 'snapshot:2:start', 'snapshot:2:end', 'present:2']);
  assert.equal(h.peak(), 1);
});

test('duplicates can refresh public wallet/presence but never replay presentation or restore an older snapshot', async t => {
  const h = setup(t); h.client.start(); const socket = h.sockets[0];
  socket.message(frame(2)); await until(() => h.calls.length === 2);
  const same = frame(2); same.snapshot.me.available = 90;
  socket.message(same); socket.message(frame(1));
  const newerState = frame(3, 2); newerState.snapshot.me.available = 80; socket.message(newerState);
  await until(() => h.calls.length === 4);
  const olderPresentation = frame(4, 1); socket.message(olderPresentation); await turn();
  assert.deepEqual(h.calls, [['snapshot', 2, 100], ['present', 2], ['snapshot', 2, 90], ['snapshot', 3, 80]]);
  assert.deepEqual(h.errors, []);
});

test('empty rooms and eventless legacy projections retain their reconnect semantics', async t => {
  const h = setup(t); h.client.start(); const socket = h.sockets[0];
  socket.message(frame(1, 0)); await until(() => h.calls.length === 1);
  const legacy = frame(2, 1);
  legacy.presentation = { roomId: 'room-a', ver: 1, talkId: 'legacy-1', auditSeq: 1, status: 'legacy', kind: null, events: [], lines: [] };
  socket.message(legacy); await until(() => h.calls.length === 3);
  assert.deepEqual(h.calls, [['snapshot', 1, 100], ['snapshot', 2, 100], ['present', 1]]);
});

test('wrong room, version, presentation binding or session actor closes before inconsistent state reaches a renderer', async t => {
  const edits = [
    f => { f.roomId = 'other'; }, f => { f.snapshot.roomId = 'other'; }, f => { f.presentation.roomId = 'other'; },
    f => { f.snapshot.contract = 'other'; }, f => { delete f.snapshot.presentationVer; },
    f => { f.snapshot.version = -1; }, f => { f.snapshot.version = 1.5; }, f => { f.snapshot.version = Number.MAX_SAFE_INTEGER + 1; },
    f => { f.presentation.ver = 0; }, f => { f.presentation.ver = 2; }, f => { f.presentation = null; },
    f => { f.presentation.configVersion = 'other'; }, f => { f.presentation.windowId = 'other'; },
    f => { f.presentation.lines[0].line = 'another'; }, f => { f.presentation.lines[0].lineId = ['a'.repeat(32)]; }, f => { f.presentation.events[0].type = 'unknown'; },
    f => { f.presentation.events = Array(129).fill({ type: 'idle' }); },
  ];
  for (const edit of edits) {
    const h = setup(t); h.client.start(); const value = frame(); edit(value); h.sockets[0].message(value);
    await turn(); assert.deepEqual(h.calls, []); assert.deepEqual(h.errors, [{ code: 'shared_room_invalid_state' }]);
    assert.equal(h.sockets[0].listeners.size, 0);
  }
  const changed = setup(t); changed.client.start(); changed.sockets[0].message(frame()); await until(() => changed.calls.length === 2);
  const otherActor = frame(2); otherActor.snapshot.me.id = 'player-b'; changed.sockets[0].message(otherActor);
  await turn(); assert.equal(changed.calls.length, 2); assert.deepEqual(changed.errors, [{ code: 'shared_room_invalid_state' }]);
});

test('reconnect rereads state, keeps its presentation cursor and ignores late messages from detached sockets', async t => {
  const h = setup(t); h.client.start(); const first = h.sockets[0]; first.message(frame());
  await until(() => h.calls.length === 2); first.ended(1006); await until(() => h.sockets.length === 2);
  assert.equal(first.listeners.size, 0);
  first.captured.get('message')({ data: JSON.stringify(frame(99)) });
  const second = h.sockets[1]; second.message(frame()); second.message(frame(2));
  await until(() => h.calls.length === 5);
  assert.deepEqual(h.calls, [['snapshot', 1, 100], ['present', 1], ['snapshot', 1, 100], ['snapshot', 2, 100], ['present', 2]]);
  assert.deepEqual(h.errors, []); assert.deepEqual(second.sent, []);
});

test('a reconnect waits for an interrupted snapshot renderer; its old presentation cannot run late', async t => {
  const entered = deferred(), release = deferred(), calls = []; let oldSignal;
  const h = setup(t, {
    restoreSnapshot: async (s, { signal }) => { calls.push(`snapshot:${s.version}`); if (s.version === 1) { oldSignal = signal; entered.resolve(); await release.promise; } },
    present: p => calls.push(`present:${p.ver}`),
  });
  h.client.start(); h.sockets[0].message(frame()); await entered.promise;
  h.sockets[0].ended(); await until(() => h.sockets.length === 2); assert.equal(oldSignal.aborted, true);
  h.sockets[1].message(frame(2)); await turn(); assert.deepEqual(calls, ['snapshot:1']);
  release.resolve(); await until(() => calls.includes('present:2'));
  assert.deepEqual(calls, ['snapshot:1', 'snapshot:2', 'present:2']); assert.equal(h.peak(), 1);
});

test('an interrupted presentation is consumed once and finishes before any reconnect renderer starts', async t => {
  const entered = deferred(), release = deferred(), calls = []; let oldSignal;
  const h = setup(t, {
    restoreSnapshot: s => calls.push(`snapshot:${s.version}`),
    present: async (p, { signal }) => { calls.push(`present:${p.ver}`); if (p.ver === 1) { oldSignal = signal; entered.resolve(); await release.promise; } },
  });
  h.client.start(); h.sockets[0].message(frame()); await entered.promise;
  h.sockets[0].ended(); await until(() => h.sockets.length === 2); h.sockets[1].message(frame()); h.sockets[1].message(frame(2));
  await turn(); assert.equal(oldSignal.aborted, true); assert.deepEqual(calls, ['snapshot:1', 'present:1']);
  release.resolve(); await until(() => calls.includes('present:2'));
  assert.deepEqual(calls, ['snapshot:1', 'present:1', 'snapshot:1', 'snapshot:2', 'present:2']); assert.equal(h.peak(), 1);
});

test('network errors retry a bounded number, while authorization and normal closure are terminal', async t => {
  const h = setup(t, { maxReconnectAttempts: 2 }); h.client.start();
  h.sockets[0].dispatchEvent(new Event('error')); h.sockets[0].ended();
  await until(() => h.sockets.length === 2); h.sockets[1].ended();
  await until(() => h.sockets.length === 3); h.sockets[2].ended();
  await until(() => h.errors.length === 1); await delay(15);
  assert.equal(h.sockets.length, 3); assert.deepEqual(h.errors, [{ code: 'shared_room_reconnect_exhausted' }]);
  for (const code of [1000, 1008, 1009]) {
    const terminal = setup(t); terminal.client.start(); terminal.sockets[0].ended(code); await delay(10);
    assert.equal(terminal.sockets.length, 1); assert.equal(terminal.sockets[0].listeners.size, 0);
    assert.equal(terminal.errors[0]?.code, code === 1000 ? undefined : code === 1008 ? 'shared_room_unauthorized' : 'shared_room_invalid_state');
  }
  let attempts = 0;
  const thrown = setup(t, { maxReconnectAttempts: 1, WebSocket: class { constructor() { attempts++; throw new Error('private connection detail'); } } });
  thrown.client.start(); await until(() => thrown.errors.length === 1); assert.equal(attempts, 2);
  assert.deepEqual(thrown.errors, [{ code: 'shared_room_reconnect_exhausted' }]);
});

test('explicit stop cancels reconnect and aborts a pending renderer without a late presentation or error', async t => {
  const waiting = setup(t); waiting.client.start(); waiting.sockets[0].ended(); waiting.client.stop();
  await delay(15); assert.equal(waiting.sockets.length, 1); assert.deepEqual(waiting.errors, []);
  const entered = deferred(), release = deferred(); let signal;
  const held = setup(t, { callbackTimeoutMs: 15, restoreSnapshot: async (_s, context) => { signal = context.signal; entered.resolve(); await release.promise; } });
  held.client.start(); held.sockets[0].message(frame()); await entered.promise; held.client.stop();
  assert.equal(signal.aborted, true); await delay(25); release.resolve(); await turn();
  assert.deepEqual(held.calls, []); assert.deepEqual(held.errors, []); assert.equal(held.sockets[0].listeners.size, 0);
});

test('renderer rejection and timeout fail closed, sanitize errors and never reconnect or repeat presentation', async t => {
  for (const port of ['restoreSnapshot', 'present']) {
    const h = setup(t, { [port]: async () => { throw new Error('private database password'); } }); h.client.start(); h.sockets[0].message(frame());
    await until(() => h.errors.length === 1); await delay(10);
    assert.deepEqual(h.errors, [{ code: 'shared_room_renderer_failed' }]); assert.equal(h.sockets.length, 1);
    assert.equal(h.sockets[0].listeners.size, 0);
    assert.deepEqual(h.calls, port === 'present' ? [['snapshot', 1, 100]] : []);
  }
  const entered = deferred(), release = deferred(); let signal;
  const timeout = setup(t, { callbackTimeoutMs: 15, restoreSnapshot: async (_s, context) => { signal = context.signal; entered.resolve(); await release.promise; } });
  timeout.client.start(); timeout.sockets[0].message(frame()); await entered.promise;
  await until(() => timeout.errors.length === 1); assert.equal(signal.aborted, true);
  release.resolve(); await turn(); assert.deepEqual(timeout.calls, []);
  assert.deepEqual(timeout.errors, [{ code: 'shared_room_renderer_timeout' }]);
});

test('wire bytes, malformed/binary frames and queued states are bounded before further rendering', async t => {
  const large = frame(); large.ignored = 'é'.repeat(1000); const encoded = JSON.stringify(large);
  assert.ok(encoded.length < 2200); assert.ok(new TextEncoder().encode(encoded).byteLength > 2200);
  for (const data of ['{invalid', encoded, new Uint8Array([1, 2, 3])]) {
    const h = setup(t, { maxMessageBytes: 2200 }); h.client.start();
    h.sockets[0].dispatchEvent(new MessageEvent('message', { data })); await turn();
    assert.deepEqual(h.calls, []); assert.deepEqual(h.errors, [{ code: 'shared_room_invalid_state' }]);
  }
  const entered = deferred(), release = deferred(); let signal;
  const full = setup(t, { maxPendingStates: 1, restoreSnapshot: async (_s, context) => { signal = context.signal; entered.resolve(); await release.promise; } });
  full.client.start(); full.sockets[0].message(frame()); await entered.promise;
  full.sockets[0].message(frame(2)); full.sockets[0].message(frame(3));
  assert.equal(signal.aborted, true); release.resolve(); await turn();
  assert.deepEqual(full.errors, [{ code: 'shared_room_backpressure' }]); assert.deepEqual(full.calls, []);
});

test('an uncompleted WebSocket handshake has a bounded retry budget; opening cancels its deadline', async t => {
  const stuck = setup(t, { initialReadyState: 0, connectTimeoutMs: 10, maxReconnectAttempts: 1 });
  stuck.client.start(); await until(() => stuck.errors.length === 1);
  assert.equal(stuck.sockets.length, 2);
  assert.deepEqual(stuck.errors, [{ code: 'shared_room_reconnect_exhausted' }]);
  assert.ok(stuck.sockets.every(socket => socket.listeners.size === 0));
  const opened = setup(t, { initialReadyState: 0, connectTimeoutMs: 10 }); opened.client.start(); opened.sockets[0].opened();
  await delay(25); assert.equal(opened.sockets.length, 1); assert.deepEqual(opened.errors, []);
  opened.sockets[0].message(frame()); await until(() => opened.calls.length === 2);
});