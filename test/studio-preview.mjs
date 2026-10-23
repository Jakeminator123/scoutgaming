import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {createStudioPreview} from '../services/game/studio-preview.mjs';
import {createStudioNativeAuth} from '../packages/studio-access/studio-native-auth.mjs';
import {addDealer,createEmptyProject,defaultPresentationLane} from '../packages/presentation/contracts/studio-model.mjs';
import {layerAssetPath} from '../packages/presentation/contracts/presentation-layers.mjs';
import {defaultCompositionSettings} from '../packages/presentation/contracts/composition-settings.mjs';
import {resolvePlayerSelection} from '../packages/presentation/runtime/player-choices.mjs';
import {defaultBackgroundRule,defaultLayerRule} from '../packages/presentation/contracts/background-playback-policy.mjs';
import {recordedSpeechIdentity} from '../packages/presentation/contracts/recorded-speech.mjs';

const origin='https://studio.example.invalid',scope={environment:'fixture',workspaceId:'croupier'};
const videoId='10000000-0000-4000-8000-000000000001',layerId='20000000-0000-4000-8000-000000000001';
const bets=[{main:5,pp:0,tp:0},...Array.from({length:6},()=>({main:0,pp:0,tp:0}))];
function fixture(t,options={}){
  const project=addDealer(addDealer(createEmptyProject(),'linnea','Linnea'),'unfinished','Utan grundloop');
  project.revision='preview-fixture.1';const lane=defaultPresentationLane('linnea');project.lanes=[lane];lane.layers.dealer={enabled:true,default:'linnea',allowed:['linnea']};lane.dealers=['linnea'];lane.composition=defaultCompositionSettings();
  const row={id:videoId,sha256:'a'.repeat(64),size:128,contentType:'video/mp4',revision:'media.1',
    pathname:`croupier/media/dealers/linnea/review/uploads/${videoId}/${'a'.repeat(64)}.mp4`,
    classification:{dealerId:'linnea',eventId:'idle.ready',kind:'idle',role:'standard',situation:'',label:'Grundloop',notes:'',playback:'once',compositing:{mode:'green-screen',threshold:.2,softness:.1,despill:0}}};
  project.lines.find(line=>line.dealerId==='linnea'&&line.eventId==='idle.ready').variants[0].videoGenerationId=videoId;
  const layer={schemaVersion:1,id:layerId,role:'table',label:'Provbord',sha256:'b'.repeat(64),size:128,contentType:'image/png',width:720,height:1280};layer.pathname=layerAssetPath(layer);project.layerAssets=[layer];
  lane.layers.table={...lane.layers.table,default:layerId,allowed:[layerId]};
  const snapshot={scope,projectDocument:{kind:'project',revision:project.revision,value:project},administrationDocument:{kind:'administration',revision:'admin.1',value:{}},mediaRows:[row]};
  const inventory={videos:[{id:row.id,sha256:row.sha256,bytes:row.size,available:true,source:'upload',dealer:'linnea',fileName:'idle.mp4',classification:structuredClone(row.classification)}],families:[]};
  const state={actor:'admin-one',role:'admin',revoked:false,time:2000000,reads:0,registryReads:0,legacyReads:0,dbs:[],media:[],bank:[],mediaHash:null,authCalls:0};
  const request=(path,method='GET',body,extra={})=>new Request(origin+path,{method,headers:{cookie:'lab_session=fixture',...(!['GET','HEAD'].includes(method)?{origin,'content-type':'application/json'}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const api=createStudioPreview({scope,origin,now:()=>state.time,ttlMs:2000,maxSessions:4,maxSessionsPerAdmin:2,
    repository:{scope,readPresentationSnapshot:async()=>{state.reads++;return snapshot;}},
    authorize:async()=>{state.authCalls++;if(state.revoked)throw Object.assign(Error('revoked'),{code:'studio_login_required',statusCode:401});return{user:state.actor,role:state.role,scope};},
    registryLoader:async()=>{state.registryReads++;await options.onRegistryLoad?.();return inventory;},legacyControlsCaptured:async(s,p)=>{state.legacyReads++;assert.equal(s.projectDocument.revision,p.revision);return{runtime:{revision:p.revision,saved:true}};},
    privateMedia:async(record,req)=>{state.media.push({record:structuredClone(record),method:req.method,range:req.headers.get('range')});return new Response(req.method==='HEAD'?null:'abcdefgh',{status:req.headers.has('range')?206:200,headers:{ETag:`"sha256-${state.mediaHash??record.sha256}"`,'Content-Type':record.contentType}});},
    bankVideoResponse:async(id,req)=>{state.bank.push(id);return new Response(req.method==='HEAD'?null:'bank',{headers:{ETag:`"sha256-${state.mediaHash??'c'.repeat(64)}"`}});},
    readHtml:async()=>'<html lang="sv"><body>Preview</body></html>',
    dbFactory:()=>{const db=new DatabaseSync(':memory:');state.dbs.push(db);return db;},...options});
  t.after(()=>api.close());
  const create=async(extra={})=>{const response=await api.handle(request('/api/studio-preview','POST',{presentationLaneId:lane.id,expectedProjectRevision:project.revision,...extra}));return{response,body:await response.json()};};
  return{api,state,project,snapshot,inventory,row,layer,request,create};
}
async function start(f){const result=await f.create();assert.equal(result.response.status,201,JSON.stringify(result.body));return result.body;}

test('owned isolated preview permits only verified pending recorded speech and keeps exact own audio identity',async t=>{
  for(const status of ['pending','rejected','unverified']){
    const f=fixture(t),id='10000000-0000-4000-8000-000000000002',sha256='d'.repeat(64);
    const metadata={schemaVersion:1,dealerId:'linnea',lineId:'goodluck',takeId:'goodluck_sv_1',language:'sv',exactText:'Lycka till.',
      videoSha256:sha256,audioSha256:'e'.repeat(64),indexSha256:'f'.repeat(64),fps:24,frameCount:72,audioDelayMs:0,
      entryPose:'VILA',exitPose:'VILA',calibrationRevision:'fixture-v1',recording:{status:'pending'},review:{status:'pending'}};
    const proof={by:'fixture-reviewer',at:'2026-10-14T00:00:00.000Z',identity:recordedSpeechIdentity(metadata)};
    if(status!=='unverified')metadata.recording={status:'verified-recording',...structuredClone(proof)};
    if(status==='rejected')metadata.review={status,...structuredClone(proof)};
    const row={...structuredClone(f.row),id,sha256,pathname:`croupier/media/dealers/linnea/review/uploads/${id}/${sha256}.mp4`,
      classification:{...f.row.classification,eventId:'speak.goodluck',kind:'speech',situation:'goodluck',recordedSpeech:metadata}};
    f.project.lines.find(line=>line.dealerId==='linnea'&&line.eventId==='speak.goodluck').variants[0].videoGenerationId=id;
    f.snapshot.mediaRows.push(row);f.inventory.videos.push({id,sha256,bytes:row.size,available:true,source:'upload',dealer:'linnea',fileName:'speech.mp4',classification:structuredClone(row.classification)});
    const session=await start(f),path=`/api/studio-preview/${session.sessionId}/presentation/select`,payload={dealerId:'linnea',mode:'off',version:0,event:{type:'speak',line:'goodluck'}};
    const response=await f.api.handle(f.request(path,'POST',payload));assert.equal(response.status,200);
    const result=await response.json();
    if(status==='pending'){
      assert.equal(result.video.id,id);assert.deepEqual(result.video.recordedSpeech,metadata);
      assert.equal(result.video.src,`/api/studio-preview/${session.sessionId}/videos/${id}`);
    }else{assert.equal(result.video,null);assert.equal(result.standard,null);}
    f.state.actor='other-admin';assert.equal((await f.api.handle(f.request(path,'POST',payload))).status,404);
    f.state.actor='admin-one';f.state.revoked=true;assert.equal((await f.api.handle(f.request(path,'POST',payload))).status,401);
  }
});

test('rehearsal freezes background rules and serves their captured layers through its own scoped grants',async t=>{
  const f=fixture(t),id='20000000-0000-4000-8000-000000000002';
  const background={...f.layer,id,role:'background',contentType:'video/mp4'};background.pathname=layerAssetPath(background);
  f.project.layerAssets.push(background);
  const lane=f.project.lanes[0];lane.layers.background={enabled:true,mode:'video',default:id,allowed:[id]};
  lane.backgroundPlayback={schemaVersion:1,rules:[defaultBackgroundRule(id,'celebrate')]};
  const captured=structuredClone(lane.backgroundPlayback),session=await start(f);
  lane.backgroundPlayback.rules[0].trigger={eventId:'speak.win'};
  f.project.layerAssets=[];
  const response=await f.api.handle(f.request(session.entryUrl));assert.equal(response.status,200);
  const html=await response.text(),raw=html.match(/data-game-composition="([^"]+)"/)[1];
  const composition=JSON.parse(raw.replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));
  assert.deepEqual(composition.backgroundPlayback,captured);
  assert.equal(composition.assets.find(asset=>asset.id===id).src,`/api/studio-preview/${session.sessionId}/layers/${id}`);
  assert.equal((await f.api.handle(f.request(`/api/studio-preview/${session.sessionId}/layers/${id}`))).status,200);
  f.state.actor='another-admin';
  assert.equal((await f.api.handle(f.request(`/api/studio-preview/${session.sessionId}/layers/${id}`))).status,404);
});

test('rehearsal composition carries the frozen table rules beside the background rules',async t=>{
  const f=fixture(t),id='20000000-0000-4000-8000-000000000003';
  const clip={...f.layer,id,label:'Levande bord',contentType:'video/mp4'};clip.pathname=layerAssetPath(clip);
  f.project.layerAssets.push(clip);
  const lane=f.project.lanes[0];lane.layers.table={enabled:true,default:layerId,allowed:[layerId,id]};
  lane.tablePlayback={schemaVersion:1,rules:[defaultLayerRule(id,'living',{role:'table'})]};
  const captured=structuredClone(lane.tablePlayback),session=await start(f);
  lane.tablePlayback.rules=[];
  const response=await f.api.handle(f.request(session.entryUrl));assert.equal(response.status,200);
  const html=await response.text(),raw=html.match(/data-game-composition="([^"]+)"/)[1];
  const composition=JSON.parse(raw.replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));
  assert.deepEqual(composition.tablePlayback,captured);assert.equal(Object.hasOwn(composition,'backgroundPlayback'),false);
  assert.deepEqual(composition.table.allowed,[layerId,id]);assert.equal(composition.table.default,layerId);
  assert.equal(composition.assets.find(asset=>asset.id===id).src,`/api/studio-preview/${session.sessionId}/layers/${id}`);
});

