import { randomUUID } from 'node:crypto';
import { studioCommandSignature } from '../../packages/shared/studio-game-command.mjs';
import { validateStudioScope, canonicalStudioJson } from '../../packages/studio-registry/server/document-contract.mjs';
import { normalizeStudioRole } from './studio-access-policy.mjs';

// Retain the established import path for existing Studio callers.
export { studioCommandSignature };

const actions = new Set(['players/password', 'players/status', 'apikeys/revoke', 'apikeys/rotate', 'apikeys/launch', 'apikeys/credit']);
const fail = (statusCode = 503) => { throw Object.assign(new Error('studio_game_authority_unavailable'), { statusCode }); };
function origin(value) {
  let url; try { url = new URL(value); } catch { fail(); }
  if (url.origin !== value || url.protocol !== 'https:' || url.username || url.password || ['localhost','127.0.0.1','[::1]'].includes(url.hostname)) fail();
  return value;
}
// This boundary transports commands to the engine. It never changes a wallet
// or player status on Vercel and never retries an uncertain mutation.
export function createStudioGameAuthority({ env = process.env, scope, fetchImpl = fetch, now = Date.now } = {}) {
  scope = validateStudioScope(scope);
  const publicOrigin = origin(env.CROUPIER_PUBLIC_ORIGIN), backendOrigin = origin(env.CROUPIER_BACKEND_ORIGIN);
  const secret = env.CROUPIER_VERCEL_INGRESS_SECRET;
  if (publicOrigin === backendOrigin || typeof secret !== 'string' || Buffer.byteLength(secret) < 32 || /[\r\n]/.test(secret)) fail();
  return Object.freeze({ async execute({ action, body, actor, scope: requestedScope, request }) {
    if (!actions.has(action) || canonicalStudioJson(validateStudioScope(requestedScope)) !== canonicalStudioJson(scope)
      || !request?.headers || !actor?.user || !normalizeStudioRole(actor?.role)) fail(403);
    const cookie = request.headers.get('cookie') || '';
    if (!cookie || cookie.length > 16384) fail(401);
    const payload = canonicalStudioJson({ action, body, actor: { user: actor.user, role: normalizeStudioRole(actor.role) }, scope, commandId: randomUUID() });
    if (Buffer.byteLength(payload) > 16384) fail(413);
    const timestamp = String(now());
    let response;
    try {
      response = await fetchImpl(`${backendOrigin}/api/studio-game/command`, {
        method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000), body: payload,
        headers: { cookie, origin: publicOrigin, 'content-type': 'application/json', accept: 'application/json',
          'x-croupier-vercel-secret': secret, 'x-croupier-public-origin': publicOrigin,
          'x-forwarded-host': new URL(publicOrigin).host, 'x-forwarded-proto': 'https',
          'x-croupier-studio-timestamp': timestamp, 'x-croupier-studio-signature': studioCommandSignature(secret, timestamp, payload) },
      });
    } catch { fail(); }
    if (!response.ok) { await response.body?.cancel(); fail([400,401,403,404,409,422,423].includes(response.status) ? response.status : 503); }
    if (!response.headers.get('content-type')?.startsWith('application/json')) { await response.body?.cancel(); fail(); }
    let raw = ''; try {
      const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
      while (true) { const { value, done } = await reader.read(); if (done) break; raw += decoder.decode(value, { stream: true }); if (Buffer.byteLength(raw) > 32768) { await reader.cancel(); fail(); } }
      raw += decoder.decode();
      const result = JSON.parse(raw);
      if (result?.ok !== true || result.authority !== 'render' || canonicalStudioJson(result.scope) !== canonicalStudioJson(scope)) fail();
      if (action === 'players/password') {
        if (result.id !== body?.playerId || result.changed !== true) fail();
        return { ok: true, id: result.id, changed: true };
      }
      return result;
    } catch { fail(); }
  } });
}
