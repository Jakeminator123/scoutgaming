import { OpenClawAdminError } from '../../../../packages/director/admin-error.mjs';
import { createHash, createPrivateKey, createPublicKey, randomUUID, sign } from 'node:crypto';
import { isLoopback } from '../../../../packages/director/configuration.mjs';

// Wire contract: official openclaw/openclaw v2026.9.5
// packages/gateway-protocol/src/version.ts (4), frames.ts,
// packages/gateway-client/src/device-auth.ts (challenge-bound v3 signature).
const SCOPES = Object.freeze(['operator.read', 'operator.admin']);
const METHODS = new Set(['config.get', 'config.patch']);
const fail = (code, status) => { throw new OpenClawAdminError(code, status); };
export function adminDeviceIdentity(encoded) {
  try {
    if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length > 512) throw Error();
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.toString('base64') !== encoded) throw Error();
    const key = createPrivateKey({ key:bytes, format:'der', type:'pkcs8' });
    if (key.asymmetricKeyType !== 'ed25519') throw Error();
    const publicKey = createPublicKey(key).export({ format:'jwk' });
    const raw = Buffer.from(publicKey.x, 'base64url');
    return { key, id:createHash('sha256').update(raw).digest('hex'), publicKey:raw.toString('base64url') };
  } catch { fail('openclaw_admin_device_not_configured'); }
}
function socketUrl(base) {
  let url; try { url = new URL(base); } catch { fail('openclaw_admin_not_configured'); }
  const privateHost = isLoopback(url.hostname) || /^[a-z0-9-]+(?:\.internal)?$/i.test(url.hostname);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash
    || !['/', '/v1', '/v1/'].includes(url.pathname) || url.protocol === 'http:' && !privateHost) fail('openclaw_admin_not_configured');
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; url.pathname = '/';
  return url.href;
}
function rpcFailure(error, method) {
  const detail = error?.details?.code;
  if (detail === 'PAIRING_REQUIRED' || error?.code === 'NOT_PAIRED') return new OpenClawAdminError('openclaw_admin_pairing_required');
  if (detail === 'AUTH_SCOPE_MISMATCH' || /missing scope/i.test(error?.message || '')) return new OpenClawAdminError('openclaw_admin_scope_required');
  if (method === 'config.patch' && /config (?:changed|base hash)|mutation conflict/i.test(error?.message || '')) return new OpenClawAdminError('openclaw_admin_conflict', 409);
  return new OpenClawAdminError(method === 'config.patch' ? 'openclaw_admin_save_uncertain' : 'openclaw_admin_unavailable');
}

/** One bounded signed connection, no retry/token persistence/pairing mutation. */
export async function withGatewayAdminRpc(settings, work, { WebSocketImpl = WebSocket, timeoutMs = 30000 } = {}) {
  // Same existing password contract as deploy/requireGatewaySecrets; device
  // pairing and effective scopes supply the additional admin-client boundary.
  if (typeof settings?.gatewayKey !== 'string' || !settings.gatewayKey.trim()
    || /[\r\n]/.test(settings.gatewayKey)) fail('openclaw_admin_not_configured');
  const password = settings.gatewayKey.trim();
  const device = adminDeviceIdentity(settings.adminDeviceKey), endpoint = socketUrl(settings.baseUrl);
  let socket;
  try { socket = new WebSocketImpl(endpoint); } catch { fail('openclaw_admin_unavailable'); }
  let finished = false, connected = false, challengeSent = false, mutationSent = false, hello;
  const pending = new Map(), connectId = randomUUID();
  let readyResolve, readyReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const finish = error => {
    if (finished) return; finished = true; clearTimeout(timer);
    readyReject(error);
    for (const request of pending.values()) request.reject(error); pending.clear();
    try { socket.close(); } catch {}
  };
  const timer = setTimeout(() => finish(new OpenClawAdminError(mutationSent ? 'openclaw_admin_save_uncertain' : 'openclaw_admin_unavailable')), timeoutMs);
  socket.addEventListener('error', () => finish(new OpenClawAdminError(mutationSent ? 'openclaw_admin_save_uncertain' : 'openclaw_admin_unavailable')));
  socket.addEventListener('close', () => finish(new OpenClawAdminError(mutationSent ? 'openclaw_admin_save_uncertain' : 'openclaw_admin_unavailable')));
  socket.addEventListener('message', event => {
    if (finished) return;
    try {
      if (typeof event.data !== 'string' || Buffer.byteLength(event.data) > 1024 * 1024) fail('openclaw_admin_unavailable');
      const frame = JSON.parse(event.data);
      if (frame.type === 'event' && frame.event === 'connect.challenge' && !challengeSent) {
        const { nonce, ts } = frame.payload || {};
        if (typeof nonce !== 'string' || !nonce || nonce.length > 512 || !Number.isSafeInteger(ts) || ts < 0) fail('openclaw_admin_unavailable');
        challengeSent = true;
        const payload = ['v3', device.id, 'cli', 'backend', 'operator', SCOPES.join(','), String(ts), '', nonce, process.platform, ''].join('|');
        socket.send(JSON.stringify({ type:'req', id:connectId, method:'connect', params:{ minProtocol:4, maxProtocol:4,
          client:{ id:'cli', displayName:'Croupier Studio server admin', version:'1', platform:process.platform, mode:'backend' },
          role:'operator', scopes:SCOPES, caps:[], auth:{ password },
          device:{ id:device.id, publicKey:device.publicKey, signedAt:ts, nonce, signature:sign(null, Buffer.from(payload), device.key).toString('base64url') },
        } }));
      } else if (frame.type === 'res' && frame.id === connectId && !connected) {
        if (frame.ok !== true) throw rpcFailure(frame.error, 'connect');
        hello = frame.payload;
        if (hello?.type !== 'hello-ok' || hello.protocol !== 4 || hello.server?.version !== '2026.9.5') fail('openclaw_admin_version_mismatch');
        if (hello.auth?.role !== 'operator' || !Array.isArray(hello.auth.scopes) || !SCOPES.every(scope => hello.auth.scopes.includes(scope))) fail('openclaw_admin_scope_required');
        if (!Array.isArray(hello.features?.methods) || ![...METHODS].every(method => hello.features.methods.includes(method))) fail('openclaw_admin_unavailable');
        connected = true; readyResolve();
      } else if (frame.type === 'res' && pending.has(frame.id)) {
        const request = pending.get(frame.id); pending.delete(frame.id);
        if (frame.ok === true) request.resolve(frame.payload); else request.reject(rpcFailure(frame.error, request.method));
      }
    } catch (error) { finish(error instanceof OpenClawAdminError ? error : new OpenClawAdminError()); }
  });
  try {
    await ready;
    const rpc = Object.freeze({ version:hello.server.version,
      call(method, params = {}) {
        if (!METHODS.has(method) || !connected || finished) return Promise.reject(new OpenClawAdminError());
        const id = randomUUID();
        return new Promise((resolve, reject) => {
          pending.set(id, { resolve, reject, method });
          if (method === 'config.patch') mutationSent = true;
          try { socket.send(JSON.stringify({ type:'req', id, method, params })); }
          catch { finish(new OpenClawAdminError(mutationSent ? 'openclaw_admin_save_uncertain' : 'openclaw_admin_unavailable')); }
        });
      },
    });
    return await work(rpc);
  } finally { finish(new OpenClawAdminError()); }
}
