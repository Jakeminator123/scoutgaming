import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as turn, setTimeout as delay } from 'node:timers/promises';
import { createSharedRoomClient, ROOM_CONFIG_MISSING } from '../services/game/public/shared-room-client.mjs';

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
  for (const options of [{ maxMessageBytes: Infinity }, { maxPendingStates: 0 }, { maxReconnectAttempts: 61 }, { reconnectDelayMs: 0 },
    { maxReconnectDelayMs: 30001 }, { reconnectBudgetMs: 0 }, { callbackTimeoutMs: 30001 }, { network: {} }, { page: { addEventListener() {} } }]) {
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

test('snapshot receipt time survives the renderer queue and is not taken from wire data',async t=>{
  const gate=deferred(),seen=[];let now=100;
  const h=setup(t,{now:()=>now,restoreSnapshot:async(s,context)=>{seen.push([s.version,context.receivedAt]);if(s.version===1)await gate.promise;}});
  h.client.start();h.sockets[0].message(frame(1,0));await turn();
  now=200;const second=frame(2,0);second.receivedAt=999999;h.sockets[0].message(second);
  now=500;gate.resolve();await until(()=>seen.length===2);
  assert.deepEqual(seen,[[1,100],[2,200]]);
});

test('a stale binding rereads through a new socket without consuming its presentation',async t=>{
  let stale=true;const restored=[],presented=[];
  const h=setup(t,{restoreSnapshot:async(s,{signal})=>{restored.push(signal);if(stale)throw Object.assign(Error('window changed'),{code:'shared_room_presentation_stale'});},
    present:p=>presented.push(p.ver)});
  h.client.start();h.sockets[0].message(frame());await until(()=>h.sockets.length===2);
  assert.equal(restored[0].aborted,true);assert.equal(h.client.status().presentationVer,0);assert.deepEqual(h.errors,[]);
  stale=false;h.sockets[1].message(frame(2));await until(()=>presented.length===1);
  assert.deepEqual(presented,[2]);assert.equal(h.client.status().reconnectAttempts,0);
});

test('persistent stale bindings exhaust the existing reconnect budget',async t=>{
  const h=setup(t,{maxReconnectAttempts:1,restoreSnapshot:()=>{throw Object.assign(Error('stale'),{code:'shared_room_presentation_stale'});}});
  h.client.start();h.sockets[0].message(frame());await until(()=>h.sockets.length===2);
  h.sockets[1].message(frame(2));await until(()=>h.errors.length===1);
  assert.deepEqual(h.errors,[{code:'shared_room_reconnect_exhausted'}]);assert.equal(h.sockets.length,2);
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

test('network errors retry a bounded number; a throwing WebSocket constructor uses the same budget', async t => {
  const h = setup(t, { maxReconnectAttempts: 2 }); h.client.start();
  h.sockets[0].dispatchEvent(new Event('error')); h.sockets[0].ended();
  await until(() => h.sockets.length === 2); h.sockets[1].ended();
  await until(() => h.sockets.length === 3); h.sockets[2].ended();
  await until(() => h.errors.length === 1); await delay(15);
  assert.equal(h.sockets.length, 3); assert.deepEqual(h.errors, [{ code: 'shared_room_reconnect_exhausted' }]);
  assert.equal(h.client.status().state, 'offline');
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
  // K04 B1: more committed presentations than the bound no longer end the client. The pending renderer is
  // aborted and the room is read again through a fresh authenticated socket, within the reconnect budget.
  const entered = deferred(), release = deferred(), restored = []; let signal;
  const full = setup(t, { maxPendingStates: 1, restoreSnapshot: async (s, context) => {
    if (s.version === 1) { signal = context.signal; entered.resolve(); await release.promise; } restored.push(s.version); } });
  full.client.start(); full.sockets[0].message(frame()); await entered.promise;
  full.sockets[0].message(frame(2)); full.sockets[0].message(frame(3));
  assert.equal(signal.aborted, true); await until(() => full.sockets.length === 2);
  full.sockets[1].message(frame(3)); await turn(); assert.deepEqual(restored, [], 'the old renderer settles first');
  release.resolve(); await until(() => full.calls.length === 1);
  assert.deepEqual(restored, [1, 3]); assert.deepEqual(full.calls, [['present', 3]]);
  assert.deepEqual(full.errors, []); assert.equal(full.client.status().state, 'running');
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
test('healthy 1001 rotations renew the retry budget after state rendering without replaying a presentation', async t => {
  const h = setup(t); h.client.start(); h.sockets[0].message(frame());
  await until(() => h.calls.length === 2);
  for (let rotation = 1; rotation <= 7; rotation++) {
    h.sockets.at(-1).ended(1001);
    await until(() => h.sockets.length === rotation + 1 || h.errors.length);
    assert.deepEqual(h.errors, []);
    h.sockets.at(-1).message(frame(rotation + 1, 1));
    await until(() => h.calls.length === rotation + 2);
  }
  assert.equal(h.sockets.length, 8);
  assert.equal(h.calls.filter(([type]) => type === 'snapshot').length, 8);
  assert.deepEqual(h.calls.filter(([type]) => type === 'present'), [['present', 1]]);
  assert.deepEqual(h.errors, []);
});

test('opening or receiving a frame cannot renew the retry budget before rendering succeeds', async t => {
  for (const port of ['restoreSnapshot', 'present']) {
    const entered = deferred(), release = deferred();
    const h = setup(t, { maxReconnectAttempts: 1, [port]: async () => { entered.resolve(); await release.promise; } });
    h.client.start(); h.sockets[0].ended(1001); await until(() => h.sockets.length === 2);
    const second = h.sockets[1]; second.opened(); second.message(frame()); await entered.promise;
    second.ended(1001); release.resolve(); await turn();
    assert.deepEqual(h.errors, [{ code: 'shared_room_reconnect_exhausted' }]);
    assert.equal(h.sockets.length, 2);
  }
  // A parsed but older state also did no renderer work and must not replenish.
  const stale = setup(t, { maxReconnectAttempts: 1 }); stale.client.start(); stale.sockets[0].message(frame(2));
  await until(() => stale.calls.length === 2); stale.sockets[0].ended(1001);
  await until(() => stale.sockets.length === 2); stale.sockets[1].message(frame(1)); await turn(); stale.sockets[1].ended(1001);
  assert.deepEqual(stale.errors, [{ code: 'shared_room_reconnect_exhausted' }]); assert.equal(stale.sockets.length, 2);
});

test('completion of an old generation cannot replenish the current connection retry budget', async t => {
  for (const port of ['restoreSnapshot', 'present']) {
    const entered = deferred(), release = deferred(), settled = deferred(); let oldSignal;
    const h = setup(t, { maxReconnectAttempts: 1, [port]: async (_value, { signal }) => {
      oldSignal = signal; entered.resolve(); await release.promise; settled.resolve();
    } });
    h.client.start(); h.sockets[0].message(frame()); await entered.promise;
    h.sockets[0].ended(1001); await until(() => h.sockets.length === 2); h.sockets[1].opened();
    assert.equal(oldSignal.aborted, true); release.resolve(); await settled.promise; await turn();
    // The new connection has never rendered state. A completed old callback
    // cannot turn its already-consumed one-retry budget into a fresh allowance.
    h.sockets[1].ended(1001); await delay(15);
    assert.equal(h.sockets.length, 2); assert.deepEqual(h.errors, [{ code: 'shared_room_reconnect_exhausted' }]);
  }
});

test('presentation deadline is frozen before renderer mutation and legacy callbacks keep their bounded fallback',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const h=setup(t,{present:async p=>{p.endAt=Number.MAX_VALUE;p.events.push(...Array(126).fill({type:'speak',line:'fake'}));await new Promise(()=>{});}});
  h.client.start();h.sockets[0].message(frame());await turn();
  t.mock.timers.tick(386499);await turn();assert.deepEqual(h.errors,[]);
  t.mock.timers.tick(1);await turn();assert.deepEqual(h.errors,[{code:'shared_room_renderer_timeout'}]);
  const legacy=setup(t,{present:()=>new Promise(()=>{})});legacy.client.start();const row=frame();
  row.presentation={roomId:'room-a',ver:1,talkId:'legacy-1',auditSeq:1,status:'legacy',kind:null,events:[],lines:[]};
  legacy.sockets[0].message(row);await turn();t.mock.timers.tick(500);await turn();
  assert.deepEqual(legacy.errors,[{code:'shared_room_renderer_timeout'}]);
});

test('extreme finite server timestamps cannot overflow or remove the bounded presentation timer',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});const h=setup(t,{present:()=>new Promise(()=>{})}),row=frame();
  row.presentation.startAt=-Number.MAX_VALUE;row.presentation.endAt=Number.MAX_VALUE;
  h.client.start();h.sockets[0].message(row);await turn();
  // One speech instruction: 10s select + two (128s film + 30s preparation + 30s buffer/startup) + 500ms callback margin.
  t.mock.timers.tick(386499);await turn();assert.deepEqual(h.errors,[]);
  t.mock.timers.tick(1);await turn();assert.deepEqual(h.errors,[{code:'shared_room_renderer_timeout'}]);
});


test('the maximum validated event count has a finite film-derived total deadline',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});const h=setup(t,{present:()=>new Promise(()=>{})}),row=frame();
  row.presentation.events=Array.from({length:128},()=>({type:'deal'}));row.presentation.lines=[];
  row.presentation.startAt=-Number.MAX_VALUE;row.presentation.endAt=Number.MAX_VALUE;
  h.client.start();h.sockets[0].message(row);await turn();
  const deadline=128*(10000+3*(128000+2*30000))+500;
  assert.ok(deadline<2147483647);t.mock.timers.tick(deadline-1);await turn();assert.deepEqual(h.errors,[]);
  t.mock.timers.tick(1);await turn();assert.deepEqual(h.errors,[{code:'shared_room_renderer_timeout'}]);
});

