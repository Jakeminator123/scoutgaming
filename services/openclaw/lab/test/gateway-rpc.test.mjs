import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { generateKeyPairSync, createPublicKey, createHash, verify } from 'node:crypto';
import { adminDeviceIdentity, withGatewayAdminRpc } from '../src/gateway-rpc.mjs';

// Existing CI installs this locked dependency; production uses Node's built-in WebSocket.
const { WebSocketServer } = createRequire(new URL('../../../astrid-gpu-worker/gateway/package.json', import.meta.url))('ws');
const key = 'fixturepass';
const { privateKey } = generateKeyPairSync('ed25519');
const encoded = privateKey.export({ format:'der', type:'pkcs8' }).toString('base64');
const identity = adminDeviceIdentity(encoded), scopes = ['operator.read', 'operator.admin'];
const hello = overrides => ({ type:'hello-ok', protocol:4, server:{ version:'2026.9.5', connId:'synthetic' },
  features:{ methods:['config.get', 'config.patch'], events:[] }, snapshot:{}, policy:{}, auth:{ role:'operator', scopes }, ...overrides });
async function fixture(t, { challenge = { nonce:'synthetic-challenge', ts:Date.now() }, connectError, helloOverrides, request } = {}) {
  const server = new WebSocketServer({ host:'127.0.0.1', port:0 });
  await once(server, 'listening');
  const frames = []; let connections = 0;
  server.on('connection', socket => {
    connections++;
    socket.send(JSON.stringify({ type:'event', event:'connect.challenge', payload:challenge }));
    socket.on('message', raw => {
      const frame = JSON.parse(String(raw)); frames.push(frame);
      if (frame.method === 'connect') {
        const params = frame.params;
        assert.equal(params.minProtocol, 4); assert.equal(params.maxProtocol, 4);
        assert.equal(params.auth.password, key); assert.equal(params.client.id, 'cli'); assert.equal(params.client.mode, 'backend');
        assert.equal(params.device.id, identity.id); assert.equal(params.device.nonce, challenge.nonce); assert.equal(params.device.signedAt, challenge.ts);
        assert.deepEqual(params.scopes, scopes);
        const payload = ['v3', identity.id, 'cli', 'backend', 'operator', scopes.join(','), String(challenge.ts), '', challenge.nonce, process.platform, ''].join('|');
        const publicKey = createPublicKey({ key:{ kty:'OKP', crv:'Ed25519', x:params.device.publicKey }, format:'jwk' });
        assert.equal(verify(null, Buffer.from(payload), publicKey, Buffer.from(params.device.signature, 'base64url')), true);
        socket.send(JSON.stringify(connectError ? { type:'res', id:frame.id, ok:false, error:connectError }
          : { type:'res', id:frame.id, ok:true, payload:hello(helloOverrides) }));
      } else if (request) request(socket, frame);
      else socket.send(JSON.stringify({ type:'res', id:frame.id, ok:true, payload:{ valid:true, hash:'synthetic' } }));
    });
  });
  t.after(async () => { for (const socket of server.clients) socket.terminate(); await new Promise(resolve => server.close(resolve)); });
  return { settings:{ baseUrl:`http://127.0.0.1:${server.address().port}`, gatewayKey:key, adminDeviceKey:encoded }, frames, connections:() => connections };
}

test('stable Ed25519 PKCS8 identity uses native sha256 raw public-key fingerprint; no automatic key generation', () => {
  assert.equal(adminDeviceIdentity(encoded).id, identity.id);
  assert.equal(identity.id, createHash('sha256').update(Buffer.from(identity.publicKey, 'base64url')).digest('hex'));
  for (const value of ['', 'invalid', encoded + '=', Buffer.from('not a key').toString('base64')]) {
    assert.throws(() => adminDeviceIdentity(value), { code:'openclaw_admin_device_not_configured' });
  }
});

test('existing 11-character Gateway password uses protocol4 and signed paired device before config RPC', async t => {
  assert.equal(key.length, 11);
  const f = await fixture(t);
  const result = await withGatewayAdminRpc(f.settings, async rpc => {
    assert.equal(rpc.version, '2026.9.5'); return rpc.call('config.get');
  });
  assert.deepEqual(result, { valid:true, hash:'synthetic' });
  assert.deepEqual(f.frames.map(frame => frame.method), ['connect', 'config.get']); assert.equal(f.connections(), 1);
});

test('native pairing rejection is surfaced safely without authentication fallback or retry', async t => {
  const f = await fixture(t, { connectError:{ code:'NOT_PAIRED', message:key, details:{ code:'PAIRING_REQUIRED', requestId:'fixture-request' } } });
  await assert.rejects(withGatewayAdminRpc(f.settings, rpc => rpc.call('config.get')), error => error.code === 'openclaw_admin_pairing_required' && !error.message.includes(key));
  assert.deepEqual(f.frames.map(frame => frame.method), ['connect']); assert.equal(f.connections(), 1);
});

test('effective scopes and exact deployed version are checked before any config method', async t => {
  for (const [overrides, code] of [[{ auth:{ role:'operator', scopes:[] } }, 'openclaw_admin_scope_required'],
    [{ server:{ version:'2026.9.6' } }, 'openclaw_admin_version_mismatch'], [{ protocol:3 }, 'openclaw_admin_version_mismatch']]) {
    const f = await fixture(t, { helloOverrides:overrides });
    await assert.rejects(withGatewayAdminRpc(f.settings, rpc => rpc.call('config.get')), { code });
    assert.deepEqual(f.frames.map(frame => frame.method), ['connect']);
  }
});

