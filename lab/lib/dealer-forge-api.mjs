// HTTP surface for Dealer Forge. Same N1 admin session, scope, origin and
// CSRF rules as the other native Studio routes; forge-specific errors keep a
// readable message because operators act on them (credits, missing anchor…).
import { canonicalStudioJson, StudioStorageError, validateActor, validateStudioScope } from '../../packages/studio-registry/server/document-contract.mjs';
import { assertNativeStudioRequest, nativeStudioAdminEnabled, nativeStudioErrorResponse, studioNativeRuntime } from './studio-native-runtime.mjs';
import { normalizeNativeStudioRequest } from './studio-native-request.mjs';
import { readStudioDocumentJson } from './studio-document-api.mjs';
import { createDealerForgeService, ForgeError } from './dealer-forge-service.mjs';
import { RunwayError } from './runway-client.mjs';
import { isDealerId } from '../../packages/presentation/contracts/dealer-identity.mjs';

const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (value, status = 200) => Response.json(value, { status, headers });
const fail = (code, status = 403) => { throw new StudioStorageError(code, status); };
const MAX_ANCHOR_BODY = 4 * 1024 * 1024; // Vercel request body ceiling; the browser downsizes first.
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

// Store-level codes travel as StudioStorageError (message === code); give operators readable text.
const CODE_MESSAGES = Object.freeze({
  studio_forge_conflict: 'Något ändrades samtidigt (profil, jobb eller projekt). Ladda om och försök igen.',
  studio_forge_invalid_status: 'Ogiltig jobbstatus.', studio_forge_invalid_job: 'Ogiltigt jobb-ID.', studio_forge_actor_required: 'Inloggad aktör saknas.',
  studio_forge_store_failed: 'Forge-lagret svarade inte.', studio_forge_store_configuration: 'Forge-lagret är felkonfigurerat.',
});
export function forgeErrorResponse(error) {
  if (error instanceof ForgeError || error instanceof RunwayError || (error?.code && /^(forge_|runway_|studio_forge_)/.test(error.code))) {
    const status = [400, 402, 403, 404, 409, 413, 415, 422, 503].includes(error.statusCode) ? error.statusCode : 503;
    const message = error.detail ?? (error.message && error.message !== error.code ? error.message : CODE_MESSAGES[error.code] ?? error.code);
    return json({ error: error.code ?? 'forge_error', message: String(message ?? '').slice(0, 600) }, status);
  }
  return nativeStudioErrorResponse(error);
}

async function readBinary(request, limit) {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) throw new ForgeError('Bilden är för stor (max 4 MB per uppladdning; förminska i webbläsaren).', { status: 413, code: 'forge_invalid_image' });
  const reader = request.body?.getReader();
  if (!reader) throw new ForgeError('Tom begäran.', { status: 400, code: 'forge_invalid_request' });
  const chunks = []; let size = 0;
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); throw new ForgeError('Bilden är för stor (max 4 MB).', { status: 413, code: 'forge_invalid_image' }); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)));
}