// K04 B1 (external review 28 Oct 2026, reproduced at c8a26b64): pump awaited the whole film, four states queued
// behind it and the fifth ended the client with shared_room_backpressure, without any reconnect. The server sends
// a state for every change of the room or of a player's account, so this was ordinary play. A state is
// replaceable: the newest state of the presentation that plays is restored at once; its film never plays again.
test('twenty states during a slow film restore the newest authority at once, never replay the film and never fail', async t => {
  const entered = deferred(), playing = deferred(), restored = [], presented = [];
  const h = setup(t, {
    restoreSnapshot: async s => { restored.push(s.version); },
    present: async p => { presented.push(p.ver); entered.resolve(); await playing.promise; },
  });
  h.client.start(); h.sockets[0].message(frame(1, 1)); await entered.promise;
  for (let version = 2; version <= 21; version++) { h.sockets[0].message(frame(version, 1)); await turn(); }
  await until(() => restored.at(-1) === 21);
  assert.equal(h.client.status().state, 'running'); assert.deepEqual(h.errors, []);
  assert.deepEqual(presented, [1], 'the playing presentation is never presented again');
  assert.equal(h.client.status().snapshotVersion, 21); assert.equal(h.sockets.length, 1);
  playing.resolve(); await delay(10);
  assert.deepEqual(presented, [1]); assert.equal(restored.at(-1), 21); assert.deepEqual(h.errors, []);
  assert.equal(h.client.status().reconnectAttempts, 0);
});

