import { isIP } from 'node:net';

const REQUIRED = ['BETTALOTTO_PARTNER_KEY_ID', 'BETTALOTTO_PARTNER_SECRET', 'BETTALOTTO_PARTNER_PLAYER_ID'];
// Match the credentials minted by web/partner-api.mjs. Shape is only a local
// check; Bettalotto must still authenticate the pair and authorize the scope.
const CREDENTIAL_FORMATS = {
  BETTALOTTO_PARTNER_KEY_ID: /^ck_live_[A-Za-z0-9_-]{24}$/,
  BETTALOTTO_PARTNER_SECRET: /^cs_[A-Za-z0-9_-]{43}$/,
};

export function partnerEnvironment(env) {
  return Object.fromEntries([...REQUIRED, 'BETTALOTTO_PARTNER_BASE_URL', 'CROUPIER_GAME_ORIGIN'].map(name => [name,
    // A present canonical value wins even when blank: never silently replace an
    // intentional empty/invalid setting with credentials from another namespace.
    env[name] !== undefined ? env[name] : name.startsWith('BETTALOTTO_PARTNER_') ? env[name.replace('BETTALOTTO_PARTNER_', 'LAB_PARTNER_')] : undefined,
  ]));
}

// This is an operator-configured observer, never a client-selected HTTP proxy.
// Loopback is allowed only for deliberately configured, isolated local servers.
function approvedOrigin(value, cloudOrigin) {
  try {
    const url = new URL(value || 'https://bettalotto.se');
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    if (url.origin === 'https://bettalotto.se') return url.origin;
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol)) return url.origin;
    // A cloud game is an exact server-side allowlist entry, never a request
    // parameter. Reject IPs, local names and non-default ports as destinations.
    if (cloudOrigin && url.protocol === 'https:' && !url.port && !isIP(url.hostname)
      && url.hostname.includes('.') && !url.hostname.endsWith('.local')
      && cloudOrigin === url.origin && cloudOrigin === value) return url.origin;
  } catch { /* Never return an invalid URL: it may contain credentials. */ }
  return null;
}

function configuration(env) {
  const missing = REQUIRED.filter(name => typeof env[name] !== 'string' || !env[name].trim());
  const invalid = REQUIRED.filter(name => !missing.includes(name) &&
    (env[name].length > 512 || /[\r\n\0]/.test(env[name]) ||
      CREDENTIAL_FORMATS[name] && !CREDENTIAL_FORMATS[name].test(env[name])));
  const origin = approvedOrigin(env.BETTALOTTO_PARTNER_BASE_URL, env.CROUPIER_GAME_ORIGIN);
  if (!origin) invalid.push('BETTALOTTO_PARTNER_BASE_URL');
  return { configured: missing.length === 0 && invalid.length === 0, missing, invalid,
    endpoint: origin ? `${origin}/api/v1/events` : null, scope: 'events or play',
    channel: 'api-key + partner-player', replay: false, readOnly: true };
}

// Configuration status for the partner reference (/api/inputs/reference).
// It only validates operator-configured settings and never opens a connection.
export function createPartnerObserver({ env = () => process.env } = {}) {
  const environment = () => partnerEnvironment(typeof env === 'function' ? env() : env);
  function status() { return configuration(environment()); }
  return { status };
}
