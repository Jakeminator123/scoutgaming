import { validateStudioPreview } from './game-entry-contract.mjs';
export { validateStudioPreview };
import { isDealerId } from './dealer-identity.mjs';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export const STUDIO_PREVIEW_NOTICE = 'Provspel med separat testsaldo. Chatt, minne, kamera, OpenClaw och genererat tal är avstängda. Inspelade repliker, regler och automatiska klipp använder den sparade sammansättningen.';
const fail = (code = 'studio_preview_invalid') => { throw Object.assign(new Error(code === 'studio_preview_expired' ? 'Provspelet har gått ut. Starta ett nytt från Sammansättning.' : 'Provspelets session kunde inte verifieras.'), {code}); };
export function studioPreviewFromDocument(dataset, pathname) {
  if (dataset?.studioPreview === undefined) {
    if (pathname.startsWith('/studio-preview')) fail();
    return null;
  }
  if (typeof dataset.studioPreview !== 'string' || dataset.studioPreview.length > 1000) fail();
  const context = validateStudioPreview(JSON.parse(dataset.studioPreview));
  if (pathname !== '/studio-preview/' + context.sessionId || dataset.gameLane !== context.presentationLaneId
    || ['gameOperator','gameRoomId','gamePackageRevision','gameBranding'].some(key => dataset[key] !== undefined)) fail();
  if(dataset.gameComposition!==undefined){
    const composition=JSON.parse(dataset.gameComposition);
    if(!Array.isArray(composition.assets)||composition.assets.some(asset=>asset.src!=='/api/studio-preview/'+context.sessionId+'/layers/'+asset.id))fail();
  }
  return context;
}
export function validateStudioPreviewSession(value, context) {
  if (!value || value.authenticated !== true || value.preview !== true || value.guest !== false) fail();
  const received = validateStudioPreview(value.studioPreview);
  if (Object.keys(context).some(key => received[key] !== context[key])
    || value.externalServices?.ai !== false || value.externalServices?.speech !== false
    || !Array.isArray(value.dealerAvailability) || value.dealerAvailability.length > 100) fail();
  const seen = new Set();
  for (const row of value.dealerAvailability) {
    if (!row || !isDealerId(row.id) || seen.has(row.id) || typeof row.label !== 'string' || row.label.length > 120
      || typeof row.playable !== 'boolean' || (row.playable ? row.reason !== null : row.reason !== 'studio_preview_idle_required')) fail();
    seen.add(row.id);
  }
  return value;
}
const routes = new Map([
  ['/api/player', ['POST','/player']], ['/api/table', ['POST','/table']], ['/api/auth/session', ['GET','/session']],
  ['/api/presentation/config', ['GET','/presentation/config']], ['/api/presentation/legacy-config', ['GET','/presentation/legacy-config']],
  ['/api/presentation/select', ['POST','/presentation/select']], ['/api/presentation/idle-advice', ['POST','/presentation/idle-advice']],
]);
// Only this client translates APIs; public media and other tabs keep their URLs.
export function createStudioPreviewClient({context = null, fetchImpl = globalThis.fetch, now = Date.now} = {}) {
  context = context ? validateStudioPreview(context) : null;
  const prefix = context ? '/api/studio-preview/' + context.sessionId : null;
  const current = () => { if (context && now() >= Date.parse(context.expiresAt)) fail('studio_preview_expired'); };
  async function request(path, init = {}) {
    if (!context) return fetchImpl(path, init);
    current();
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) fail();
    const parsed = new URL(path, 'https://preview.invalid');
    const route = routes.get(parsed.pathname);
    if (!route || (init.method ?? 'GET').toUpperCase() !== route[0] || parsed.hash) fail('studio_preview_external_unavailable');
    if (parsed.search && (parsed.pathname !== '/api/presentation/config'
      || [...parsed.searchParams.keys()].some(key => key !== 'dealerId')
      || parsed.searchParams.getAll('dealerId').length !== 1 || !isDealerId(parsed.searchParams.get('dealerId')))) fail();
    const response=await fetchImpl(prefix + route[1] + parsed.search, {...init, credentials:'same-origin', cache:'no-store', redirect:'error'});
    if([401,403,404,409,410,412].includes(response.status))fail(response.status===410?'studio_preview_expired':'studio_preview_unavailable');
    return response;
  }
  return Object.freeze({
    context, request,
    async close() {
      if(!context)fail();
      const response=await fetchImpl(prefix,{method:'DELETE',credentials:'same-origin',cache:'no-store',redirect:'error'});
      if(!response.ok && response.status!==410)fail('studio_preview_unavailable');
    },
    async session() {
      const response = await request('/api/auth/session');
      if (!response.ok) fail(response.status === 410 ? 'studio_preview_expired' : 'studio_preview_unavailable');
      const value = await response.json();
      return context ? validateStudioPreviewSession(value, context) : value;
    },
    mediaUrl(video) {
      if (!context) return video.src || '/api/presentation/videos/' + video.id;
      current();
      if (!uuid.test(video.id)) fail();
      const expected = prefix + '/videos/' + video.id;
      if (video.src && video.src !== expected) fail();
      return expected;
    },
  });
}