test('states arriving faster than they render keep only the newest per presentation, in version order', async t => {
  const gate = deferred(), restored = [];
  const h = setup(t, { restoreSnapshot: async s => { restored.push(s.version); if (s.version === 1) await gate.promise; } });
  h.client.start(); h.sockets[0].message(frame(1, 0)); await turn();
  for (let version = 2; version <= 20; version++) h.sockets[0].message(frame(version, 0));
  h.sockets[0].message(frame(21, 1)); h.sockets[0].message(frame(22, 1)); h.sockets[0].message(frame(3, 1));
  gate.resolve(); await until(() => h.calls.length === 1);
  assert.deepEqual(restored, [1, 20, 22], 'replaceable states coalesce; an older one is never queued');
  assert.deepEqual(h.calls, [['present', 1]]); assert.deepEqual(h.errors, []);
});

test('more committed presentations than the bound abort the film and reread the room; nothing old is replayed', async t => {
  const entered = deferred(), presented = []; let film;
  const h = setup(t, { maxPendingStates: 2, present: (p, { signal }) => {
    presented.push(p.ver);
    if (p.ver === 1) { film = signal; entered.resolve(); return new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })); }
  } });
  h.client.start(); h.sockets[0].message(frame(1)); await entered.promise;
  for (let version = 2; version <= 4; version++) h.sockets[0].message(frame(version));
  await until(() => h.sockets.length === 2);
  assert.equal(film.aborted, true, 'the playing film is aborted'); assert.deepEqual(h.errors, []);
  assert.equal(h.client.status().state, 'running');
  h.sockets[1].message(frame(4)); await until(() => presented.length === 2);
  assert.deepEqual(presented, [1, 4], 'skipped presentations are consumed by the fresh state, never played late');
  assert.deepEqual(h.calls, [['snapshot', 1, 100], ['snapshot', 4, 100]]);
  assert.equal(h.client.status().reconnectAttempts, 0); assert.deepEqual(h.errors, []);
});

