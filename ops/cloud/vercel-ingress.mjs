import { timingSafeEqual } from 'node:crypto';
import {sharedRoomSocketPath} from '../../packages/server-transport/paths.mjs';
import {approvedGameQuery} from '../../packages/navigation/game-entry.mjs';
import { isOperatorSlug } from '../../packages/navigation/operator-slug.mjs';
import { exactPlatformOrigin, backendPlatformPath, canonicalPlatformPath } from '../../packages/navigation/server/platform-routing.mjs';

export function readVercelIngressConfig(env = process.env) {
  if (!env.CROUPIER_VERCEL_TRANSPORT_ORIGIN) return null;
  const transportOrigin = exactPlatformOrigin(env.CROUPIER_VERCEL_TRANSPORT_ORIGIN, 'CROUPIER_VERCEL_TRANSPORT_ORIGIN');
  const publicOrigin = exactPlatformOrigin(env.CROUPIER_PUBLIC_ORIGIN, 'CROUPIER_PUBLIC_ORIGIN');
  const secret = env.CROUPIER_VERCEL_INGRESS_SECRET;
  if (transportOrigin === publicOrigin || typeof secret !== 'string' || Buffer.byteLength(secret) < 32 || /[\r\n]/.test(secret)) throw Error('Invalid private Vercel ingress configuration.');
  let movingWorkerOrigin;
  if (env.CROUPIER_MOVING_SPEECH_ENABLED === '1') {
    movingWorkerOrigin = exactPlatformOrigin(env.CROUPIER_MOVING_SPEECH_WORKER_ORIGIN, 'CROUPIER_MOVING_SPEECH_WORKER_ORIGIN');
    const renderOrigin = exactPlatformOrigin(env.RENDER_EXTERNAL_URL, 'RENDER_EXTERNAL_URL');
    if (movingWorkerOrigin !== transportOrigin || movingWorkerOrigin !== renderOrigin) throw Error('Moving worker origin must be this exact Render transport.');
  }
  return { transportOrigin, publicOrigin, secret,
    ...(movingWorkerOrigin ? {movingWorkerOrigin} : {}),
    // The canonical game entry is always on (Neon is the one registry; no flag selects it).
    canonicalGame: true };
}

const MOVING_CHANNEL = /^\/lipsync-moving\/[a-f0-9]{48}\?(?:token=[a-f0-9]{64}&avatar=[a-z][a-z0-9-]{0,39}|avatar=[a-z][a-z0-9-]{0,39}&token=[a-f0-9]{64})$/;
export const movingCallbackPath = target => typeof target === 'string' && MOVING_CHANNEL.test(target);

// This is only routing admission. The application still owns one-use capability
// authorization before any upgrade or bank bytes. No browser/session authority
// is accepted here, and no general unsigned API path is opened.
function directMovingCapability(request, ingress) {
  if (!ingress.movingWorkerOrigin || request.method !== 'GET'
    || request.headers.host !== new URL(ingress.movingWorkerOrigin).host
    || ['origin', 'cookie', 'authorization', 'sec-websocket-protocol', 'range'].some(name => request.headers[name] !== undefined)
    || request.headers['sec-fetch-site'] === 'cross-site') return false;
  return request.headers.upgrade?.toLowerCase() === 'websocket'
    ? movingCallbackPath(request.url)
    : !request.headers.upgrade && /^\/api\/moving-speech\/bank\/[a-f0-9]{64}\/(?:archive|receipt)$/.test(request.url);
}

