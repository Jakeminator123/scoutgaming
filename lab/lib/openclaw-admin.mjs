import { validDashboardHandoff, validDashboardRequest, dashboardBrowserUrl } from '../../packages/director/dashboard-handoff-contract.mjs';
import { readSettings } from './director-settings.mjs';
import { CROUPIER_ADMIN_AGENTS, validateOpenClawAdminPatch, validAdminHash } from '../../packages/director/studio-admin-contract.mjs';
import { normalizeStudioRole } from './studio-access-policy.mjs';
import { normalizeNativeStudioRequest } from './studio-native-request.mjs';
import { nativeStudioAdminConfiguration, studioNativeRuntime, assertNativeStudioRequest } from './studio-native-runtime.mjs';
import { validateStudioScope } from '../../web/storage/studio-contract.mjs';
import { resolve, basename } from 'node:path';

const DIRECTOR = 'https://croupier-lab-director.onrender.com';
const ENDPOINT = '/api/studio/openclaw/admin';
const SAFE_ERRORS = new Set(['openclaw_dashboard_unavailable', 'openclaw_admin_not_configured', 'openclaw_admin_device_not_configured', 'openclaw_admin_pairing_required',
  'openclaw_admin_scope_required', 'openclaw_admin_version_mismatch', 'openclaw_admin_unavailable', 'openclaw_admin_save_uncertain',
  'openclaw_admin_conflict', 'openclaw_admin_model_unavailable', 'openclaw_admin_invalid_request']);
