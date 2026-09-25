import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { createProjectStore } from '../lab/lib/project-store.mjs';
import { loadVideoRegistry, getVideoResponse } from '../lab/lib/video-registry.mjs';
import { buildRuntimeCatalog } from '../lab/lib/studio-model.mjs';
import { prepareDecision } from '../open-claw/lab/src/engine.mjs';
import { selectPresentation } from '../presentation-runtime/selection.mjs';
import { createIdleAdviceServer } from '../lab/lib/idle-advice-server.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicModules = new Map(['live-idle', 'idle-policy'].map(name => [`/presentation-runtime/${name}.mjs`, `presentation-runtime/${name}.mjs`]));
publicModules.set('/lab/policies/idle-policy.seed.json', 'lab/policies/idle-policy.seed.json');
const modes = new Set(['off', 'rules', 'random', 'shadow', 'active']);
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };

// The request identifies a public instruction. Cards come exclusively from the
// server's committed native presentation, never from a browser-supplied card.
export function presentationInput(event, published) {
  if (event?.type === 'deal') {
    const source = published.find(item => item.type === 'deal' && item.shoeDraw === event.shoeDraw
      && item.to === event.to && item.box === event.box);
    if (!source) fail('No committed instruction for this card', 409);
    return { ...source, card: source.faceDown ? null : source.card };
  }
  if (event?.type === 'speak' && typeof event.line === 'string' && /^[a-z]{2,40}$/.test(event.line)) {
    return published.find(item => item.type === 'speak' && item.line === event.line) ?? { type: 'speak', line: event.line };
  }
  fail('Unsupported presentation request');
}

export function createPresentationApi({ db, env = process.env, store = createProjectStore(env.CROUPIER_PRESENTATION_STUDIO_DIR || join(root, 'lab/data')),
  registryOptions = { snapshotPath: join(root, 'emil/dealklipp-v1/lab-video-manifest.json'), archiveDir: join(root, 'emil/dealklipp-v1'), uploadDir: join(env.CROUPIER_PRESENTATION_STUDIO_DIR || join(root, 'lab/data'), 'videos') },
  select = selectPresentation } = {}) {
  const decisions = new Map();
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
      if (!playerId) fail('Sign in required', 401);
      if (pathname.startsWith('/api/presentation/videos/')) {
        if (!['GET', 'HEAD'].includes(req.method)) fail('GET or HEAD required', 405);
        const id = pathname.slice('/api/presentation/videos/'.length);
        const response = await getVideoResponse(id, new Request(`http://localhost${pathname}`, { method: req.method, headers: req.headers }), registryOptions);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        if (response.body) Readable.fromWeb(response.body).on('error', () => res.destroy()).pipe(res); else res.end();
        return true;
      }
      if (pathname === '/api/presentation/config' && req.method === 'GET') {
        const [project, inventory] = await Promise.all([store.load(), loadVideoRegistry(registryOptions)]);
        json(200, { owner: 'web', revision: project.revision, idlePolicy: project.idlePolicy, inventory,
          defaultMode: env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane' ? 'active' : 'off' }); return true;
      }
      if (!['/api/presentation/select', '/api/presentation/idle-advice'].includes(pathname) || req.method !== 'POST') fail('Unknown presentation endpoint', 404);
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (raw.length > 16384) fail('Presentation request too large', 413); }
      const body = JSON.parse(raw);
      if (pathname === '/api/presentation/idle-advice') {
        const project = await store.load();
        adviceService ??= loadVideoRegistry(registryOptions).then(videoRegistry => createIdleAdviceServer({ settings, videoRegistry }));
        const advise = await adviceService;
        const controller = new AbortController();
        const disconnected = () => { if (!res.writableEnded) controller.abort(); };
        res.once('close', disconnected);
        try { json(200, await advise({ ...body, project }, { signal: controller.signal })); }
        finally { res.removeListener('close', disconnected); }
        return true;
      }
      if (body.dealerId !== 'astrid' || !modes.has(body.mode) || !Number.isInteger(body.version)) fail('Invalid presentation request');
      const receipt = db.prepare('SELECT version, payload FROM native_presentations WHERE player_id=?').get(playerId);
      if (body.event?.type === 'deal' && receipt?.version !== body.version) fail('Stale presentation', 409);
      const sourceEvent = presentationInput(body.event, receipt?.version === body.version ? JSON.parse(receipt.payload) : []);
      const [project, inventory] = await Promise.all([store.load(), loadVideoRegistry(registryOptions)]);
      const eventId = prepareDecision(buildRuntimeCatalog(project, body.dealerId), { event: sourceEvent, mode: 'off' }).node.id;
      const key = JSON.stringify([playerId, body.version, sourceEvent, body.mode, project.revision]);
      if (!decisions.has(key)) {
        if (decisions.size >= 256) decisions.delete(decisions.keys().next().value);
        decisions.set(key, select({ requestId: randomUUID(), project, dealerId: body.dealerId, eventId, sourceEvent, mode: body.mode }, { settings, videoRegistry: inventory }).then(result => {
          const video = inventory.videos.find(item => item.id === result.videoGenerationId);
          const family = inventory.families.find(item => item.id === video?.familyId);
          const standard = inventory.videos.find(item => family?.standardIds.includes(item.id) && item.available);
          const publicVideo = item => item ? { id: item.id, sha256: item.sha256, fileName: item.fileName, src: `/api/presentation/videos/${item.id}` } : null;
          return { ...result, video: publicVideo(video), standard: publicVideo(standard), owner: 'web', projectRevision: project.revision };
        }));
      }
      json(200, await decisions.get(key));
    } catch (error) { json(error.statusCode || 400, { error: error.message || 'Presentation unavailable' }); }
    return true;
  };
}
