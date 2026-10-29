// "Exportera miljöbild": one staff-only route that renders an environment's real scene on a computer screen
// (1920 x 1080: background, table graphics and the dealer at their saved placement, with the compositor's
// geometry) and saves it as a new material with the role `illustration` ("<Miljö> · miljöbild v<n>").
// The server renders from the saved project; the browser only supplies one frame of the dealer's idle clip,
// because this server has no video decoder. The frame is keyed here with the clip's own registered settings.
// The new picture replaces this environment's earlier ones that no saved environment shows: they move to the
// archive (Material › Arkiverat), so repeated exports do not fill the shared library. A picture that an active
// or archived environment still shows stays. The editor chooses the new picture in its draft.
import {createHash,randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {canonicalStudioJson,StudioStorageError,validateActor,validateStudioScope} from '../../../packages/studio-registry/server/document-contract.mjs';
import {assertNativeStudioRequest,nativeStudioErrorResponse,studioNativeRuntime} from './studio-native-runtime.mjs';
import {normalizeNativeStudioRequest} from './studio-native-request.mjs';
import {deletePrivateMedia,getPrivateMedia,isCloudMediaConfigured,putPrivateMedia,validatePrivateMedia} from './cloud-media-store.mjs';
import {layerAssetPath,validateLayerAsset} from '../../../packages/presentation/contracts/layer-asset-contract.mjs';
import {DEFAULT_DEALER_FRAMING,dealerFrameRect,keyGreenPixels,validateDealerFraming} from '../../../packages/presentation/contracts/dealer-framing.mjs';
import {effectiveDealerCompositing} from '../../../packages/presentation/contracts/dealer-compositing.mjs';
import {SCENE_STILL_SIZE,desktopSceneStill} from '../../../packages/presentation/runtime/scene-still.mjs';

const HEADERS=Object.freeze({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
// Vercel's request body ceiling is 4.5 MB; the browser sends one WebP or PNG frame well below it.
const BODY_LIMIT=4_400_000,FRAME_MAX_BYTES=3_200_000,FRAME_MAX_EDGE=4096,PIXEL_LIMIT=40_000_000,LABEL_MAX=80;
// The project's archive holds at most this many materials (studio-model layerAssetTrash).
const TRASH_LIMIT=128;
const STATUS=Object.freeze({scene_export_invalid_request:400,scene_export_lane_missing:404,scene_export_stale:409,
  scene_export_dealer_invalid:422,scene_export_empty:422,scene_export_unavailable:503});
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/,LANE=/^[a-z][a-z0-9-]{0,63}$/,REVISION=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const FRAME=/^data:(image\/(?:png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
// The quiet frame behind an environment without its own background (the preview's dark stage).
const STAGE=Object.freeze({r:17,g:24,b:39,alpha:1});

export class SceneExportError extends Error { constructor(code) { super(code); this.code=code; } }
const exportFail=code=>{ throw new SceneExportError(code); };
const invalid=()=>exportFail('scene_export_invalid_request');
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const signature=(bytes,type)=>type==='image/png'?bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))
  :bytes.subarray(0,4).toString('latin1')==='RIFF'&&bytes.subarray(8,12).toString('latin1')==='WEBP';

/** {laneId, expectedRevision, dealer?: {videoId, frame}} with exact fields; the frame is a PNG or WebP data URL. */
export function validateSceneExportRequest(body) {
  if (!plain(body)||Object.keys(body).some(key=>!['laneId','expectedRevision','dealer'].includes(key))
    ||typeof body.laneId!=='string'||!LANE.test(body.laneId)||typeof body.expectedRevision!=='string'||!REVISION.test(body.expectedRevision)) invalid();
  let dealer=null;
  if (Object.hasOwn(body,'dealer')&&body.dealer!==null) {
    if (!plain(body.dealer)||Object.keys(body.dealer).sort().join(',')!=='frame,videoId'||typeof body.dealer.videoId!=='string'||!UUID.test(body.dealer.videoId)) invalid();
    const match=typeof body.dealer.frame==='string'&&body.dealer.frame.length<=Math.ceil(FRAME_MAX_BYTES/3)*4+32?FRAME.exec(body.dealer.frame):null;
    if (!match) invalid();
    const bytes=Buffer.from(match[2],'base64');
    if (bytes.length<16||bytes.length>FRAME_MAX_BYTES||!signature(bytes,match[1])) invalid();
    dealer={videoId:body.dealer.videoId,contentType:match[1],bytes};
  }
  return Object.freeze({laneId:body.laneId,expectedRevision:body.expectedRevision,dealer});
}

// "<Miljö> · miljöbild v<n>" for this environment's label: the version, or 0 for another label.
function pictureVersion(laneLabel,label) {
  const clean=String(laneLabel).replace(/[\u0000-\u001f\u007f-\u009f<>]/gu,'').replace(/\s+/g,' ').trim()||'Miljö';
  const suffix=n=>` · miljöbild v${n}`,named=n=>clean.slice(0,LABEL_MAX-suffix(n).length).trim()+suffix(n);
  const match=typeof label==='string'?/ · miljöbild v(\d{1,6})$/.exec(label):null;
  return {version:match&&label===named(Number(match[1]))?Number(match[1]):0,named};
}

/** "<Miljö> · miljöbild v<n>", one past the highest version of this environment's pictures, including archived ones. */
export function illustrationLabel(laneLabel,project) {
  const used=[...(project.layerAssets??[]),...(project.layerAssetTrash??[]).map(row=>row.asset)].filter(row=>row?.role==='illustration')
    .map(row=>pictureVersion(laneLabel,row.label).version);
  return pictureVersion(laneLabel,'').named(Math.max(0,...used)+1);
}

/** The project with `record` added and this environment's earlier, unshown pictures archived (oldest first, while
 * the archive has room). A picture that any active or archived environment shows is kept. */
export function withExportedIllustration(project,laneLabel,record,now=new Date().toISOString(),{archive=true}={}) {
  if (!archive) return {...project,layerAssets:[...(project.layerAssets??[]),record]};
  const shown=new Set([...(project.lanes??[]),...(project.dealerTrash??[]).flatMap(entry=>entry.compositions??[])].map(lane=>lane.illustration).filter(Boolean));
  const trash=project.layerAssetTrash??[];
  const earlier=(project.layerAssets??[]).filter(row=>row.role==='illustration'&&!shown.has(row.id)&&pictureVersion(laneLabel,row.label).version>0)
    .sort((a,b)=>pictureVersion(laneLabel,a.label).version-pictureVersion(laneLabel,b.label).version).slice(0,Math.max(0,TRASH_LIMIT-trash.length));
  const archived=new Set(earlier.map(row=>row.id));
  return {...project,layerAssets:[...(project.layerAssets??[]).filter(row=>!archived.has(row.id)),record],
    ...(earlier.length?{layerAssetTrash:[...trash,...earlier.map(asset=>({asset,archivedAt:now}))]}:{})};
}

// Resize an image to `rect` and keep only the part inside the frame, as raw RGBA for a composite.
async function placed(sharp,input,rect,frame) {
  const [x,y,w,h]=rect,width=Math.max(1,Math.round(w)),height=Math.max(1,Math.round(h)),left=Math.round(x),top=Math.round(y);
  const x0=Math.max(0,left),y0=Math.max(0,top),x1=Math.min(frame.width,left+width),y1=Math.min(frame.height,top+height);
  if (x1<=x0||y1<=y0) return null;
  const source=Buffer.isBuffer(input)?sharp(input,{limitInputPixels:PIXEL_LIMIT}):sharp(input.data,{raw:input.info,limitInputPixels:PIXEL_LIMIT});
  const {data,info}=await source.ensureAlpha().resize(width,height,{fit:'fill'})
    .extract({left:x0-left,top:y0-top,width:x1-x0,height:y1-y0}).raw().toBuffer({resolveWithObject:true});
  return {input:data,raw:{width:info.width,height:info.height,channels:4},left:x0,top:y0};
}

/** The dealer's actor plane (1920 x 1080 RGBA): the frame drawn with the clip's framing, then keyed with its compositing. */
export async function dealerActorPlane(bytes,{framing=DEFAULT_DEALER_FRAMING,compositing},{sharp}) {
  const metadata=await sharp(bytes,{limitInputPixels:PIXEL_LIMIT}).metadata();
  if (!['png','webp'].includes(metadata.format)||(metadata.pages??1)!==1
    ||![metadata.width,metadata.height].every(edge=>Number.isSafeInteger(edge)&&edge>=16&&edge<=FRAME_MAX_EDGE)) invalid();
  const plane=SCENE_STILL_SIZE,frame=await placed(sharp,bytes,dealerFrameRect(metadata.width,metadata.height,plane.width,plane.height,framing),plane);
  const empty=Buffer.alloc(plane.width*plane.height*4);
  const raw=frame?await sharp(empty,{raw:{...plane,channels:4}}).composite([frame]).raw().toBuffer():empty;
  keyGreenPixels(new Uint8ClampedArray(raw.buffer,raw.byteOffset,raw.length),compositing);
  return {data:raw,info:{width:plane.width,height:plane.height,channels:4}};
}

/** Background, table graphics and the keyed dealer on a 1920 x 1080 computer screen, as WebP.
 * `background` and `table` are {bytes} of an image or null; `dealer` is an actor plane or null. */
export async function renderSceneStill({composition,background,table,dealer},{sharp}) {
  const size=async layer=>{
    if (!layer) return null;
    const metadata=await sharp(layer.bytes,{limitInputPixels:PIXEL_LIMIT}).metadata();
    if (!['png','jpeg','webp'].includes(metadata.format)||!metadata.width||!metadata.height) exportFail('scene_export_unavailable');
    return {width:metadata.width,height:metadata.height};
  };
  const backgroundSize=await size(background),tableSize=await size(table);
  if (!backgroundSize&&!tableSize&&!dealer) exportFail('scene_export_empty');
  const still=desktopSceneStill({composition,background:backgroundSize,table:tableSize,dealer:Boolean(dealer)});
  const sources={background:background?.bytes,table:table?.bytes,dealer};
  const layers=[];
  for (const layer of still.layers) { const part=await placed(sharp,sources[layer.role],layer.rect,still); if (part) layers.push(part); }
  const bytes=await sharp({create:{width:still.width,height:still.height,channels:4,background:STAGE}})
    .composite(layers).flatten({background:STAGE}).webp({quality:90,effort:4}).toBuffer();
  return {bytes,width:still.width,height:still.height,contentType:'image/webp'};
}

const loadSharp=async()=>(await import('sharp')).default;
async function readBounded(request) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type')||'')) invalid();
  const length=request.headers.get('content-length');
  if (length!==null&&(!/^\d+$/.test(length)||Number(length)>BODY_LIMIT)) invalid();
  const reader=request.body?.getReader();if (!reader) invalid();
  let size=0;const chunks=[];
  try {
    for (;;) { const {done,value}=await reader.read();if (done) break;size+=value.byteLength;if (size>BODY_LIMIT) { await reader.cancel();invalid(); }chunks.push(Buffer.from(value)); }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))); } catch { return invalid(); }
}