export function createDealerForgeApi(runtime, { service } = {}) {
  const { authorize, config } = runtime;
  if (typeof authorize !== 'function' || !config || !['/api/admin', '/studio/api/admin'].includes(config.apiBase)) fail('studio_invalid_configuration', 503);
  const scope = validateStudioScope(config.scope), prefix = config.apiBase === '/api/admin' ? '/api' : '/studio/api', base = `${prefix}/forge`;
  const forge = service ?? createDealerForgeService({ repository: runtime.repository, scope, env: process.env, mutationTransaction: runtime.mutationTransaction,
    gamePolicy: runtime.gamePolicy, videoRegistry: runtime.videoRegistry, validateProjectBindings: runtime.validateProjectBindings });
  async function principal(request) {
    const session = await authorize(request);
    if (!session || !['admin', 'superadmin'].includes(session.role) || canonicalStudioJson(validateStudioScope(session.scope)) !== canonicalStudioJson(scope)) fail('studio_request_rejected');
    return Object.freeze({ actor: validateActor(session.user), role: session.role });
  }
  return Object.freeze({ async handle(request) {
    try {
      request = normalizeNativeStudioRequest(request, config); assertNativeStudioRequest(request, config);
      const url = new URL(request.url);
      if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) fail('studio_media_unknown', 404);
      const parts = url.pathname.slice(base.length).split('/').filter(Boolean);
      const first = await principal(request), actor = first.actor;
      const stillAuthorized = async () => { const current = await principal(request); if (current.actor !== actor || current.role !== first.role) fail('studio_request_rejected'); return true; };
      const mutating = request.method !== 'GET';
      if (mutating && (request.headers.get('origin') !== url.origin || !['same-origin', 'none'].includes(request.headers.get('sec-fetch-site')))) fail('studio_request_rejected');

      if (request.method === 'GET' && parts.length === 0) return json({ ...(await forge.status()), dealers: await forge.listDealers() });
      if (request.method === 'POST' && parts.length === 1 && parts[0] === 'dealers') {
        const body = await readStudioDocumentJson(request);
        if (Object.keys(body).sort().join(',') !== 'dealerId,label') fail('studio_invalid_request', 400);
        await stillAuthorized();
        return json(await forge.createDealer(body, { actor, stillAuthorized }));
      }
      const dealerId = parts[0];
      if (!isDealerId(dealerId)) fail('studio_media_unknown', 404);
      const rest = parts.slice(1);
      if (['GET', 'HEAD'].includes(request.method) && rest.length === 0) return json(await forge.state(dealerId));
      if (['GET', 'HEAD'].includes(request.method) && rest.length === 2 && rest[0] === 'anchor' && ['vila', 'redo'].includes(rest[1])) return forge.anchorResponse(dealerId, rest[1], request);
      if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, POST' } });
      if (rest.length === 1 && rest[0] === 'anchor') {
        const pose = request.headers.get('x-forge-pose') ?? '', contentType = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
        const bytes = await readBinary(request, MAX_ANCHOR_BODY);
        await stillAuthorized();
        return json(await forge.uploadAnchor(dealerId, { pose, contentType, dataBase64: bytes.toString('base64') }, { actor }));
      }
      const body = await readStudioDocumentJson(request);
      await stillAuthorized();
      if (rest.length === 1 && rest[0] === 'profile') return json(await forge.saveProfile(dealerId, body, { actor }));
      if (rest.length === 1 && rest[0] === 'preview') return json(await forge.preview(dealerId, body));
      if (rest.length === 1 && rest[0] === 'jobs') return json(await forge.createJob(dealerId, body, { actor }));
      if (rest.length === 2 && rest[0] === 'pose' && rest[1] === 'adopt') return json(await forge.adoptPose(dealerId, body, { actor }));
      if (rest.length === 3 && rest[0] === 'jobs' && uuid.test(rest[1])) {
        if (rest[2] === 'poll') return json(await forge.pollJob(dealerId, rest[1], { actor }));
        if (rest[2] === 'cancel') return json(await forge.cancelJob(dealerId, rest[1], { actor }));
        if (rest[2] === 'resolve') return json(await forge.resolveUnknown(dealerId, rest[1], body, { actor }));
      }
      fail('studio_media_unknown', 404);
    } catch (error) { return forgeErrorResponse(error); }
  }, service: forge });
}

let apiPromise;
async function nativeForgeApi() {
  apiPromise ??= studioNativeRuntime().then(runtime => createDealerForgeApi(runtime)).catch(error => { apiPromise = undefined; throw error; });
  return apiPromise;
}
export async function handleNativeDealerForge(request) {
  try { return await (await nativeForgeApi()).handle(request); }
  catch (error) { return forgeErrorResponse(error); }
}

/** Server-rendered first paint for /control/dealer-forge. The page has already passed authorizeUiPage. */
export async function dealerForgeInitialData(dealerId, { enabled = nativeStudioAdminEnabled } = {}) {
  if (!enabled()) return { index: null, state: null };
  try {
    const { service } = await nativeForgeApi();
    const index = { ...(await service.status()), dealers: await service.listDealers() };
    const id = dealerId && index.dealers.some(row => row.id === dealerId) ? dealerId : index.dealers[0]?.id;
    const state = id ? await service.state(id) : null;
    return { index, state };
  } catch { return { index: null, state: null }; }
}