export function vercelIngressRequest(request, ingress) {
  if (!ingress) return { accepted: true, transported: false };
  const transportHost = new URL(ingress.transportOrigin).host, publicHost = new URL(ingress.publicOrigin).host;
  if (request.headers.host === transportHost && request.method === 'GET' && request.url === '/__cloud/health') return { accepted: true, transported: false, health: true };
  if (request.headers.host === transportHost && ['GET', 'HEAD'].includes(request.method)
      && request.url === '/__cloud/version' && !request.headers.upgrade) return { accepted: true, transported: false, version: true };
  // Read-only feature metadata carries no cookies or credentials to the game.
  if (request.headers.host === transportHost && ['GET', 'HEAD'].includes(request.method)
      && request.url === '/api/presentation/capabilities' && !request.headers.upgrade) {
    return { accepted: true, transported: true, headers: { host: publicHost,
      ...(request.headers['x-presentation-capability-version'] === undefined ? {} : {'x-presentation-capability-version':request.headers['x-presentation-capability-version']}) } };
  }
  if (directMovingCapability(request, ingress)) {
    const headers = {...request.headers, host: publicHost, 'x-forwarded-host': publicHost, 'x-forwarded-proto': 'https'};
    for (const name of Object.keys(headers)) if (name.startsWith('x-croupier-') || name === 'forwarded'
      || name === 'x-forwarded-for' || name === 'x-worker-id') delete headers[name];
    return {accepted: true, transported: true, movingCapability: true, headers};
  }
  // Existing document bookmarks lead to the canonical UI. This does not
  // accept API calls, credentials, launch tickets or a second game origin.
  if (request.headers.host === transportHost && request.method === 'GET' && !request.headers['x-croupier-vercel-secret']) {
    const queryAt=request.url.indexOf('?'),rawPath=queryAt<0?request.url:request.url.slice(0,queryAt);
    const documents=new Map([['/','/game'],['/game','/game'],['/blackjack','/game'],['/v2','/v2'],['/v2/','/v2'],['/casino.html','/play'],
      ['/roulette-test','/roulette-test'],['/roulette-test/','/roulette-test'],
      ['/roulette','/play/roulette'],['/play/roulette','/play/roulette'],
      ['/bo','/control/administration'],['/bo/','/control/administration'],['/bo/index.html','/control/administration'],
      ['/bo/login.html','/control/login'],['/bo/set-password.html','/control/set-password'],
      ['/studio','/studio'],['/studio/','/studio'],['/studio/activity','/studio/activity'],['/studio/administration','/studio/administration'],['/lab','/control'],['/studio-astrid','/control'],['/studio-lissabon','/control']]);
    const destination=documents.get(rawPath);
    if(destination){
      const target=new URL(destination,ingress.publicOrigin),source=new URL(request.url,ingress.transportOrigin);
      // Operator documents without a launch need the signed UI proxy, never the anonymous bookmark redirect.
      if (rawPath === '/blackjack' && source.searchParams.has('operator') && !source.searchParams.has('launch')) return {accepted:false,transported:false};
      if(rawPath==='/bo/login.html'){
        const value=source.searchParams.get('returnTo');
        if(value && (['/studio','/studio/administration','/control','/control/administration'].includes(value) || /^\/api\/bo\/(?:game|lab)-login\?state=[a-f0-9]{64}$/.test(value)))target.searchParams.set('returnTo',value);
      }else if(rawPath==='/bo/set-password.html'){
        const value=source.searchParams.get('t');
        if(value && /^[A-Za-z0-9_-]{32,128}$/.test(value))target.searchParams.set('t',value);
      }else for(const name of ['dealer','rehearsal','presentation']){
          const value=source.searchParams.get(name);
          if(value && /^[a-z0-9_-]{1,40}$/.test(value))target.searchParams.set(name,value);
      }
      return {accepted:true,transported:false,redirect:target.href};
    }
  }
  const key = Buffer.from(ingress.secret), supplied = request.headers['x-croupier-vercel-secret'];
  const bytes = typeof supplied === 'string' ? Buffer.from(supplied) : Buffer.alloc(0);
  const path = canonicalPlatformPath(request.url);
  const launch = path && (['/', '/game', '/game/'].includes(path)
    || ingress.canonicalGame && ['/blackjack','/blackjack/'].includes(path) && ['GET','HEAD'].includes(request.method))
    && new URL(request.url, ingress.publicOrigin).searchParams.has('launch');
  // The canonical UI proxies a player's operator document without a launch ticket.
  // Keep this exact HTML path behind every existing signed transport check.
  const operatorQuery = path === '/blackjack' ? new URL(request.url, ingress.publicOrigin).searchParams : null;
  const approvedOperatorQuery = operatorQuery ? approvedGameQuery(operatorQuery, { origin: ingress.publicOrigin, includeLaunch: false }) : null;
  const operatorDocument = ingress.canonicalGame && path === '/blackjack' && request.url.split('?', 1)[0] === '/blackjack'
    && ['GET', 'HEAD'].includes(request.method) && !request.headers.upgrade && request.headers.accept === 'text/html'
    && operatorQuery?.getAll('operator').length === 1 && isOperatorSlug(operatorQuery.get('operator'))
    && operatorQuery.size === approvedOperatorQuery.size
    && [...operatorQuery].every(([name, value]) => approvedOperatorQuery.get(name) === value);
  const room = sharedRoomSocketPath(request.url);
  if (room) {
    const seen = new Set();
    for (let i = 0; i < (request.rawHeaders?.length ?? 0); i += 2) {
      const name = request.rawHeaders[i].toLowerCase();
      if (seen.has(name)) return {accepted:false,transported:false};
      seen.add(name);
    }
    if (request.method !== 'GET' || request.headers.upgrade?.toLowerCase() !== 'websocket'
      || request.headers.origin !== ingress.publicOrigin || typeof request.headers.cookie !== 'string'
      || !request.headers.cookie || request.headers.cookie.length > 16384
      || ['authorization','x-worker-id','sec-websocket-protocol'].some(name => request.headers[name] !== undefined)) return {accepted:false,transported:false};
  }
  const session = path === '/__vercel/lab/session';
  if (request.headers.host !== transportHost || request.headers['x-croupier-public-origin'] !== ingress.publicOrigin
      || bytes.length !== key.length || !timingSafeEqual(bytes, key)
      || request.headers['x-forwarded-host'] !== publicHost || request.headers['x-forwarded-proto'] !== 'https'
      || !(backendPlatformPath(request.url) || room || launch || operatorDocument || session)
      || (session && request.method !== 'GET')) return { accepted: false, transported: false };
  const headers = {...request.headers, host: publicHost};
  delete headers['x-croupier-vercel-secret']; delete headers['x-croupier-public-origin'];
  delete headers['x-croupier-lab-authorized']; delete headers.forwarded;
  if (room) for (const name of Object.keys(headers)) if (name.startsWith('x-croupier-') || name === 'x-forwarded-for') delete headers[name];
  return { accepted: true, transported: true, session, headers };
}
