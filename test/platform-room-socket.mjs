import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setImmediate as turn } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';

// Exercise the current checkout, including the speech package's public imports.
// A process-local resolver avoids package copies/junctions in detached worktrees.
const require = createRequire(new URL('../apps/speech/package.json', import.meta.url));
const wsUrl = new URL('wrapper.mjs', pathToFileURL(require.resolve('ws/package.json'))).href;
assert.equal(require('ws/package.json').version, '8.22.0');
const hook = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'ws') return next(wsUrl, context);
  if (specifier.startsWith('@croupier/server-transport/')) return next(new URL('../packages/server-transport/' + specifier.split('/').at(-1) + '.mjs', import.meta.url).href, context);
  return next(specifier, context);
} });
let createSpeechIngress;
try { ({ createSpeechIngress } = await import('../apps/speech/service.mjs')); } finally { hook.deregister(); }

const env = { CROUPIER_VERCEL_UI: '1', CROUPIER_PUBLIC_ORIGIN: 'https://player.example.test',
  CROUPIER_BACKEND_ORIGIN: 'https://engine.example.test',
  CROUPIER_VERCEL_INGRESS_SECRET: 'isolated-ingress-fixture-'.repeat(3) };
const headers = { upgrade: 'websocket', connection: 'Upgrade', host: 'player.example.test',
  origin: env.CROUPIER_PUBLIC_ORIGIN, cookie: 'player_session=fixture',
  'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==', 'sec-websocket-version': '13' };
const req = (url = '/shared-room/room-a', extra = {}) => Object.assign(new EventEmitter(), { method: 'GET', url, headers: { ...headers, ...extra } });
class Raw extends EventEmitter {
  destroyed = false; writes = []; upgraded = false;
  end(value) { this.writes.push(value); this.destroy(); }
  destroy() { if (!this.destroyed) { this.destroyed = true; this.emit('close'); } }
}
class Peer extends EventEmitter {
  readyState = 0; bufferedAmount = 0; protocol = ''; sent = []; closes = [];
  send(data, options, callback) { this.sent.push({ data, options }); callback?.(); }
  close(code = 1000) { if (this.readyState === 3) return; this.closes.push(code); this.readyState = 3; this.emit('close', code); }
  terminate() { this.close(1006); }
}
async function until(check) { for (let i = 0; i < 50; i++) { if (check()) return; await turn(); } assert.fail('Expected transport event did not arrive'); }
function setup(t, options = {}) {
  const upstreams = [], servers = [], frontends = [];
  class Backend extends Peer {
    constructor(url, protocols, settings) { super(); Object.assign(this, { url, protocols, settings }); upstreams.push(this); }
    open() { this.readyState = 1; this.emit('open'); }
  }
  class Server {
    constructor(settings) { this.settings = settings; this.closed = false; servers.push(this); }
    handleUpgrade(request, raw, head, attach) {
      if (this.closed) throw Error('Server closed');
      const frontend = new Peer(); frontend.readyState = 1; frontend.request = request; frontend.head = head;
      frontend.once('close', () => raw.destroy()); frontends.push(frontend); raw.upgraded = true; attach(frontend);
    }
    close() { this.closed = true; }
  }
  const service = createSpeechIngress({ env, WebSocketImpl: Backend, WebSocketServerImpl: Server,
    bridgeOptions: { closeTimeoutMs: 10 }, ...options });
  t.after(async () => { service.emit('close'); for (const upstream of upstreams) upstream.terminate(); for (const frontend of frontends) frontend.terminate(); await turn(); });
  function upgrade(request = req()) { const raw = new Raw(); service.emit('upgrade', request, raw, Buffer.alloc(0)); return raw; }
  return { service, upgrade, upstreams, servers, frontends };
}

test('deployment routes the dynamic room path to the existing speech service before the catch-all', async () => {
  const deployment = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const at = deployment.rewrites.findIndex(rule => rule.source === '/shared-room/:path*');
  assert.ok(at >= 0 && at < deployment.rewrites.findIndex(rule => rule.source === '/(.*)'));
  assert.deepEqual(deployment.rewrites[at].destination, { service: 'speech' });
  assert.equal(deployment.services.speech.entrypoint, 'server.mjs');
});

test('room path and cookie reach the backend unchanged; authenticated upstream101 precedes public upgrade', async t => {
  const h = setup(t), request = req('/shared-room/room:alpha.v_2'), raw = h.upgrade(request);
  assert.equal(h.service.listening, false); assert.equal(h.upstreams.length, 1); assert.equal(raw.upgraded, false);
  const upstream = h.upstreams[0];
  assert.equal(upstream.url, 'wss://engine.example.test/shared-room/room:alpha.v_2');
  assert.deepEqual(upstream.protocols, []); assert.equal(upstream.settings.headers.cookie, headers.cookie);
  assert.equal(upstream.settings.headers.origin, env.CROUPIER_PUBLIC_ORIGIN);
  assert.equal(upstream.settings.headers['x-croupier-vercel-secret'], env.CROUPIER_VERCEL_INGRESS_SECRET);
  assert.equal(upstream.settings.headers.authorization, undefined); assert.equal(upstream.settings.headers['x-worker-id'], undefined);
  assert.equal(upstream.settings.maxPayload, 256 * 1024); assert.equal(upstream.settings.followRedirects, false); assert.equal(upstream.settings.perMessageDeflate, false);
  await turn(); assert.equal(raw.upgraded, false);
  upstream.open(); await until(() => raw.upgraded);
  assert.equal(h.frontends.length, 1); assert.equal(h.frontends[0].request, request);
  const roomSettings = h.servers.find(server => server.settings.maxPayload === 1024).settings;
  assert.equal(roomSettings.noServer, true); assert.equal(roomSettings.perMessageDeflate, false);
  assert.equal(roomSettings.handleProtocols(new Set(['astrid-v2'])), false);
});

