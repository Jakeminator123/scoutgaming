const fail=(code='shared_room_presentation_invalid',statusCode=400)=>{throw Object.assign(Error(code),{code,statusCode});};
const prefix='/api/presentation/';
const noStore={'Cache-Control':'private, no-store'};
const strictQuery=(url,keys)=>url.searchParams.size===keys.length&&keys.every(key=>url.searchParams.getAll(key).length===1);
const revision=value=>typeof value==='string'&&/^[1-9][0-9]{0,15}$/.test(value)&&Number.isSafeInteger(Number(value));

/** Only explicit shared-room paths enter the active-window port. The existing
 * generic frozen-context routes retain their original history policy. */
export async function sharedRoomPresentationRead({request,playerId,signal},withActiveRoomPresentation) {
  const url=new URL(request.url,'http://local'),path=url.pathname;
  if(!['shared-room/','room-idle/','room-video/','room-layers/'].some(part=>path.startsWith(prefix+part)))return null;
  if(/^\/api\/presentation\/shared-room\/[a-z0-9_-]{1,128}\/idle-advice$/.test(path))return null;
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...noStore,Allow:'GET, HEAD'}});
  if(typeof withActiveRoomPresentation!=='function')fail('shared_room_presentation_unavailable',503);
  if(url.hash||request.url!==(request.url.startsWith('/')?path+url.search:url.origin+path+url.search))fail();
  let match;
  if((match=/^\/api\/presentation\/shared-room\/([a-z0-9_-]{1,128})\/(binding|config)$/.exec(path))) {
    if(request.method!=='GET')return new Response(null,{status:405,headers:{...noStore,Allow:'GET'}});
    const roomId=match[1],binding=match[2]==='binding';
    if(binding) {
      if(!strictQuery(url,['configVersion','windowId']))fail();
      const value=await withActiveRoomPresentation({request,playerId,roomId,signal,expected:{configVersion:url.searchParams.get('configVersion'),windowId:url.searchParams.get('windowId')}},
        async(capture,{frozenDealerContext})=>({owner:'web',roomId,configVersion:capture.configVersion,windowId:capture.windowId,
          presentationContext:capture.presentationContext,selection:await frozenDealerContext.selection()}));
      return Response.json(value,{headers:noStore});
    }
    if(!strictQuery(url,['operatorSlug','roomId','packageRevision','dealerId'])||url.searchParams.get('roomId')!==roomId||!revision(url.searchParams.get('packageRevision')))fail();
    const presentationContext={operatorSlug:url.searchParams.get('operatorSlug'),roomId,packageRevision:Number(url.searchParams.get('packageRevision')),dealerId:url.searchParams.get('dealerId')};
    const value=await withActiveRoomPresentation({request,playerId,roomId,presentationContext,signal},async(capture,{frozenDealerContext})=>({
      inventory:{videos:[],families:[]},defaultMode:'off',...await frozenDealerContext.configuration(capture.presentationContext)}));
    return Response.json(value,{headers:noStore});
  }
  if(url.search)fail();
  if((match=/^\/api\/presentation\/room-(idle|video)\/([a-z][a-z0-9-]{0,62})\/([a-z0-9_-]{1,128})\/([1-9][0-9]{0,15})\/([a-z][a-z0-9_-]*)(?:\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}))?$/.exec(path))) {
    if(!revision(match[4])||match[1]==='idle'&&match[6]||match[1]==='video'&&!match[6])fail();
    const roomId=match[3],presentationContext={operatorSlug:match[2],roomId,packageRevision:Number(match[4]),dealerId:match[5]};
    return withActiveRoomPresentation({request,playerId,roomId,presentationContext,signal},(_capture,{frozenDealerContext})=>frozenDealerContext.response());
  }
  if((match=/^\/api\/presentation\/room-layers\/([a-z][a-z0-9-]{0,62})\/([a-z0-9_-]{1,128})\/([1-9][0-9]{0,15})\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/.exec(path))) {
    if(!revision(match[3]))fail();
    const roomId=match[2],presentationContext={operatorSlug:match[1],roomId,packageRevision:Number(match[3])};
    return withActiveRoomPresentation({request,playerId,roomId,presentationContext,signal},(_capture,{frozenDealerContext})=>frozenDealerContext.layerResponse());
  }
  fail('shared_room_presentation_not_found',404);
}

/** Same-origin Node/Fetch adapter. The application supplies the live service;
 * request fields cannot select a backend, account, session or SQL owner. */
export function createSharedRoomPresentationBridge({service,origin,engineOrigin}={}) {
  if(typeof service!=='function'||typeof origin!=='string'||typeof engineOrigin!=='string'
    ||new URL(origin).origin!==origin||new URL(engineOrigin).origin!==engineOrigin)throw new TypeError('Explicit room origins required');
  function authenticated(args,mode) {
    const incoming=args.request,url=new URL(incoming.url,engineOrigin),headers=new Headers(incoming.headers);
    const write=incoming.method==='POST';
    if(url.username||url.password||url.hash||incoming.url!==(incoming.url.startsWith('/')?url.pathname+url.search:url.origin+url.pathname+url.search))fail();
    if(url.origin!==engineOrigin||headers.get('host')!==url.host||write&&headers.get('origin')!==origin
      ||!write&&headers.has('origin')&&headers.get('origin')!==origin||['cross-site','same-site'].includes(headers.get('sec-fetch-site'))
      ||['authorization','upgrade','sec-websocket-protocol','x-worker-id'].some(key=>headers.has(key)))fail('shared_room_presentation_forbidden',403);
    if(mode==='receipt') {
      if(!write||url.pathname!=='/api/presentation/select'||url.search||url.hash)fail();
    } else {
      const readPath=/^\/api\/presentation\/(?:shared-room\/([a-z0-9_-]{1,128})\/(binding|config|idle-advice)|room-(?:idle|video|layers)\/[^/]+\/([a-z0-9_-]{1,128})\/.+)$/.exec(url.pathname);
      if(!readPath||(readPath[1]??readPath[3])!==args.roomId||write!==(readPath[2]==='idle-advice')
        ||!['GET','HEAD','POST'].includes(incoming.method))fail();
    }
    return {...args,request:new Request(url,{method:incoming.method,headers,signal:args.signal})};
  }
  const invoke=(method,mode)=>(args,work)=>{
    const current=service();
    if(typeof current?.[method]!=='function')fail('shared_room_presentation_unavailable',503);
    return current[method](authenticated(args,mode),work);
  };
  return Object.freeze({withSharedCommittedReceipt:invoke('withSharedCommittedReceipt','receipt'),withActiveRoomPresentation:invoke('withActiveRoomPresentation','active')});
}