// K04 R2b (review of #481): a decision during a take that still played queued its result behind the film.
test('a newer committed presentation tells the playing one it is superseded; both play once and in order', async t => {
  const order = [];
  const h = setup(t, {
    restoreSnapshot: s => order.push(`snapshot:${s.version}`),
    present: async (p, { superseded }) => {
      order.push(`present:${p.ver}`);
      if (p.ver === 1) { await new Promise(resolve => superseded.addEventListener('abort', resolve, { once: true })); order.push('superseded:1'); }
    },
  });
  h.client.start(); h.sockets[0].message(frame(1)); await until(() => order.includes('present:1'));
  h.sockets[0].message(frame(2, 1)); await until(() => order.includes('snapshot:2'));
  assert.equal(order.includes('superseded:1'), false, 'a newer state of the same presentation does not supersede it');
  h.sockets[0].message(frame(3, 2)); await until(() => order.includes('present:2'));
  assert.deepEqual(order, ['snapshot:1', 'present:1', 'snapshot:2', 'superseded:1', 'snapshot:3', 'present:2']);
  assert.deepEqual(h.errors, []);
});

// K04 B2 (external review 28 Oct 2026): the server's channel.close, service release and SIGTERM shutdown use 1000,
// and the client treated 1000 as terminal: every deploy left the players at "Återansluter…" for good. The client's
// own closes go through detach, which removes the listeners first, so every close event comes from elsewhere.
test('every close but an authorization or contract close reconnects with fresh authentication; stop() is the client’s own', async t => {
  for (const code of [1000, 1001, 1006, 1011, 1012, 1013]) {
    const h = setup(t); h.client.start(); h.sockets[0].message(frame()); await until(() => h.calls.length === 2);
    h.sockets[0].ended(code); await until(() => h.sockets.length === 2);
    assert.equal(h.client.status().state, 'running', `close ${code}`); assert.deepEqual(h.errors, []);
    assert.equal(h.sockets[0].listeners.size, 0); assert.deepEqual(h.sockets[1].args, ['wss://game.invalid/shared-room/room-a']);
    h.sockets[1].message(frame(2)); await until(() => h.calls.length === 4);
    assert.deepEqual(h.calls.slice(2), [['snapshot', 2, 100], ['present', 2]]);
    h.client.stop(); await delay(15);
    assert.equal(h.sockets.length, 2); assert.equal(h.client.status().state, 'stopped'); assert.deepEqual(h.errors, []);
  }
});

// External comparison with Kevin's table (28 Oct 2026): three attempts 250 ms apart turned a phone waking up, a
// short network drop or a full channel (1013) into "Ladda om sidan". The wait doubles from 250 ms up to 5 s.
test('five failed reconnects in a row back off from 250 ms and the sixth connection renders', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = setup(t, { reconnectDelayMs: 250 }); h.client.start();
  for (const [i, ms] of [250, 500, 1000, 2000, 4000].entries()) {
    h.sockets[i].ended(1006);
    t.mock.timers.tick(ms - 1); await turn(); assert.equal(h.sockets.length, i + 1, `attempt ${i + 1} waits ${ms} ms`);
    t.mock.timers.tick(1); await turn(); assert.equal(h.sockets.length, i + 2);
    assert.equal(h.client.status().state, 'running'); assert.deepEqual(h.errors, []);
  }
  h.sockets[5].message(frame()); for (let i = 0; i < 6; i++) await turn();
  assert.deepEqual(h.calls, [['snapshot', 1, 100], ['present', 1]]); assert.equal(h.client.status().reconnectAttempts, 0);
  h.sockets[5].ended(1006); t.mock.timers.tick(249); await turn(); assert.equal(h.sockets.length, 6);
  t.mock.timers.tick(1); await turn(); assert.equal(h.sockets.length, 7, 'a rendered state starts the next outage at 250 ms');
});