test('preview captures saved project and media once without consulting legacy policy or publishing',async t=>{
  const f=fixture(t),session=await start(f),base='/api/studio-preview/'+session.sessionId;
  assert.match(session.entryUrl,new RegExp('^/studio-preview/'+session.sessionId+'$'));assert.equal(session.projectRevision,f.project.revision);
  f.project.revision='changed';f.inventory.videos=[];f.row.sha256='f'.repeat(64);
  const config=await f.api.handle(f.request(base+'/presentation/config?dealerId=linnea'));
  assert.equal(config.status,200);const body=await config.json();assert.equal(body.projectRevision,session.projectRevision);
  assert.equal(body.dealerIdle.linnea.src,base+'/videos/'+videoId);assert.equal(body.inventory.videos[0].previewUrl,base+'/videos/'+videoId);
  assert.equal(body.inventory.videos[0].sha256,'a'.repeat(64));assert.deepEqual([f.state.reads,f.state.registryReads,f.state.legacyReads],[1,1,0]);
  const player=await f.api.handle(f.request(base+'/player','POST',{id:'real-player'}));assert.equal(player.status,200);
  const value=await player.json();assert.equal(value.id,'studio-preview:'+session.sessionId);assert.equal(value.balance,10000);assert.equal(player.headers.get('set-cookie'),null);
});

