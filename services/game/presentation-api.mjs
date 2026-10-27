import { cloneStudioJson } from '../../packages/studio-registry/server/storage-contract.mjs';
import { idleRuleFor, publishedSelectionMode, selectSharedRoomPresentation } from './shared-room-presentation-selection.mjs';
import { sharedRoomPresentationRead } from './shared-room-presentation-http.mjs';
import { presentationPublicModules } from '../../packages/presentation/public-modules.mjs';
import { isActiveDealerId as isDealerId } from '../../packages/presentation/contracts/dealer-identity.mjs';
import { filmedDealSelection } from './filmed-deal-selection.mjs';
import {gateRecordedSpeechSelection,recordedSpeechProjection,recordedSpeechResult} from '../../packages/presentation/runtime/recorded-speech-selection.mjs';
import { presentationCapabilitiesResponse } from './presentation-capabilities.mjs';
import { selectRegisteredIdleRule, selectPresentation, createIdleAdviceServer } from './presentation-selection.mjs';
import { registeredIdlePolicy, registeredIdleInventory } from '../../packages/presentation/runtime/registered-idle-policy.mjs';
import { ownDealerIdle } from '../../packages/presentation/runtime/registered-idle.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { randomUUID, createHash } from 'node:crypto';
import {revalidatePrivateMedia} from '../../packages/studio-registry/server/private-media-revalidation.mjs';
import { loadVideoRegistry, getVideoResponse, exactHttpsOrigin } from './storage/video-registry.mjs';
import { buildRuntimeCatalog, normalizeProject } from '../../packages/presentation/contracts/studio-model.mjs';
import { prepareDecision } from '../../packages/director/engine.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const publicModules = new Map(presentationPublicModules.flatMap(row => row.paths.map(url => [url, row.source])));
const publicVideo = item => item ? {
  id: item.id, sha256: item.sha256, fileName: item.fileName,
  src: `/api/presentation/videos/${item.id}`,
  ...(item.classification?.compositing ? { compositing: structuredClone(item.classification.compositing) } : {}),
  ...(item.classification?.framing ? { framing: structuredClone(item.classification.framing) } : {}),
  ...recordedSpeechProjection(item),
} : null;


const modes = new Set(['off', 'rules', 'random', 'shadow', 'active']);
const committedTypes = new Set(['deal','reveal','turn','settle']);
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
  if (['turn','settle'].includes(event?.type)) {
    const source = published.find(item => item.type === event.type
      && (event.type === 'settle' || item.box === event.box && item.handIndex === event.handIndex));
    if (!source) fail('No committed instruction for this behaviour',409);
    return structuredClone(source);
  }
  if (event?.type === 'speak' && typeof event.line === 'string' && /^[a-z]{2,40}$/.test(event.line)) {
    return published.find(item => item.type === 'speak' && item.line === event.line) ?? { type: 'speak', line: event.line };
  }
  fail('Unsupported presentation request');
}

// The checkout holds no product register. Neon supplies the store in production;
// without one, project reads fail explicitly instead of touching a directory on disk.
const unavailableStore = Object.freeze({ configurationSource: 'unavailable',
  load: async () => { throw Object.assign(new Error('studio_read_storage_unavailable'), { statusCode: 503 }); } });