test('an outage longer than its time budget pauses the client offline; reconnect() starts a fresh budget', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  const h = setup(t, { reconnectDelayMs: 250, maxReconnectDelayMs: 5000, reconnectBudgetMs: 12000, now: () => Date.now() }); h.client.start();
  for (const [i, ms] of [250, 500, 1000, 2000, 4000].entries()) { h.sockets[i].ended(1006); t.mock.timers.tick(ms); await turn(); assert.equal(h.sockets.length, i + 2); }
  // 7.75 s into the outage the next wait (5 s, the cap) would end past the 12 s budget.
  h.sockets[5].ended(1006); await turn();
  assert.equal(h.client.status().state, 'offline'); assert.deepEqual(h.errors, [{ code: 'shared_room_reconnect_exhausted' }]);
  t.mock.timers.tick(60000); await turn(); assert.equal(h.sockets.length, 6, 'offline makes no further attempt by itself');
  assert.equal(h.client.reconnect(), true); assert.equal(h.sockets.length, 7); assert.equal(h.client.status().state, 'running');
  h.sockets[6].message(frame()); for (let i = 0; i < 6; i++) await turn();
  assert.deepEqual(h.calls, [['snapshot', 1, 100], ['present', 1]]); assert.equal(h.errors.length, 1);
  assert.equal(h.client.reconnect(), false, 'a running client has nothing to resume');
  h.client.stop(); assert.equal(h.client.reconnect(), false); assert.equal(h.sockets.length, 7);
});

test('online and a visible page reconnect at once, during a backoff wait and when offline', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const network = new EventTarget(), page = Object.assign(new EventTarget(), { visibilityState: 'hidden' });
  const h = setup(t, { reconnectDelayMs: 250, maxReconnectAttempts: 2, network, page }); h.client.start();
  h.sockets[0].ended(1006); await turn(); assert.equal(h.sockets.length, 1);
  network.dispatchEvent(new Event('online')); await turn(); assert.equal(h.sockets.length, 2, 'online skips the remaining wait');
  h.sockets[1].ended(1006); page.dispatchEvent(new Event('visibilitychange')); await turn(); assert.equal(h.sockets.length, 2, 'a hidden page waits');
  t.mock.timers.tick(500); await turn(); assert.equal(h.sockets.length, 3);
  h.sockets[2].ended(1006); await turn();
  assert.equal(h.client.status().state, 'offline'); assert.deepEqual(h.errors, [{ code: 'shared_room_reconnect_exhausted' }]);
  page.visibilityState = 'visible'; page.dispatchEvent(new Event('visibilitychange')); await turn();
  assert.equal(h.sockets.length, 4); assert.equal(h.client.status().state, 'running');
  network.dispatchEvent(new Event('online')); await turn(); assert.equal(h.sockets.length, 4, 'a live connection is kept');
  h.sockets[3].message(frame()); for (let i = 0; i < 6; i++) await turn(); assert.equal(h.calls.length, 2);
  h.client.stop(); network.dispatchEvent(new Event('online')); page.dispatchEvent(new Event('visibilitychange')); await turn();
  assert.equal(h.sockets.length, 4, 'stop removes the listeners');
});

test('a close that keeps coming exhausts the budget and leaves the client offline', async t => {
  const h = setup(t, { maxReconnectAttempts: 2 }); h.client.start();
  for (let i = 0; i < 3; i++) { await until(() => h.sockets.length === i + 1); h.sockets[i].ended(i === 0 ? 1000 : 1006); }
  await until(() => h.errors.length === 1); await delay(15);
  assert.equal(h.sockets.length, 3); assert.deepEqual(h.errors, [{ code: 'shared_room_reconnect_exhausted' }]);
  assert.equal(h.client.status().state, 'offline'); assert.equal(h.client.reconnect(), true);
});

