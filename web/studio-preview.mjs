import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {createNativeTableCommand} from './native-table.mjs';
import {createPresentationApi} from './presentation-api.mjs';
import {isActiveDealerId, registeredDealerIds} from './dealer-identity.mjs';
import {gamePresentationForDealer, isGameLaneId, gameChoicesForLane} from './public/game-lanes.mjs';
import {decorateGameEntryHtml} from './public/game-entry-contract.mjs';
import {defaultCompositionSettings} from './public/composition-settings.mjs';
import {validateLayerAsset} from './presentation-layers.mjs';
import {normalizeProject} from '../lab/lib/studio-model.mjs';
import {ownDealerIdle} from '../packages/presentation/runtime/registered-idle.mjs';
import {canonicalStudioJson, validateRevision, validateStudioScope, validateStudioMedia} from './storage/studio-contract.mjs';

const uuid='[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}';
const apiPattern=new RegExp(`^/api/studio-preview/(${uuid})(?:/(.*))?$`);
const entryPattern=new RegExp(`^/studio-preview/(${uuid})$`);
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const fail=(code,statusCode=400)=>{throw Object.assign(Error(code),{code,statusCode});};
const json=(status,body)=>Response.json(body,{status,headers});
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const same=(a,b)=>canonicalStudioJson(a)===canonicalStudioJson(b);
const privateRecord=({pathname,sha256,size,contentType})=>({provider:'vercel-blob',pathname,sha256,size,contentType});

async function readBody(request) {
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')fail('studio_preview_json_required',415);
  let size=0,raw='';const decoder=new TextDecoder('utf-8',{fatal:true});
  try {for await(const chunk of request.body??[]){size+=chunk.byteLength;if(size>16384)fail('studio_preview_request_too_large',413);raw+=decoder.decode(chunk,{stream:true});}raw+=decoder.decode();}
  catch(error){if(error.code)throw error;fail('studio_preview_invalid_json');}
  let body;try{body=JSON.parse(raw);}catch{fail('studio_preview_invalid_json');}
  if(!body||typeof body!=='object'||Array.isArray(body))fail('studio_preview_invalid_json');
  return body;
}
function fields(body,allowed) {if(Object.keys(body).some(key=>!allowed.includes(key)))fail('studio_preview_invalid_request');}

