import { StudioError } from './project-store.mjs';

function origin(value, name) {
  let url;
  try { url = new URL(value); } catch { throw new StudioError(`${name} är inte konfigurerad.`, 503); }
  if (url.protocol !== 'https:' || value !== url.origin || url.username || url.password || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new StudioError(`${name} kräver en exakt HTTPS-adress.`, 503);
  }
  return url.origin;
}

export function remoteUiConfiguration(env = process.env) {
  if (env.CROUPIER_LAB_REMOTE_UI !== '1') return null;
  const publicOrigin = origin(env.CROUPIER_PUBLIC_ORIGIN, 'Publik Lab-adress');
  const backendOrigin = origin(env.CROUPIER_BACKEND_ORIGIN, 'Lab-backend');
  const zoneOrigin = origin(env.CROUPIER_LAB_UI_ORIGIN, 'Lab UI-zon');
  const secret = env.CROUPIER_VERCEL_INGRESS_SECRET;
  if (new Set([publicOrigin, backendOrigin, zoneOrigin]).size !== 3 || typeof secret !== 'string' || Buffer.byteLength(secret) < 32 || /[\r\n]/.test(secret)) {
    throw new StudioError('Lab UI-zonens privata anslutning är ogiltig.', 503);
  }
  if (env.CROUPIER_LAB_BASE_PATH !== '/studio') throw new StudioError('Den gemensamma Lab UI-zonen kräver /studio.', 503);
  return { publicOrigin, backendOrigin, zoneOrigin, secret };
}

export function assertRemoteUiPage(request, config) {
  const url = new URL(request.url), host = request.headers.get('host') || url.host;
  const hosts = new Set([new URL(config.publicOrigin).host, new URL(config.zoneOrigin).host]);
  if (request.method !== 'GET' || request.headers.has('next-action') || !hosts.has(host) || !hosts.has(url.host)) throw new StudioError('Ogiltig Lab UI-begäran.', 403);
  if (['iframe', 'frame', 'embed', 'object'].includes(request.headers.get('sec-fetch-dest'))) throw new StudioError('Öppna labbet som en egen sida.', 403);
  const from = request.headers.get('origin');
  if (from && from !== config.publicOrigin && from !== config.zoneOrigin) throw new StudioError('Begäran måste komma från labbet.', 403);
  if (request.headers.get('sec-fetch-site') === 'cross-site' && !(request.headers.get('sec-fetch-mode') === 'navigate' && request.headers.get('sec-fetch-dest') === 'document')) throw new StudioError('Begäran måste komma från labbet.', 403);
}

export async function remoteUiRequest(path, request, { config = remoteUiConfiguration(), fetchImpl = fetch } = {}) {
  if (!config || !['/__vercel/lab/session', '/studio/api/project', '/studio/api/videos'].includes(path)) throw new StudioError('Okänd Lab UI-begäran.', 503);
  assertRemoteUiPage(request, config);
  const headers = {
    cookie: request.headers.get('cookie') || '', accept: 'application/json',
    'x-croupier-vercel-secret': config.secret, 'x-croupier-public-origin': config.publicOrigin,
    'x-forwarded-host': new URL(config.publicOrigin).host, 'x-forwarded-proto': 'https',
  };
  let response;
  try { response = await fetchImpl(`${config.backendOrigin}${path}`, { method: 'GET', headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) }); }
  catch { throw new StudioError('Lab-backend kunde inte nås. Inget lokalt projekt har skapats.', 503); }
  if (!response.ok) { await response.body?.cancel(); throw new StudioError(response.status === 401 ? 'Labbinloggning krävs.' : 'Lab-backend kunde inte verifieras.', response.status === 401 ? 401 : 503); }
  try { return await response.json(); }
  catch { throw new StudioError('Lab-backend gav ett ogiltigt svar.', 503); }
}

export async function authorizeRemoteUi(request, options) {
  const session = await remoteUiRequest('/__vercel/lab/session', request, options);
  if (session.authorized !== true) throw new StudioError('Labbinloggning krävs.', 401);
}

export async function remoteUiInitialData(request, options = {}) {
  await authorizeRemoteUi(request, options);
  const [saved, videos] = await Promise.all([
    remoteUiRequest('/studio/api/project', request, options), remoteUiRequest('/studio/api/videos', request, options),
  ]);
  if (!saved.project || typeof saved.project.revision !== 'string' || !Array.isArray(videos.videos)) throw new StudioError('Lab-backend gav ett ogiltigt projekt.', 503);
  return { project: saved.project, videos, status: saved.status };
}
