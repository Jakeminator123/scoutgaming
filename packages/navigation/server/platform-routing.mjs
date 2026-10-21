import { presentationPublicSource } from '../../presentation/public-modules.mjs';
import { gameEntryRedirect, approvedGameQuery } from '../game-entry.mjs';
import {adminDocumentHref} from '../admin-workspace-routes.mjs';
import {legacyActivityDocumentHref} from '../control-flow.mjs';
import { requestedOperator } from '../operator-entry.mjs';
import { resolveWorkspaceSurfacePath } from '../workspace-surfaces.mjs';
import {canonicalPlatformPath, PLATFORM_SOCKET_ENDPOINTS, movingWorkerSocketPath} from '../../server-transport/paths.mjs';
export {canonicalPlatformPath, PLATFORM_SOCKET_ENDPOINTS} from '../../server-transport/paths.mjs';
export {exactPlatformOrigin, platformConfiguration} from '../../server-transport/configuration.mjs';

// Launch payload only. The signature stays the engine's; the claim name is partner.
export function launchHasPartnerClaim(token) {
  if (typeof token !== 'string' || token.length > 16384) return false;
  const part = token.split('.');
  if (part.length !== 3 || part[1].length === 0 || part[1].length > 12000) return false;
  try {
    const payload = JSON.parse(Buffer.from(part[1], 'base64url').toString());
    return typeof payload?.partner === 'string' && payload.partner.length > 0;
  } catch { return false; }
}

// A signed launch with claims.partner wins over ?operator=. An invalid slug is omitted.
// Without an operator parameter the original search is returned unchanged.
export function launchBackendSearch(url) {
  if (!url.searchParams.has('operator')) return url.search;
  if (launchHasPartnerClaim(url.searchParams.get('launch')) || typeof requestedOperator(url.searchParams) !== 'string') {
    const params = new URLSearchParams(url.search);
    params.delete('operator');
    const text = params.toString();
    return text ? `?${text}` : '';
  }
  return url.search;
}

const AUTH = new Set([
  '/api/auth/session', '/api/auth/login', '/api/auth/logout', '/api/auth/player/login', '/api/auth/player/register',
  '/api/auth/bo/start', '/api/auth/bo/callback', '/api/auth/lab/start', '/api/auth/lab/callback',
]);
const PLAYER = new Set(['/api/operator/appearance','/api/player', '/api/profile', '/api/table', '/api/deposit', '/api/balance', '/api/currency', '/api/history', '/chat']);
const BACKOFFICE = new Set(['/api/bo/config', '/api/bo/game-login', '/api/bo/lab-login', '/api/bo/speech-qa']);
// Public, unlisted roulette diagnostics; exact files only, no game/server source.
const ROULETTE_PREVIEW = new Set(['/roulette-test', '/roulette-test/', '/roulette-test/app.mjs', '/roulette-test/style.css', '/api/roulette-test/spin']);
const ROULETTE_ROOM = new Set(['/roulette','/roulette/','/play/roulette','/play/roulette/','/roulette/app.mjs','/roulette/style.css','/roulette/scene.mjs','/roulette/media.mjs','/roulette/table-layout.mjs','/roulette/wheel.mjs','/roulette/wheel-motion.mjs','/roulette/assets/roulette-bord.png','/published-scene.mjs','/operator-rooms-contract.mjs','/operator-preview-contract.mjs','/roulette-idle-contract.mjs','/roulette-start-contract.mjs','/material-catalog.mjs','/background-materials.mjs','/roulette-rules.mjs','/api/roulette/table']);
const PRESENTATION = new Set(['/api/presentation/config', '/api/presentation/select', '/api/presentation/idle-advice', '/api/presentation/legacy-config',
  '/api/presentation/native-p6-playback-context']);
const LAB_API = /^\/studio\/api\/(?:project|videos|dealers|layer-assets|voice|inputs|chat|clip-controls|presentation|social|probe|simulate|zones|generated-speech)(?:\/|$)/;
const PUBLIC_MEDIA = /^\/(?:assets|dealer|dealers\/(?:astrid|vera|amira|mei)|sfx|kevin-cards|review|media\/(?:dealers\/(?:astrid|vera|amira|mei)|game|site)\/runtime)(?:\/|$)/;