// Review of #502 (G1): 1008 and 1009 were tried again for up to 20 attempts and 60 s behind "Återansluter…".
test('a contract close ends the client at once; an authorization close gets one re-authenticating socket', async t => {
  for (const code of [1002, 1003, 1007, 1009]) {
    const h = setup(t); h.client.start(); h.sockets[0].message(frame()); await until(() => h.calls.length === 2);
    h.sockets[0].ended(code); await delay(15);
    assert.equal(h.sockets.length, 1, `close ${code}`); assert.deepEqual(h.errors, [{ code: 'shared_room_invalid_state' }]);
    assert.equal(h.client.status().state, 'failed'); assert.equal(h.client.reconnect(), false); assert.equal(h.sockets[0].listeners.size, 0);
  }
  for (const second of [1008, 1006]) {
    const h = setup(t); h.client.start(); h.sockets[0].message(frame()); await until(() => h.calls.length === 2);
    h.sockets[0].ended(1008); await until(() => h.sockets.length === 2); assert.deepEqual(h.errors, [], 'one socket re-authenticates');
    h.sockets[1].ended(second); await delay(15);
    assert.equal(h.sockets.length, 2, `no further socket after ${second}`); assert.deepEqual(h.errors, [{ code: 'shared_room_unauthorized' }]);
    assert.equal(h.client.status().state, 'failed');
  }
  // A renewed session: the re-authenticating socket delivers state, and a later 1008 gets its own single attempt.
  const h = setup(t); h.client.start(); h.sockets[0].message(frame()); await until(() => h.calls.length === 2);
  h.sockets[0].ended(1008); await until(() => h.sockets.length === 2); h.sockets[1].message(frame(2)); await until(() => h.calls.length === 4);
  h.sockets[1].ended(1006); await until(() => h.sockets.length === 3); assert.deepEqual(h.errors, []);
  h.sockets[2].message(frame(3)); await until(() => h.calls.length === 6);
  h.sockets[2].ended(1008); await until(() => h.sockets.length === 4); h.sockets[3].ended(1008); await delay(15);
  assert.deepEqual(h.errors, [{ code: 'shared_room_unauthorized' }]); assert.equal(h.sockets.length, 4);
});

// Review of #502 (G4): only a fully rendered state renews the outage budget. A newer state restored beside a
// presentation that still plays is not one.
test('a state restored beside a playing presentation does not renew the reconnect budget', async t => {
  const entered = deferred(); let restored = 0;
  const h = setup(t, { maxReconnectAttempts: 1, restoreSnapshot: () => { restored++; },
    present: (p, { signal }) => { entered.resolve(); return new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })); } });
  h.client.start(); h.sockets[0].ended(1006); await until(() => h.sockets.length === 2);
  h.sockets[1].message(frame(1)); await entered.promise;
  h.sockets[1].message(frame(2, 1)); await until(() => restored === 2);
  assert.equal(h.client.status().reconnectAttempts, 1, 'the spent attempt is not given back');
  h.sockets[1].ended(1006); await until(() => h.errors.length === 1); await delay(15);
  assert.deepEqual(h.errors, [{ code: 'shared_room_reconnect_exhausted' }]); assert.equal(h.sockets.length, 2);
});

// Speech lag (28 Oct 2026): the engine adds speechTake to a spoken line. The frame check selects no event keys, so
// a client of any age passes the field on and a later one is not refused either (an old client simply ignores it).
test("a spoken line's speechTake, and any later event field, reaches the renderer: the frame check never refuses unknown event keys", async t => {
  const presented = [];
  const h = setup(t, { present: p => { presented.push(p.events[0]); } });
  h.client.start();
  const value = frame(); value.presentation.events[0] = { ...value.presentation.events[0], speechTake: { id: 'clip-1', sha256: 'a'.repeat(64) }, laterField: { any: 1 } };
  h.sockets[0].message(value); await until(() => presented.length === 1);
  assert.deepEqual(presented[0].speechTake, { id: 'clip-1', sha256: 'a'.repeat(64) });
  assert.deepEqual(h.errors, []); assert.deepEqual(h.sockets[0].closed, []);
});

