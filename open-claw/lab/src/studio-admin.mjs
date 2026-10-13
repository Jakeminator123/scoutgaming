import { OpenClawAdminError, withGatewayAdminRpc } from './gateway-rpc.mjs';
import { validDashboardHandoff, validDashboardRequest } from './dashboard-handoff-contract.mjs';
import { boundedJson } from './openclaw.mjs';

export const STUDIO_OPENCLAW_ADMIN_PATH = '/api/studio/openclaw/admin';
export const CROUPIER_ADMIN_AGENTS = Object.freeze(['croupier-director', 'croupier-chat', 'croupier-operator', 'croupier-social', 'croupier-speech']);
const modelRef = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,100}\/[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,150}$/.test(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const keys = (value, names) => object(value) && Object.keys(value).every(key => names.includes(key)) && names.every(key => Object.hasOwn(value, key));
const fail = (code = 'openclaw_admin_invalid_request', statusCode = 400) => { throw new OpenClawAdminError(code, statusCode); };
export const validAdminHash = value => typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,256}$/.test(value);
function model(value) {
  if (!keys(value, ['primary', 'fallbacks']) || !modelRef(value.primary) || !Array.isArray(value.fallbacks)
    || value.fallbacks.length > 4 || !value.fallbacks.every(modelRef) || new Set([value.primary, ...value.fallbacks]).size !== value.fallbacks.length + 1) fail();
  return { primary:value.primary, fallbacks:[...value.fallbacks] };
}
export function validateOpenClawAdminPatch(input) {
  if (!keys(input, ['version', 'baseHash', 'agentId', 'model']) || input.version !== 1 || !validAdminHash(input.baseHash)
    || !CROUPIER_ADMIN_AGENTS.includes(input.agentId)) fail();
  return { version:1, baseHash:input.baseHash, agentId:input.agentId, model:model(input.model) };
}
function snapshot(input, version) {
  if (input?.valid !== true || !validAdminHash(input.hash) || !object(input.config?.agents?.entries)) fail('openclaw_admin_unavailable', 503);
  const config = input.config, agents = [];
  for (const id of CROUPIER_ADMIN_AGENTS) {
    const entry = config.agents.entries[id]; if (!object(entry)) continue;
    const assigned = entry.model ?? config.agents.defaults?.model;
    try { agents.push({ id, model:model(typeof assigned === 'string' ? { primary:assigned, fallbacks:[] } : { primary:assigned?.primary, fallbacks:assigned?.fallbacks ?? [] }) }); }
    catch { fail('openclaw_admin_unavailable', 503); }
  }
  if (!agents.length) fail('openclaw_admin_unavailable', 503);
  const models = new Map();
  for (const [provider, definition] of Object.entries(config.models?.providers || {})) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,100}$/.test(provider) || !Array.isArray(definition?.models)) continue;
    for (const entry of definition.models) {
      const id = `${provider}/${entry?.id}`; if (modelRef(id)) models.set(id, { id, provider });
    }
  }
  // Existing choices remain visible without discovering providers or running a model.
  for (const agent of agents) for (const id of [agent.model.primary, ...agent.model.fallbacks]) models.set(id, { id, provider:id.split('/')[0] });
  return { version:1, baseHash:input.hash, gateway:{ connected:true, version,
    applied:typeof input.configRevisionHash === 'string' && typeof input.appliedConfigHash === 'string'
      ? input.configRevisionHash === input.appliedConfigHash : null }, agents, models:[...models.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}

/** Finite model edits plus a separate native owner dashboard handoff.
 * Provider/auth/tool configuration and arbitrary RPC remain unavailable here. */
export function createStudioOpenClawAdmin({ rpc = withGatewayAdminRpc, now = Date.now, fetchImpl = fetch } = {}) {
  let writing = false;
  return Object.freeze({
    get(settings) { return rpc(settings, async connection => snapshot(await connection.call('config.get'), connection.version)); },
    async dashboard(input, settings) {
      if (!validDashboardRequest(input)) fail();
      try {
        const url = new URL(settings.baseUrl);
        if (url.protocol !== 'http:' || url.username || url.password || url.search || url.hash
          || !/^(?:[a-z0-9-]+(?:\.internal)?|127\.0\.0\.1|\[::1\])$/i.test(url.hostname)
          || !['/', '/v1', '/v1/'].includes(url.pathname) || !settings.gatewayKey?.trim() || /[\r\n]/.test(settings.gatewayKey)) throw Error();
        url.port='18790'; url.pathname='/dashboard';
        const response = await fetchImpl(url, { method:'POST', redirect:'error', cache:'no-store', signal:AbortSignal.timeout(25000),
          headers:{ Authorization:'Bearer '+settings.gatewayKey.trim() } });
        if (!response.ok) { await response.body?.cancel(); throw Error(); }
        const value = await boundedJson(response, 4096);
        if (!validDashboardHandoff(value,now())) throw Error();
        return { bootstrapToken:value.bootstrapToken, expiresAtMs:value.expiresAtMs };
      } catch { fail('openclaw_dashboard_unavailable',503); }
    },
    async patch(input, settings) {
      const patch = validateOpenClawAdminPatch(input);
      if (writing) fail('openclaw_admin_conflict', 409);
      writing = true;
      try {
        return await rpc(settings, async connection => {
          const before = snapshot(await connection.call('config.get'), connection.version);
          if (before.baseHash !== patch.baseHash) fail('openclaw_admin_conflict', 409);
          if (!before.agents.some(agent => agent.id === patch.agentId)) fail('openclaw_admin_invalid_request', 400);
          const allowed = new Set(before.models.map(item => item.id));
          if (![patch.model.primary, ...patch.model.fallbacks].every(id => allowed.has(id))) fail('openclaw_admin_model_unavailable', 422);
          const acknowledged = await connection.call('config.patch', { baseHash:patch.baseHash,
            raw:JSON.stringify({ agents:{ entries:{ [patch.agentId]:{ model:patch.model } } } }),
            replacePaths:[`agents.entries.${patch.agentId}.model.fallbacks`], note:'Croupier Studio model selection',
          });
          const noop = acknowledged?.noop === true;
          if (acknowledged?.ok !== true || !noop && !validAdminHash(acknowledged.hash)) fail('openclaw_admin_save_uncertain', 503);
          // v2026.9.5 respondConfigPatchNoop returns config/changedPaths without
          // hash or restart. Its successful CAS preserves the requested revision.
          if (noop && (!Array.isArray(acknowledged.changedPaths) || acknowledged.changedPaths.length
            || JSON.stringify(before.agents.find(agent => agent.id === patch.agentId).model) !== JSON.stringify(patch.model)
            || acknowledged.hash !== undefined && acknowledged.hash !== before.baseHash)) fail('openclaw_admin_save_uncertain', 503);
          const saved = acknowledged.config?.agents?.entries?.[patch.agentId]?.model;
          let observed; try { observed = model(saved); } catch { fail('openclaw_admin_save_uncertain', 503); }
          if (JSON.stringify(observed) !== JSON.stringify(patch.model)) fail('openclaw_admin_save_uncertain', 503);
          return { saved:true, baseHash:noop ? before.baseHash : acknowledged.hash, agentId:patch.agentId, model:patch.model,
            restartScheduled:!noop && acknowledged.restart?.ok === true, verifiedAt:new Date(now()).toISOString() };
        });
      } finally { writing = false; }
    },
  });
}
