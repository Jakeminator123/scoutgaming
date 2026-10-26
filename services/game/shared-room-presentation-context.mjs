import {canonicalStudioJson} from '../../packages/studio-registry/server/document-contract.mjs';
import {createFrozenDealerPresentationContext} from '../../packages/presentation/server/frozen-dealer-presentation.mjs';
import {createGameEntrySelector} from '../../packages/presentation/server/game-entry-selector.mjs';
import {readPackagePresentation} from '../../packages/presentation/server/presentation-package.mjs';
import {validateLayerAsset} from '../../packages/presentation/contracts/presentation-layers.mjs';
import {revalidatePrivateMedia} from '../../packages/studio-registry/server/private-media-revalidation.mjs';

const same=(a,b)=>canonicalStudioJson(a)===canonicalStudioJson(b);
const fail=()=>{throw Object.assign(Error('shared_room_presentation_stale'),{code:'shared_room_presentation_stale',statusCode:409});};
const urlForRoom=src=>typeof src==='string'?src.replace('/api/presentation/registered-video/','/api/presentation/room-video/')
  .replace('/api/presentation/registered-idle/','/api/presentation/room-idle/'):src;
const videoForRoom=video=>video?{...video,src:urlForRoom(video.src)}:video;

/** Request-local view of the one active config's exact package. This factory
 * owns no SQL reader and cannot choose another historical package. Its caller
 * captures current authority before and after any unlocked provider work. */
export function createActiveRoomPresentationContext({saved,context,privateMedia,signal,request:activeRequest}={}) {
  if(typeof privateMedia!=='function')throw new TypeError('Explicit private media port required');
  async function fetchPrivate(record,request) {
    signal?.throwIfAborted();
    const providerRequest=new Request(request,{signal:signal?AbortSignal.any([signal,request.signal]):request.signal});
    const result=await privateMedia(record,providerRequest);
    try{signal?.throwIfAborted();return result;}
    catch(error){try{await result.body?.cancel();}catch{}throw error;}
  }
  const frozen=createFrozenDealerPresentationContext({
    readCurrentContext:async(slug,revision)=>{
      signal?.throwIfAborted();if(slug!==context.operatorSlug||revision!==context.packageRevision)fail();return saved;
    },readPresentation:readPackagePresentation,privateMedia:fetchPrivate,
  });
  const resolve=async input=>{if(!same(input,context))fail();return frozen.resolve(input);};
  async function configuration(input) {
    await resolve(input);const value=await frozen.configuration(input);
    value.dealerIdle=Object.fromEntries(Object.entries(value.dealerIdle).map(([id,video])=>[id,videoForRoom(video)]));
    if(value.inventory)value.inventory.videos=value.inventory.videos.map(videoForRoom);
    return value;
  }
  async function selection() {
    const select=createGameEntrySelector({game:'blackjack',log:()=>{},
      policy:{readSaved:async()=>({administration:saved.administration,project:{}}),readGameConfiguration:()=>fail()},
      packages:{resolve:async()=>({operator:saved.operator,package:saved.package})}});
    const result=await select(new URLSearchParams({operator:context.operatorSlug,table:context.roomId}));
    if(result.status!==200||result.selection?.roomId!==context.roomId||result.selection.packageRevision!==context.packageRevision
      ||result.selection.dealer!==context.dealerId)fail();
    const value=structuredClone(result.selection);
    if(value.composition)value.composition.assets=value.composition.assets.map(asset=>({...asset,
      src:'/api/presentation/room-layers/'+[context.operatorSlug,context.roomId,context.packageRevision,asset.id].join('/')}));
    return value;
  }
  async function response(request=activeRequest) {
    const url=new URL(request.url);
    if(!['GET','HEAD'].includes(request.method))fail();
    const parts=/^\/api\/presentation\/room-(idle|video)\/([^/]+)\/([^/]+)\/([1-9][0-9]{0,15})\/([^/]+)(?:\/([^/]+))?$/.exec(url.pathname);
    if(!parts||url.search||url.hash||parts[1]==='idle'&&parts[6]||parts[1]==='video'&&!parts[6])fail();
    await resolve({operatorSlug:parts[2],roomId:parts[3],packageRevision:Number(parts[4]),dealerId:parts[5]});
    url.pathname=url.pathname.replace('/api/presentation/room-'+parts[1]+'/','/api/presentation/registered-'+parts[1]+'/');
    return frozen.response(new Request(url,{method:request.method,headers:request.headers,signal:request.signal}));
  }
  async function layerResponse(request=activeRequest) {
    const url=new URL(request.url),parts=/^\/api\/presentation\/room-layers\/([^/]+)\/([^/]+)\/([1-9][0-9]{0,15})\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/.exec(url.pathname);
    if(!parts||url.search||url.hash||!['GET','HEAD'].includes(request.method)
      ||parts[1]!==context.operatorSlug||parts[2]!==context.roomId||Number(parts[3])!==context.packageRevision)fail();
    const resolved=await resolve(context),presentation=readPackagePresentation(saved.package);
    const asset=presentation.assets.find(row=>row.id===parts[4]&&resolved.lane.layers[row.role]?.allowed.includes(row.id));
    if(!asset)fail();
    const {pathname,sha256,size,contentType}=validateLayerAsset(asset);
    signal?.throwIfAborted();
    const response=await fetchPrivate({provider:'vercel-blob',pathname,sha256,size,contentType},request);
    return revalidatePrivateMedia(response,request,sha256);
  }
  return Object.freeze({resolve,configuration,selection,publicVideo:(resolved,id)=>videoForRoom(frozen.publicVideo(resolved,id)),response,layerResponse});
}