// Nyckel→bolag (docs/plans/NYCKEL-BOLAG.md): the O02 receipt showed 15 sockets over 60 s ending in the error page.
// Preview 29 Oct 2026: a room without published game settings was retried for a minute and ended in the generic
// error page. Named in the server's 1008 close, it gets one more socket and then ends the client with its code.
test('a room without game settings is tried twice in all, then ends the client with room_config_missing', async t => {
  const refused = socket => { socket.readyState = 3; socket.dispatchEvent(Object.assign(new Event('close'), { code: 1008, reason: 'room_config_missing' })); };
  assert.equal(ROOM_CONFIG_MISSING, 'room_config_missing');
  const h = setup(t); h.client.start();
  refused(h.sockets[0]); await until(() => h.sockets.length === 2); assert.deepEqual(h.errors, [], 'one more socket, in case the settings were just published');
  refused(h.sockets[1]); await delay(30);
  assert.equal(h.sockets.length, 2, 'no third socket'); assert.deepEqual(h.errors, [{ code: 'room_config_missing' }]);
  assert.equal(h.client.status().state, 'failed'); assert.equal(h.client.reconnect(), false);
  // Settings published between the two attempts: the second socket delivers a state and the table plays on;
  // a later refusal again gets its own second attempt.
  const later = setup(t); later.client.start();
  refused(later.sockets[0]); await until(() => later.sockets.length === 2);
  later.sockets[1].message(frame()); await until(() => later.calls.length === 2);
  refused(later.sockets[1]); await until(() => later.sockets.length === 3); assert.deepEqual(later.errors, []);
  refused(later.sockets[2]); await delay(30); assert.deepEqual(later.errors, [{ code: 'room_config_missing' }]); assert.equal(later.sockets.length, 3);
});

// A partner refused for its key's company is named in the server's 1008 close; the client ends at once with it.
test('a partner refusal close ends the client at once with its code, without another socket', async t => {
  const refused = (socket, reason) => { socket.readyState = 3; socket.dispatchEvent(Object.assign(new Event('close'), { code: 1008, reason })); };
  for (const reason of ['partner_operator_mismatch', 'partner_key_unbound']) {
    // Before any state (the upgrade's own refusal) and on an open, rendered socket alike.
    for (const rendered of [false, true]) {
      const h = setup(t); h.client.start();
      if (rendered) { h.sockets[0].message(frame()); await until(() => h.calls.length === 2); }
      refused(h.sockets[0], reason); await delay(30);
      assert.equal(h.sockets.length, 1, `${reason} after state: ${rendered}`); assert.deepEqual(h.errors, [{ code: reason }]);
      assert.equal(h.client.status().state, 'failed'); assert.equal(h.client.reconnect(), false); assert.equal(h.sockets[0].listeners.size, 0);
    }
  }
  // Any other 1008 reason keeps its single re-authentication, and 1006 keeps its bounded retries.
  const other = setup(t); other.client.start(); refused(other.sockets[0], 'shared_room_unauthorized');
  await until(() => other.sockets.length === 2); assert.deepEqual(other.errors, []);
  const network = setup(t); network.client.start(); network.sockets[0].ended(1006);
  await until(() => network.sockets.length === 2); assert.deepEqual(network.errors, []);
});

test('chat frames reach onChat without touching snapshots; a malformed chat frame is an invalid state', async t => {
  const lines = [];
  const h = setup(t, { onChat: line => lines.push(line) });
  h.client.start();
  h.sockets[0].message({ type: 'shared-room-chat', roomId: 'room-a', lineId: 'a-' + '1'.repeat(24), requestId: 'chat-1', who: 'dealer', seat: null, text: 'Hej', at: 5 });
  h.sockets[0].message(frame()); await until(() => h.calls.length === 2);
  assert.deepEqual(lines, [{ lineId: 'a-' + '1'.repeat(24), requestId: 'chat-1', who: 'dealer', seat: null, text: 'Hej', at: 5 }]);
  assert.ok(Object.isFrozen(lines[0])); assert.deepEqual(h.calls, [['snapshot', 1, 100], ['present', 1]]);
  h.sockets[0].message({ type: 'shared-room-chat', roomId: 'room-a', lineId: 'q-' + '2'.repeat(24), requestId: 'chat-2', who: 'player', seat: 9, text: 'x', at: 6 });
  await until(() => h.errors.length === 1);
  assert.deepEqual(h.errors, [{ code: 'shared_room_invalid_state' }]); assert.equal(lines.length, 1);
});