// The committed native receipt comes from the product table unless a caller (the
// Studio rehearsal) supplies the `{ version, payload }` row of its own isolated table.
export function createPresentationApi({ db, readNativeReceipt = playerId => db.prepare('SELECT version, payload FROM native_presentations WHERE player_id=?').get(playerId),
  env = process.env, store = unavailableStore,
  registryOptions = { env, repositoryRoot: root },
  select = selectPresentation, directorFetchFactory = null, frozenDealerContext = null, registryLoader = () => loadVideoRegistry(registryOptions), videoResponse,
  recordedSpeechPreview = false, beforeActionPresentation = () => {}, withSharedCommittedReceipt = null, withActiveRoomPresentation = null, qaPublicOrigin = null } = {}) {
  // Only the verified server QA capability supplies this constructor port.
  if (qaPublicOrigin !== null && (typeof qaPublicOrigin !== 'string'
    || !/^http:\/\/127\.0\.0\.1:([1-9][0-9]{3,4})$/.test(qaPublicOrigin)
    || Number(qaPublicOrigin.slice(qaPublicOrigin.lastIndexOf(':') + 1)) < 1024
    || Number(qaPublicOrigin.slice(qaPublicOrigin.lastIndexOf(':') + 1)) > 65535)) {
    throw new TypeError('Canonical loopback QA origin required');
  }
  const qaHost = qaPublicOrigin ? new URL(qaPublicOrigin).host : null;
  const decisions = new Map();
  const configurationSource = store.configurationSource || 'lab/project.json';
  const settings = { remoteUrl: env.CROUPIER_PRESENTATION_DIRECTOR_URL || '', remoteToken: env.CROUPIER_PRESENTATION_DIRECTOR_TOKEN || '', adviceTimeoutMs: 2200 };
  let adviceService;
  async function idleAdvice({req,playerId,body,signal,context=frozenDealerContext}) {
    let frozen=null;
    if(body.presentationContext!==undefined) {
      if(!context||body.presentationContext.dealerId!==body.dealerId)fail('Invalid presentation context');
      frozen=await context.resolve(body.presentationContext);
      if(!frozen.project)return {videoId:null,provider:'idle_family_unavailable_baseline',projectRevision:frozen.projectRevision};
    }
    const project=frozen?.project??await store.load(),{presentationContext:_context,...adviceBody}=body;
    if(frozen) {
      const idleMode=publishedSelectionMode(frozen.lane,{type:'idle'},'off');
      if(!['active','shadow'].includes(idleMode))return {videoId:null,provider:'idle_openclaw_off',projectRevision:frozen.projectRevision};
      adviceBody.mode=idleMode;
    }
    const ownInventory=!frozen&&isDealerId(body.dealerId)?registeredIdleInventory(await registryLoader(),{dealerId:body.dealerId,policy:registeredIdlePolicy(project,body.dealerId)}):null;
    adviceService??=createIdleAdviceServer({settings,registryLoader});
    const advise=await adviceService;
    const fetchImpl=directorFetchFactory?await directorFetchFactory({req,playerId,project,
      readProject:async()=>frozen?(await context.resolve(frozen.context)).project:store.load(),signal}):null;
    if(fetchImpl!==null&&typeof fetchImpl!=='function')fail('Director transport unavailable',503);
    return {...await advise({...adviceBody,project},{signal,...(ownInventory?{videoRegistry:ownInventory}:{}),
      ...(fetchImpl?{fetchImpl,...(fetchImpl.cacheScope===undefined?{}:{cacheScope:fetchImpl.cacheScope})}:{}),
      ...(frozen?{videoRegistry:frozen.idleInventory,cacheScope:createHash('sha256').update(JSON.stringify([playerId,frozen.context,fetchImpl?.cacheScope??null])).digest('hex')}:{}),
    }),projectRevision:project.revision,configurationSource:frozen?.configurationSource??configurationSource};
  }
  return async function handle(req, res, pathname, playerId) {
    const capability=presentationCapabilitiesResponse(new Request('http://local'+(req.url||pathname),{method:req.method,headers:req.headers??{}}));
    if(capability){res.writeHead(capability.status,Object.fromEntries(capability.headers));res.end(req.method==='HEAD'?undefined:await capability.text());return true;}
    const json = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }); res.end(JSON.stringify(value)); };
    if (publicModules.has(pathname) && ['GET', 'HEAD'].includes(req.method)) {
      const content = await readFile(join(root, publicModules.get(pathname)));
      res.writeHead(200, { 'Content-Type': pathname.endsWith('.json') ? 'application/json' : 'text/javascript', 'Content-Length': String(content.length), 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : content); return true;
    }
    if (!pathname.startsWith('/api/presentation/')) return false;
    let sharedRequest=false,sharedSignal;
    try {
      if (!playerId) fail('Sign in required', 401);
      const sharedIdle=/^\/api\/presentation\/shared-room\/([a-z0-9_-]{1,128})\/idle-advice$/.exec(pathname);
      if(!sharedIdle&&['/api/presentation/shared-room/','/api/presentation/room-idle/','/api/presentation/room-video/','/api/presentation/room-layers/'].some(prefix=>pathname.startsWith(prefix))) {
        sharedRequest=true;
        const controller=new AbortController(),disconnected=()=>{if(!res.writableEnded)controller.abort();};
        sharedSignal=controller.signal;res.once('close',disconnected);
        if(req.aborted||res.destroyed)controller.abort();
        let response,stream;
        try {
          controller.signal.throwIfAborted();
          response=await sharedRoomPresentationRead({request:req,playerId,signal:controller.signal},withActiveRoomPresentation);
          controller.signal.throwIfAborted();
          res.writeHead(response.status,Object.fromEntries(response.headers));
          controller.signal.throwIfAborted();
          if(response.body){stream=Readable.fromWeb(response.body);res.once('close',()=>stream.destroy());stream.once('error',()=>res.destroy());stream.pipe(res);}else res.end();
          return true;
        } catch(error) {
          if(stream)stream.destroy();else if(response?.body)try{await response.body.cancel();}catch{}
          throw error;
        } finally {res.removeListener('close',disconnected);}
      }
      if (qaPublicOrigin && ['/api/presentation/registered-idle/', '/api/presentation/registered-video/', '/api/presentation/videos/']
        .some(prefix => pathname.startsWith(prefix))
        && (req.headers.host !== qaHost || req.headers.origin && req.headers.origin !== qaPublicOrigin
          || ['cross-site', 'same-site'].includes(req.headers['sec-fetch-site']))) fail('Same-origin preview required', 403);
      if (pathname.startsWith('/api/presentation/registered-idle/') || pathname.startsWith('/api/presentation/registered-video/')) {
        if (!frozenDealerContext) fail('Frozen presentation unavailable',503);
        const response = await frozenDealerContext.response(new Request((qaPublicOrigin||(env.CROUPIER_CLOUD_RUNTIME==='1'&&exactHttpsOrigin(env.PUBLIC_URL)?env.PUBLIC_URL:'http://localhost'))+(req.url||pathname), { method: req.method, headers: req.headers }));
        res.writeHead(response.status, Object.fromEntries(response.headers));
        if (response.body) Readable.fromWeb(response.body).on('error', () => res.destroy()).pipe(res); else res.end();
        return true;
      }
      if (pathname.startsWith('/api/presentation/videos/')) {
        if (!['GET', 'HEAD'].includes(req.method)) fail('GET or HEAD required', 405);
        const id = pathname.slice('/api/presentation/videos/'.length);
        const publicOrigin = qaPublicOrigin || (env.CROUPIER_CLOUD_RUNTIME === '1' && exactHttpsOrigin(env.PUBLIC_URL) ? env.PUBLIC_URL : null);
        const frontendOrigin = env.CROUPIER_VERCEL_FRONTEND_ORIGIN;
        const trustedProxyOrigin = !qaPublicOrigin && publicOrigin && exactHttpsOrigin(frontendOrigin)
          && [new URL(publicOrigin).host, new URL(frontendOrigin).host].includes(req.headers.host)
          ? frontendOrigin : null;
        const request = new Request(`${publicOrigin || 'http://localhost'}${pathname}`, { method: req.method, headers: req.headers });
        const media = await (videoResponse || ((videoId, request) => getVideoResponse(videoId, request, { ...registryOptions, trustedProxyOrigin })))(id, request);
        // The registry reader has just rechecked availability, origin and bytes.
        const verifiedHash = /^"sha256-([a-f0-9]{64})"$/.exec(media.headers.get('etag') ?? '')?.[1];
        const response = await revalidatePrivateMedia(media, request, verifiedHash);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        if (response.body) Readable.fromWeb(response.body).on('error', () => res.destroy()).pipe(res); else res.end();
        return true;
      }
      if (pathname === '/api/presentation/config' && req.method === 'GET') {
        const query = new URL(req.url||pathname,'http://localhost').searchParams;
        const requestedDealer = query.size === 1 && query.getAll('dealerId').length === 1 ? query.get('dealerId') : null;
        if (requestedDealer === null) {
          const keys = ['operatorSlug','roomId','packageRevision','dealerId'];
          if (!frozenDealerContext || query.size !== 4 || keys.some(key=>query.getAll(key).length!==1) || !/^[1-9][0-9]{0,15}$/.test(query.get('packageRevision')||'')) fail('Invalid presentation context');
          json(200, { inventory:{videos:[],families:[]},defaultMode:'off',
            ...await frozenDealerContext.configuration({operatorSlug:query.get('operatorSlug'),roomId:query.get('roomId'),packageRevision:Number(query.get('packageRevision')),dealerId:query.get('dealerId')}) }); return true;
        }
        const [project, inventory] = await Promise.all([store.load(), registryLoader()]);
        if (requestedDealer !== null && (!isDealerId(requestedDealer) || !project.dealers.some(row => row.id === requestedDealer))) fail('Invalid presentation dealer');
        const ownPolicy = registeredIdlePolicy(project, requestedDealer);
        json(200, { owner: 'web', revision: project.revision, projectRevision: project.revision, configurationSource, idlePolicy: ownPolicy, inventory,
          ...(ownPolicy ? {idleInventory:registeredIdleInventory(inventory,{dealerId:requestedDealer,policy:ownPolicy})} : {}),
          dealerIdle: Object.fromEntries(project.dealers.filter(dealer=>dealer.id===requestedDealer).map(dealer=>[dealer.id,publicVideo(ownDealerIdle(project,inventory,dealer.id))])),
          defaultMode: env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane' ? 'active' : 'off' }); return true;
      }
      if (pathname === '/api/presentation/legacy-config' && req.method === 'GET') {
        json(410, {error:'legacy_presentation_retired'}); return true;
      }
      if (!['/api/presentation/select', '/api/presentation/idle-advice'].includes(pathname) && !sharedIdle || req.method !== 'POST') fail('Unknown presentation endpoint', 404);
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (raw.length > 16384) fail('Presentation request too large', 413); }
      const body = JSON.parse(raw);
      sharedRequest=body!==null&&typeof body==='object'&&Object.hasOwn(body,'sharedRoom');
      if(sharedRequest){
        const plain=value=>value&&Object.getPrototypeOf(value)===Object.prototype;
        const marker=body.sharedRoom;
        if(pathname!=='/api/presentation/select'||!plain(body)||!plain(marker)||Object.keys(marker).sort().join(',')!=='roomId,talkId,ver'
          ||typeof marker.roomId!=='string'||!/^[a-z0-9_-]{1,128}$/.test(marker.roomId)||typeof marker.talkId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(marker.talkId)
          ||!Number.isSafeInteger(marker.ver)||marker.ver<1||body.version!==marker.ver||!modes.has(body.mode)||!isDealerId(body.dealerId)||!plain(body.presentationContext))
          throw Object.assign(new Error('shared_room_presentation_invalid'),{code:'shared_room_presentation_invalid',statusCode:400});
        if(typeof withSharedCommittedReceipt!=='function')
          throw Object.assign(new Error('shared_room_presentation_unavailable'),{code:'shared_room_presentation_unavailable',statusCode:503});
        const controller=new AbortController(),disconnected=()=>{if(!res.writableEnded)controller.abort();};
        sharedSignal=controller.signal;res.once('close',disconnected);
        if(req.aborted||res.destroyed)controller.abort();
        try{
          controller.signal.throwIfAborted();
          const value=await withSharedCommittedReceipt({request:req,playerId,body,signal:controller.signal},(capture,{signal,frozenDealerContext:activeContext})=>
            selectSharedRoomPresentation({capture,body,frozenDealerContext:activeContext,select,settings,directorFetchFactory,request:req,playerId,signal}));
          controller.signal.throwIfAborted();
          if(!value||Object.getPrototypeOf(value)!==Object.prototype)throw Object.assign(new Error('shared_room_presentation_unavailable'),{code:'shared_room_presentation_unavailable',statusCode:503});
          json(200,cloneStudioJson(value,{maxBytes:256*1024}));return true;
        }finally{res.removeListener('close',disconnected);}
      }
      if (pathname === '/api/presentation/idle-advice' || sharedIdle) {
        const controller = new AbortController();
        const disconnected = () => { if (!res.writableEnded) controller.abort(); };
        res.once('close', disconnected);
        try {
          if(sharedIdle) {
            sharedRequest=true;sharedSignal=controller.signal;
            if(req.aborted||res.destroyed)controller.abort();
            controller.signal.throwIfAborted();
            if(typeof withActiveRoomPresentation!=='function')throw Object.assign(Error('shared_room_presentation_unavailable'),{code:'shared_room_presentation_unavailable',statusCode:503});
            if(!body.presentationContext||body.presentationContext.dealerId!==body.dealerId||new URL(req.url,'http://local').search)throw Object.assign(Error('shared_room_presentation_invalid'),{code:'shared_room_presentation_invalid',statusCode:400});
            const value=await withActiveRoomPresentation({request:req,playerId,roomId:sharedIdle[1],presentationContext:body.presentationContext,signal:controller.signal},
              (_capture,{signal,frozenDealerContext:context})=>idleAdvice({req,playerId,body,signal,context}));
            controller.signal.throwIfAborted();json(200,value);
          } else json(200,await idleAdvice({req,playerId,body,signal:controller.signal}));
        }
        finally { res.removeListener('close', disconnected); }
        return true;
      }
      if (!modes.has(body.mode) || !Number.isInteger(body.version) || !isDealerId(body.dealerId)) fail('Invalid presentation request');
      if (body.presentationContext !== undefined) {
        if (!frozenDealerContext || body.presentationContext.dealerId !== body.dealerId) fail('Invalid presentation context');
        const frozen = await frozenDealerContext.resolve(body.presentationContext);
        const receipt = await readNativeReceipt(playerId);
        if (committedTypes.has(body.event?.type) && receipt?.version !== body.version) fail('Stale presentation',409);
        if(['deal','reveal'].includes(body.event?.type))await beforeActionPresentation({playerId,version:body.version});
        const sourceEvent = presentationInput(body.event,receipt?.version===body.version?JSON.parse(receipt.payload):[]);
        if (['turn','settle'].includes(sourceEvent.type)) {
          const requestId=randomUUID();
          await frozenDealerContext.resolve(body.presentationContext);
          json(200,{video:null,standard:null,decision:{requestId,sourceEvent},
            idleRule:frozen.project?idleRuleFor(body,frozen.project,frozen.inventory,sourceEvent,requestId,publishedSelectionMode(frozen.lane,{type:'idle'},'off')):null,
            projectRevision:frozen.projectRevision,configurationSource:frozen.configurationSource});return true;
        }
        if (frozen.project) {
          const filmed=filmedDealSelection({project:frozen.project,inventory:frozen.inventory,dealerId:body.dealerId,sourceEvent,
            published:receipt?.version===body.version?JSON.parse(receipt.payload):[],shoeTransitions:body.shoeTransitions===true});
          if(filmed){
            await frozenDealerContext.resolve(body.presentationContext);
            const video=filmed.video?{...frozenDealerContext.publicVideo(frozen,filmed.video.id),filmedTake:filmed.filmedTake}:null;
            const transitions=Object.fromEntries(Object.entries(filmed.transitions??{}).map(([key,clip])=>[key,clip?frozenDealerContext.publicVideo(frozen,clip.id):null]));
            json(200,{...filmed.result,owner:'web',projectRevision:frozen.projectRevision,configurationSource:frozen.configurationSource,video,standard:video,transitions});return true;
          }
          const eventId = prepareDecision(buildRuntimeCatalog(frozen.project, body.dealerId), { event: sourceEvent, mode: 'off' }).node.id;
          const controller = new AbortController();
          const disconnected = () => { if (!res.writableEnded) controller.abort(); };
          res.once('close', disconnected);
          try {
          const fetchImpl = directorFetchFactory ? await directorFetchFactory({req,playerId,project:frozen.project,
            readProject:async ()=>(await frozenDealerContext.resolve(body.presentationContext)).project,signal:controller.signal}) : null;
          if (fetchImpl !== null && typeof fetchImpl !== 'function') fail('Director transport unavailable',503);
          // The saved composition decides the selection mode for this phase.
          const mode = publishedSelectionMode(frozen.lane, sourceEvent, 'off');
          const result = await select({ requestId:randomUUID(), project:frozen.project, dealerId:body.dealerId, eventId, sourceEvent, mode },
            { settings, videoRegistry:frozen.inventory, ...(fetchImpl ? {fetchImpl} : {}) });
          const chosen = frozen.inventory.videos.find(row=>row.id===result.videoGenerationId);
          // The fallback passes the same exact-event selector: never borrow a
          // different position, sentence or dealer after an alternative fails.
          const baseline = chosen && mode !== 'off'
            ? await select({ requestId:result.decision.requestId, project:frozen.project, dealerId:body.dealerId, eventId, sourceEvent, mode:'off' },
              { settings, videoRegistry:frozen.inventory }) : result;
          const selected=gateRecordedSpeechSelection({video:chosen,standard:frozen.inventory.videos.find(row=>row.id===baseline.videoGenerationId)},
            {project:frozen.project,dealerId:body.dealerId,eventId,sourceEvent});
          const video=frozenDealerContext.publicVideo(frozen,selected.video?.id);
          const standard=frozenDealerContext.publicVideo(frozen,selected.standard?.id);
          const idleRule = idleRuleFor(body,frozen.project,frozen.inventory,sourceEvent,result.decision.requestId,publishedSelectionMode(frozen.lane,{type:'idle'},'off'));
          await frozenDealerContext.resolve(body.presentationContext);
          if (controller.signal.aborted) return true;
          const gated=recordedSpeechResult(result,selected);
          json(200, { ...gated, owner:'web', projectRevision:frozen.projectRevision, configurationSource:frozen.configurationSource,
            video, standard, idleRule, decision: !video && !gated.decision.media ? { ...gated.decision,
              media:{familyId:null,reason:'frozen_clip_missing'} } : gated.decision });
          return true;
          } finally { res.removeListener('close', disconnected); }
        }
        // Package v2 freezes registered idle only. Other media cannot silently
        // follow an edited Studio registry after publication; native cards stay
        // authoritative and continue in 2D until that media has a frozen format.
        const positional = sourceEvent.type === 'deal';
        json(200,{owner:'web',projectRevision:frozen.projectRevision,configurationSource:'operator-package-v2',video:null,standard:null,
          decision:{requestId:randomUUID(),sourceEvent,media:{familyId:null,reason:positional?'position_clip_missing':'frozen_clip_missing',
            situation:positional?(sourceEvent.to==='dealer'?(sourceEvent.faceDown?'dealer-hole':'dealer-up'):'box'+sourceEvent.box):''}}});
        return true;
      }
      const [loaded, inventory] = await Promise.all([store.load(), registryLoader()]);
      const project = normalizeProject(loaded, { allowIncompatibleAnimations: true, preserveMissingLanes: true });
      if (!project.dealers.some(dealer => dealer.id === body.dealerId)) fail('Invalid presentation request');
      const receipt = await readNativeReceipt(playerId);
      if (committedTypes.has(body.event?.type) && receipt?.version !== body.version) fail('Stale presentation', 409);
      if(['deal','reveal'].includes(body.event?.type))await beforeActionPresentation({playerId,version:body.version});
      const sourceEvent = presentationInput(body.event, receipt?.version === body.version ? JSON.parse(receipt.payload) : []);
      if (['turn','settle'].includes(sourceEvent.type)) {
        const requestId=randomUUID();
        json(200,{video:null,standard:null,decision:{requestId,sourceEvent},
          idleRule:idleRuleFor(body,project,inventory,sourceEvent,requestId),projectRevision:project.revision,configurationSource});return true;
      }
      const filmed=filmedDealSelection({project,inventory,dealerId:body.dealerId,sourceEvent,
        published:receipt?.version===body.version?JSON.parse(receipt.payload):[],shoeTransitions:body.shoeTransitions===true});
      if(filmed){
        const video=filmed.video?{...publicVideo(filmed.video),filmedTake:filmed.filmedTake}:null;
        const transitions=Object.fromEntries(Object.entries(filmed.transitions??{}).map(([key,clip])=>[key,clip?publicVideo(clip):null]));
        json(200,{...filmed.result,owner:'web',projectRevision:project.revision,configurationSource,video,standard:video,transitions});return true;
      }
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
          { settings, videoRegistry: inventory, ...(fetchImpl ? { fetchImpl } : {}) });
        const projectOwned = result => {
            const video = inventory.videos.find(item => item.id === result.videoGenerationId);
            const family = inventory.families.find(item => item.id === video?.familyId);
            const standard = inventory.videos.find(item => family?.standardIds.includes(item.id) && item.available);
            // This option is set only by the authorized isolated preview service,
            // never from body, query, headers or a player's rehearsal preference.
            const preview=recordedSpeechPreview===true&&configurationSource==='studio-preview'
              &&/^studio-preview:[a-f0-9-]{36}$/.test(playerId);
            const selected=gateRecordedSpeechSelection({video,standard},{project,dealerId:body.dealerId,eventId,sourceEvent,preview});
            return { ...recordedSpeechResult(result,selected), idleRule:idleRuleFor(body,project,inventory,sourceEvent,result.decision?.requestId),
              video:publicVideo(selected.video),standard:publicVideo(selected.standard),owner:'web',projectRevision:project.revision,configurationSource };
          };
        // A QA transport closes over the actual authenticated HTTP request.
        // It must never be reused through the ordinary presentation cache.
        if (fetchImpl) { json(200, projectOwned(await selectOwned())); return true; }
        if (!decisions.has(key)) {
          if (decisions.size >= 256) decisions.delete(decisions.keys().next().value);
          decisions.set(key, selectOwned());
        }
        // Approval/media revisions may change without a project revision. Apply
        // the gate to this request's fresh registry even for a cached decision.
        json(200, projectOwned(await decisions.get(key)));
      } finally { res.removeListener('close', disconnected); }
    } catch (error) { if(sharedRequest){
      const known={shared_room_presentation_invalid:400,shared_room_presentation_not_found:404,shared_room_presentation_unavailable:503,shared_room_presentation_stale:409,shared_room_presentation_forbidden:403,shared_room_authentication_required:401};
      const code=Object.hasOwn(known,error?.code)?error.code:error?.statusCode===401?'shared_room_authentication_required':error?.statusCode===403?'shared_room_presentation_forbidden':typeof error?.code==='string'&&error.code.startsWith('studio_presentation_idle_')&&error.statusCode===409?'shared_room_presentation_stale':'shared_room_presentation_unavailable';
      if(!res.destroyed&&!sharedSignal?.aborted)json(known[code],{error:code});return true;
    } json(error.statusCode || 400, { error: error.message || 'Presentation unavailable', ...(error.code?.startsWith('studio_presentation_idle_') ? {code:error.code} : {}) }); }
    return true;
  };
}