// Preview documents and commands share the signed transport. The backend still
// requires the current Studio administrator and the session owner on every call.
const PREVIEW_UUID = '[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}';
const STUDIO_PREVIEW = new RegExp('^(?:/studio-preview/' + PREVIEW_UUID
  + '|/api/studio-preview(?:/' + PREVIEW_UUID
  + '(?:/(?:player|table|session|presentation/(?:config|legacy-config|select|idle-advice)|(?:videos|layers)/' + PREVIEW_UUID + '))?)?)$');
// The routing boundary deliberately has no general /api or /bo catch-all.
// Every group retains the backend's own session, role and request validation.
export function backendPlatformPath(value) {
  const path = canonicalPlatformPath(value);
  if (!path) return false;
  return (path.startsWith('/packages/') && Boolean(presentationPublicSource(path))) || AUTH.has(path) || PLAYER.has(path) || PRESENTATION.has(path) || LAB_API.test(path) || ROULETTE_PREVIEW.has(path) || ROULETTE_ROOM.has(path)
    || path === '/api/operators'
    || path === '/api/studio-game/command'
    || /^\/api\/moving-speech\/[a-f0-9]{32}\/rest$/.test(path)
    || /^\/api\/moving-speech\/bank\/[a-f0-9]{64}\/(?:archive|receipt)$/.test(path)
    || path === '/api/dealer/observation'
    || path === '/api/dealer/transcription'
    || STUDIO_PREVIEW.test(path)
    || BACKOFFICE.has(path)
    || /^\/api\/v1\/(?:events|ping|launch|generations|assets|player|table|deposit|balance|currency|history|lobby|demo-credit)(?:\/|$)/.test(path)
    || /^\/api\/operators\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\/rooms)?$/.test(path)
    || /^\/api\/operators\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*\/rooms\/[a-z][a-z0-9-]{0,63}\/preview(?:\/media\/[1-9][0-9]{0,15}\/[a-z][a-z0-9-]{0,39}\/(?:dealer|table|background)\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})?$/.test(path)
    || /^\/api\/(?:probe|chat\/memory|astrid\/(?:observation|transcription)|generated-speech)(?:\/|$)/.test(path)
    || /^\/api\/presentation\/layers\/[a-z][a-z0-9-]{0,62}\/[a-f0-9-]{36}$/.test(path)
    || /^\/api\/presentation\/registered-idle\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*\/[a-z][a-z0-9-]{0,63}\/[1-9][0-9]{0,15}\/[a-z][a-z0-9-]{0,39}$/.test(path)
    || /^\/api\/presentation\/registered-video\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*\/[a-z][a-z0-9-]{0,63}\/[1-9][0-9]{0,15}\/[a-z][a-z0-9-]{0,39}\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(path)
    || /^\/api\/presentation\/videos\/[a-zA-Z0-9_-]+$/.test(path)
    || /^\/bo\/(?:gen|thumbs|img)\//.test(path)
    || ['/speech-stream', '/lipsync-worker', '/moving-speech-stream'].includes(path) || movingWorkerSocketPath(path)
    || PUBLIC_MEDIA.test(path)
    || ['/scene.jpg', '/dealer-fallback.png', '/speech-media.json'].includes(path);
}

// A bare public Blackjack address is a lobby entry, not a global dealer choice.
// Explicit selectors (even malformed ones) keep their existing validation/auth path.
export function blackjackLobbyDestination(url, config) {
  if (!config?.unifiedUi || !config.canonicalGame
    || !['/play/blackjack','/play/blackjack/','/blackjack','/blackjack/'].includes(url.pathname)) return null;
  const context = ['table','dealer','lane','presentation','launch','rehearsal',
    'performance','motion','labObserverOrigin','labObserverChannel'];
  if (context.some(key => url.searchParams.has(key))) return null;
  const operator = requestedOperator(url.searchParams);
  if (operator === null) return null; // Preserve the existing invalid/duplicate selector handling.
  return typeof operator === 'string' ? '/play?'+new URLSearchParams({operator}).toString() : '/play';
}

