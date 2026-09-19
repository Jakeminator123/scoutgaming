import path from 'node:path';

const PROVIDER_APIS = new Set(['openai-completions', 'openai-responses', 'anthropic-messages', 'google-generative-ai']);

export function gatewayConfig(env) {
  if (!env.OPENCLAWAPI_KEY?.trim()) throw new Error('Set OPENCLAWAPI_KEY for Gateway authentication.');
  if (!env.OPENCLAW_MODEL_API_KEY?.trim()) throw new Error('Set OPENCLAW_MODEL_API_KEY for the chosen model provider.');
  if (env.OPENCLAWAPI_KEY === env.OPENCLAW_MODEL_API_KEY) {
    throw new Error('Gateway and model provider credentials must be different.');
  }
  const baseUrl = new URL(env.OPENCLAW_MODEL_BASE_URL || 'https://api.openai.com/v1');
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
