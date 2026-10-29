import {NATIVE_FILMED_PLANNING_MUTATION} from './presentation-runtime-readiness.mjs';
import {ROOM_RELEASE_ACTION,roomReleaseErrorBody} from './room-release.mjs';
import { STUDIO_ADMIN_ENDPOINTS, studioAdminEndpoint, isPresentationRoomReadQuery } from './studio-admin-contract.mjs';
import { normalizeStudioRole, studioRoleMeetsMinimum } from './studio-access-policy.mjs';
import { validateStudioScope } from '../../../packages/studio-registry/server/document-contract.mjs';
import { PRESENTATION_RUNTIME_UPDATE_REQUIRED, PRESENTATION_RUNTIME_UPDATE_MESSAGE } from './presentation-runtime-readiness.mjs';

import { publicMovingDriftError } from '../../../packages/presentation/contracts/moving-drift-admin.mjs';
import { StudioStorageError } from '../../../packages/studio-access/studio-scope.mjs';
import { logStudioServerFailure } from './studio-error-log.mjs';
import { aiTableMisfitBody } from './ai-table-publication-guard.mjs';

const MAX_BODY = 64 * 1024;
const administrationMutations = new Set(['tier','room','game-lane','game-lanes/create','game-lanes/remove','room-state','room-lifecycle','clip-landing','clip-never','gen-landing','gen-verdict']);
const renderActions = new Set(['players/password', 'players/status', 'apikeys/revoke', 'apikeys/rotate', 'apikeys/launch', 'apikeys/credit']);
const publicErrors = new Map([[400, 'Invalid request'], [401, 'Authentication required'], [403, 'Access denied'], [404, 'Not found'], [405, 'Method not allowed'], [413, 'Request too large'], [415, 'JSON required'], [409, 'Conflict'], [422, 'Invalid data'], [423, 'Resource busy'], [429, 'Too many attempts'], [503, 'Action unavailable'], [500, 'Request failed']]);
function failure(status) { return Object.assign(new Error(publicErrors.get(status)), { statusCode: status }); }
function json(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
}
function sessionActor(session) {
  if (!session || typeof session.user !== 'string' || !session.user.trim()) throw failure(401);
  const role = normalizeStudioRole(session.role);
  if (!role) throw failure(403);
  return Object.freeze({ user: session.user, role, ...(session.accountId ? { accountId: String(session.accountId) } : {}) });
}
function readActorHeaders(actor) {
  if (actor.user.length > 254 || /[\u0000-\u001f\u007f-\u009f]/.test(actor.user)) throw failure(403);
  try {
    return { 'X-Croupier-Studio-Actor': encodeURIComponent(actor.user), 'X-Croupier-Studio-Role': actor.role };
  } catch { throw failure(403); }
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
export function createStudioAdminApi({ authorize, allowedOrigins, publicHosts, handlers, gates = new Map(), preparations = new Map(), apiBase = '/studio/api/admin', mutationTransaction }) {
  if (!['/studio/api/admin', '/api/admin'].includes(apiBase)) throw new TypeError('Invalid admin API base');
  if (typeof authorize !== 'function' || !(handlers instanceof Map) || !(gates instanceof Map) || !(preparations instanceof Map)
    || !Array.isArray(allowedOrigins) || !allowedOrigins.length || !Array.isArray(publicHosts) || !publicHosts.length) throw new TypeError('Explicit admin dependencies required');
  const origins = new Set(allowedOrigins);
  const hosts = new Set(publicHosts);
  for (const origin of origins) { const url = new URL(origin); if (url.origin !== origin || url.username || url.password || !['http:', 'https:'].includes(url.protocol)) throw new TypeError('Invalid allowed origin'); }
  for (const host of hosts) { if (typeof host !== 'string' || new URL(`https://${host}`).host !== host || /[\s/@?#]/.test(host)) throw new TypeError('Invalid public host'); }
  // Snapshot trusted registrations so later mutation cannot widen this factory.
  const registered = new Map(handlers); const requirements = new Map(gates); const preparedHandlers = new Map(preparations);
  for (const [key, prepare] of preparedHandlers) {
    const endpoint = STUDIO_ADMIN_ENDPOINTS.find(endpoint => `${endpoint.method} ${endpoint.path}` === key);
    if (!endpoint || endpoint.method !== 'POST' || renderActions.has(endpoint.action) || typeof prepare !== 'function' || !registered.has(key)) throw new TypeError('Unknown admin preparation');
  }
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
    let action, release = false;
    try {
      const url = new URL(request.url);
      if (!hosts.has(url.host) || !origins.has(url.origin) || url.username || url.password) throw failure(403);
      for (const header of ['host', 'x-forwarded-host']) { const value = request.headers.get(header); if (value !== null && value !== url.host) throw failure(403); }
      if (url.pathname.includes('%') || url.pathname.includes('\\') || url.search && !isPresentationRoomReadQuery(request.method, url) || url.hash) throw failure(404);
      if (!url.pathname.startsWith(`${apiBase}/`)) throw failure(404);
      const canonicalPath = `/studio/api/admin${url.pathname.slice(apiBase.length)}`;
      const matches = STUDIO_ADMIN_ENDPOINTS.filter(endpoint => endpoint.path === canonicalPath);
      if (!matches.length) throw failure(404);
      const endpoint = studioAdminEndpoint(request.method, canonicalPath);
      if (!endpoint) return json({ error: publicErrors.get(405) }, 405, { Allow: [...new Set(matches.map(item => item.method))].join(', ') });
      action = endpoint.action;
      const session = await authorize(request);
      const actor = sessionActor(session);
      if (!studioRoleMeetsMinimum(actor.role, endpoint.minimumRole)) throw failure(403);
      // Safe UI identity from this request's fresh authorization, never handler
      // data, credentials, a token or a cached session. Keep payload contracts intact.
      const readIdentity = request.method === 'GET' ? readActorHeaders(actor) : {};
      // Trusted authorization owns the scope; copy its validated scalar fields
      // before async input/gates so handlers never share a mutable session scope.
      const scope = validateStudioScope(session.scope);
      if (request.method !== 'GET') {
        if (request.headers.get('origin') !== url.origin || !origins.has(request.headers.get('origin'))
          || !['same-origin', 'none'].includes(request.headers.get('sec-fetch-site'))) throw failure(403);
      }
      if (!ready(endpoint)) throw failure(503);
      const body = request.method === 'GET' ? null : await readObject(request);
      // Rummets publicering svarar med sitt fasta felkontrakt {error, code, step}.
      release = endpoint.action === 'room-release' || endpoint.action === 'operator-package' && body?.action === ROOM_RELEASE_ACTION;
      if (['users/role', 'users/remove'].includes(endpoint.action)) {
        if (typeof body.username !== 'string' || !body.username.trim()) throw failure(400);
        if (body.username.trim().toLowerCase() === actor.user.trim().toLowerCase()) throw failure(403);
        if (endpoint.action === 'users/role' && body.role !== 'admin') throw failure(400);
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
        if (principal.accountId !== actor.accountId || principal.user !== actor.user || principal.role !== actor.role
          || !studioRoleMeetsMinimum(principal.role, endpoint.minimumRole)
          || currentScope.environment !== scope.environment || currentScope.workspaceId !== scope.workspaceId) throw failure(403);
      };
      // Input and gates may yield for an arbitrary time. Recheck the cookie's
      // fingerprint/epoch before any mutation capability observes this actor.
      if (request.method !== 'GET') await refresh();
      for (const requirement of endpoint.handlerRequirements) {
        if (await requirements.get(requirement)(context) !== true) throw failure(403);
      }
      // Provider verification uses trusted server data before either SQL lock.
      // Authorization is refreshed again inside the product transaction.
      const prepare = preparedHandlers.get(`${endpoint.method} ${endpoint.path}`);
      const invocation = prepare ? Object.freeze({ ...context, prepared: await prepare(context) }) : context;
      // Negotiate the exact saved-scene candidate before the transaction.
      const sceneLayout = endpoint.action === 'operator-package' && body?.action === 'publish-scene-layout';
      if (sceneLayout && (invocation.prepared?.action !== 'publish-scene-layout' || !invocation.prepared.presentation)) throw failure(503);
      const roomRelease = endpoint.action === 'operator-package' && body?.action === ROOM_RELEASE_ACTION;
      if (roomRelease && (invocation.prepared?.action !== ROOM_RELEASE_ACTION || !invocation.prepared.presentation)) throw failure(503);
      // Bolag › Tilldelat: den förberedda kandidaten bär exakt det paket transaktionen förhandlar.
      const assignment = endpoint.action === 'operator-package' && body?.action === 'publish-assignment';
      if (assignment && (invocation.prepared?.action !== 'publish-assignment' || !Array.isArray(invocation.prepared.mutations))) throw failure(503);
      const invoke = async () => {
        if (request.method !== 'GET') await refresh();
        const value = await registered.get(`${endpoint.method} ${endpoint.path}`)(invocation);
        if (value === undefined || value instanceof Response) throw failure(503);
        return value;
      };
      // Render revalidates inside its own product transaction. Local mutations
      // hold that same product lock while validating current identity and writing.
      const presentationOptions = ['material-trash-check','material-trash'].includes(endpoint.action)
        ? {presentationDocuments:['project','administration'],presentationMaterialTrash:{id:body.id,archived:body.archived,expectedRevision:body.expectedRevision},presentationMutation:{kind:'material-trash',value:{}}}
        : ['operator-lifecycle','room-lifecycle','room-state'].includes(endpoint.action)
        ? { presentationDocuments: ['project','administration'], presentationOperatorIds: [body.operatorId], presentationMutation: {kind:'resource-lifecycle',value:{}} }
        : endpoint.action === 'room-game-config'
        // Both actions write administration.roomGameConfigs; negotiate v23 before either SQL lock.
        ? { presentationDocuments: ['project','administration'], presentationMutation: [{ kind: 'administration', value: { roomGameConfigs: [] } }, ...(body?.action==='publish'?[NATIVE_FILMED_PLANNING_MUTATION]:[])],
          ...(body?.action === 'publish' ? { presentationOperatorIds: [body.operatorId] } : {}) }
        : endpoint.action === 'presentation-room'
        ? { presentationDocuments: ['project', 'administration'], ...(body?.operatorId?{presentationOperatorIds:[body.operatorId]}:{}), presentationMutation: [{ kind: 'administration', value: { rooms: [{ schemaVersion: 2, game: invocation.prepared?.game ?? 'blackjack' }] } }, ...(invocation.prepared?.publicationPresentation ? [{ kind: 'presentation-package', value: invocation.prepared.publicationPresentation }] : [])] }
        : administrationMutations.has(endpoint.action)
        ? { presentationDocuments: ['administration'], ...(endpoint.action === 'game-lanes/create'
          ? { presentationMutation: { metadata: { dealerId: body.definition?.dealer } } } : {}) }
        // The room publication writes the package, the room's game settings (v31 film
        // planning) and administration without the room's draft; negotiate all before SQL.
        : roomRelease ? { presentationDocuments: ['project', 'administration'], presentationOperatorIds: [body.operatorId],
          presentationMutation: [{ kind: 'presentation-package', value: invocation.prepared.presentation },
            { kind: 'administration', value: { roomGameConfigs: [] } }, NATIVE_FILMED_PLANNING_MUTATION] }
        : assignment ? { presentationDocuments: ['project', 'administration'], presentationOperatorIds: [body.operatorId],
          presentationMutation: invocation.prepared.mutations }
        : endpoint.action === 'operator-package' ? { presentationDocuments: ['project', 'administration'], ...(body?.operatorId?{presentationOperatorIds:[body.operatorId]}:{}), ...(invocation.prepared?.presentation ? { presentationMutation: { kind: 'presentation-package', value: invocation.prepared.presentation } } : {}) } : undefined;
      const result = localMutation ? await mutationTransaction(invoke, presentationOptions) : await invoke();
      queueOpen = false;
      // Mail is an effect of committed identity state. Never send a token whose
      // surrounding transaction may still roll back or hold the product lock.
      for (const work of deferred) await work();
      return json(result, 200, readIdentity);
    } catch (error) {
      if (action === 'moving-drift') {
        const safe = publicMovingDriftError(error) ?? (error?.statusCode === 503 && !error?.code
          ? publicMovingDriftError({code:'drift_api_unavailable',statusCode:503}) : null);
        if (safe) return json(safe.body,safe.status);
      }
      const status = publicErrors.has(error?.statusCode) ? error.statusCode : 500;
      if (action === 'room-game-config' && status === 422 && error?.code === 'studio_room_game_material_unavailable') {
        const code = 'studio_room_game_material_unavailable';
        return json({ error: code, code }, status);
      }
      // Nyckel→bolag: Admin names why the chosen company cannot own a new key.
      if (action === 'apikeys/create' && status === 422 && error instanceof StudioStorageError && error.code === 'partner_key_operator_invalid') {
        return json({ error: publicErrors.get(status), code: error.code }, status);
      }
      // A refused AI table graphic: fixed code, scene template, material and reason code.
      const misfit = status === 422 ? aiTableMisfitBody(error) : null;
      if (misfit) return json(misfit, status);
      if (status === 503 && error?.code === PRESENTATION_RUNTIME_UPDATE_REQUIRED) {
        return json({ error: PRESENTATION_RUNTIME_UPDATE_MESSAGE, code: PRESENTATION_RUNTIME_UPDATE_REQUIRED }, status);
      }
      const releaseBody = release ? roomReleaseErrorBody(error, status) : null;
      if (releaseBody) {
        if (status >= 500) logStudioServerFailure(error, { method: request.method, route: action });
        return json(releaseBody, status);
      }
      if (status !== 503 && status !== 500) return json({ error: publicErrors.get(status) }, status);
      logStudioServerFailure(error, { method: request.method, route: action });
      // Storage codes are fixed product identifiers (see StudioStorageError), never provider text.
      const code = error instanceof StudioStorageError && typeof error.code === 'string' && error.code ? error.code : null;
      return json({ error: publicErrors.get(status), ...(code ? { code } : {}) }, status);
    }
  }
  return Object.freeze({ handle, availableActions });
}