export function platformRoute(url, config, request) {
  const retiredDocument = /^\/(?:studio\/)?control\/(?:rooms|companies|lanes|guide|videos|probe|replies|events|tree|compositions|rehearsal|preview|zones|activity|openclaw|operator-chat|ops|clips)$/.test(url.pathname);
  if((config.nativeStudio||retiredDocument)&&(!request||['GET','HEAD'].includes(request.method)&&!request.body&&!request.headers.has('next-action'))){
    const documentHref=url.pathname+url.search+url.hash;
    const destination=/^\/(?:studio\/)?control\/activity$/.test(url.pathname) ? legacyActivityDocumentHref(documentHref) : adminDocumentHref(documentHref);
    if(destination!==documentHref)return {kind:'redirect',destination:config.publicOrigin+destination};
  }
  // Next encodes the literal catch-all folder in these two generated chunks.
  // Allow only their hashed JS assets; encoded document/API paths stay rejected.
  if (/^\/studio\/_next\/static\/chunks\/app\/(?:control|partner)\/%5B%5B\.\.\.path%5D%5D\/page-[0-9a-f]+\.js$/i.test(url.pathname)) {
    return { kind: 'lab', destination: `${config.labUiOrigin}${url.pathname}${url.search}` };
  }
  const path = canonicalPlatformPath(url.pathname);
  if (!path) return { kind: 'reject' };
  if(config.unifiedUi && ['/administration','/administration/'].includes(path)){
    return {kind:'redirect',destination:`${config.publicOrigin}/control/administration${url.search}`};
  }
  const lobby = blackjackLobbyDestination(url, config);
  if (lobby) return {kind:'redirect',destination:config.publicOrigin+lobby};
  if(config.unifiedUi && config.canonicalGame){
    const previous=gameEntryRedirect(url,{CROUPIER_STUDIO_NEON_POLICY:'1'});
    if(previous||['/blackjack','/blackjack/','/play/blackjack/'].includes(path)){
      const query=approvedGameQuery(url.searchParams,{origin:url.origin});
      if(launchHasPartnerClaim(query.get('launch'))) query.delete('operator');
      const text=query.toString();
      return {kind:'redirect',destination:`${config.publicOrigin}/play/blackjack${text?'?'+text:''}`};
    }
    if(path==='/play/blackjack'&&url.searchParams.has('launch')){
      // Preserve the existing signed launch handler and game-session audience.
      return {kind:'backend',destination:`${config.backendOrigin}/blackjack${launchBackendSearch(url)}`};
    }
  }
  if (path === '/play' || path === '/play/' || path === '/play/profil' || path === '/play/profil/' || path === '/play/historik' || path === '/play/historik/') {
    return {kind: 'frontend'};
  }
  const gameRedirect=gameEntryRedirect(url,{CROUPIER_STUDIO_NEON_POLICY:config.canonicalGame?'1':''});
  if (gameRedirect) return {kind:'redirect',destination:config.publicOrigin+gameRedirect};
  // Internal Node endpoints are reachable through these two exact rewrites.
  // A direct browser/API request must not create an alternative public route.
  if (Object.values(PLATFORM_SOCKET_ENDPOINTS).includes(path)) return {kind: 'reject'};
  if (Object.hasOwn(PLATFORM_SOCKET_ENDPOINTS, path)) return {kind: 'socket', destination: `${config.publicOrigin}${PLATFORM_SOCKET_ENDPOINTS[path]}${url.search}`};
  if ((path === '/' || path === '/game' || path === '/game/' || config.canonicalGame && ['/blackjack','/blackjack/'].includes(path)) && url.searchParams.has('launch')) {
    return { kind: 'backend', destination: `${config.backendOrigin}${path}${launchBackendSearch(url)}` };
  }
  if (path === '/' && ['dealer', 'presentation', 'performance'].some(key => url.searchParams.has(key))) return {kind: 'redirect', destination: `${config.publicOrigin}/game${url.search}`};
  const workspace = config.nativeStudio && resolveWorkspaceSurfacePath(path);
  if(workspace?.canonicalPath && workspace.publicPath!==workspace.canonicalPath){
    return {kind:'redirect',destination:`${config.publicOrigin}${workspace.canonicalPath}${url.search}`};
  }
  if (path === '/admin' || path.startsWith('/admin/') || path === '/lobby' || path.startsWith('/lobby/')) {
    return { kind: 'lab', destination: `${config.labUiOrigin}/studio${path}${url.search}` };
  }
  if (workspace && (path === '/control' || path.startsWith('/control/') || path === '/partner' || path.startsWith('/partner/'))) {
    return { kind: 'lab', destination: `${config.labUiOrigin}${workspace.studioPath}${url.search}` };
  }
  if (config.nativeStudio && (['/studio/api/project','/studio/api/social'].includes(path)
    || /^\/studio\/api\/(?:videos|dealers|clip-controls|layer-assets|replies)(?:\/|$)/.test(path))) {
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