export function createSceneExportApi({authorize,config,repository,mutationTransaction,env=process.env,imageLibrary=loadSharp,
  privateMedia={get:getPrivateMedia,put:putPrivateMedia,delete:deletePrivateMedia},newId=randomUUID,now=()=>new Date().toISOString()}={}) {
  if (typeof authorize!=='function'||!config||!['/api/admin','/studio/api/admin'].includes(config.apiBase)
    ||!repository?.readDocument||!repository?.saveDocument||!repository?.getMedia||typeof mutationTransaction!=='function') throw new StudioStorageError('studio_invalid_configuration',503);
  const scope=validateStudioScope(config.scope),path=`${config.apiBase==='/api/admin'?'/api':'/studio/api'}/layer-assets/scene-export`;
  const mediaOptions={env:Object.freeze({...env}),cacheDir:join(tmpdir(),'croupier-private-media')};
  // The same staff gate as the layer-asset upload and the AI proposals: admin or superadmin in this scope.
  async function staff(request) {
    const session=await authorize(request);
    if (!session||!['admin','superadmin'].includes(session.role)
      ||canonicalStudioJson(validateStudioScope(session.scope))!==canonicalStudioJson(scope)) throw new StudioStorageError('studio_request_rejected',403);
    return Object.freeze({user:validateActor(session.user),role:session.role});
  }
  async function readImage(asset) {
    const {pathname,sha256,size,contentType}=validateLayerAsset(asset);
    const response=await privateMedia.get(validatePrivateMedia({provider:'vercel-blob',pathname,sha256,size,contentType}),new Request('https://scene-export.internal/read',{method:'GET'}),mediaOptions);
    if (!response.ok) { await response.body?.cancel?.();exportFail('scene_export_unavailable'); }
    return Buffer.from(await response.arrayBuffer());
  }
  // The lane's own default image for a layer; a video layer has no still on this server and is left out.
  const layerImage=(project,lane,role,skipped)=>{
    const id=lane.layers[role].enabled&&(role!=='background'||lane.layers.background.mode!=='baked')?lane.layers[role].default:null;
    const asset=id?(project.layerAssets??[]).find(row=>row.id===id&&row.role===role):null;
    if (asset&&!asset.contentType.startsWith('image/')) { skipped.push(role);return null; }
    return asset??null;
  };
  return Object.freeze({path,async handle(request) {
    try {
      request=normalizeNativeStudioRequest(request,config);
      assertNativeStudioRequest(request,config);
      if (new URL(request.url).pathname!==path) throw new StudioStorageError('studio_media_unknown',404);
      if (request.method!=='POST') return new Response(null,{status:405,headers:{...HEADERS,Allow:'POST'}});
      if (request.headers.get('origin')!==new URL(request.url).origin
        ||!['same-origin','none'].includes(request.headers.get('sec-fetch-site'))) throw new StudioStorageError('studio_request_rejected',403);
      const principal=await staff(request);
      if (!isCloudMediaConfigured(mediaOptions.env)) exportFail('scene_export_unavailable');
      const input=validateSceneExportRequest(await readBounded(request));
      const captured=await repository.readDocument('project');
      if (!captured) throw new StudioStorageError('studio_document_missing',404);
      // Render exactly the saved environment the editor shows; a newer save asks the editor to reload first.
      if (captured.revision!==input.expectedRevision) exportFail('scene_export_stale');
      const project=captured.value,lane=project.lanes?.find(row=>row.id===input.laneId);
      if (!lane) exportFail('scene_export_lane_missing');
      const skipped=[],backgroundAsset=layerImage(project,lane,'background',skipped),tableAsset=layerImage(project,lane,'table',skipped);
      const sharp=await imageLibrary();
      let dealer=null;
      if (input.dealer) {
        const record=await repository.getMedia(input.dealer.videoId),metadata=record?.classification;
        if (!record||record.deletion||metadata?.archived||!lane.layers.dealer.allowed.includes(metadata?.dealerId)) exportFail('scene_export_dealer_invalid');
        let compositing,framing;
        try { compositing=effectiveDealerCompositing(metadata.compositing);framing=validateDealerFraming(metadata.framing??DEFAULT_DEALER_FRAMING); }
        catch { exportFail('scene_export_dealer_invalid'); }
        try { dealer=await dealerActorPlane(input.dealer.bytes,{framing,compositing},{sharp}); }
        catch (error) { if (error instanceof SceneExportError) throw error;invalid(); }
      }
      const [background,table]=await Promise.all([backgroundAsset,tableAsset].map(async asset=>asset?{bytes:await readImage(asset)}:null));
      let still;
      try { still=await renderSceneStill({composition:lane.composition,background,table,dealer},{sharp}); }
      catch (error) { if (error instanceof SceneExportError) throw error;exportFail('scene_export_unavailable'); }
      const sha256=createHash('sha256').update(still.bytes).digest('hex');
      const draft={schemaVersion:1,id:newId(),role:'illustration',label:illustrationLabel(lane.label,project),sha256,size:still.bytes.length,
        contentType:still.contentType,width:still.width,height:still.height};
      const record=validateLayerAsset({...draft,pathname:layerAssetPath(draft)});
      // Re-authorize right before anything is stored, as the upload does before its commit.
      const stillAuthorized=async()=>{ const current=await staff(request);if (current.user!==principal.user||current.role!==principal.role) throw new StudioStorageError('studio_request_rejected',403);return true; };
      await stillAuthorized();
      // The game server must read the new material role before any byte is stored (capability v33).
      if (typeof repository.withMutationContext==='function') await repository.withMutationContext(()=>{},{kind:'project',value:{layerAssets:[record]}});
      const storage=await privateMedia.put(record.pathname,still.bytes,{sha256,size:record.size,contentType:record.contentType,env:mediaOptions.env,cacheDir:mediaOptions.cacheDir});
      // The new material joins the library and replaces this environment's earlier, unshown pictures (archived);
      // the miljöbild choice stays with the editor's draft.
      // Archiving changes the project's material archive, which only the server's lifecycle save may write.
      const archive=typeof repository.saveDealerLifecycle==='function',archivedAt=now();
      const replaced=value=>withExportedIllustration(value,lane.label,record,archivedAt,{archive});
      const presentationMutation={kind:'project',value:replaced(project)};
      let saved;
      try {
        saved=await mutationTransaction(async()=>{
          await stillAuthorized();
          return repository.transaction(async()=>{
            const current=await repository.readDocument('project');
            if (!current) throw new StudioStorageError('studio_document_missing',404);
            if (current.revision!==captured.revision) throw new StudioStorageError('studio_conflict',409);
            const next=replaced(current.value),options={expectedRevision:current.revision,actor:principal.user};
            return (next.layerAssetTrash??[]).length!==(current.value.layerAssetTrash??[]).length
              ?repository.saveDealerLifecycle(next,options):repository.saveDocument('project',{...options,value:next});
          },{presentationMutation});
        },{presentationMutation});
      } catch (error) {
        // Nothing refers to the new object unless the project already lists it: remove it, keep the original error.
        // A failed cleanup (or an unreadable project) leaves the object in place rather than risk a listed one.
        try {
          const current=await repository.readDocument('project');
          if (current&&!(current.value.layerAssets??[]).some(row=>row.id===record.id))
            await privateMedia.delete?.(storage??validatePrivateMedia({provider:'vercel-blob',pathname:record.pathname,sha256,size:record.size,contentType:record.contentType}),{env:mediaOptions.env,cacheDir:mediaOptions.cacheDir});
        } catch {}
        throw error;
      }
      return Response.json({ok:true,id:record.id,label:record.label,skipped,project:saved.value},{headers:HEADERS});
    } catch (error) {
      if (error instanceof SceneExportError) return Response.json({error:error.code,code:error.code},{status:STATUS[error.code],headers:HEADERS});
      return nativeStudioErrorResponse(error);
    }
  }});
}

export async function handleSceneExportRequest(request) {
  try { const native=await studioNativeRuntime();return await createSceneExportApi({authorize:native.authorize,config:native.config,repository:native.repository,mutationTransaction:native.mutationTransaction}).handle(request); }
  catch (error) { return nativeStudioErrorResponse(error); }
}
