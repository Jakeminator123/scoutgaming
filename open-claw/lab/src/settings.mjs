import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, basename, dirname } from 'node:path';
import { parseEnv } from 'node:util';

// Resolve as a filesystem path, not a bundled URL asset. The same adapter is
// also imported by the local Next.js studio.
export const LAB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ENV_FILES = basename(dirname(resolve(LAB_ROOT))) === 'open-claw'
  ? [resolve(LAB_ROOT, '../../.env'), resolve(LAB_ROOT, '.env')] : [resolve(LAB_ROOT, '.env')];
const KEYS = ['HOST', 'PORT', 'LAB_API_TOKEN', 'LAB_DATA_DIR', 'LAB_REMOTE_URL', 'LAB_REMOTE_TOKEN',
  'OPENCLAW_BASE_URL', 'OPENCLAW_HOSTPORT', 'OPENCLAWAPI_KEY', 'OPENCLAW_AGENT', 'OPENCLAW_CHAT_AGENT', 'OPENCLAW_TIMEOUT_MS',
  'OPENCLAW_SPEECH_AGENT', 'OPENCLAW_PRODUCT_SPEECH_URL', 'OPENCLAW_PRODUCT_SPEECH_TOKEN', 'OPENCLAW_MODEL_API_KEY',
  'OPENCLAW_DASHBOARD_ENABLED', 'OPENCLAW_DASHBOARD_ORIGIN', 'OPENCLAW_DASHBOARD_ALLOW_LOOPBACK', 'RENDER_EXTERNAL_URL',
  'LAB_COMPANION_ENABLED', 'LAB_COMPANION_FUN_ENABLED', 'LAB_COMPANION_WEB_ENABLED'];
export const isLoopback = hostname => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);

export function assertProductSpeechCredentialIsolation({ speechToken = '', apiToken = '', remoteToken = '', gatewayKey = '', modelKey = '' } = {}) {
  const speech = String(speechToken).trim();
  if (!speech) return;
  const reserved = [apiToken, remoteToken, gatewayKey, modelKey].map(value => String(value || '').trim()).filter(Boolean);
  if (reserved.includes(speech)) throw new Error('OPENCLAW_PRODUCT_SPEECH_TOKEN must not reuse a lab, Gateway, or model-provider credential.');
}

// Only these lab settings are read. The model credential is compared for aliasing
// and is never returned or forwarded by this settings adapter.
export function readSettings({ env = process.env, envFiles = DEFAULT_ENV_FILES } = {}) {
  const values = {};
  for (const path of envFiles) {
    try {
      const parsed = parseEnv(readFileSync(path, 'utf8'));
      for (const key of KEYS) if (parsed[key] !== undefined) values[key] = parsed[key];
    } catch (error) { if (error.code !== 'ENOENT') throw new Error('Could not parse lab environment file.'); }
  }
  for (const key of KEYS) if (env[key] !== undefined) values[key] = env[key];
  const timeout = Number(values.OPENCLAW_TIMEOUT_MS ?? 2500);
  const settings = {
    host: values.HOST || '127.0.0.1', port: Number(values.PORT || 4188),
    apiToken: values.LAB_API_TOKEN || '', dataDir: resolve(values.LAB_DATA_DIR || resolve(LAB_ROOT, 'data')),
    remoteUrl: values.LAB_REMOTE_URL || '', remoteToken: values.LAB_REMOTE_TOKEN || '',
    baseUrl: values.OPENCLAW_BASE_URL || (values.OPENCLAW_HOSTPORT ? `http://${values.OPENCLAW_HOSTPORT}` : ''),
    gatewayKey: values.OPENCLAWAPI_KEY || '', agent: values.OPENCLAW_AGENT || 'openclaw/croupier-director',
    chatAgent: values.OPENCLAW_CHAT_AGENT || 'openclaw/croupier-chat',
    speechAgent: values.OPENCLAW_SPEECH_AGENT || 'openclaw/croupier-speech',
    speechUrl: values.OPENCLAW_PRODUCT_SPEECH_URL || '', speechToken: values.OPENCLAW_PRODUCT_SPEECH_TOKEN || '',
    companionEnabled: values.LAB_COMPANION_ENABLED !== 'false',
    companionFunEnabled: values.LAB_COMPANION_FUN_ENABLED !== 'false',
    companionWebEnabled: values.LAB_COMPANION_WEB_ENABLED !== 'false',
    dashboardOrigin: values.OPENCLAW_DASHBOARD_ORIGIN || (values.OPENCLAW_DASHBOARD_ENABLED === 'true' ? values.RENDER_EXTERNAL_URL || '' : ''),
    dashboardAllowLoopback: values.OPENCLAW_DASHBOARD_ALLOW_LOOPBACK === 'true',
    adviceTimeoutMs: Number.isFinite(timeout) ? Math.max(50, Math.min(timeout, 30000)) : 2500,
  };
  assertProductSpeechCredentialIsolation({ ...settings, modelKey: values.OPENCLAW_MODEL_API_KEY });
  return settings;
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
