export const DIRECTOR_ENV_KEYS = ['HOST', 'PORT', 'LAB_API_TOKEN', 'LAB_DATA_DIR', 'LAB_REMOTE_URL', 'LAB_REMOTE_TOKEN',
  'OPENCLAW_BASE_URL', 'OPENCLAW_HOSTPORT', 'OPENCLAW_API_KEY', 'OPENCLAWAPI_KEY', 'OPENCLAW_STUDIO_ADMIN_DEVICE_KEY', 'OPENCLAW_AGENT', 'OPENCLAW_CHAT_AGENT', 'OPENCLAW_TIMEOUT_MS',
  'OPENCLAW_SPEECH_AGENT', 'OPENCLAW_PRODUCT_SPEECH_URL', 'OPENCLAW_PRODUCT_SPEECH_TOKEN',
  'OPENCLAW_SPEECH_ROUTING', 'OPENCLAW_SPEECH_DEEP_MODEL', 'OPENCLAW_SPEECH_TIMEOUT_MS',
  'OPENCLAW_DASHBOARD_ENABLED', 'OPENCLAW_DASHBOARD_ORIGIN', 'OPENCLAW_DASHBOARD_ALLOW_LOOPBACK', 'RENDER_EXTERNAL_URL',
  'LAB_COMPANION_ENABLED', 'LAB_COMPANION_FUN_ENABLED', 'LAB_COMPANION_WEB_ENABLED'];

export const isLoopback = hostname => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);

// Merge one already-read layer; callers own file selection, IO and environment access.
export function mergeDirectorEnvironment(values, source) {
  for (const key of DIRECTOR_ENV_KEYS) if (source[key] !== undefined) values[key] = source[key];
  if (source.OPENCLAW_API_KEY !== undefined || source.OPENCLAWAPI_KEY !== undefined) {
    values.OPENCLAW_API_KEY = source.OPENCLAW_API_KEY ?? source.OPENCLAWAPI_KEY;
  }
  return values;
}

export function projectDirectorSettings(values) {
  const timeout = Number(values.OPENCLAW_TIMEOUT_MS ?? 2500);
  return {
    remoteUrl: values.LAB_REMOTE_URL || '', remoteToken: values.LAB_REMOTE_TOKEN || '',
    baseUrl: values.OPENCLAW_BASE_URL || (values.OPENCLAW_HOSTPORT ? `http://${values.OPENCLAW_HOSTPORT}` : ''),
    gatewayKey: (values.OPENCLAW_API_KEY ?? values.OPENCLAWAPI_KEY) || '', adminDeviceKey: values.OPENCLAW_STUDIO_ADMIN_DEVICE_KEY || '', agent: values.OPENCLAW_AGENT || 'openclaw/croupier-director',
    chatAgent: values.OPENCLAW_CHAT_AGENT || 'openclaw/croupier-chat',
    speechAgent: values.OPENCLAW_SPEECH_AGENT || 'openclaw/croupier-speech',
    speechUrl: values.OPENCLAW_PRODUCT_SPEECH_URL || '', speechToken: values.OPENCLAW_PRODUCT_SPEECH_TOKEN || '',
    speechRouting: values.OPENCLAW_SPEECH_ROUTING ?? 'fixed',
    speechDeepModel: values.OPENCLAW_SPEECH_DEEP_MODEL ?? 'gpt-6-sol',
    ...(values.OPENCLAW_SPEECH_TIMEOUT_MS === undefined ? {} : { speechTimeoutMs: Number(values.OPENCLAW_SPEECH_TIMEOUT_MS) }),
    companionEnabled: values.LAB_COMPANION_ENABLED !== 'false',
    companionFunEnabled: values.LAB_COMPANION_FUN_ENABLED !== 'false',
    companionWebEnabled: values.LAB_COMPANION_WEB_ENABLED !== 'false',
    dashboardOrigin: values.OPENCLAW_DASHBOARD_ORIGIN || (values.OPENCLAW_DASHBOARD_ENABLED === 'true' ? values.RENDER_EXTERNAL_URL || '' : ''),
    dashboardAllowLoopback: values.OPENCLAW_DASHBOARD_ALLOW_LOOPBACK === 'true',
    adviceTimeoutMs: Number.isFinite(timeout) ? Math.max(50, Math.min(timeout, 30000)) : 2500,
  };
}

export function gatewayEndpoint(baseUrl) {
  const url = new URL(baseUrl);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid gateway URL');
  if (url.protocol === 'http:' && !isLoopback(url.hostname) && !url.hostname.endsWith('.internal') && url.hostname.includes('.')) {
    throw new Error('Public gateway connections require HTTPS');
  }
  url.pathname = `${url.pathname.replace(/\/$/, '').replace(/\/v1$/, '')}/v1/chat/completions`;
  return url.href;
}
