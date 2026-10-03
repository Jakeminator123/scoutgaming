import { timingSafeEqual } from 'node:crypto';
import { exactPlatformOrigin, backendPlatformPath, canonicalPlatformPath } from '../../apps/croupier-frontend/lib/platform-routing.mjs';

export function readVercelIngressConfig(env = process.env) {
  if (!env.CROUPIER_VERCEL_TRANSPORT_ORIGIN) return null;
  const transportOrigin = exactPlatformOrigin(env.CROUPIER_VERCEL_TRANSPORT_ORIGIN, 'CROUPIER_VERCEL_TRANSPORT_ORIGIN');
  const publicOrigin = exactPlatformOrigin(env.CROUPIER_PUBLIC_ORIGIN, 'CROUPIER_PUBLIC_ORIGIN');
  const secret = env.CROUPIER_VERCEL_INGRESS_SECRET;
  if (transportOrigin === publicOrigin || typeof secret !== 'string' || Buffer.byteLength(secret) < 32 || /[\r\n]/.test(secret)) throw Error('Invalid private Vercel ingress configuration.');
  return { transportOrigin, publicOrigin, secret,
    ...(env.CROUPIER_STUDIO_NEON_POLICY === '1' ? {canonicalGame:true} : {}) };
}

export function vercelIngressRequest(request, ingress) {
  if (!ingress) return { accepted: true, transported: false };
  const transportHost = new URL(ingress.transportOrigin).host, publicHost = new URL(ingress.publicOrigin).host;
  if (request.headers.host === transportHost && request.method === 'GET' && request.url === '/__cloud/health') return { accepted: true, transported: false, health: true };
  // Existing document bookmarks lead to the canonical UI. This does not
  // accept API calls, credentials, launch tickets or a second game origin.
  if (request.headers.host === transportHost && request.method === 'GET' && !request.headers['x-croupier-vercel-secret']) {
    const queryAt=request.url.indexOf('?'),rawPath=queryAt<0?request.url:request.url.slice(0,queryAt);
    const documents=new Map([['/','/game'],['/game','/game'],['/blackjack','/game'],['/v2','/v2'],['/v2/','/v2'],['/casino.html','/casino.html'],['/bo','/bo'],['/bo/','/bo'],['/bo/login.html','/bo/login.html'],['/studio','/studio'],['/studio/','/studio'],['/studio/activity','/studio/activity'],['/studio/administration','/studio/administration'],['/lab','/studio'],['/studio-astrid','/studio'],['/studio-lissabon','/studio']]);
    const destination=documents.get(rawPath);
    if(destination){
      const target=new URL(destination,ingress.publicOrigin),source=new URL(request.url,ingress.transportOrigin);
      for(const name of ['dealer','rehearsal','presentation']){
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
  const session = path === '/__vercel/lab/session';
  if (request.headers.host !== transportHost || request.headers['x-croupier-public-origin'] !== ingress.publicOrigin
      || bytes.length !== key.length || !timingSafeEqual(bytes, key)
      || request.headers['x-forwarded-host'] !== publicHost || request.headers['x-forwarded-proto'] !== 'https'
      || !(backendPlatformPath(request.url) || launch || session)
      || (session && request.method !== 'GET')) return { accepted: false, transported: false };
  const headers = {...request.headers, host: publicHost};
  delete headers['x-croupier-vercel-secret']; delete headers['x-croupier-public-origin'];
  delete headers['x-croupier-lab-authorized']; delete headers.forwarded;
  return { accepted: true, transported: true, session, headers };
}
