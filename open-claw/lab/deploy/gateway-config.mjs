import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const PROVIDER_APIS = new Set(['openai-completions', 'openai-responses', 'anthropic-messages', 'google-generative-ai']);

export function requireGatewaySecrets(env) {
  if (!env.OPENCLAWAPI_KEY?.trim()) throw new Error('Set OPENCLAWAPI_KEY for Gateway authentication.');
  if (!env.OPENCLAW_MODEL_API_KEY?.trim()) throw new Error('Set OPENCLAW_MODEL_API_KEY for the chosen model provider.');
  if (/[\r\n]/.test(env.OPENCLAWAPI_KEY) || /[\r\n]/.test(env.OPENCLAW_MODEL_API_KEY)) {
    throw new Error('Gateway and model provider credentials must each be a single line.');
  }
  if (env.OPENCLAWAPI_KEY.trim() === env.OPENCLAW_MODEL_API_KEY.trim()) {
    throw new Error('Gateway and model provider credentials must be different.');
  }
}

export function dashboardOrigin(env) {
  const local = env.OPENCLAW_DASHBOARD_ALLOW_LOOPBACK;
  if (local !== undefined && !['', 'false', '0', 'true', '1'].includes(local)) {
    throw new Error('OPENCLAW_DASHBOARD_ALLOW_LOOPBACK must be true or false.');
  }
  const value = env.OPENCLAW_DASHBOARD_ORIGIN;
  if (value === undefined || value === '') return null;
  let origin;
  try { origin = new URL(value); } catch {
    throw new Error('OPENCLAW_DASHBOARD_ORIGIN must be a bare HTTPS origin.');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  const explicitLocal = ['true', '1'].includes(local);
  if (!/^https?:\/\//i.test(value) || /[?#\\]/.test(value) || value !== value.trim()
    || origin.username || origin.password || origin.search || origin.hash
    || origin.pathname !== '/' || origin.hostname.includes('*')
    || (origin.protocol !== 'https:' && !(loopback && explicitLocal && origin.protocol === 'http:'))
    || (loopback && !explicitLocal)) {
    throw new Error('OPENCLAW_DASHBOARD_ORIGIN must be a bare HTTPS origin; loopback requires explicit local opt-in.');
  }
  return origin.origin;
}

// Keep this shape equal to the former generated lab seed: exact structural
// equality is the only automatic legacy migration trigger.
function baseConfig(env) {
  requireGatewaySecrets(env);
  let baseUrl;
  try { baseUrl = new URL(env.OPENCLAW_MODEL_BASE_URL || 'https://api.openai.com/v1'); } catch {
    throw new Error('OPENCLAW_MODEL_BASE_URL must be an HTTPS API base URL.');
  }
  if (baseUrl.protocol !== 'https:' || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error('OPENCLAW_MODEL_BASE_URL must be an HTTPS API base URL without credentials, query, or fragment.');
  }
  const modelId = env.OPENCLAW_MODEL_ID || 'gpt-5.4-mini';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/.test(modelId)) throw new Error('Invalid OPENCLAW_MODEL_ID.');
  const api = env.OPENCLAW_MODEL_API || 'openai-responses';
  if (!PROVIDER_APIS.has(api)) throw new Error('Unsupported OPENCLAW_MODEL_API.');
  const port = Number(env.OPENCLAW_GATEWAY_PORT || '18789');
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid OPENCLAW_GATEWAY_PORT.');
  const stateDir = env.OPENCLAW_STATE_DIR || '/data/openclaw';
  if (!path.isAbsolute(stateDir)) throw new Error('OPENCLAW_STATE_DIR must be absolute.');
  const agent = (name, directory) => ({
    name,
    workspace: path.join(stateDir, 'workspaces', directory),
    agentDir: path.join(stateDir, 'agents', directory, 'agent'),
    model: { primary: `lab-provider/${modelId}`, fallbacks: [] },
    skills: [],
    memory: { search: { enabled: false } },
    heartbeat: { every: '0m' },
    tools: { profile: 'minimal', deny: ['*'], elevated: { enabled: false } },
  });
  return {
    gateway: {
      mode: 'local', bind: 'lan', port,
      auth: { mode: 'token', token: '${OPENCLAW_GATEWAY_TOKEN}' },
      controlUi: { enabled: false },
      terminal: { enabled: false },
      cliAgents: { enabled: false },
      http: { endpoints: { chatCompletions: { enabled: true }, responses: { enabled: false } } },
    },
    agents: {
      ownership: 'explicit',
      entries: {
        'croupier-director': agent('Croupier presentation adviser', 'croupier-director'),
        'croupier-chat': agent('Croupier lab chat', 'croupier-chat'),
      },
    },
    models: {
      mode: 'replace',
      providers: {
        'lab-provider': {
          baseUrl: baseUrl.toString().replace(/\/$/, ''),
          apiKey: { source: 'env', provider: 'default', id: 'OPENCLAW_MODEL_API_KEY' },
          api,
          models: [{ id: modelId, name: modelId, input: ['text'] }],
        },
      },
    },
    tools: { profile: 'minimal', deny: ['*'], elevated: { enabled: false } },
    browser: { enabled: false },
    cron: { enabled: false },
  };
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// Authentication and browser ingress are deployment policy. Everything else in
// the native config (including human-edited agents/tools/models) stays editable.
export function applyDashboardPolicy(config, env) {
  requireGatewaySecrets(env);
  const origin = dashboardOrigin(env);
  if (!isObject(config) || !isObject(config.gateway)
    || (config.gateway.auth !== undefined && !isObject(config.gateway.auth))
    || (config.gateway.controlUi !== undefined && !isObject(config.gateway.controlUi))) {
    throw new Error('Persisted OpenClaw configuration has an invalid gateway object.');
  }
  const next = structuredClone(config);
  const controlUi = next.gateway.controlUi ?? {};
  if (controlUi.dangerouslyDisableDeviceAuth === true
    || controlUi.dangerouslyAllowHostHeaderOriginFallback === true
    || controlUi.allowInsecureAuth === true) {
    throw new Error('Remove unsafe Control UI authentication/origin bypass settings before starting this deployment.');
  }
  next.gateway.auth = {
    ...next.gateway.auth,
    mode: 'password',
    password: '${OPENCLAW_GATEWAY_PASSWORD}',
    allowTailscale: false,
  };
  delete next.gateway.auth.token;
  next.gateway.controlUi = { ...controlUi, enabled: origin !== null, basePath: '/openclaw' };
  if (origin) {
    next.gateway.controlUi.allowedOrigins = [origin];
    next.gateway.publicOrigin = origin;
  } else {
    // Removing the opt-in on a later deploy closes an already-enabled panel.
    delete next.gateway.controlUi.allowedOrigins;
    delete next.gateway.publicOrigin;
  }
  return next;
}

export function gatewayConfig(env) {
  const config = baseConfig(env);
  // No global deny: a human can later equip the operator agent independently.
  // Every seeded agent still denies all tools until the operator changes it.
  delete config.tools.deny;
  const operator = structuredClone(config.agents.entries['croupier-chat']);
  operator.name = 'Croupier operator assistant';
  const stateDir = env.OPENCLAW_STATE_DIR || '/data/openclaw';
  operator.workspace = path.join(stateDir, 'workspaces', 'croupier-operator');
  operator.agentDir = path.join(stateDir, 'agents', 'croupier-operator', 'agent');
  config.agents.entries['croupier-operator'] = operator;
  const configured = applyOwnershipDefaults(applyDashboardPolicy(config, env));
  configured.gateway.auth.rateLimit = {
    maxAttempts: 10, windowMs: 60000, lockoutMs: 300000, exemptLoopback: false,
  };
  return configured;
}

// OpenClaw 2026.9.5 requires an explicit owner for agent-less system/Talk work.
// Fill only absent owners, and only when our operator is actually configured.
// This does not enable cron, Talk audio, tools, or any new agent permissions.
export function applyOwnershipDefaults(config) {
  const next = structuredClone(config);
  if (!isObject(next.agents?.entries?.['croupier-operator'])) return next;
  if (next.agents.defaults === undefined) next.agents.defaults = {};
  if (isObject(next.agents.defaults)) {
    if (next.agents.defaults.systemAgent === undefined) next.agents.defaults.systemAgent = {};
    if (isObject(next.agents.defaults.systemAgent) && next.agents.defaults.systemAgent.agentId === undefined) {
      next.agents.defaults.systemAgent.agentId = 'croupier-operator';
    }
  }
  if (next.talk === undefined) next.talk = {};
  if (isObject(next.talk) && next.talk.agentId === undefined) next.talk.agentId = 'croupier-operator';
  return next;
}

export function isLegacyGeneratedConfig(config, env) {
  try {
    const provider = config.models.providers['lab-provider'];
    // Recover original non-secret seed inputs so changing an environment model
    // default does not overwrite the provider/model already on persistent disk.
    const legacyEnv = {
      ...env,
      OPENCLAW_MODEL_BASE_URL: provider.baseUrl,
      OPENCLAW_MODEL_ID: provider.models[0].id,
      OPENCLAW_MODEL_API: provider.api,
      OPENCLAW_GATEWAY_PORT: String(config.gateway.port),
    };
    return isDeepStrictEqual(config, baseConfig(legacyEnv));
  } catch { return false; }
}

export function planGatewayConfig(existing, env) {
  if (existing === null) return { action: 'seed', config: gatewayConfig(env) };
  if (isLegacyGeneratedConfig(existing, env)) {
    const provider = existing.models.providers['lab-provider'];
    return {
      action: 'migrate-legacy',
      config: gatewayConfig({
        ...env,
        OPENCLAW_MODEL_BASE_URL: provider.baseUrl,
        OPENCLAW_MODEL_ID: provider.models[0].id,
        OPENCLAW_MODEL_API: provider.api,
        OPENCLAW_GATEWAY_PORT: String(existing.gateway.port),
      }),
    };
  }
  const ingress = applyDashboardPolicy(existing, env);
  const config = applyOwnershipDefaults(ingress);
  const action = isDeepStrictEqual(config, existing) ? 'reuse'
    : isDeepStrictEqual(ingress, existing) ? 'reconcile-ownership' : 'reconcile-ingress';
  return { action, config };
}
