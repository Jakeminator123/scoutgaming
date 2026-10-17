import {previewMediaPath,validatePublicOperatorPreview} from './public/operator-preview-contract.mjs';
import {isGameLaneId,isOperatorSlug} from './public/game-lanes.mjs';
import {isActiveDealerId as isDealerId} from '../packages/presentation/contracts/dealer-identity.mjs';
import {defaultCompositionSettings} from '../packages/presentation/contracts/composition-settings.mjs';
import {materialLabel,materialForAsset} from '../packages/presentation/contracts/material-catalog.mjs';
import {layerAssetFitsGame} from '../packages/presentation/contracts/layer-asset-contract.mjs';

const route=/^\/api\/operators\/([^/]+)\/rooms\/([^/]+)\/preview(?:\/media\/([^/]+)\/([^/]+)\/(dealer|table|background)\/([^/]+))?$/;
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Referrer-Policy':'no-referrer'};
const fail=(status=503)=>{throw Object.assign(Error('operator_preview_unavailable'),{statusCode:status});};
const revision=value=>/^[1-9][0-9]{0,15}$/.test(value??'')&&Number.isSafeInteger(Number(value))?Number(value):null;
function json(request,status,code) {
  return new Response(request.method==='HEAD'?null:JSON.stringify(typeof code==='string'?{error:code}:code),
    {status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
}

/** Anonymous presentation only. Each descriptor AND byte request reads one fresh,
 * atomic published operator/package/administration snapshot. No player session,
 * mutable media registry, Studio draft, voice or provider-generation API is used. */
export function createPublicOperatorPreview({readCurrentContext=null,privateMedia=null}={}) {
  if(readCurrentContext!==null&&typeof readCurrentContext!=='function'||privateMedia!==null&&typeof privateMedia!=='function')throw TypeError('Invalid preview readers');
  async function resolve(context) {
    if(!readCurrentContext||!privateMedia)fail();
    const saved=await readCurrentContext(context.operatorSlug);
    if(!saved)fail();
    const {operator,package:pack,administration}=saved;
    if(!operator||operator.status!=='active'||operator.slug!==context.operatorSlug||!pack)fail(404);
    if(pack.operatorId!==operator.id)fail();
    if(pack.revision!==context.packageRevision)fail(409);
    const room = administration.rooms?.find(row=>row.id===context.roomId);
    if(!pack.games?.includes(room?.game ?? 'blackjack'))fail(404);
    const [{readPackagePresentation},{createGameEntrySelector},{supportsIndependentLayers},{resolveFrozenDealerIdle},{validateLayerAsset}]=await Promise.all([
      import('./storage/presentation-package.mjs'),import('./game-entry-operator.mjs'),import('./public-operator-rooms.mjs'),
      import('./storage/frozen-dealer-idle.mjs'),import('../packages/presentation/contracts/layer-asset-contract.mjs')]);
    const frozen=readPackagePresentation(pack);
    if(!frozen)fail(404);
    const select=createGameEntrySelector({
      policy:{readSaved:async()=>({administration,project:{}}),readGameConfiguration:()=>fail()},
      packages:{resolve:async()=>({operator,package:pack})},log:()=>{},game:'any',
    });
    const entry=await select(new URLSearchParams({operator:context.operatorSlug,table:context.roomId,dealer:context.dealerId}));
    const selection=entry.selection;
    if(entry.status!==200||selection?.roomId!==context.roomId||selection.dealer!==context.dealerId
      ||selection.packageRevision!==context.packageRevision||!selection.choices.dealers.includes(context.dealerId))fail(404);
    const independentLayers=supportsIndependentLayers(selection,frozen,context.dealerId,room.game??'blackjack');
    const registered=frozen.registeredDealers?.find(row=>row.id===context.dealerId);
    const label=registered?.label;
    if(!label)fail();
    const idle=resolveFrozenDealerIdle(frozen.registeredDealers,{
      dealerId:context.dealerId,allowedDealerIds:selection.choices.dealers,game:room.game??'blackjack'});
    const rouletteIdle=room.game==='roulette'?registered.rouletteIdle:null;
    const dealerMedia=[...(idle?[idle]:[]),...(rouletteIdle?.variants??[])];
    const assets={table:[],background:[]};
    for(const role of ['table','background']) {
      const layer=selection.composition?.[role];
      if(!independentLayers||!layer?.enabled)continue;
      assets[role]=layer.allowed.map(id=>{
        const asset=frozen.assets.find(row=>row.id===id&&row.role===role);
        if(!asset)fail();
        return validateLayerAsset(asset);
      }).filter(asset=>role!=='table'||layerAssetFitsGame(asset,room.game??'blackjack'));
    }
    const rouletteStart=room.game==='roulette'&&independentLayers&&idle&&registered.rouletteStart
      &&assets.table.some(asset=>materialForAsset(asset)?.id===registered.rouletteStart.tableDesignId)?registered.rouletteStart:null;
    if(rouletteStart)dealerMedia.push(rouletteStart.clip);
    const item=(record,kind)=>({src:previewMediaPath(context,kind,record.id),contentType:record.contentType});
    const dealerItem=record=>({...item(record,'dealer'),...(['green-screen','alpha'].includes(record.classification.compositing?.mode)?{compositing:record.classification.compositing}:{}),...(record.classification.framing?{framing:record.classification.framing}:{})});
    const startItem=rouletteStart?(()=>{const {clip,...profile}=rouletteStart;return {...dealerItem(clip),...profile};})():null;
    const descriptor=validatePublicOperatorPreview({
      schemaVersion:1,operatorSlug:context.operatorSlug,roomId:context.roomId,packageRevision:context.packageRevision,
      dealer:{id:context.dealerId,label},independentLayers,
      settings:independentLayers?(selection.composition?.settings??defaultCompositionSettings()):null,
      media:{dealer:idle?{...dealerItem(idle),...(rouletteIdle?{variants:rouletteIdle.variants.map(dealerItem),...(rouletteIdle.foregroundPolygons?{foregroundPolygons:rouletteIdle.foregroundPolygons}:{})}:{}),...(startItem?{wheelStart:startItem}:{})}:null,
        tables:assets.table.map(asset=>({id:asset.id,label:materialLabel(asset),...item(asset,'table'),...(materialForAsset(asset)?{designId:materialForAsset(asset).id}:{})})),
        backgrounds:assets.background.map(asset=>({id:asset.id,label:materialLabel(asset),...item(asset,'background')}))},
    },context);
    return {descriptor,dealerMedia,assets};
  }
  async function handle(request) {
    const url=new URL(request.url),match=route.exec(url.pathname);
    if(!match)return null;
    if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
    try {
      const [,operatorSlug,roomId,revisionPath,dealerPath,kind,mediaId]=match;
      const media=kind!==undefined;
      if(!isOperatorSlug(operatorSlug)||!isGameLaneId(roomId)||url.hash)fail(400);
      if(media?url.search!==''||!uuid.test(mediaId):url.searchParams.size!==2
        ||url.searchParams.getAll('dealer').length!==1||url.searchParams.getAll('revision').length!==1)fail(400);
      const packageRevision=revision(media?revisionPath:url.searchParams.get('revision'));
      const dealerId=media?dealerPath:url.searchParams.get('dealer');
      if(!packageRevision||!isDealerId(dealerId))fail(400);
      const {descriptor,dealerMedia,assets}=await resolve({operatorSlug,roomId,packageRevision,dealerId});
      if(!media)return json(request,200,descriptor);
      const record=kind==='dealer'?dealerMedia.find(row=>row.id===mediaId):assets[kind].find(row=>row.id===mediaId);
      if(!record)fail(404);
      const {pathname,sha256,size,contentType}=record;
      const response=await privateMedia({provider:'vercel-blob',pathname,sha256,size,contentType},request);
      if(![200,206,304,416].includes(response.status)) {await response.body?.cancel();fail([404,409].includes(response.status)?response.status:503);}
      if(response.status!==416&&response.headers.get('etag')!=='"sha256-'+sha256+'"') {await response.body?.cancel();fail(409);}
      const safeHeaders=new Headers(headers);
      for(const name of ['content-type','content-length','content-range','accept-ranges','etag'])if(response.headers.has(name))safeHeaders.set(name,response.headers.get(name));
      if(response.status!==416)safeHeaders.set('Content-Type',contentType);
      // Error bodies belong to this public boundary too, never to the provider.
      if(response.status===416) {await response.body?.cancel();safeHeaders.delete('content-length');safeHeaders.delete('content-type');
        return new Response(null,{status:416,headers:safeHeaders});}
      if(request.method==='HEAD')await response.body?.cancel();
      return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:safeHeaders});
    } catch(error) {
      const status=[400,404,409].includes(error?.statusCode)?error.statusCode:503;
      return json(request,status,status===409?'operator_preview_changed':status===404?'operator_preview_not_found':status===400?'invalid_preview_request':'operator_preview_unavailable');
    }
  }
  return Object.freeze({handle});
}