test('N1 identity, owner and exact Origin are checked for every preview route and media',async t=>{
  const f=fixture(t),session=await start(f),base='/api/studio-preview/'+session.sessionId;
  f.state.actor='another-admin';assert.equal((await f.api.handle(f.request(base+'/videos/'+videoId))).status,404);
  f.state.actor='admin-one';f.state.revoked=true;assert.equal((await f.api.handle(f.request(base+'/layers/'+layerId))).status,401);
  f.state.revoked=false;f.state.role='editor';assert.equal((await f.api.handle(f.request(base+'/session'))).status,403);
  f.state.role='admin';assert.equal((await f.api.handle(f.request(base+'/player','POST',{}, {origin:'https://foreign.invalid'}))).status,403);
  assert.equal((await f.api.handle(f.request(base+'/videos/'+videoId,'GET',undefined,{'sec-fetch-site':'cross-site'}))).status,403);
  assert.equal(f.state.media.length,0);assert.equal((await f.api.handle(f.request(base+'/session'))).status,200);
});

test('each preview has a separate shoe, wallet and idempotent authoritative table',async t=>{
  const f=fixture(t),a=await start(f),b=await start(f),base='/api/studio-preview/';
  const state=async s=>(await (await f.api.handle(f.request(base+s.sessionId+'/table','POST',{op:'state',dealer:'linnea'}))).json());
  const before=await state(a),other=await state(b);assert.notEqual(before.shoe.id,other.shoe.id);
  const body={op:'start',dealer:'linnea',version:before.version,requestId:randomUUID(),bets,id:'production-player'};
  const first=await f.api.handle(f.request(base+a.sessionId+'/table','POST',body));assert.equal(first.status,200);const played=await first.json();
  assert.equal(played.balance,9995);assert.ok(played.presentation.some(event=>event.type==='deal'));
  const replay=await (await f.api.handle(f.request(base+a.sessionId+'/table','POST',body))).json();assert.equal(replay.balance,played.balance);assert.equal(replay.version,played.version);
  assert.equal((await state(b)).balance,10000);assert.equal((await state(b)).version,0);
  assert.equal((await f.api.handle(f.request(base+a.sessionId+'/table','POST',{...body,balance:999999}))).status,400);
  assert.equal((await f.api.handle(f.request(base+a.sessionId+'/deposit','POST',{amount:1000}))).status,404);
  assert.equal((await f.api.handle(f.request('/api/table','POST',body))),null,'ordinary API never handled by preview');
});