test('query, hash, encoding, alias and invalid room ids fail before any backend request', async t => {
  const h = setup(t);
  for (const path of ['/shared-room', '/shared-room/', '/shared-room/a/', '/shared-room/a?actorId=other', '/shared-room/a?',
    '/shared-room/a#fragment', '/shared-room/%61', '/shared-room/../a', '/shared-room/a/b', '/shared-room/' + 'a'.repeat(129),
    '/api/shared-room/a', '/studio/shared-room/a', '/%73hared-room/a']) {
    const raw = h.upgrade(req(path)); await turn(); assert.equal(raw.upgraded, false, path);
    assert.match(raw.writes.join(''), /^HTTP\/1.1 (400|404) /, path);
  }
  assert.equal(h.upstreams.length, 0);
});

test('room requires exact browser origin/cookie and rejects worker credentials or subprotocols', async t => {
  const h = setup(t);
  for (const extra of [{ host: 'foreign.example.test' }, { host: undefined }, { origin: 'https://foreign.example.test' }, { origin: undefined }, { cookie: undefined },
    { cookie: 'x'.repeat(16385) }, { 'sec-websocket-protocol': 'astrid-v2' },
    { authorization: 'Bearer worker', 'x-worker-id': 'worker-a' }]) {
    const raw = h.upgrade(req(undefined, extra)); await turn(); assert.equal(raw.upgraded, false);
    assert.match(raw.writes.join(''), /^HTTP\/1.1 (401|403) /);
  }
  assert.equal(h.upstreams.length, 0);
});

test('backend auth failure and aborted handshakes never produce public101', async t => {
  const h = setup(t), rejected = h.upgrade();
  let resumed = false;
  h.upstreams[0].emit('unexpected-response', {}, { statusCode: 403, resume() { resumed = true; } });
  await until(() => rejected.writes.length > 0); assert.equal(resumed, true); assert.equal(rejected.upgraded, false);
  assert.match(rejected.writes[0], /^HTTP\/1.1 403 /);
  const abandoned = h.upgrade(); abandoned.destroy(); await turn();
  assert.equal(h.upstreams[1].readyState, 3); assert.equal(abandoned.upgraded, false);
  assert.equal(h.frontends.length, 0);
});

test('bounded room frames pass through; backend close, backpressure and service shutdown release both peers', async t => {
  const h = setup(t), raw = h.upgrade(); h.upstreams[0].open(); await until(() => raw.upgraded);
  const upstream = h.upstreams[0], frontend = h.frontends[0], frame = Buffer.from('{"type":"shared-room-state"}');
  upstream.emit('message', frame, false); assert.equal(frontend.sent[0].data, frame);
  frontend.bufferedAmount = 256 * 1024; upstream.emit('message', Buffer.from('x'), false);
  assert.ok(frontend.closes.includes(1013)); assert.ok(upstream.closes.includes(1013));
  const next = h.upgrade(); h.upstreams[1].open(); await until(() => next.upgraded);
  h.upstreams[1].close(1008); assert.ok(h.frontends[1].closes.includes(1008));
  const last = h.upgrade(); h.upstreams[2].open(); await until(() => last.upgraded);
  h.service.emit('close'); await turn();
  assert.equal(h.upstreams[2].readyState, 3); assert.equal(h.frontends[2].readyState, 3);
  assert.ok(h.servers.every(server => server.closed)); assert.equal(h.service.listening, false);
});

test('existing speech tickets, moving capabilities and worker bearer gates still reject invalid admission', async t => {
  const h = setup(t);
  for (const [path, extra] of [
    ['/speech-stream', {}], ['/moving-speech-stream', {}], ['/lipsync-worker', { cookie: undefined, origin: undefined }],
    ['/lipsync-moving/' + 'a'.repeat(48) + '?token=' + 'b'.repeat(64) + '&avatar=dragan', {}],
  ]) {
    const raw = h.upgrade(req(path, extra)); await turn(); assert.equal(raw.upgraded, false);
    assert.match(raw.writes.join(''), /^HTTP\/1.1 (401|403) /);
  }
  assert.equal(h.upstreams.length, 0);
  assert.ok(h.servers.some(server => server.settings.handleProtocols(new Set(['astrid-v2'])) === 'astrid-v2'));
  assert.ok(h.servers.some(server => server.settings.handleProtocols(new Set(['moving-v1'])) === 'moving-v1'));
});


test('duplicate authority/cookie headers and oversized early frames fail before backend admission',async t=>{
  const h=setup(t);
  for(const name of ['Host','Origin','Cookie','Sec-WebSocket-Key','Sec-WebSocket-Protocol']) {
    const request=req();request.rawHeaders=[name,'first',name.toLowerCase(),'second'];const raw=h.upgrade(request);await turn();
    assert.equal(raw.upgraded,false);assert.match(raw.writes.join(''),/^HTTP\/1.1 403 /);
  }
  const raw=new Raw();h.service.emit('upgrade',req(),raw,Buffer.alloc(1039));await turn();assert.equal(raw.upgraded,false);assert.match(raw.writes.join(''),/^HTTP\/1.1 403 /);
  h.service.emit('close');const stopped=h.upgrade();await turn();assert.match(stopped.writes.join(''),/^HTTP\/1.1 503 /);
  assert.equal(h.upstreams.length,0);
});