// This is a separate transport and never accepts a product player database,
// partner publisher, player cookie or live project reader after capture.
export function createStudioPreview({authorize,scope,repository,registryLoader,privateMedia,bankVideoResponse,readHtml,
  origin,now=Date.now,ttlMs=20*60*1000,maxSessions=16,maxSessionsPerAdmin=3,dbFactory=()=>new DatabaseSync(':memory:')}={}) {
  scope=validateStudioScope(scope);
  if(!same(repository?.scope,scope)||typeof repository?.readPresentationSnapshot!=='function'
    ||[authorize,registryLoader,privateMedia,bankVideoResponse,readHtml,now,dbFactory].some(f=>typeof f!=='function')
    ||!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>60*60*1000
    ||!Number.isSafeInteger(maxSessions)||maxSessions<1||maxSessions>64
    ||!Number.isSafeInteger(maxSessionsPerAdmin)||maxSessionsPerAdmin<1||maxSessionsPerAdmin>maxSessions)throw Error('Invalid Studio preview configuration');
  const checkedOrigin=new URL(origin);
  if(checkedOrigin.origin!==origin||checkedOrigin.username||checkedOrigin.password
    ||!(checkedOrigin.protocol==='https:'||checkedOrigin.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(checkedOrigin.hostname)))throw Error('Invalid Studio preview origin');
  const sessions=new Map(),pending=new Map();let closed=false;
  const metadata=s=>({sessionId:s.id,presentationLaneId:s.lane.id,projectRevision:s.project.revision,expiresAt:new Date(s.expires).toISOString()});
  function dispose(s){if(s.closed)return;s.closed=true;clearTimeout(s.timer);sessions.delete(s.id);if(!s.active)s.db.close();}
  function expire(){for(const s of sessions.values())if(s.expires<=now())dispose(s);}
  function available(s,dealerId){const row=s.dealerAvailability.find(row=>row.id===dealerId);if(!row)fail('studio_preview_dealer_not_found',404);if(!row.playable)fail(row.reason,422);return row;}
  function live(s){if(closed||s.closed||s.expires<=now()){dispose(s);fail('studio_preview_expired',410);}}
  function inventoryFor(s){return {...s.inventory,videos:s.inventory.videos.map(video=>({...video,previewUrl:`/api/studio-preview/${s.id}/videos/${video.id}`}))};}
  function selection(s,params) {
    if([...params.keys()].some(key=>key!=='dealer')||params.getAll('dealer').length>1)fail('studio_preview_invalid_selection');
    const dealer=params.get('dealer')??s.lane.layers.dealer.default;available(s,dealer);
    const presentation=gamePresentationForDealer(dealer,'portrait-video');
    const lane=structuredClone(s.lane);lane.layers.dealer.allowed=s.dealerAvailability.filter(row=>row.playable).map(row=>row.id);
    // Preview can try the complete captured library without changing saved lane
    // assignments. Per-clip compositing still decides whether each film reveals it.
    for(const role of ['table','background']){
      const assets=s.assets.filter(row=>row.role===role);
      lane.layers[role].allowed=assets.map(row=>row.id);
      lane.layers[role].enabled=assets.length>0;
      if(role==='background'){
        if(assets.length&&lane.layers[role].mode==='baked')lane.layers[role].mode=assets.some(row=>row.contentType.startsWith('image/'))?'image':'video';
      }
    }
    lane.composition??=defaultCompositionSettings();
    const registry=s.project.dealers.filter(row=>isActiveDealerId(row.id)).map(({id,label})=>({id,label}));
    const choices=gameChoicesForLane([lane],lane.id,{renderer:'portrait-video',dealer},{portraitDealerIds:lane.layers.dealer.allowed});
    const composition={schemaVersion:1,
      background:{enabled:lane.layers.background.enabled,mode:lane.layers.background.mode,allowed:lane.layers.background.allowed,default:lane.layers.background.default},
      table:{enabled:lane.layers.table.enabled,allowed:lane.layers.table.allowed,default:lane.layers.table.default},
      dealer:{enabled:lane.layers.dealer.enabled,compatibility:'per-clip'},
      ...(lane.composition?{settings:lane.composition}:{}),
      ...(lane.backgroundPlayback?{backgroundPlayback:structuredClone(lane.backgroundPlayback)}:{}),
      assets:s.assets.map(({id,role,label,contentType})=>({id,role,label,contentType,src:`/api/studio-preview/${s.id}/layers/${id}`}))};
    return {lane:lane.id,dealer,presentation,...(presentation==='local'?{localDealer:dealer}:{}),registeredDealers:registry,choices,composition};
  }
  async function capture(actor,body,request) {
    fields(body,['presentationLaneId','expectedProjectRevision']);
    if(!isGameLaneId(body.presentationLaneId))fail('studio_preview_invalid_lane',422);
    validateRevision(body.expectedProjectRevision);expire();
    if(closed)fail('studio_preview_unavailable',503);
    const owner=actor.user;
    if(sessions.size+[...pending.values()].reduce((a,b)=>a+b,0)>=maxSessions
      ||[...sessions.values()].filter(s=>s.owner===owner).length+(pending.get(owner)??0)>=maxSessionsPerAdmin)fail('studio_preview_limit',429);
    pending.set(owner,(pending.get(owner)??0)+1);let db;
    try {
      const snapshot=freeze(structuredClone(await repository.readPresentationSnapshot()));
      if(!same(snapshot.scope,scope)||snapshot.projectDocument?.kind!=='project'||snapshot.administrationDocument?.kind!=='administration')fail('studio_preview_snapshot_unavailable',503);
      if(snapshot.projectDocument.revision!==body.expectedProjectRevision||snapshot.projectDocument.value?.revision!==body.expectedProjectRevision)fail('studio_preview_revision_conflict',409);
      const project=freeze(normalizeProject(snapshot.projectDocument.value));registeredDealerIds(project);
      const lane=project.lanes.find(row=>row.id===body.presentationLaneId);if(!lane)fail('studio_preview_lane_not_found',404);
      const loadedInventory=await registryLoader(snapshot);
      const inventory=freeze(structuredClone({videos:loadedInventory.videos,families:loadedInventory.families}));
      if(!Array.isArray(inventory.videos)||inventory.videos.length>5000||!Array.isArray(inventory.families))fail('studio_preview_media_unavailable',503);
      const records=new Map();
      for(const row of snapshot.mediaRows){const {revision,updatedAt,...record}=row;validateRevision(revision);validateStudioMedia(record);if(records.has(row.id))fail('studio_preview_media_unavailable',503);records.set(row.id,freeze(record));}
      const ids=new Set();
      for(const video of inventory.videos){
        if(!new RegExp(`^${uuid}$`).test(video.id)||ids.has(video.id)||!/^[a-f0-9]{64}$/.test(video.sha256))fail('studio_preview_media_unavailable',503);ids.add(video.id);
        const record=records.get(video.id);
        if(record&&(record.sha256!==video.sha256||record.size!==video.bytes||!same(record.classification,video.classification)))fail('studio_preview_media_mismatch',409);
        if(['upload'].includes(video.source)&&!record)fail('studio_preview_media_unavailable',503);
      }
      const assets=freeze((project.layerAssets??[]).map(validateLayerAsset));
      if(['table','background'].some(role=>assets.filter(row=>row.role===role).length>32))fail('studio_preview_layer_limit',422);
      const dealerAvailability=project.dealers.filter(row=>isActiveDealerId(row.id)).map(({id,label})=>({id,label,playable:Boolean(ownDealerIdle(project,inventory,id)),
        reason:ownDealerIdle(project,inventory,id)?null:'studio_preview_idle_required'}));
      if(!dealerAvailability.find(row=>row.id===lane.layers.dealer.default)?.playable)fail('studio_preview_idle_required',422);
      const current=await authorize(request);if(current.role!=='admin'||current.user!==owner||!same(current.scope,scope))fail('studio_preview_forbidden',403);
      if(closed)fail('studio_preview_unavailable',503);
      db=dbFactory();db.exec('CREATE TABLE players (id TEXT PRIMARY KEY,name TEXT,currency TEXT,balance REAL); CREATE TABLE transactions (player_id TEXT,type TEXT,amount REAL,currency TEXT,note TEXT);');
      const id=randomUUID(),playerId=`studio-preview:${id}`,expires=now()+ttlMs;
      db.prepare('INSERT INTO players VALUES (?,?,?,?)').run(playerId,'Studio provspel','EUR',10000);
      const sessionDb=db;
      const getPlayer=()=>sessionDb.prepare('SELECT * FROM players WHERE id=?').get(playerId);
      const command=createNativeTableCommand({db,getPlayer,logTx:(...values)=>sessionDb.prepare('INSERT INTO transactions VALUES (?,?,?,?,?)').run(...values)});
      const s={id,owner,project,lane,inventory,records,snapshot,assets,dealerAvailability,expires,db,getPlayer,command,active:0,closed:false};
      s.api=createPresentationApi({db,env:{},store:{configurationSource:'studio-preview',load:async()=>project},registryLoader:async()=>inventoryFor(s),recordedSpeechPreview:true});
      s.timer=setTimeout(()=>dispose(s),ttlMs);s.timer.unref?.();sessions.set(id,s);db=null;
      return json(201,{...metadata(s),entryUrl:`/studio-preview/${id}`});
    }finally{pending.set(owner,pending.get(owner)-1);if(!pending.get(owner))pending.delete(owner);if(db)db.close();}
  }
  async function media(s,kind,id,request) {
    if(!['GET','HEAD'].includes(request.method))fail('studio_preview_method_not_allowed',405);
    if(new URL(request.url).search)fail('studio_preview_invalid_media');
    let response,expected;
    if(kind==='layers'){
      expected=s.assets.find(row=>row.id===id);if(!expected)fail('studio_preview_media_not_found',404);
      response=await privateMedia(privateRecord(expected),request);
    }else{
      expected=s.inventory.videos.find(row=>row.id===id&&row.available);if(!expected)fail('studio_preview_media_not_found',404);
      const record=s.records.get(id);
      response=record?await privateMedia(privateRecord(record),request):await bankVideoResponse(id,request,s.snapshot);
    }
    try{live(s);}catch(error){await response.body?.cancel();throw error;}
    if([200,206,304].includes(response.status)&&response.headers.get('etag')!==`"sha256-${expected.sha256}"`){await response.body?.cancel();fail('studio_preview_media_mismatch',409);}
    const resultHeaders=new Headers(response.headers);for(const [key,value]of Object.entries(headers))resultHeaders.set(key,value);resultHeaders.delete('set-cookie');
    return new Response(response.body,{status:response.status,headers:resultHeaders});
  }
  async function presentation(s,endpoint,request,url) {
    if(!['config','legacy-config','select','idle-advice'].includes(endpoint))fail('studio_preview_route_not_found',404);
    let body;
    if(['select','idle-advice'].includes(endpoint)){
      if(request.method!=='POST')fail('studio_preview_method_not_allowed',405);
      body=await readBody(request);if(url.search||body.presentationContext!==undefined)fail('studio_preview_invalid_request');
      available(s,body.dealerId);
      if(endpoint==='idle-advice'||['active','shadow'].includes(body.mode))fail('studio_preview_external_unavailable',503);
    }else{
      if(!['GET','HEAD'].includes(request.method))fail('studio_preview_method_not_allowed',405);
      if(endpoint==='config'){
        if(url.searchParams.size!==1||url.searchParams.getAll('dealerId').length!==1)fail('studio_preview_invalid_selection');
        available(s,url.searchParams.get('dealerId'));
      }else if(url.search)fail('studio_preview_invalid_request');
    }
    const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);req.method=request.method==='HEAD'?'GET':request.method;
    req.url=`/api/presentation/${endpoint}${url.search}`;req.headers=Object.fromEntries(request.headers);
    const res=new EventEmitter();let status=500,output;
    res.writeHead=value=>{status=value;};res.end=value=>{output=value;res.writableEnded=true;};
    await s.api(req,res,`/api/presentation/${endpoint}`,s.getPlayer().id);live(s);
    let value;try{value=JSON.parse(output);}catch{fail('studio_preview_presentation_unavailable',503);}
    const mapped=JSON.parse(JSON.stringify(value,(_key,item)=>typeof item==='string'?item.replace(/^\/api\/presentation\/videos\/([a-f0-9-]{36})$/,`/api/studio-preview/${s.id}/videos/$1`):item));
    return request.method==='HEAD'?new Response(null,{status,headers:{...headers,'Content-Type':'application/json'}}):json(status,mapped);
  }
  async function handle(request) {
    const url=new URL(request.url),entry=entryPattern.exec(url.pathname),api=apiPattern.exec(url.pathname),creating=url.pathname==='/api/studio-preview';
    if(!creating&&!entry&&!api)return null;
    let s,acquired=false;
    try {
      if(closed)fail('studio_preview_unavailable',503);
      if(url.origin!==origin||request.headers.get('sec-fetch-site')==='cross-site')fail('studio_preview_forbidden',403);
      if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==origin)fail('studio_preview_origin_rejected',403);
      const actor=await authorize(request);
      if(actor?.role!=='admin'||!actor.user||!same(actor.scope,scope))fail('studio_preview_forbidden',403);
      if(creating){if(request.method!=='POST')fail('studio_preview_method_not_allowed',405);if(url.search)fail('studio_preview_invalid_request');return await capture(actor,await readBody(request),request);}
      s=sessions.get((entry??api)[1]);if(!s)fail('studio_preview_not_found',404);
      if(s.owner!==actor.user)fail('studio_preview_not_found',404);live(s);s.active++;acquired=true;
      if(entry){
        if(!['GET','HEAD'].includes(request.method))fail('studio_preview_method_not_allowed',405);
        const selected={...selection(s,url.searchParams),studioPreview:metadata(s)},decorated=decorateGameEntryHtml(await readHtml(),{},selected,{offline:true});live(s);
        return new Response(request.method==='HEAD'?null:decorated,{status:200,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
      }
      const route=api[2]??'';
      if(!route){if(request.method!=='DELETE')fail('studio_preview_method_not_allowed',405);if(url.search)fail('studio_preview_invalid_request');dispose(s);return json(200,{ok:true});}
      if(route==='session'){
        if(!['GET','HEAD'].includes(request.method))fail('studio_preview_method_not_allowed',405);if(url.search)fail('studio_preview_invalid_request');
        return request.method==='HEAD'?new Response(null,{status:200,headers}):json(200,{authenticated:true,preview:true,guest:false,studioPreview:metadata(s),dealerAvailability:s.dealerAvailability,externalServices:{ai:false,speech:false}});
      }
      if(route==='player'){
        if(request.method!=='POST')fail('studio_preview_method_not_allowed',405);if(url.search)fail('studio_preview_invalid_request');fields(await readBody(request),['id']);live(s);return json(200,s.getPlayer());
      }
      if(route==='table'){
        if(request.method!=='POST')fail('studio_preview_method_not_allowed',405);if(url.search)fail('studio_preview_invalid_request');
        const body=await readBody(request);fields(body,['id','op','version','requestId','dealer','bets','action','take']);available(s,body.dealer);live(s);
        try{return json(200,s.command({...body,id:s.getPlayer().id}));}catch{fail('studio_preview_table_rejected',409);}
      }
      const asset=/^(videos|layers)\/([a-f0-9-]{36})$/.exec(route);if(asset)return await media(s,asset[1],asset[2],request);
      if(route.startsWith('presentation/'))return await presentation(s,route.slice('presentation/'.length),request,url);
      fail('studio_preview_route_not_found',404);
    }catch(error){const status=[400,401,403,404,405,409,410,413,415,422,429,503].includes(error.statusCode)?error.statusCode:503;
      const code=/^studio_[a-z0-9_]{1,100}$/.test(error.code??'')?error.code:'studio_preview_unavailable';return json(status,{error:code});
    }finally{if(acquired){s.active--;if(s.closed&&!s.active)s.db.close();}}
  }
  return Object.freeze({handle,close(){closed=true;for(const s of sessions.values())dispose(s);}});
}