test('private media is pinned to captured records, ranges supported and unknown or changed hashes rejected',async t=>{
  const f=fixture(t),session=await start(f),base='/api/studio-preview/'+session.sessionId;
  f.row.pathname='different';f.layer.sha256='f'.repeat(64);
  const video=await f.api.handle(f.request(base+'/videos/'+videoId,'GET',undefined,{range:'bytes=0-3'}));assert.equal(video.status,206);assert.equal(video.headers.get('cache-control'),'private, no-cache, must-revalidate');
  assert.equal(f.state.media[0].record.sha256,'a'.repeat(64));assert.match(f.state.media[0].record.pathname,/croupier\/media\//);assert.equal(f.state.media[0].range,'bytes=0-3');
  const head=await f.api.handle(f.request(base+'/layers/'+layerId,'HEAD'));assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(f.state.media[1].record.sha256,'b'.repeat(64));
  assert.equal((await f.api.handle(f.request(base+'/videos/10000000-0000-4000-8000-000000000099'))).status,404);
  f.state.mediaHash='f'.repeat(64);assert.equal((await f.api.handle(f.request(base+'/videos/'+videoId))).status,409);
});

test('cached preview bytes still require current owner, authorization and an open unexpired session',async t=>{
  for(const change of [f=>{f.state.revoked=true;},f=>{f.state.actor='another-admin';},f=>{f.state.time+=3000;}]) {
    const f=fixture(t),session=await start(f),path='/api/studio-preview/'+session.sessionId+'/videos/'+videoId;
    const first=await f.api.handle(f.request(path));assert.equal(await first.text(),'abcdefgh');
    const conditional={'if-none-match':first.headers.get('etag')};
    const repeat=await f.api.handle(f.request(path,'GET',undefined,conditional));
    assert.equal(repeat.status,304);assert.equal(await repeat.text(),'');
    const calls=f.state.authCalls,reads=f.state.media.length;change(f);
    const denied=await f.api.handle(f.request(path,'GET',undefined,conditional));
    assert.ok([401,404,410].includes(denied.status));assert.equal(denied.headers.get('cache-control'),'private, no-store');
    assert.equal(f.state.authCalls,calls+1);assert.equal(f.state.media.length,reads);
  }
  const f=fixture(t),session=await start(f),base='/api/studio-preview/'+session.sessionId;
  await (await f.api.handle(f.request(base+'/videos/'+videoId))).body.cancel();
  assert.equal((await f.api.handle(f.request(base,'DELETE',{}))).status,200);
  assert.equal((await f.api.handle(f.request(base+'/videos/'+videoId,'GET',undefined,{'if-none-match':`"sha256-${'a'.repeat(64)}"`}))).status,404);
});

test('captured immutable bank UUID must retain its expected SHA and never borrows current uploads',async t=>{
  let captured;const f=fixture(t,{bankVideoResponse:async(id,req,snapshot)=>{captured=snapshot;f.state.bank.push(id);return new Response('bank',{headers:{ETag:`"sha256-${f.state.mediaHash??'c'.repeat(64)}"`}});}});f.snapshot.runtimeCatalog={revision:'catalog.1',value:{frozen:true}};
  const id='30000000-0000-4000-8000-000000000001';f.inventory.videos.push({id,sha256:'c'.repeat(64),bytes:4,available:true,source:'emil',dealer:'astrid'});
  const session=await start(f),path='/api/studio-preview/'+session.sessionId+'/videos/'+id;
  f.snapshot.runtimeCatalog.revision='catalog.2';
  assert.equal((await f.api.handle(f.request(path))).status,200);assert.deepEqual(f.state.bank,[id]);assert.equal(f.state.media.length,0);
  assert.equal(captured.runtimeCatalog.revision,'catalog.1');assert.equal(Object.isFrozen(captured.runtimeCatalog),true);
  f.state.mediaHash='d'.repeat(64);assert.equal((await f.api.handle(f.request(path))).status,409);
});

test('HTML and session metadata preserve own identity and expose incomplete dealers without fallback',async t=>{
  const f=fixture(t,{readHtml:()=>readFile(new URL('../services/game/public/index.html',import.meta.url),'utf8')}),session=await start(f),base='/api/studio-preview/'+session.sessionId;
  const info=await (await f.api.handle(f.request(base+'/session'))).json();assert.equal(info.preview,true);assert.equal(info.authenticated,true);assert.equal(info.guest,false);
  assert.equal(info.dealerAvailability.find(row=>row.id==='unfinished').reason,'studio_preview_idle_required');assert.deepEqual(info.externalServices,{ai:false,speech:false});
  const htmlResponse=await f.api.handle(f.request(session.entryUrl));assert.equal(htmlResponse.status,200);const html=await htmlResponse.text();
  assert.match(html,/<body\b[^>]*data-scout-assistant="disabled"/);
  assert.match(html,/data-studio-preview=/);assert.match(html,/data-game-dealer="linnea"/);assert.match(html,/data-game-local-dealer="linnea"/);assert.match(html,new RegExp(base+'/layers/'+layerId));assert.doesNotMatch(html,/data-game-operator|data-game-room-id|data-game-package-revision|croupier\/media/);
  assert.equal((await f.api.handle(f.request(session.entryUrl+'?dealer=amira'))).status,404);
  assert.equal((await f.api.handle(f.request(session.entryUrl+'?dealer=unfinished'))).status,422);
  assert.equal((await f.api.handle(f.request(session.entryUrl+'?dealer=foreign'))).status,404);
  assert.equal((await f.api.handle(f.request(session.entryUrl+'?operator=sg-test'))).status,400);
});

test('saved preview entry permits a same-origin frame while keeping private auth and external services disabled',async t=>{
  const f=fixture(t,{readHtml:()=>readFile(new URL('../services/game/public/index.html',import.meta.url),'utf8')}),session=await start(f);
  const navigation={'sec-fetch-site':'same-origin','sec-fetch-mode':'navigate','sec-fetch-dest':'iframe'};
  for(const method of ['GET','HEAD']){
    const response=await f.api.handle(f.request(session.entryUrl,method,undefined,navigation));
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.match(response.headers.get('content-type'),/^text\/html/);
    const frameOption=response.headers.get('x-frame-options')?.toUpperCase();
    assert.ok(!frameOption||frameOption==='SAMEORIGIN','entry must permit its same-origin Admin parent');
    const ancestors=(response.headers.get('content-security-policy')??'').split(';').map(value=>value.trim()).find(value=>value.startsWith('frame-ancestors '));
    if(ancestors)assert.ok(ancestors.split(/\s+/).includes("'self'"),'frame-ancestors must include self');
    const html=await response.text();if(method==='HEAD')assert.equal(html,'');else assert.match(html,/<body\b[^>]*data-scout-assistant="disabled"/);
  }
  assert.equal((await f.api.handle(f.request(session.entryUrl,'GET',undefined,{...navigation,'sec-fetch-site':'cross-site'}))).status,403);
  const info=await (await f.api.handle(f.request('/api/studio-preview/'+session.sessionId+'/session'))).json();
  assert.deepEqual(info.externalServices,{ai:false,speech:false});
  for(const route of ['chat','memory','probe','camera','speech'])assert.equal((await f.api.handle(f.request('/api/studio-preview/'+session.sessionId+'/'+route,'POST',{}))).status,404);
});

test('stale revisions, unplayable defaults, mismatched media and unknown lanes allocate no session',async t=>{
  const f=fixture(t);assert.equal((await f.create({expectedProjectRevision:'old'})).response.status,409);
  assert.equal((await f.create({presentationLaneId:'unknown'})).response.status,404);
  f.inventory.videos[0].sha256='b'.repeat(64);assert.equal((await f.create()).response.status,409);
  f.inventory.videos[0].sha256=f.row.sha256;f.project.lanes[0].layers.dealer.default='unfinished';f.project.lanes[0].layers.dealer.allowed.push('unfinished');f.project.lanes[0].dealers.push('unfinished');
  const missing=await f.create();assert.equal(missing.response.status,422);assert.equal(missing.body.error,'studio_preview_idle_required');assert.equal(f.state.dbs.length,0);
});

test('TTL, deletion, per-admin capacity and shutdown close every isolated database',async t=>{
  const f=fixture(t),a=await start(f),b=await start(f);assert.equal((await f.create()).response.status,429);
  assert.equal((await f.api.handle(f.request('/api/studio-preview/'+a.sessionId,'DELETE'))).status,200);assert.throws(()=>f.state.dbs[0].prepare('SELECT 1'));
  await start(f);f.state.time+=3000;assert.equal((await f.api.handle(f.request('/api/studio-preview/'+b.sessionId+'/session'))).status,410);assert.throws(()=>f.state.dbs[1].prepare('SELECT 1'));
  f.api.close();for(const db of f.state.dbs)assert.throws(()=>db.prepare('SELECT 1'));assert.equal((await f.create()).response.status,503);
});

test('preview presentation uses isolated committed cards and explicitly rejects external services',async t=>{
  const f=fixture(t),s=await start(f),base='/api/studio-preview/'+s.sessionId;
  const state=await (await f.api.handle(f.request(base+'/table','POST',{op:'state',dealer:'linnea'}))).json();
  const played=await (await f.api.handle(f.request(base+'/table','POST',{op:'start',dealer:'linnea',version:state.version,requestId:randomUUID(),bets}))).json();
  const deal=played.presentation.find(event=>event.type==='deal');
  const input={dealerId:'linnea',mode:'off',version:played.version,event:{...deal,card:{r:'A',s:'♠'}}};
  const response=await f.api.handle(f.request(base+'/presentation/select','POST',input));assert.equal(response.status,200);const result=await response.json();
  assert.deepEqual(result.decision.sourceEvent.card,deal.faceDown?null:deal.card);
  assert.equal((await f.api.handle(f.request(base+'/presentation/select','POST',{...input,version:999}))).status,409);
  assert.equal((await f.api.handle(f.request(base+'/presentation/select','POST',{...input,mode:'active'}))).status,503);
  assert.equal((await f.api.handle(f.request(base+'/presentation/idle-advice','POST',{dealerId:'linnea'}))).status,503);
  for(const route of ['chat','memory','probe','camera','speech'])assert.equal((await f.api.handle(f.request(base+'/'+route,'POST',{}))).status,404);
});

test('real native Studio auth rechecks password stamp and rejects partner-only cookies without product identity',async t=>{
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('CREATE TABLE users(id TEXT,username TEXT,email TEXT,salt TEXT,hash TEXT,role TEXT); CREATE TABLE bo_auth_epochs(user_id TEXT,epoch INTEGER); CREATE TABLE meta(k TEXT,v TEXT); CREATE TABLE lab_sessions(token_digest TEXT,expires INTEGER,craig_user_id TEXT,role TEXT,source_stamp TEXT,auth_epoch INTEGER);');
  const salt='s',hash='c'.repeat(128),secret='a'.repeat(64);db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run('u','native-admin','admin@example.invalid',salt,hash,'admin');db.prepare('INSERT INTO meta VALUES (?,?)').run('jwt_secret',secret);
  const stamp=createHash('sha256').update(salt+':'+hash).digest('hex'),parts=[{alg:'HS256',typ:'JWT'},{aud:'backoffice',sub:'native-admin',role:'admin',source_stamp:stamp,auth_epoch:0,exp:9999999999}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url'));
  const token=parts.join('.')+'.'+createHmac('sha256',Buffer.from(secret,'hex')).update(parts.join('.')).digest('base64url');
  const f=fixture(t,{authorize:createStudioNativeAuth({boDb:db,scope})});
  const call=(path,method='GET',body,cookie='bo_jwt='+token)=>f.api.handle(f.request(path,method,body,{cookie}));
  const response=await call('/api/studio-preview','POST',{presentationLaneId:f.project.lanes[0].id,expectedProjectRevision:f.project.revision});assert.equal(response.status,201);const s=await response.json(),path='/api/studio-preview/'+s.sessionId+'/videos/'+videoId;
  assert.equal((await call(path,'GET',undefined,'partner_session=only')).status,401);
  db.prepare('UPDATE users SET hash=?').run('d'.repeat(128));assert.equal((await call(path)).status,401);assert.equal(f.state.media.length,0);
});

test('pending captures count toward admin and global limits before database allocation',async t=>{
  let release;const barrier=new Promise(resolve=>{release=resolve;});let entered;const waiting=new Promise(resolve=>{entered=resolve;});
  const f=fixture(t,{maxSessions:1,maxSessionsPerAdmin:1,onRegistryLoad:async()=>{entered();await barrier;}});
  const first=f.create();await waiting;const second=await f.create();assert.equal(second.response.status,429);assert.equal(f.state.dbs.length,0);
  release();assert.equal((await first).response.status,201);f.state.actor='another-admin';assert.equal((await f.create()).response.status,429);
});

test('scope mismatch and revocation during capture cannot allocate or leak a preview',async t=>{
  const f=fixture(t);f.snapshot.scope={...scope,workspaceId:'other'};assert.equal((await f.create()).response.status,503);assert.equal(f.state.dbs.length,0);
  const g=fixture(t,{onRegistryLoad:async()=>{g.state.revoked=true;}});assert.equal((await g.create()).response.status,401);assert.equal(g.state.dbs.length,0);
});

test('a media request expiring while verification runs returns no bytes and frees the database',async t=>{
  let responseBody;const f=fixture(t,{privateMedia:async record=>{f.state.time+=3000;responseBody=new ReadableStream({start(controller){controller.enqueue(new Uint8Array([1]));}});return new Response(responseBody,{headers:{ETag:`"sha256-${record.sha256}"`}});}});
  const s=await start(f),response=await f.api.handle(f.request('/api/studio-preview/'+s.sessionId+'/videos/'+videoId));assert.equal(response.status,410);
  assert.equal((await response.json()).error,'studio_preview_expired');assert.throws(()=>f.state.dbs[0].prepare('SELECT 1'));
});


test('preview exposes captured layer choices from baked defaults, with optional saved geometry and no project mutation',async t=>{
  for(const savedGeometry of [false,true])for(const contentType of ['image/png','video/mp4']){
    const f=fixture(t),lane=f.project.lanes[0];
    const background={...f.layer,id:'20000000-0000-4000-8000-000000000002',role:'background',label:'Library background',sha256:'e'.repeat(64),contentType};
    background.pathname=layerAssetPath(background);f.project.layerAssets.push(background);
    lane.layers.background={enabled:false,mode:'baked',allowed:[],default:null};lane.layers.table.enabled=false;
    if(savedGeometry)lane.composition.desktop.table.x=.2;else delete lane.composition;
    const saved=structuredClone(f.project),session=await start(f);
    const attribute=(html,name)=>JSON.parse(html.match(new RegExp(name+'="([^"]+)"'))[1].replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));
    const entry=await f.api.handle(f.request(session.entryUrl));assert.equal(entry.status,200);const html=await entry.text();
    const choices=attribute(html,'data-game-choices'),composition=attribute(html,'data-game-composition');
    assert.equal(composition.dealer.compatibility,'per-clip');assert.equal(composition.table.enabled,true);assert.equal(composition.background.enabled,true);
    assert.equal(choices.background.mode,contentType==='image/png'?'image':'video');assert.equal(choices.background.enabled,true);
    assert.equal(composition.background.default,null);assert.equal(composition.table.default,layerId);
    assert.deepEqual(composition.settings,savedGeometry?saved.lanes[0].composition:defaultCompositionSettings());
    const selected=resolvePlayerSelection({choices,composition,currentDealer:'linnea',stored:{background:background.id,tableAsset:layerId}});
    assert.equal(selected.backgroundDisabled,false);assert.equal(selected.backgroundValue,background.id);assert.equal(selected.tableValue,layerId);
    for(const dealer of ['amira','astrid','vera','mei'])assert.equal((await f.api.handle(f.request(session.entryUrl+'?dealer='+dealer))).status,404,'No implicit legacy dealer: '+dealer);
    assert.deepEqual(f.project,saved);
  }
});
