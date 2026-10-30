import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { createMovingSpeechRoomRelay } from '../services/game/moving-speech-room-relay.mjs';

// PR 4: one fake GPU session (chunks pushed by hand) feeds every listener at the table from one buffer.
const { WebSocket, WebSocketServer } = createRequire(new URL('../services/astrid-gpu-worker/gateway/package.json', import.meta.url))('ws');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) { for (let i = 0; i < 200; i++) { if (check()) return; await pause(5); } assert.fail('relay fixture did not settle'); }
const id = 'a'.repeat(32), planId = 'plan-1';
const chunk = (del, n) => [[JSON.stringify({ t: 'lapp', id: planId, del, fran: del * 12, rutor: Array.from({ length: n }, (_, k) => ({ ruta: k })) }), false], [Buffer.from([del, n, 7]), true]];

async function setup(t, options = {}) {
  const sessions = { alice: 'session-alice', bob: 'session-bob', carol: 'session-carol' };
  const relay = createMovingSpeechRoomRelay({ ticketSecret: 'fixture-only'.repeat(4), lifetimeMs: options.lifetimeMs ?? 60000,
    // A cookie names one player's session; another player's ticket never resolves to it.
    resolveOwner: async (req, playerId) => { const name = /player=(\w+)/.exec(req.headers.cookie ?? '')?.[1];
      if (name !== playerId) throw Error('stale_chat_session'); return sessions[name]; } });
  const wss = new WebSocketServer({ noServer: true }), server = createServer((req, res) => { res.writeHead(404); res.end(); });
  server.on('upgrade', async (req, socket, head) => {
    try {
      const ticket = String(req.headers['sec-websocket-protocol']).split(',').map(v => v.trim()).find(v => v.startsWith('ticket.')).slice(7);
      const listener = await relay.redeem(ticket, req);
      wss.handleUpgrade(req, socket, head, ws => { void relay.attach(listener, ws); });
    } catch { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = `ws://127.0.0.1:${server.address().port}/moving-speech-stream`, sockets = [];
  t.after(async () => { for (const socket of sockets) socket.terminate(); relay.close(); wss.close(); await new Promise(resolve => server.close(resolve)); });
  const broadcast = relay.open({ id, attemptId: 'attempt-1', nonce: 'nonce-1', planId, frames: 36, playbackMs: options.playbackMs ?? 0, owner: sessions.alice, playerId: 'alice', dealerId: 'paow', data: { rest: 'evidence' } });
  broadcast.push([[JSON.stringify({ t: 'ready', id }), false]]);
  broadcast.push([[JSON.stringify({ t: 'pcm', id, byteLength: 4 }), false], [Buffer.from([1, 2, 3, 4]), true]]);
  // Each room socket's lifetime: the channel aborts it when that socket closes.
  const room = {};
  const recipient = name => { room[name] ??= new AbortController(); return { owner: sessions[name], playerId: name, signal: room[name].signal }; };
  const connect = (ticket, name) => {
    const socket = new WebSocket(address, ['moving-v1', `ticket.${ticket}`], { headers: { cookie: `player=${name}` } });
    const messages = [], close = new Promise(resolve => socket.once('close', code => resolve(code)));
    socket.on('message', (data, binary) => messages.push(binary ? [...data] : JSON.parse(data.toString())));
    socket.on('error', () => {}); sockets.push(socket);
    const opened = new Promise(resolve => {
      socket.once('open', () => resolve(101));
      socket.once('unexpected-response', (_req, res) => { res.resume(); resolve(res.statusCode); });
    });
    return { socket, messages, close, opened, credit: frames => socket.send(JSON.stringify({ t: 'credit', id: planId, frames })) };
  };
  return { relay, broadcast, recipient, room, connect };
}

test('three listeners get identical ready, pcm and chunks; each one only as far as its own credit', async t => {
  const f = await setup(t);
  const [a, b, c] = ['alice', 'bob', 'carol'].map(name => f.connect(f.broadcast.issue(f.recipient(name)).ticket, name));
  for (const client of [a, b, c]) assert.equal(await client.opened, 101);
  await until(() => [a, b, c].every(client => client.messages.length === 3));
  for (const n of [0, 1, 2]) f.broadcast.push(chunk(n, 12), 12);
  f.broadcast.push([[JSON.stringify({ t: 'done', id: planId, frames: 36 }), false]]); f.broadcast.end();
  await pause(30);
  assert.equal(a.messages.length, 3, 'no chunk before credit');
  a.credit(24); b.credit(12);
  await until(() => a.messages.length === 7 && b.messages.length === 5);
  await pause(30);
  assert.equal(b.messages.length, 5, 'bob has credit for one chunk only');
  a.credit(12); b.credit(24);
  assert.equal(await a.close, 1000); assert.equal(await b.close, 1000);
  assert.deepEqual(a.messages, b.messages, 'one GPU session, identical output for every listener');
  assert.deepEqual(a.messages.at(-1), { t: 'done', id: planId, frames: 36 });
  assert.deepEqual(a.messages.filter(m => Array.isArray(m)).slice(1), [[0, 12, 7], [1, 12, 7], [2, 12, 7]]);
  // carol never sent credit: she still has her three opening messages and her own socket.
  assert.equal(c.messages.length, 3); assert.equal(c.socket.readyState, WebSocket.OPEN);
});

test('a listener that aborts, breaks the credit rules or leaves the room stops alone', async t => {
  const f = await setup(t);
  const clients = ['alice', 'bob', 'carol'].map(name => f.connect(f.broadcast.issue(f.recipient(name)).ticket, name));
  const [a, b, c] = clients;
  for (const client of clients) assert.equal(await client.opened, 101);
  await until(() => clients.every(client => client.messages.length === 3));
  f.broadcast.push(chunk(0, 12), 12);
  b.credit(49); f.room.carol.abort();
  assert.notEqual(await b.close, 1000); assert.notEqual(await c.close, 1000);
  a.credit(36); f.broadcast.push(chunk(1, 12), 12); f.broadcast.push(chunk(2, 12), 12);
  f.broadcast.push([[JSON.stringify({ t: 'done', id: planId, frames: 36 }), false]]); f.broadcast.end();
  assert.equal(await a.close, 1000);
  assert.equal(a.messages.filter(m => Array.isArray(m)).length, 4, 'pcm and all three chunks reached alice');
});

test('a ticket is single use and only for its own session and socket', async t => {
  const f = await setup(t);
  const forBob = f.broadcast.issue(f.recipient('bob')), forCarol = f.broadcast.issue(f.recipient('carol'));
  assert.notEqual(forBob.ticket, forCarol.ticket);
  assert.equal(await f.connect(forBob.ticket, 'alice').opened, 403, 'alice cannot redeem bob\'s ticket');
  assert.equal(await f.connect(forBob.ticket, 'bob').opened, 403, 'the attempt spent it');
  await assert.rejects(f.relay.authorizeRest(id, { headers: { cookie: 'player=bob' } }), /rest_unavailable/);
  f.room.carol.abort();
  assert.equal(await f.connect(forCarol.ticket, 'carol').opened, 403, 'carol\'s room socket closed: her ticket went with it');
  assert.equal(f.broadcast.issue(f.recipient('carol')), null, 'no ticket for a closed socket');
  const alice = f.broadcast.issue(f.recipient('alice'));
  const tampered = alice.ticket.slice(0, -1) + (alice.ticket.endsWith('A') ? 'B' : 'A');
  assert.equal(await f.connect(tampered, 'alice').opened, 403);
  const client = f.connect(alice.ticket, 'alice'); assert.equal(await client.opened, 101);
  assert.equal(await f.connect(alice.ticket, 'alice').opened, 403, 'no replay');
  assert.deepEqual(await f.relay.authorizeRest(id, { headers: { cookie: 'player=alice' } }), { rest: 'evidence' });
});

test('a late listener gets text: no ticket once the answer is played out or its buffer expired', async t => {
  const f = await setup(t);
  const a = f.connect(f.broadcast.issue(f.recipient('alice')).ticket, 'alice'); assert.equal(await a.opened, 101);
  for (const n of [0, 1, 2]) f.broadcast.push(chunk(n, 12), 12);
  f.broadcast.push([[JSON.stringify({ t: 'done', id: planId, frames: 36 }), false]]); f.broadcast.end();
  a.credit(36); assert.equal(await a.close, 1000);
  await until(() => f.relay.get(id) === null);
  assert.equal(f.broadcast.issue(f.recipient('bob')), null, 'bob joined after the answer: text only');
  const short = await setup(t, { lifetimeMs: 20 });
  await pause(40);
  assert.equal(short.broadcast.issue(short.recipient('bob')), null, 'the buffer lives at most lifetimeMs');
  assert.equal(short.relay.get(id), null);
});

test('more frames than the plan close the broadcast instead of buffering them', async t => {
  const f = await setup(t), a = f.connect(f.broadcast.issue(f.recipient('alice')).ticket, 'alice');
  assert.equal(await a.opened, 101);
  for (const n of [0, 1, 2]) assert.equal(f.broadcast.push(chunk(n, 12), 12), true);
  assert.equal(f.broadcast.push(chunk(3, 12), 12), false);
  assert.notEqual(await a.close, 1000); assert.equal(f.relay.get(id), null);
});

// Rättelser efter oberoende granskning (PR 4a).
test('a listener stuck in a send that never drains is terminated when the broadcast closes', async () => {
  const relay = createMovingSpeechRoomRelay({ ticketSecret: 'fixture-only'.repeat(4), resolveOwner: async () => 'o' });
  const b = relay.open({ id, attemptId: 'x', nonce: 'n', planId, frames: 12, owner: 'o', playerId: 'p1', dealerId: 'd' });
  b.push([['{"t":"ready"}', false]]);
  const listener = await relay.redeem(b.issue({ owner: 'o', playerId: 'p1' }).ticket, { headers: {} });
  const ws = Object.assign(new EventEmitter(), { readyState: 1, bufferedAmount: 0, terminated: false,
    send() { /* the TCP send never completes */ }, terminate() { this.terminated = true; this.readyState = 3; this.emit('close'); }, close() {} });
  let settled = false; const attached = relay.attach(listener, ws).finally(() => { settled = true; });
  await pause(20); assert.equal(settled, false);
  relay.cancel(() => true);
  assert.equal(ws.terminated, true); assert.equal(b.listeners.size, 1, 'still awaiting the send');
  await Promise.race([attached, pause(50)]);
});

test('redemption is refused when the recipient\'s own freshness check throws, and an aborted listener gets no rest frame', async t => {
  const f = await setup(t);
  let fresh = false;
  const bob = f.broadcast.issue({ ...f.recipient('bob'), check: async () => { if (!fresh) throw Error('stale_round_revision'); } });
  assert.equal(await f.connect(bob.ticket, 'bob').opened, 403, 'bob left the table: his ticket is refused');
  fresh = true;
  const carol = f.connect(f.broadcast.issue(f.recipient('carol')).ticket, 'carol'); assert.equal(await carol.opened, 101);
  assert.deepEqual(await f.relay.authorizeRest(id, { headers: { cookie: 'player=carol' } }), { rest: 'evidence' });
  f.room.carol.abort();
  await assert.rejects(f.relay.authorizeRest(id, { headers: { cookie: 'player=carol' } }), /rest_unavailable/, 'carol\'s room socket closed');
  // An aborted listener is refused before any read, and a socket closing during the check is refused after it.
  let checks = 0;
  const gone = new AbortController(), dave = f.broadcast.issue({ ...f.recipient('bob'), signal: gone.signal, check: async () => { checks++; } });
  gone.abort();
  await assert.rejects(f.relay.redeem(dave.ticket, { headers: { cookie: 'player=bob' } }), /moving_speech_ticket/); assert.equal(checks, 0);
  const leaving = new AbortController(), erin = f.broadcast.issue({ ...f.recipient('bob'), signal: leaving.signal, check: async () => { leaving.abort(); } });
  await assert.rejects(f.relay.redeem(erin.ticket, { headers: { cookie: 'player=bob' } }), /moving_speech_ticket/);
});


test('idle relay keeps each authorized socket until its own played ack, and rejects early or forged acknowledgements', async t => {
  for(const ack of [{t:'played',id:'wrong-plan'},{t:'played',id:planId,extra:true},{t:'played',id:planId}]){
    const f=await setup(t,{playbackMs:1000});
    const a=f.connect(f.broadcast.issue(f.recipient('alice')).ticket,'alice');await a.opened;
    await until(()=>a.messages.length===3);
    a.socket.send(JSON.stringify(ack));assert.notEqual(await a.close,1000,'no played ack before done');
  }
  const f=await setup(t,{playbackMs:1000});
  const a=f.connect(f.broadcast.issue(f.recipient('alice')).ticket,'alice'),b=f.connect(f.broadcast.issue(f.recipient('bob')).ticket,'bob');
  for(const client of [a,b]){await client.opened;client.credit(36);}
  for(const n of [0,1,2])f.broadcast.push(chunk(n,12),12);
  f.broadcast.push([[JSON.stringify({t:'done',id:planId,frames:36}),false]]);f.broadcast.end();
  await until(()=>[a,b].every(c=>c.messages.some(m=>m.t==='done')));
  a.socket.send(JSON.stringify({t:'played',id:planId}));assert.equal(await a.close,1000);
  assert.equal(b.socket.readyState,WebSocket.OPEN);
  f.relay.cancel(row=>row.dealerId==='paow');assert.notEqual(await b.close,1000);
});

test('idle ack never arriving has a hard transport plus playback bound even after producer done', async t => {
  const f=await setup(t,{lifetimeMs:80,playbackMs:30});
  const a=f.connect(f.broadcast.issue(f.recipient('alice')).ticket,'alice');await a.opened;a.credit(36);
  for(const n of [0,1,2])f.broadcast.push(chunk(n,12),12);
  f.broadcast.push([[JSON.stringify({t:'done',id:planId,frames:36}),false]]);f.broadcast.end();
  await until(()=>a.messages.some(m=>m.t==='done'));
  assert.equal(a.socket.readyState,WebSocket.OPEN);
  assert.notEqual(await a.close,1000);assert.equal(f.relay.get(id),null);
});
