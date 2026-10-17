import { nativeStudioAdminConfiguration, assertNativeStudioRequest, studioNativeRuntime } from './studio-native-runtime.mjs';
import { normalizeNativeStudioRequest, normalizeNativeStudioPageRequest } from './studio-native-request.mjs';
import { createPartnerPreviewContext, DEFAULT_PARTNER_PREVIEW_OPERATOR, partnerPreviewOperator } from './partner-preview-policy.mjs';
import { readPartnerPreviewFixture } from './partner-preview-fixtures.mjs';

const reject = (statusCode = 403) => { throw Object.assign(new Error('partner_preview_rejected'), { statusCode }); };
const responseHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Cookie' };
const apiPath = config => config?.apiBase === '/studio/api/admin' ? '/studio/api/partner-preview' : '/api/partner-preview';

function normalizePreviewApiRequest(request, config) {
  const url = new URL(request.url);
  const entries = [...url.searchParams];
  if (entries.length > 1 || entries.some(([key, value]) => key !== 'operator' || !/^operator-demo-(north|south)$/.test(value))) reject(400);
  const operatorId = entries[0]?.[1] ?? DEFAULT_PARTNER_PREVIEW_OPERATOR;
  // Validate the only allowed query separately. The shared native normalizer
  // deliberately refuses all queries, so do not weaken it for other endpoints.
  url.search = '';
  let normalized = normalizeNativeStudioRequest(new Request(url, { method: 'GET', headers: request.headers, signal: request.signal }), config);
  const logical = new URL(normalized.url);
  if (apiPath(config) === '/studio/api/partner-preview' && logical.pathname === '/api/partner-preview') {
    logical.pathname = apiPath(config);
    normalized = new Request(logical, { method: 'GET', headers: normalized.headers, signal: request.signal });
  }
  assertNativeStudioRequest(normalized, config);
  if (new URL(normalized.url).pathname !== apiPath(config)) reject(404);
  return { request: normalized, operatorId };
}

function previewFailure(error) {
  const status = [400, 401, 403, 404, 405, 503].includes(error?.statusCode) ? error.statusCode : 503;
  const code = status === 401 ? 'studio_login_required' : status === 503 ? 'partner_preview_unavailable' : 'partner_preview_rejected';
  return Response.json({ error: code }, { status, headers: responseHeaders });
}

export function rejectPartnerPreviewMethod() {
  return new Response(null, { status: 405, headers: { ...responseHeaders, Allow: 'GET' } });
}

// Configuration/dependencies are server-owned and never accepted from request
// JSON, headers or query fields. A caller must explicitly opt into fixture mode.
export function createPartnerPreviewHandlers({ previewEnabled = false, configuration = nativeStudioAdminConfiguration,
  runtime = studioNativeRuntime, now = Date.now } = {}) {
  async function snapshot(request, config, operatorId) {
    if (previewEnabled !== true) reject(503);
    const native = await runtime();
    // Runtime construction may be shared, but authorization is fresh on every
    // API read and SSR load (including password, role and auth-epoch changes).
    const session = await native.authorize(request);
    const context = createPartnerPreviewContext({ session, scope: config.scope, operatorId, previewEnabled });
    return { snapshot: readPartnerPreviewFixture(context, { now }),
      session: { user: context.actor, role: context.role, accessClass: context.accessClass } };
  }
  return Object.freeze({
    handle: async request => {
      if (request.method !== 'GET') return rejectPartnerPreviewMethod();
      try {
        if (previewEnabled !== true) reject(503);
        const config = configuration();
        const normalized = normalizePreviewApiRequest(request, config);
        const result = await snapshot(normalized.request, config, normalized.operatorId);
        return Response.json(result.snapshot, { headers: responseHeaders });
      } catch (error) { return previewFailure(error); }
    },
    initialData: async (request, { operatorId, operatorSlug } = {}) => {
      if (previewEnabled !== true) reject(503);
      const config = configuration();
      const normalized = normalizeNativeStudioPageRequest(request, config);
      assertNativeStudioRequest(normalized, config);
      if (!/^\/(?:studio\/)?(?:partner|control)(?:\/[a-z0-9][a-z0-9-]*){0,2}$/.test(new URL(normalized.url).pathname)) reject(404);
      if (operatorId !== undefined && operatorSlug !== undefined) reject(400);
      if (operatorSlug !== undefined) {
        const operator = partnerPreviewOperator(operatorSlug);
        if (!operator || operator.slug !== operatorSlug) reject(404);
        operatorId = operator.id;
      }
      const result = await snapshot(normalized, config, operatorId ?? DEFAULT_PARTNER_PREVIEW_OPERATOR);
      return { ...result, apiBase: apiPath(config) };
    },
  });
}

// This rollout enables only the internal fixture preview. Native Studio must
// already be configured; there is no local/guest mode or real operator access.
const preview = createPartnerPreviewHandlers({ previewEnabled: true });
export async function handlePartnerPreview(request) { return preview.handle(request); }
export async function partnerPreviewInitialData(request, options) { return preview.initialData(request, options); }
