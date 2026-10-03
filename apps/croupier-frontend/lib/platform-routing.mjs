import { gameEntryRedirect } from '../../../web/public/game-entry-contract.mjs';
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
export const PLATFORM_SOCKET_ENDPOINTS = Object.freeze({
  '/speech-stream': '/api/platform-speech-stream',
  '/lipsync-worker': '/api/platform-lipsync-worker',
});

export function exactPlatformOrigin(value, name) {
  let url;
  try { url = new URL(value); } catch { throw Error(`${name} must be an exact HTTPS origin.`); }
  if (url.protocol !== 'https:' || value !== url.origin || url.username || url.password || LOOPBACK.has(url.hostname)) {
    throw Error(`${name} must be an exact HTTPS origin.`);
  }
  return url.origin;
}

export function platformConfiguration(env = process.env) {
  if (env.CROUPIER_VERCEL_UI !== '1') return null;
  const publicOrigin = exactPlatformOrigin(env.CROUPIER_PUBLIC_ORIGIN, 'CROUPIER_PUBLIC_ORIGIN');
  const backendOrigin = exactPlatformOrigin(env.CROUPIER_BACKEND_ORIGIN, 'CROUPIER_BACKEND_ORIGIN');
  const labUiOrigin = exactPlatformOrigin(env.CROUPIER_LAB_UI_ORIGIN, 'CROUPIER_LAB_UI_ORIGIN');
  const secret = env.CROUPIER_VERCEL_INGRESS_SECRET;
  if (new Set([publicOrigin, backendOrigin, labUiOrigin]).size !== 3) throw Error('Public UI, backend transport and Lab UI origins must be distinct.');
  if (typeof secret !== 'string' || secret.length < 32 || /[\r\n]/.test(secret)) throw Error('A private ingress secret of at least 32 bytes is required.');
  return { publicOrigin, backendOrigin, labUiOrigin, secret,
    ...(env.CROUPIER_STUDIO_NATIVE_ADMIN === '1' ? { nativeStudio: true } : {}),
    ...(env.CROUPIER_STUDIO_NEON_POLICY === '1' ? { canonicalGame: true } : {}) };
}

export function canonicalPlatformPath(value) {
  if (typeof value !== 'string') return null;
  const path = value.split('?')[0];
  if (!path.startsWith('/') || /[%\\\x00-\x20]/.test(path) || path.includes('//')) return null;
  if (path.split('/').some(part => part === '.' || part === '..')) return null;
  return path;
}

const AUTH = new Set([
  '/api/auth/session', '/api/auth/login', '/api/auth/logout', '/api/auth/player/login', '/api/auth/player/register',
  '/api/auth/bo/start', '/api/auth/bo/callback', '/api/auth/lab/start', '/api/auth/lab/callback',
]);
const PLAYER = new Set(['/api/player', '/api/table', '/api/deposit', '/api/balance', '/api/currency', '/chat']);
const PRESENTATION = new Set(['/api/presentation/config', '/api/presentation/select', '/api/presentation/idle-advice', '/api/presentation/legacy-config']);
const LAB_API = /^\/studio\/api\/(?:project|videos|voice|inputs|chat|clip-controls|presentation|social|probe|simulate|zones|original-media|generated-speech)(?:\/|$)/;
const PUBLIC_MEDIA = /^\/(?:assets|dealer|dealers\/(?:astrid|vera|amira|mei)|sfx|kevin-cards|review|media\/(?:dealers\/(?:astrid|vera|amira|mei)|game|site)\/runtime)(?:\/|$)/;

// The routing boundary deliberately has no general /api or /bo catch-all.
// Every group retains the backend's own session, role and request validation.
export function backendPlatformPath(value) {
  const path = canonicalPlatformPath(value);
  if (!path) return false;
  return AUTH.has(path) || PLAYER.has(path) || PRESENTATION.has(path) || LAB_API.test(path)
    || path === '/api/studio-game/command'
    || /^\/api\/bo\/[a-z0-9][a-z0-9/-]*$/.test(path)
    || /^\/api\/v1\/(?:events|ping|launch|generations|assets|player|table|deposit|balance|currency|history|lobby|demo-credit)(?:\/|$)/.test(path)
    || /^\/api\/(?:probe|chat\/memory|astrid\/(?:observation|transcription)|generated-speech)(?:\/|$)/.test(path)
    || /^\/api\/presentation\/videos\/[a-zA-Z0-9_-]+$/.test(path)
    || /^\/bo\/(?:gen|thumbs|img)\//.test(path)
    || ['/speech-stream', '/lipsync-worker'].includes(path)
    || PUBLIC_MEDIA.test(path)
    || ['/scene.jpg', '/dealer-fallback.png', '/speech-media.json'].includes(path);
}

export function platformRoute(url, config) {
  const path = canonicalPlatformPath(url.pathname);
  if (!path) return { kind: 'reject' };
  const gameRedirect=gameEntryRedirect(url,{CROUPIER_STUDIO_NEON_POLICY:config.canonicalGame?'1':''});
  if (gameRedirect) return {kind:'redirect',destination:config.publicOrigin+gameRedirect};
  // Internal Node endpoints are reachable through these two exact rewrites.
  // A direct browser/API request must not create an alternative public route.
  if (Object.values(PLATFORM_SOCKET_ENDPOINTS).includes(path)) return {kind: 'reject'};
  if (Object.hasOwn(PLATFORM_SOCKET_ENDPOINTS, path)) return {kind: 'socket', destination: `${config.publicOrigin}${PLATFORM_SOCKET_ENDPOINTS[path]}${url.search}`};
  if ((path === '/' || path === '/game' || path === '/game/' || config.canonicalGame && ['/blackjack','/blackjack/'].includes(path)) && url.searchParams.has('launch')) {
    return { kind: 'backend', destination: `${config.backendOrigin}${path}${url.search}` };
  }
  if (path === '/' && ['dealer', 'presentation', 'performance'].some(key => url.searchParams.has(key))) return {kind: 'redirect', destination: `${config.publicOrigin}/game${url.search}`};
  if (config.nativeStudio && (['/studio/api/project','/studio/api/social'].includes(path)
    || /^\/studio\/api\/(?:videos|clip-controls)(?:\/|$)/.test(path))) {
    return { kind: 'lab', destination: `${config.labUiOrigin}${path}${url.search}` };
  }
  if (backendPlatformPath(path)) return { kind: 'backend', destination: `${config.backendOrigin}${path}${url.search}` };
  if (path === '/studio' || path.startsWith('/studio/')) return { kind: 'lab', destination: `${config.labUiOrigin}${path}${url.search}` };
  return { kind: 'frontend' };
}

export function platformBackendHeaders(headers, config) {
  const result = new Headers(headers);
  for (const name of [...result.keys()]) if (name.startsWith('x-croupier-') || name === 'forwarded') result.delete(name);
  result.set('x-croupier-vercel-secret', config.secret);
  result.set('x-croupier-public-origin', config.publicOrigin);
  result.set('x-forwarded-host', new URL(config.publicOrigin).host);
  result.set('x-forwarded-proto', 'https');
  return result;
}
