import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { createProjectStore } from '../lab/lib/project-store.mjs';
import { loadVideoRegistry, getVideoResponse, exactHttpsOrigin } from '../lab/lib/video-registry.mjs';
import { buildRuntimeCatalog, normalizeProject } from '../lab/lib/studio-model.mjs';
import { prepareDecision } from '../open-claw/lab/src/engine.mjs';
import { selectPresentation } from '../presentation-runtime/selection.mjs';
import { createIdleAdviceServer } from '../lab/lib/idle-advice-server.mjs';
import { legacyClipControls } from '../lab/lib/legacy-clip-inventory.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicModules = new Map(['live-idle', 'idle-policy'].map(name => [`/presentation-runtime/${name}.mjs`, `presentation-runtime/${name}.mjs`]));
publicModules.set('/lab/policies/idle-policy.seed.json', 'lab/policies/idle-policy.seed.json');
const modes = new Set(['off', 'rules', 'random', 'shadow', 'active']);
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };

// The request identifies a public instruction. Cards come exclusively from the
// server's committed native presentation, never from a browser-supplied card.
export function presentationInput(event, published) {
  if (['deal', 'reveal'].includes(event?.type)) {
    const source = published.find(item => item.type === event.type && item.shoeDraw === event.shoeDraw
      && item.to === event.to && (event.type === 'reveal' || item.box === event.box));
    if (!source) fail('No committed instruction for this card', 409);
    return { ...source, card: source.faceDown ? null : source.card };
  }
  if (event?.type === 'speak' && typeof event.line === 'string' && /^[a-z]{2,40}$/.test(event.line)) {
    return published.find(item => item.type === 'speak' && item.line === event.line) ?? { type: 'speak', line: event.line };
  }
  fail('Unsupported presentation request');
}

