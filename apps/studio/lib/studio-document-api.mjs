import { canonicalStudioJson, StudioStorageError, validateActor, validateStudioScope, STUDIO_JSON_LIMIT } from '../../../packages/studio-registry/server/document-contract.mjs';
import { createNeonProjectStore, createNeonSocialStore } from './neon-project-store.mjs';
import { assertNativeStudioRequest, nativeStudioErrorResponse, studioNativeRuntime } from './studio-native-runtime.mjs';
import { normalizeNativeStudioRequest } from './studio-native-request.mjs';
import { movingSpeechBanksAllowed } from '../../../packages/presentation/contracts/dealer-speech-profile.mjs';

const fail = (code, statusCode = 503) => { throw new StudioStorageError(code, statusCode); };
const json = value => Response.json(value, { headers: {
  'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
} });
export async function readStudioDocumentJson(request) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') || '')) fail('studio_json_required', 415);
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > STUDIO_JSON_LIMIT)) fail('studio_invalid_request', /^\d+$/.test(length) ? 413 : 400);
  const reader = request.body?.getReader();
  if (!reader) fail('studio_invalid_request', 400);
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > STUDIO_JSON_LIMIT) { await reader.cancel(); fail('studio_request_too_large', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body;
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { fail('studio_invalid_request', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('studio_invalid_request', 400);
  return body;
}
function documentSession(session, scope) {
  if (!session || !['admin', 'superadmin'].includes(session.role)) fail('studio_request_rejected', 403);
  const actor = validateActor(session.user);
  if (canonicalStudioJson(validateStudioScope(session.scope)) !== canonicalStudioJson(scope)) fail('studio_scope_mismatch', 403);
  return actor;
}

// These are Studio policy endpoints, not BO reader/staff administration access.
// Exact saved documents only; request drafts never become game policy implicitly.
// movingSpeechDealers: the dealers with a moving bank in this environment (movingDriftDealerIds); none when absent.
export function createStudioDocumentApi({ repository, authorize, config, validateProjectBindings, gamePolicy, mutationTransaction, movingSpeechDealers = () => [] } = {}) {
  if (typeof authorize !== 'function' || !config) fail('studio_invalid_configuration');
  const scope = validateStudioScope(config.scope);
  if (!['/api/admin', '/studio/api/admin'].includes(config.apiBase)) fail('studio_invalid_configuration');
  config = Object.freeze({ ...config, scope,
    allowedOrigins: Object.freeze([...config.allowedOrigins]), publicHosts: Object.freeze([...config.publicHosts]),
  });
  const base = config.apiBase === '/api/admin' ? '/api' : '/studio/api';
  const endpoints = new Map([[`${base}/project`, ['project', createNeonProjectStore]], [`${base}/social`, ['policy', createNeonSocialStore]]]);
  return Object.freeze({ async handle(request) {
    try {
      request = normalizeNativeStudioRequest(request, config);
      assertNativeStudioRequest(request, config);
      const endpoint = endpoints.get(new URL(request.url).pathname);
      if (!endpoint) fail('studio_document_unknown', 404);
      if (!['GET', 'PUT'].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, PUT', 'Cache-Control': 'private, no-store' } });
      const session = await authorize(request), actor = documentSession(session, scope);
      const role = session.role;
      const [field, storeFactory] = endpoint;
      const store = field === 'project' && gamePolicy ? gamePolicy.projectStore({ actor }) : storeFactory({ repository, scope, actor });
      if (request.method === 'GET') return json({ [field]: await store.load() });
      if (request.headers.get('origin') !== new URL(request.url).origin
        || !['same-origin', 'none'].includes(request.headers.get('sec-fetch-site'))) fail('studio_request_rejected', 403);
      if (typeof mutationTransaction !== 'function') fail('studio_mutation_transaction_required');
      const body = await readStudioDocumentJson(request);
      if (Object.keys(body).sort().join(',') !== ['expectedRevision', field].sort().join(',')) fail('studio_invalid_request', 400);
      // Native policy writes cannot use an unverified old upload/index on disk.
      // The active media adapter must validate exact IDs/families/hash bindings.
      if (field === 'project') {
        if (typeof validateProjectBindings !== 'function') fail('studio_media_verifier_required');
        await validateProjectBindings(body.project);
        // The bank check is the server's, not only Admin's: the saved project is read only when a motion reference
        // would be refused without it, so an unchanged active profile (Dragan) stays saveable.
        const banks = movingSpeechDealers();
        if (!movingSpeechBanksAllowed(body.project, null, banks) && !movingSpeechBanksAllowed(body.project, await store.load(), banks))
          fail('studio_speech_bank_missing', 422);
      }
      const saved = await mutationTransaction(async () => {
        const current = await authorize(request);
        if (documentSession(current,scope) !== actor || current.role !== role) fail('studio_request_rejected',403);
        return store.save(body[field],body.expectedRevision);
      }, {presentationMutation:{kind:field === 'project' ? 'project' : 'social-policy',value:body[field]}});
      return json({[field]:saved});
    } catch (error) { return nativeStudioErrorResponse(error); }
  } });
}

export async function handleNativeStudioDocument(request) {
  try { return await createStudioDocumentApi(await studioNativeRuntime()).handle(request); }
  catch (error) { return nativeStudioErrorResponse(error); }
}
