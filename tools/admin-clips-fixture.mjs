// Isolated visual harness for the already-built /admin UI. No Next/game server,
// provider credentials, remote media or production state. Run from the checkout:
// Build with CROUPIER_LAB_BASE_PATH=/studio, then run:
// node tools/admin-clips-fixture.mjs --ffmpeg <installed-ffmpeg.exe> [--scene]
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import {createServer} from 'node:http';
import {createHash,createHmac,randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const args=process.argv.slice(2),option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const sceneMode=args.includes('--scene');
const port=Number(option('--port','4196')),host='127.0.0.1',origin=`http://${host}:${port}`;
const ffmpeg=option('--ffmpeg','ffmpeg'),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid loopback port');
// Keep only OS locations before importing repository modules; no dotenv read.
const keep=new Set(['PATH','SYSTEMROOT','WINDIR','TEMP','TMP','TMPDIR','COMSPEC','PATHEXT']);
for(const key of Object.keys(process.env))if(!keep.has(key.toUpperCase()))delete process.env[key];
const {installQaProcessGuard}=await import('./qa-process-guard.mjs');
installQaProcessGuard({ports:[port]});
const {createEmptyProject,addDealer,addVariant,validateProject,defaultPresentationLane}=await import('../packages/presentation/contracts/studio-model.mjs');
const {defaultCompositionSettings,defaultBlackjackTableGeometry}=await import('../packages/presentation/contracts/composition-settings.mjs');
const {compositionRuntimeResponse}=await import('../services/game/composition-runtime.mjs');
const {bindClip,clipSlots,createStudioClient}=await import('../apps/studio/client/admin/lib/connected-studio.mjs');
const {kindForEvent}=await import('../packages/presentation/contracts/video-intake.mjs');
const {layerAssetPath}=await import('../packages/presentation/contracts/presentation-layers.mjs');
const {createStudioNativeAuth}=await import('../packages/studio-access/studio-native-auth.mjs');
const {serveDesignPreview}=await import('../apps/studio/lib/design-preview.mjs');
const {parseByteRange}=await import('../apps/studio/lib/preview-files.mjs');
const buildRoot=join(root,'apps/studio/design-preview-build');
if(!fs.existsSync(join(buildRoot,'admin/app.js')))throw Error('Build Admin before starting the fixture');
// Binding the loopback port first is the single-instance guard: a second
// fixture on this port fails here, and the OS frees the port if we crash.
// Requests answer 503 until the self-checks below have passed.
let temporary,serve=null,stopping=false;
const server=createServer((req,res)=>{
  if(serve)return void serve(req,res);
  res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});res.end('{"error":"fixture_starting"}');
});
await new Promise((resolveReady,reject)=>{server.once('error',reject);server.listen(port,host,resolveReady);});
async function stop(){
  if(stopping)return;stopping=true;
  server.closeAllConnections();await new Promise(resolveClosed=>server.close(resolveClosed));
  if(temporary){
    const target=resolve(temporary);
    if(dirname(target)!==resolve(tmpdir())||!basename(target).startsWith('croupier-admin-clips-'))throw Error('Invalid fixture cleanup target');
    await fsp.rm(target,{recursive:true,force:true});
  }
  console.log('Admin clips fixture stopped.');
}
process.once('SIGINT',()=>void stop().then(()=>process.exit(0)));
process.once('SIGTERM',()=>void stop().then(()=>process.exit(0)));
try {
  temporary=await fsp.mkdtemp(join(tmpdir(),'croupier-admin-clips-'));
  const media=new Map(),dealerId='elin-fixture';
  const ids=[1,2,3].map(n=>`${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`);
  const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
  function generate(name,source,extra){
    const destination=join(temporary,name);
    const result=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',source,...extra,destination],{windowsHide:true,encoding:'utf8',timeout:30000});
    if(result.error||result.status!==0)throw Error(`Synthetic media generation failed: ${name} (${result.error?.code??result.status})`);
    return fs.readFileSync(destination);
  }
  const videoBytes=ids.map((id,index)=>generate(`sample-${index}.mp4`,'testsrc2=size=360x640:rate=12:duration=2',
    ['-vf',`hue=h=${index*90}`,'-an','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-movflags','+faststart']));
  let project=addDealer(createEmptyProject(),dealerId,'Elin · isolerad provdealer');
  const inventory={videos:ids.map((id,index)=>{
    const eventId=index?'deal.player.left':'idle.ready',event=project.events.find(row=>row.id===eventId);
    const label=index?`Vänster variant ${index} · syntetiskt prov`:'Grundloop · syntetiskt prov';
    const bytes=videoBytes[index];media.set('/studio/api/videos/'+id,{bytes,contentType:'video/mp4'});
    return {id,label,filename:`sample-${index}.mp4`,dealer:dealerId,available:true,integrity:'verified',sha256:digest(bytes),bytes:bytes.length,contentType:'video/mp4',durationMs:2000,previewUrl:'/studio/api/videos/'+id,
      classification:{label,dealerId,eventId,kind:kindForEvent(event),role:index?'alternative':'standard',situation:index?'box0':'',playback:'once',notes:'Isolerat tekniskt provmaterial; ingen godkänd dealer-tagning.',compositing:{mode:'opaque'}}};
  }),families:[],summary:{readable:true,snapshotReadable:true}};
  const slots=clipSlots(project,inventory,dealerId),idle=slots.find(row=>row.eventId==='idle.ready'),deal=slots.find(row=>row.id==='deal.player.left/box0');
  project=bindClip(project,inventory,dealerId,idle,ids[0],{durationMs:2000});
  for(let index=1;index<3;index++){
    const label=`Alternativ ${index}`;project=addVariant(project,dealerId,deal.eventId,label);
    const variant=project.lines.find(row=>row.dealerId===dealerId&&row.eventId===deal.eventId).variants.find(row=>row.label===label);
    project=bindClip(project,inventory,dealerId,deal,ids[index],{variantId:variant.id});
  }
  const assetId='44444444-4444-4444-8444-444444444444';
  const assetBytes=generate('table.png','color=c=0x146b50:size=720x360:duration=1',['-frames:v','1','-threads','1']);
  const asset={schemaVersion:1,id:assetId,role:'table',game:'blackjack',label:'Grönt provbord',contentType:'image/png',sha256:digest(assetBytes),size:assetBytes.length,width:720,height:360};
  asset.pathname=layerAssetPath(asset);project.layerAssets=[asset];
  media.set('/studio/api/layer-assets/'+assetId,{bytes:assetBytes,contentType:'image/png'});
  const rooms=[];
  if(sceneMode){
    const lane=defaultPresentationLane(dealerId);lane.id='fixture-scene';lane.label='Delad provscen';lane.renderer='layered';
    lane.layers.table={enabled:true,default:assetId,allowed:[assetId]};lane.composition=defaultCompositionSettings();
    lane.composition.mobile.table.y=.45;lane.composition.desktop.table.y=.45;
    lane.composition.blackjackTables=[defaultBlackjackTableGeometry(assetId)];project.lanes=[lane];
    rooms.push({id:'fixture-room',name:'Scenprov',operatorId:'fixture-company',game:'blackjack',compositionId:lane.id,state:'draft',published:false,playable:false,dealerIds:[dealerId],dealers:[{id:dealerId,name:'Elin · isolerad provdealer'}]});
  }
  project=validateProject({...project,revision:'fixture.ui.1'});
  assert.equal(project.lanes.length,sceneMode?1:0);
  const seed=structuredClone(project);let revision=1,saves=0,conflicts=0;
  const account={id:'7',username:'fixture-admin',role:'admin',email:'fixture@example.invalid',salt:randomBytes(16).toString('hex'),hash:randomBytes(64).toString('hex'),epoch:0};
  const signer=randomBytes(32),stamp=digest(Buffer.from(account.salt+':'+account.hash));
  const boDb={prepare(sql){return {get:async()=>sql.includes('FROM meta')?{v:signer.toString('hex')}:account,
    all:async(...values)=>/lower\(u.username\)/.test(sql)&&values[0]===account.username?[account]:[]};}};
  let authNow=Date.now;
  const authorize=createStudioNativeAuth({boDb,scope:{environment:'test',workspaceId:'admin-clips-fixture'},now:()=>authNow()});
  const jwtHeader=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  function createCookie(){
    const jwtBody=Buffer.from(JSON.stringify({sub:account.username,role:'admin',aud:'backoffice',exp:Math.floor(authNow()/1000)+14400,source_stamp:stamp,auth_epoch:0})).toString('base64url');
    return 'bo_jwt='+jwtHeader+'.'+jwtBody+'.'+createHmac('sha256',signer).update(jwtHeader+'.'+jwtBody).digest('base64url');
  }
  const cookie=createCookie();
  const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
  const headers={'cache-control':'private, no-store','content-security-policy':csp,'x-content-type-options':'nosniff'};
  const json=(value,status=200)=>Response.json(value,{status,headers});
  const fixtureOperators=[{id:'fixture-company',slug:'provbolaget',name:'Provbolaget',status:'active',archivedAt:null,packageRevision:null},{id:'fixture-archive',slug:'arkivbolaget',name:'Arkiverat provbolag',status:'archived',archivedAt:'2026-10-01T00:00:00Z',packageRevision:null}];
  const catalog=()=>({source:'registered',operators:[],dealers:project.dealers.map(row=>({id:row.id,name:row.label})),administration:{operators:fixtureOperators,rooms,compositions:[],dealers:project.dealers.map(row=>({id:row.id,name:row.label,archived:false})),revisions:{project:project.revision,administration:'fixture-admin-1'}}});
  function bump(value){project=validateProject({...structuredClone(value),revision:'fixture.ui.'+(++revision)});return project;}
  async function handle(request){
    const url=new URL(request.url);
    if(url.origin!==origin||request.headers.get('host')&&request.headers.get('host')!==new URL(origin).host)return json({error:'fixture_origin_required'},403);
    if(url.pathname==='/__fixture/start'&&request.method==='GET')return new Response(null,{status:303,headers:{...headers,'set-cookie':createCookie()+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=14400',location:'/admin/clips?dealer='+dealerId}});
    await authorize(request);
    const previewModule=['/studio/preview/compositor.js','/studio/preview/geometry.js'].includes(url.pathname);
    const compositor=await compositionRuntimeResponse(previewModule?new Request(origin+'/composition-runtime/'+basename(url.pathname),request):request);if(compositor)return compositor;
    if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==origin)return json({error:'fixture_origin_required'},403);
    if(url.pathname==='/__fixture/state')return json({isolated:true,revision:project.revision,saves,conflicts,dealerId,rooms:rooms.length,compositions:project.lanes.length,project});
    if(url.pathname==='/__fixture/conflict'&&request.method==='POST'){
      const other=structuredClone(project);other.dealers[0].label='Elin · sparad från annan session';bump(other);return json({revision:project.revision});
    }
    if(url.pathname==='/__fixture/reset'&&request.method==='POST'){bump(seed);saves=0;conflicts=0;return json({revision:project.revision});}
    if(url.pathname==='/__fixture/stop'&&request.method==='POST'){setTimeout(()=>void stop().then(()=>process.exit(0)),100);return json({stopping:true});}
    if(url.pathname==='/__fixture')return new Response(`<!doctype html><meta charset="utf-8"><title>Isolerad Admin-fixtur</title><style>body{font:18px system-ui;padding:36px;background:#13222c;color:white}button,a{padding:12px;margin:8px;color:inherit}button{background:#334855}</style><h1>Isolerad Admin-fixtur</h1><p>Minne, syntetisk N1-identitet och tre lokala tekniska provklipp. ${sceneMode?"En syntetisk rumsmall för scenprov. ":"Inga rum. "}Inga molntjänster eller produktdata.</p><p><a href="/admin/clips?dealer=${dealerId}">Öppna klippkartan</a><a href="/admin/assets">Materialbibliotek</a><a href="/__fixture/state">Sparat projekt / revisionskvitto</a></p><form method="post" action="/__fixture/conflict"><button>Skapa konkurrerande sparning</button></form><form method="post" action="/__fixture/reset"><button>Återställ endast fixturen</button></form><form method="post" action="/__fixture/stop"><button>Stoppa fixturen</button></form>`,{headers:{...headers,'content-type':'text/html; charset=utf-8'}});
    // Read-only synthetic System data. Mutation capabilities and external services stay absent.
    const systemData={
      'resource-lifecycle':{administrationRevision:'fixture-admin-1',operators:fixtureOperators,rooms:[],presentations:[],historyCoverage:'complete'},
      transactions:{tx:[{at:'2026-10-17T09:30:00.000Z',player_id:'fixture-player-one',type:'start',amount:-5,currency:'USD'},
        {at:'2026-10-17T09:31:00.000Z',player_id:'fixture-player-one',type:'collect',amount:10,currency:'USD'},
        {at:'2026-10-17T09:32:00.000Z',player_id:'fixture-player-two',type:'future-event',amount:0,currency:'SEK'}]},
      players:{players:[{id:'fixture-player-one',name:'Provspelare',status:'active',balance:100,currency:'USD'}]},
      users:{users:[]},apikeys:{keys:[]},emails:{},overview:{players:1,rooms:0},shoes:{shoes:[]},
    };
    if(url.pathname==='/studio/api/auth/session'&&request.method==='GET')return json({username:account.username,role:'admin',availableActions:Object.keys(systemData).map(key=>'GET '+key)});
    if(url.pathname.startsWith('/studio/api/admin/')&&request.method==='GET'){
      const key=url.pathname.slice('/studio/api/admin/'.length);
      if(Object.hasOwn(systemData,key))return Response.json(systemData[key],{headers:{...headers,'X-Croupier-Studio-Actor':encodeURIComponent(account.username),'X-Croupier-Studio-Role':'admin'}});
    }
    if(url.pathname==='/studio/api/openclaw/admin'){
      if(request.method!=='GET')return json({error:'fixture_read_only'},405);
      return json({version:1,baseHash:'fixture-models-1',gateway:{connected:true,version:'fixture',applied:null},
        agents:['croupier-director','croupier-speech'].map(id=>({id,model:{primary:'fixture/local',fallbacks:[]}})),models:[{id:'fixture/local',provider:'fixture'},{id:'fixture/alternative',provider:'fixture'}]});
    }
    if(url.pathname==='/admin/_data/catalog')return json(catalog());
    if(url.pathname==='/studio/api/project'){
      if(request.method==='GET')return json({project,status:{configured:true,provider:'fixture'}});
      if(request.method!=='PUT')return json({error:'method_not_allowed'},405);
      const body=await request.json();
      if(body.expectedRevision!==project.revision){conflicts++;return json({error:'studio_revision_conflict'},409);}
      const next=validateProject(body.project);bump(next);saves++;return json({project});
    }
    if(url.pathname==='/studio/api/videos')return json(inventory);
    if(media.has(url.pathname)){
      const {bytes,contentType}=media.get(url.pathname),range=parseByteRange(request.headers.get('range'),bytes.length);
      if(range&&range.status!=='ok')return new Response(null,{status:416,headers:{...headers,'content-range':`bytes */${bytes.length}`}});
      const start=range?.start??0,end=range?.end??bytes.length-1,body=bytes.subarray(start,end+1);
      return new Response(request.method==='HEAD'?null:body,{status:range?206:200,headers:{...headers,'content-type':contentType,'accept-ranges':'bytes','content-length':String(body.length),...(range?{'content-range':`bytes ${start}-${end}/${bytes.length}`}:{})}});
    }
    if(['/assistant-widget.js','/studio/assistant-widget.js'].includes(url.pathname))return new Response('// Provider-backed assistants are disabled in the isolated fixture.',{headers:{...headers,'content-type':'text/javascript'}});
    if(url.pathname==='/admin'||url.pathname.startsWith('/admin/')){
      const response=await serveDesignPreview(request,url.pathname.slice('/admin'.length).split('/').filter(Boolean),{authorize,root:buildRoot});
      const outgoing=new Headers(response.headers);outgoing.set('content-security-policy',csp);
      if(response.headers.get('content-type')?.startsWith('text/html')&&request.method==='GET'){
        outgoing.delete('content-length');return new Response((await response.text()).replace('<head>','<head><meta name="croupier-environment" content="isolated-qa">'),{status:response.status,headers:outgoing});
      }
      return new Response(response.body,{status:response.status,headers:outgoing});
    }
    return json({error:'fixture_endpoint_not_available'},404);
  }
  const fixtureRequest=(path,init={})=>handle(new Request(origin+path,{...init,headers:{cookie,origin,...init.headers}}));
  await assert.rejects(handle(new Request(origin+'/studio/api/project')),error=>error.statusCode===401);
  assert.equal((await fixtureRequest('/studio/api/project',{method:'PUT',headers:{origin:'https://outside.invalid'},body:'{}'})).status,403);
  const client=createStudioClient({fetchImpl:fixtureRequest});const loaded=await client.load();
  assert.equal(loaded.project.dealers.length,1);assert.equal(loaded.project.lanes.length,sceneMode?1:0);
  const changed=structuredClone(loaded.project);changed.dealers[0].label='Elin · kontrollsparning';const saved=await client.save(changed);
  assert.equal((await client.load()).project.revision,saved.revision);
  await fixtureRequest('/__fixture/conflict',{method:'POST'});
  await assert.rejects(client.save(saved),error=>error.statusCode===409);
  const ledger=await fixtureRequest('/studio/api/admin/transactions');
  assert.equal(ledger.headers.get('X-Croupier-Studio-Role'),'admin');
  assert.equal((await ledger.json()).tx.length,3);
  assert.equal((await fixtureRequest('/studio/api/openclaw/admin',{method:'PATCH',body:'{}'})).status,405);
  await assert.rejects(fetch('https://outside.invalid'),error=>error.code==='QA_NETWORK_BLOCKED');
  assert.throws(()=>fs.readFileSync(join(root,'.env')),error=>error.code==='ENOENT');
  const currentClock=authNow;
  try{
    authNow=()=>currentClock()+5*60*60*1000;
    await assert.rejects(fixtureRequest('/studio/api/project'),error=>error.statusCode===401);
    const renewed=await handle(new Request(origin+'/__fixture/start'));
    assert.equal(renewed.status,303);
    await authorize(new Request(origin+'/studio/api/project',{headers:{cookie:renewed.headers.get('set-cookie').split(';')[0]}}));
  }finally{authNow=currentClock;}
  project=structuredClone(seed);revision=1;saves=0;conflicts=0;
  serve=async(req,res)=>{
    try{
      const body=[];let total=0;for await(const part of req){total+=part.length;if(total>1024*1024)throw Object.assign(Error('large'),{statusCode:413});body.push(part);}
      const request=new Request(origin+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(body)}:{})});
      const response=await handle(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
    }catch(error){const status=error.statusCode??400;res.writeHead(status,{...headers,'content-type':'application/json'});res.end(JSON.stringify({error:status===401?'studio_login_required':'fixture_request_rejected'}));}
  };
  console.log(JSON.stringify({ready:true,pid:process.pid,url:origin+'/__fixture/start',controls:origin+'/__fixture',selfChecks:['native-auth-denied','session-renewed-after-expiry','foreign-origin-denied','save-reload','revision-conflict','system-read-identity','model-writes-denied','outbound-network-blocked','env-files-blocked'],dealerId,rooms:rooms.length,clips:inventory.videos.map(row=>({id:row.id,label:row.label,sha256:row.sha256})),bindingVariants:project.lines.find(row=>row.eventId==='deal.player.left').variants.filter(row=>row.videoGenerationId).map(row=>({id:row.id,videoId:row.videoGenerationId}))}));
}catch(error){await stop();throw error;}