export function createPresentationApi({ db, env = process.env, store = createProjectStore(join(root, 'lab/data')),
  registryOptions = { env, repositoryRoot: root, uploadDir: join(root, 'lab/data', 'videos') },
  select = selectPresentation, directorFetchFactory = null, nativeP6PlaybackContext = null, legacyOptions, registryLoader = () => loadVideoRegistry(registryOptions), videoResponse,
  legacyControls = project => legacyClipControls(project, { ...legacyOptions, ...(env.CROUPIER_DATA_DIR ? { dataDirectory: env.CROUPIER_DATA_DIR } : {}) }) } = {}) {
  const decisions = new Map();
  const configurationSource = store.configurationSource || 'lab/project.json';
  const settings = { remoteUrl: env.CROUPIER_PRESENTATION_DIRECTOR_URL || '', remoteToken: env.CROUPIER_PRESENTATION_DIRECTOR_TOKEN || '', adviceTimeoutMs: 2200 };
  let adviceService;
  return async function handle(req, res, pathname, playerId) {
    const json = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }); res.end(JSON.stringify(value)); };
    if (publicModules.has(pathname) && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': pathname.endsWith('.json') ? 'application/json' : 'text/javascript', 'Cache-Control': 'no-store' });
      res.end(await readFile(join(root, publicModules.get(pathname)))); return true;
    }
    if (!pathname.startsWith('/api/presentation/')) return false;
    try {
      if(pathname==='/api/presentation/native-p6-playback-context'){
        if(typeof nativeP6PlaybackContext!=='function')fail('Unknown presentation endpoint',404);
        if(req.method!=='GET')fail('GET required',405);
        if(new URL(req.url||pathname,'http://local').search)fail('Playback context query forbidden',400);
        if(!playerId)fail('Sign in required',401);
        const project=await store.load();
        json(200,await nativeP6PlaybackContext({req,playerId,project,readProject:()=>store.load()}));return true;
      }
      if (!playerId) fail('Sign in required', 401);
      if (pathname.startsWith('/api/presentation/videos/')) {
        if (!['GET', 'HEAD'].includes(req.method)) fail('GET or HEAD required', 405);
        const id = pathname.slice('/api/presentation/videos/'.length);
        const publicOrigin = env.CROUPIER_CLOUD_RUNTIME === '1' && exactHttpsOrigin(env.PUBLIC_URL) ? env.PUBLIC_URL : null;
        const frontendOrigin = env.CROUPIER_VERCEL_FRONTEND_ORIGIN;
        const trustedProxyOrigin = publicOrigin && exactHttpsOrigin(frontendOrigin)
          && [new URL(publicOrigin).host, new URL(frontendOrigin).host].includes(req.headers.host)
          ? frontendOrigin : null;
        const response = await (videoResponse || ((videoId, request) => getVideoResponse(videoId, request, { ...registryOptions, trustedProxyOrigin })))(id,
          new Request(`${publicOrigin || 'http://localhost'}${pathname}`, { method: req.method, headers: req.headers }),
        );
        res.writeHead(response.status, Object.fromEntries(response.headers));
        if (response.body) Readable.fromWeb(response.body).on('error', () => res.destroy()).pipe(res); else res.end();
        return true;
      }
      if (pathname === '/api/presentation/config' && req.method === 'GET') {
        const [project, inventory] = await Promise.all([store.load(), registryLoader()]);
        json(200, { owner: 'web', revision: project.revision, projectRevision: project.revision, configurationSource, idlePolicy: project.idlePolicy, inventory,
          defaultMode: env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane' ? 'active' : 'off' }); return true;
      }
      if (pathname === '/api/presentation/legacy-config' && req.method === 'GET') {
        const controls = await legacyControls(await store.load());
        json(200, controls.runtime); return true;
      }
      if (!['/api/presentation/select', '/api/presentation/idle-advice'].includes(pathname) || req.method !== 'POST') fail('Unknown presentation endpoint', 404);
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (raw.length > 16384) fail('Presentation request too large', 413); }
      const body = JSON.parse(raw);
      if (pathname === '/api/presentation/idle-advice') {
        const project = await store.load();
        adviceService ??= createIdleAdviceServer({ settings, registryLoader });
        const advise = await adviceService;
        const controller = new AbortController();
        const disconnected = () => { if (!res.writableEnded) controller.abort(); };
        res.once('close', disconnected);
        try {
          const fetchImpl = directorFetchFactory ? await directorFetchFactory({ req, playerId, project,
            readProject: () => store.load(), signal: controller.signal }) : null;
          if (fetchImpl !== null && typeof fetchImpl !== 'function') fail('Director transport unavailable', 503);
          json(200, { ...await advise({ ...body, project }, { signal: controller.signal,
            ...(fetchImpl ? { fetchImpl, ...(fetchImpl.cacheScope === undefined ? {} : { cacheScope: fetchImpl.cacheScope }) } : {}) }),
            projectRevision: project.revision, configurationSource });
        }
        finally { res.removeListener('close', disconnected); }
        return true;
      }
      if (!modes.has(body.mode) || !Number.isInteger(body.version) || typeof body.dealerId !== 'string') fail('Invalid presentation request');
      const [loaded, inventory] = await Promise.all([store.load(), registryLoader()]);
      const project = normalizeProject(loaded, { allowIncompatibleAnimations: true, preserveMissingLanes: true });
      if (!project.dealers.some(dealer => dealer.id === body.dealerId)) fail('Invalid presentation request');
      const receipt = await db.prepare('SELECT version, payload FROM native_presentations WHERE player_id=?').get(playerId);
      if (['deal', 'reveal'].includes(body.event?.type) && receipt?.version !== body.version) fail('Stale presentation', 409);
      const sourceEvent = presentationInput(body.event, receipt?.version === body.version ? JSON.parse(receipt.payload) : []);
      const eventId = prepareDecision(buildRuntimeCatalog(project, body.dealerId), { event: sourceEvent, mode: 'off' }).node.id;
      const key = JSON.stringify([playerId, body.dealerId, body.version, sourceEvent, body.mode, project.revision]);
      const controller = new AbortController();
      const disconnected = () => { if (!res.writableEnded) controller.abort(); };
      res.once('close', disconnected);
      try {
        const fetchImpl = directorFetchFactory ? await directorFetchFactory({ req, playerId, project,
          readProject: () => store.load(), signal: controller.signal }) : null;
        if (fetchImpl !== null && typeof fetchImpl !== 'function') fail('Director transport unavailable', 503);
        const selectOwned = () => select({ requestId: randomUUID(), project, dealerId: body.dealerId, eventId, sourceEvent, mode: body.mode },
          { settings, videoRegistry: inventory, ...(fetchImpl ? { fetchImpl } : {}) }).then(result => {
            const video = inventory.videos.find(item => item.id === result.videoGenerationId);
            const family = inventory.families.find(item => item.id === video?.familyId);
            const standard = inventory.videos.find(item => family?.standardIds.includes(item.id) && item.available);
            const publicVideo = item => item ? { id: item.id, sha256: item.sha256, fileName: item.fileName, src: `/api/presentation/videos/${item.id}` } : null;
            return { ...result, video: publicVideo(video), standard: publicVideo(standard), owner: 'web', projectRevision: project.revision, configurationSource };
          });
        // A QA transport closes over the actual authenticated HTTP request.
        // It must never be reused through the ordinary presentation cache.
        if (fetchImpl) { json(200, await selectOwned()); return true; }
        if (!decisions.has(key)) {
          if (decisions.size >= 256) decisions.delete(decisions.keys().next().value);
          decisions.set(key, selectOwned());
        }
        json(200, await decisions.get(key));
      } finally { res.removeListener('close', disconnected); }
    } catch (error) { json(error.statusCode || 400, { error: error.message || 'Presentation unavailable' }); }
    return true;
  };
}