const fail = (statusCode, code = 'openclaw_admin_unavailable') => { throw Object.assign(new Error(code), { statusCode, code }); };
const json = (body, status = 200, extra = {}) => Response.json(body, { status,
  headers:{ 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff', ...extra } });
const settingsNow = () => {
  const lab = basename(process.cwd()) === 'lab' ? process.cwd() : resolve(process.cwd(), 'lab');
  return readSettings({ envFiles:[resolve(lab, '../.env'), resolve(lab, '.env.local')] });
};
async function boundedJson(response, max = 32 * 1024) {
  const reader = response.body?.getReader(); if (!reader) fail(503);
  const chunks = []; let size = 0;
  try { for (;;) { const item = await reader.read(); if (item.done) break;
    size += item.value.byteLength; if (size > max) { await reader.cancel(); fail(413, 'openclaw_admin_invalid_request'); } chunks.push(item.value); }
    return JSON.parse(new TextDecoder('utf-8', { fatal:true }).decode(Buffer.concat(chunks)));
  } catch (error) { if (error?.statusCode) throw error; fail(400, 'openclaw_admin_invalid_request'); }
  finally { reader.releaseLock(); }
}
function principal(session, config) {
  if (!session || typeof session.user !== 'string' || !session.user.trim()) fail(401, 'studio_login_required');
  if (normalizeStudioRole(session.role) !== 'admin') fail(403, 'studio_request_rejected');
  let scope; try { scope = validateStudioScope(session.scope); } catch { fail(403, 'studio_request_rejected'); }
  if (scope.environment !== config.scope.environment || scope.workspaceId !== config.scope.workspaceId) fail(403, 'studio_request_rejected');
  return { user:session.user, scope };
}
function publicModel(input, agentId, hash) {
  try { return validateOpenClawAdminPatch({ version:1, baseHash:hash, agentId, model:input }).model; }
  catch { fail(503); }
}
function projection(value, method) {
  if (!value || !validAdminHash(value.baseHash)) fail(503);
  if (method === 'PATCH') {
    if (value.saved !== true || !CROUPIER_ADMIN_AGENTS.includes(value.agentId) || typeof value.restartScheduled !== 'boolean'
      || typeof value.verifiedAt !== 'string' || !Number.isFinite(Date.parse(value.verifiedAt))) fail(503, 'openclaw_admin_save_uncertain');
    return { saved:true, baseHash:value.baseHash, agentId:value.agentId, model:publicModel(value.model, value.agentId, value.baseHash),
      restartScheduled:value.restartScheduled, verifiedAt:value.verifiedAt };
  }
  if (value.version !== 1 || value.gateway?.connected !== true || value.gateway.version !== '2026.9.5'
    || !Array.isArray(value.agents) || value.agents.length < 1 || value.agents.length > 5 || !Array.isArray(value.models) || value.models.length > 512) fail(503);
  const agents = value.agents.map(agent => { if (!CROUPIER_ADMIN_AGENTS.includes(agent?.id)) fail(503);
    return { id:agent.id, model:publicModel(agent.model, agent.id, value.baseHash) }; });
  if (new Set(agents.map(agent => agent.id)).size !== agents.length) fail(503);
  const models = value.models.map(item => {
    if (typeof item?.id !== 'string' || typeof item.provider !== 'string' || item.id.split('/')[0] !== item.provider) fail(503);
    publicModel({ primary:item.id, fallbacks:[] }, agents[0].id, value.baseHash);
    return { id:item.id, provider:item.provider };
  });
  return { version:1, baseHash:value.baseHash, gateway:{ connected:true, version:'2026.9.5', applied:[true,false].includes(value.gateway.applied) ? value.gateway.applied : null }, agents, models };
}

export function createOpenClawAdminApi({ config, authorize, settings = settingsNow, fetchImpl = fetch } = {}) {
  if (!config || typeof authorize !== 'function') throw new TypeError('Explicit native admin dependencies required');
  return Object.freeze({ async handle(request) {
    try {
      request = normalizeNativeStudioRequest(request, config); assertNativeStudioRequest(request, config);
      const url = new URL(request.url);
      const paths = config.apiBase === '/studio/api/admin' ? ['/studio/api/openclaw/admin', '/api/openclaw/admin'] : ['/api/openclaw/admin'];
      if (!paths.includes(url.pathname)) fail(404, 'studio_request_rejected');
      if (!['GET', 'PATCH', 'POST'].includes(request.method)) return json({ error:'openclaw_admin_invalid_request' }, 405, { Allow:'GET, PATCH, POST' });
      const actor = principal(await authorize(request), config);
      let body;
      if (['PATCH','POST'].includes(request.method)) {
        if (request.headers.get('origin') !== url.origin || !['same-origin', 'none'].includes(request.headers.get('sec-fetch-site'))) fail(403, 'studio_request_rejected');
        if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') || '')) fail(415, 'openclaw_admin_invalid_request');
        const input = await boundedJson(request);
        if (request.method === 'POST') { if (!validDashboardRequest(input)) fail(400,'openclaw_admin_invalid_request'); body={version:1,action:'dashboard.open'}; }
        else body = validateOpenClawAdminPatch(input);
        if (principal(await authorize(request), config).user !== actor.user) fail(403, 'studio_request_rejected');
      }
      const current = settings();
      if (!['', DIRECTOR].includes(current.remoteUrl) || typeof current.gatewayKey !== 'string' || !current.gatewayKey.trim()
        || current.gatewayKey.trim() === (current.remoteToken || '').trim() || /[\r\n]/.test(current.gatewayKey)) fail(503, 'openclaw_admin_not_configured');
      let response;
      try { response = await fetchImpl(`${DIRECTOR}${ENDPOINT}`, { method:request.method, redirect:'error', cache:'no-store', signal:AbortSignal.timeout(35000),
        headers:{ Authorization:`Bearer ${current.gatewayKey.trim()}`, ...(body ? { 'Content-Type':'application/json' } : {}) },
        ...(body ? { body:JSON.stringify(body) } : {}) }); }
      catch { fail(503, request.method === 'PATCH' ? 'openclaw_admin_save_uncertain' : 'openclaw_admin_unavailable'); }
      let value; try { value = await boundedJson(response); } catch { fail(503, request.method === 'PATCH' ? 'openclaw_admin_save_uncertain' : 'openclaw_admin_unavailable'); }
      if (!response.ok) {
        if (request.method === 'POST' && [404,405].includes(response.status)) fail(503,'openclaw_dashboard_unavailable');
        const status = [400,409,422,503].includes(response.status) ? response.status : 503;
        fail(status, SAFE_ERRORS.has(value?.error) ? value.error : 'openclaw_admin_unavailable');
      }
      if (request.method === 'POST') {
        if (principal(await authorize(request),config).user !== actor.user) fail(403,'studio_request_rejected');
        if (!validDashboardHandoff(value)) fail(503,'openclaw_dashboard_unavailable');
        // Compare expiry on the server that validated it. A browser's wall clock
        // may differ from Gateway time even when the one-use link is fresh.
        return json({ browserUrl:dashboardBrowserUrl(value), expiresAtMs:value.expiresAtMs,
          remainingLifetimeMs:value.expiresAtMs - Date.now() });
      }
      return json(projection(value, request.method));
    } catch (error) {
      const status = [400,401,403,404,405,409,413,415,422,503].includes(error?.statusCode) ? error.statusCode : 503;
      const code = status === 401 ? 'studio_login_required' : status === 403 ? 'studio_request_rejected'
        : SAFE_ERRORS.has(error?.code) ? error.code : 'openclaw_admin_unavailable';
      return json({ error:code }, status);
    }
  } });
}

export async function handleOpenClawAdmin(request) {
  try {
    const config = nativeStudioAdminConfiguration(); if (!config) fail(503, 'openclaw_admin_not_configured');
    return createOpenClawAdminApi({ config, authorize:async current => (await studioNativeRuntime()).authorize(current) }).handle(request);
  } catch { return json({ error:'openclaw_admin_unavailable' }, 503); }
}