test('malformed native challenge cannot create a signed connect', async t => {
  for (const challenge of [{ nonce:'fixture', ts:-1 }, { nonce:'fixture' }, { nonce:'', ts:1 }]) {
    const f = await fixture(t, { challenge });
    await assert.rejects(withGatewayAdminRpc(f.settings, rpc => rpc.call('config.get')), { code:'openclaw_admin_unavailable' });
    assert.equal(f.frames.length, 0);
  }
});

test('RPC client never exposes chat, generic config replacement, secrets or pairing mutations', async t => {
  const f = await fixture(t);
  await withGatewayAdminRpc(f.settings, async rpc => {
    for (const method of ['chat.send', 'config.apply', 'config.set', 'secrets.resolve', 'device.pair.approve']) {
      await assert.rejects(rpc.call(method, { private:key }), { code:'openclaw_admin_unavailable' });
    }
  });
  assert.deepEqual(f.frames.map(frame => frame.method), ['connect']);
});

test('lost mutation acknowledgement is uncertain and sends exactly one config.patch, no reconnect', async t => {
  const f = await fixture(t, { request:socket => socket.close() });
  await assert.rejects(withGatewayAdminRpc(f.settings, rpc => rpc.call('config.patch', { baseHash:'fixture', raw:'{}' })), { code:'openclaw_admin_save_uncertain' });
  assert.deepEqual(f.frames.map(frame => frame.method), ['connect', 'config.patch']); assert.equal(f.connections(), 1);
});

test('native conflict and scope errors retain only safe actionable codes', async t => {
  for (const [error, code] of [[{ code:'INVALID_REQUEST', message:'config changed since last load; private synthetic data' }, 'openclaw_admin_conflict'],
    [{ code:'FORBIDDEN', message:'missing scope: operator.admin' }, 'openclaw_admin_scope_required']]) {
    const f = await fixture(t, { request:(socket, frame) => socket.send(JSON.stringify({ type:'res', id:frame.id, ok:false, error })) });
    await assert.rejects(withGatewayAdminRpc(f.settings, rpc => rpc.call('config.patch')), { code });
    assert.equal(f.connections(), 1);
  }
});

test('unresponsive peer reaches bounded deadline and fails before mutation without retry', async t => {
  // Keep the real deadline, but do not require CI to establish TCP within 40ms.
  // Native WebSocket tests above still cover the signed protocol and failures.
  for (const stage of ['before challenge', 'waiting for config.get']) await t.test(stage, async () => {
    const frames = []; let connections = 0, closed = 0, workStarted = false;
    class UnresponsiveSocket extends EventTarget {
      constructor() {
        super(); connections++;
        if (stage === 'waiting for config.get') queueMicrotask(() => this.message({
          type:'event', event:'connect.challenge', payload:{ nonce:'synthetic-challenge', ts:Date.now() },
        }));
      }
      message(frame) { this.dispatchEvent(new MessageEvent('message', { data:JSON.stringify(frame) })); }
      send(raw) {
        const frame = JSON.parse(raw); frames.push(frame);
        if (frame.method === 'connect') queueMicrotask(() => this.message({ type:'res', id:frame.id, ok:true, payload:hello() }));
      }
      close() { closed++; }
    }
    const settings = { baseUrl:'http://127.0.0.1', gatewayKey:key, adminDeviceKey:encoded };
    await assert.rejects(withGatewayAdminRpc(settings, async rpc => {
      workStarted = true;
      await rpc.call('config.get');
      await rpc.call('config.patch', { baseHash:'fixture', raw:'{}' });
    }, { WebSocketImpl:UnresponsiveSocket, timeoutMs:40 }), { code:'openclaw_admin_unavailable' });
    assert.equal(workStarted, stage === 'waiting for config.get');
    assert.deepEqual(frames.map(frame => frame.method), workStarted ? ['connect', 'config.get'] : []);
    assert.equal(connections, 1); assert.equal(closed, 1);
  });
});

test('missing server identity and invalid public plaintext endpoint cannot open a connection', async () => {
  let connected = 0;
  class ForbiddenSocket { constructor() { connected++; } }
  for (const settings of [{ gatewayKey:key, baseUrl:'http://127.0.0.1', adminDeviceKey:'' },
    { gatewayKey:key, baseUrl:'http://public.example.invalid', adminDeviceKey:encoded },
    { gatewayKey:key, baseUrl:'https://user:pass@example.invalid', adminDeviceKey:encoded }]) {
    await assert.rejects(withGatewayAdminRpc(settings, () => {}, { WebSocketImpl:ForbiddenSocket }));
  }
  assert.equal(connected, 0);
});

test('empty, whitespace-only and multiline Gateway passwords never open a socket', async () => {
  let connected = 0;
  class ForbiddenSocket { constructor() { connected++; } }
  for (const gatewayKey of ['', '   ', `${key}\r\n`]) {
    await assert.rejects(withGatewayAdminRpc({ gatewayKey, baseUrl:'http://127.0.0.1', adminDeviceKey:encoded }, () => {}, { WebSocketImpl:ForbiddenSocket }), { code:'openclaw_admin_not_configured' });
  }
  assert.equal(connected, 0);
});
