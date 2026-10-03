import { STUDIO_ADMIN_ENDPOINTS, studioAdminEndpoint } from './studio-admin-contract.mjs';
import { isStudioRole, studioRoleMeetsMinimum } from './studio-access-policy.mjs';
import { validateStudioScope } from '../../web/storage/studio-contract.mjs';

const MAX_BODY = 64 * 1024;
const renderActions = new Set(['players/status', 'apikeys/revoke', 'apikeys/rotate', 'apikeys/launch', 'apikeys/credit']);
const publicErrors = new Map([[400, 'Invalid request'], [401, 'Authentication required'], [403, 'Access denied'], [404, 'Not found'], [405, 'Method not allowed'], [413, 'Request too large'], [415, 'JSON required'], [409, 'Conflict'], [422, 'Invalid data'], [423, 'Resource busy'], [503, 'Action unavailable'], [500, 'Request failed']]);
function failure(status) { return Object.assign(new Error(publicErrors.get(status)), { statusCode: status }); }
function json(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
}
function sessionActor(session) {
  if (!session || typeof session.user !== 'string' || !session.user.trim() || !isStudioRole(session.role)) throw failure(401);
  return Object.freeze({ user: session.user, role: session.role });
}
async function readObject(request) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') || '')) throw failure(415);
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY)) throw failure(length && /^\d+$/.test(length) ? 413 : 400);
  const reader = request.body?.getReader();
  if (!reader) throw failure(400);
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); throw failure(413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body;
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw failure(400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw failure(400);
  if (['actor', 'scope', 'session'].some(key => Object.hasOwn(body, key))) throw failure(400);
  return body;
}

/** Dependency-only factory. It neither installs routes nor creates an identity/store. */
export function createStudioAdminApi({ authorize, allowedOrigins, publicHosts, handlers, gates = new Map(), apiBase = '/studio/api/admin', mutationTransaction }) {
  if (!['/studio/api/admin', '/api/admin'].includes(apiBase)) throw new TypeError('Invalid admin API base');
  if (typeof authorize !== 'function' || !(handlers instanceof Map) || !(gates instanceof Map)
    || !Array.isArray(allowedOrigins) || !allowedOrigins.length || !Array.isArray(publicHosts) || !publicHosts.length) throw new TypeError('Explicit admin dependencies required');
  const origins = new Set(allowedOrigins);
  const hosts = new Set(publicHosts);
  for (const origin of origins) { const url = new URL(origin); if (url.origin !== origin || url.username || url.password || !['http:', 'https:'].includes(url.protocol)) throw new TypeError('Invalid allowed origin'); }
  for (const host of hosts) { if (typeof host !== 'string' || new URL(`https://${host}`).host !== host || /[\s/@?#]/.test(host)) throw new TypeError('Invalid public host'); }
  // Snapshot trusted registrations so later mutation cannot widen this factory.
  const registered = new Map(handlers); const requirements = new Map(gates);
  for (const [key, handler] of registered) {
    if (typeof handler !== 'function' || !STUDIO_ADMIN_ENDPOINTS.some(endpoint => `${endpoint.method} ${endpoint.path}` === key)) throw new TypeError('Unknown admin handler');
  }
  const ready = endpoint => (endpoint.method === 'GET' || renderActions.has(endpoint.action) || typeof mutationTransaction === 'function')
    && typeof registered.get(`${endpoint.method} ${endpoint.path}`) === 'function'
    && endpoint.handlerRequirements.every(requirement => typeof requirements.get(requirement) === 'function');
  function availableActions(session) {
    let actor; try { actor = sessionActor(session); } catch { return []; }
    return STUDIO_ADMIN_ENDPOINTS.filter(endpoint => ready(endpoint) && studioRoleMeetsMinimum(actor.role, endpoint.minimumRole)).map(endpoint => `${endpoint.method} ${endpoint.action}`);
  }
  async function handle(request) {
    try {
      const url = new URL(request.url);
      if (!hosts.has(url.host) || !origins.has(url.origin) || url.username || url.password) throw failure(403);
      for (const header of ['host', 'x-forwarded-host']) { const value = request.headers.get(header); if (value !== null && value !== url.host) throw failure(403); }
      if (url.pathname.includes('%') || url.pathname.includes('\\') || url.search || url.hash) throw failure(404);
      if (!url.pathname.startsWith(`${apiBase}/`)) throw failure(404);
      const canonicalPath = `/studio/api/admin${url.pathname.slice(apiBase.length)}`;
      const matches = STUDIO_ADMIN_ENDPOINTS.filter(endpoint => endpoint.path === canonicalPath);
      if (!matches.length) throw failure(404);
      const endpoint = studioAdminEndpoint(request.method, canonicalPath);
      if (!endpoint) return json({ error: publicErrors.get(405) }, 405, { Allow: [...new Set(matches.map(item => item.method))].join(', ') });
      const session = await authorize(request);
      const actor = sessionActor(session);
      if (!studioRoleMeetsMinimum(actor.role, endpoint.minimumRole)) throw failure(403);
      // Trusted authorization owns the scope; copy its validated scalar fields
      // before async input/gates so handlers never share a mutable session scope.
      const scope = validateStudioScope(session.scope);
      if (request.method !== 'GET') {
        if (request.headers.get('origin') !== url.origin || !origins.has(request.headers.get('origin'))
          || !['same-origin', 'none'].includes(request.headers.get('sec-fetch-site'))) throw failure(403);
      }
      if (!ready(endpoint)) throw failure(503);
      const body = request.method === 'GET' ? null : await readObject(request);
      if (['users/role', 'users/remove'].includes(endpoint.action)) {
        if (typeof body.username !== 'string' || !body.username.trim()) throw failure(400);
        if (body.username.trim().toLowerCase() === actor.user.trim().toLowerCase()) throw failure(403);
        if (endpoint.action === 'users/role' && !isStudioRole(body.role)) throw failure(400);
      }
      const localMutation = request.method !== 'GET' && !renderActions.has(endpoint.action);
      const deferred = []; let queueOpen = true;
      const context = Object.freeze({ request, body, actor, scope, endpoint,
        ...(localMutation ? { afterCommit(work) {
          if (!queueOpen || typeof work !== 'function' || deferred.length >= 10) throw failure(503);
          deferred.push(work);
        } } : {}) });
      const refresh = async () => {
        const current = await authorize(request), principal = sessionActor(current), currentScope = validateStudioScope(current.scope);
        if (principal.user !== actor.user || principal.role !== actor.role
          || !studioRoleMeetsMinimum(principal.role, endpoint.minimumRole)
          || currentScope.environment !== scope.environment || currentScope.workspaceId !== scope.workspaceId) throw failure(403);
      };
      // Input and gates may yield for an arbitrary time. Recheck the cookie's
      // fingerprint/epoch before any mutation capability observes this actor.
      if (request.method !== 'GET') await refresh();
      for (const requirement of endpoint.handlerRequirements) {
        if (await requirements.get(requirement)(context) !== true) throw failure(403);
      }
      const invoke = async () => {
        if (request.method !== 'GET') await refresh();
        const value = await registered.get(`${endpoint.method} ${endpoint.path}`)(context);
        if (value === undefined || value instanceof Response) throw failure(503);
        return value;
      };
      // Render revalidates inside its own product transaction. Local mutations
      // hold that same product lock while validating current identity and writing.
      const result = localMutation ? await mutationTransaction(invoke) : await invoke();
      queueOpen = false;
      // Mail is an effect of committed identity state. Never send a token whose
      // surrounding transaction may still roll back or hold the product lock.
      for (const work of deferred) await work();
      return json(result);
    } catch (error) {
      const status = publicErrors.has(error?.statusCode) ? error.statusCode : 500;
      return json({ error: publicErrors.get(status) }, status);
    }
  }
  return Object.freeze({ handle, availableActions });
}
