import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { EventEmitter } from 'node:events';
import {createHash} from 'node:crypto';
import { createPresentationApi } from '../services/game/presentation-api.mjs';
import {sharedRoomPresentationRead,createSharedRoomPresentationBridge} from '../services/game/shared-room-presentation-http.mjs';
import { createEmptyProject, addDealer } from '../packages/presentation/contracts/studio-model.mjs';
import { recordedSpeechIdentity, recordedSpeechForVideo } from '../packages/presentation/contracts/recorded-speech.mjs';
import {recordedSpeechProjection} from '../packages/presentation/runtime/recorded-speech-selection.mjs';
import { DRAGAN_KEVIN_PROFILE as profile } from '../packages/presentation/contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs';
const first='10000000-0000-4000-8000-000000000001',second='10000000-0000-4000-8000-000000000002';
const event={type:'deal',to:'box',box:3,handIndex:0,shoeDraw:4,faceDown:false,card:{r:'5',s:'♠',shoeDraw:4},clip:{action:'deal-centre'}};
function fixture({dealerId='nora',sourceEvent=event,options={}}={}){
  const project=addDealer(createEmptyProject(),dealerId,dealerId);
  const line=project.lines.find(row=>row.dealerId===dealerId&&row.eventId===(sourceEvent.type==='speak'?'speak.goodluck':'deal.player.centre'));
  line.variants[0].videoGenerationId=first;
  const video={id:first,dealer:dealerId,sha256:'a'.repeat(64),available:true,fileName:'exact.mp4',contentType:'video/mp4',classification:{dealerId,eventId:line.eventId,kind:sourceEvent.type==='speak'?'speech':'action',role:'standard',situation:sourceEvent.type==='speak'?'goodluck':'box3',playback:'once',label:'Exact',notes:''}};
  const context={operatorSlug:'north',roomId:'room-a',packageRevision:7,dealerId};
  const frozen={context,dealer:{id:dealerId},project,inventory:{videos:[video],families:[]},projectRevision:'frozen-7',configurationSource:'operator-package-v3',
    lane:{openclaw:{idle:'rules',deal:'off',reveal:'off',speak:'off',probe:'off'}}};
  const capture={sourceEvent,published:[sourceEvent],material:{revision:'material-1',dealerId,language:'sv',leadMs:0,cardMs:1000,media:[{id:first,sha256:video.sha256}]},configVersion:'config-1',version:3,roomId:'room-a',talkId:'talk-3',language:'sv',presentationContext:context,operatorId:'operator-1',packageRevision:7};
  let reads=0,native=0,before=0,selects=0,failure;
  const base={env:{},db:{prepare(){native++;throw Error('must not read native journal');}},beforeActionPresentation(){before++;throw Error('must not change native action');},
    store:{load:async()=>{throw Error('must not read live Studio');}},registryLoader:async()=>{throw Error('must not read live registry');},
    frozenDealerContext:{resolve:async()=>{reads++;return frozen;},publicVideo:(_f,id)=>{const row=frozen.inventory.videos.find(v=>v.id===id);return row?{id,sha256:row.sha256,fileName:row.fileName,src:'/api/presentation/room-video/'+['north','room-a',7,dealerId,id].join('/'),...recordedSpeechProjection(row)}:null;}},
    withSharedCommittedReceipt:async({request,playerId,body,signal},selectFrozen)=>{
      assert.equal(request.method,'POST');assert.equal(playerId,'alice');signal.throwIfAborted();
      if(body.event.type!==capture.sourceEvent.type||body.event.type==='speak'&&body.event.line!==capture.sourceEvent.line)throw Object.assign(Error('stale'),{code:'shared_room_presentation_stale',statusCode:409});
      selects++;try{return await selectFrozen(capture,{signal,frozenDealerContext:base.frozenDealerContext});}catch(error){failure=error;throw error;}
    },...options};
  const api=createPresentationApi(base);
  const body={dealerId,mode:'off',version:3,event:sourceEvent,presentationContext:context,sharedRoom:{roomId:'room-a',ver:3,talkId:'talk-3'}};
  async function request(change={},pathname='/api/presentation/select'){
    const req=Readable.from([JSON.stringify({...body,...change})]);req.method='POST';req.headers={host:'game.invalid'};req.url=pathname;
    const res=new EventEmitter();res.writableEnded=false;res.destroyed=false;res.writeHead=status=>res.status=status;res.end=text=>{res.body=JSON.parse(text);res.writableEnded=true;};
    await api(req,res,pathname,'alice');assert.equal(res.listenerCount('close'),0);return res;
  }
  return{request,body,capture,frozen,video,project,line,base,get failure(){return failure;},counts:()=>({reads,native,before,selects})};
}
function speech(status='approved',changes={}){
  const row={schemaVersion:1,dealerId:'nora',lineId:'goodluck',takeId:'goodluck_sv_1',language:'sv',exactText:'Lycka till.',videoSha256:'a'.repeat(64),audioSha256:'b'.repeat(64),indexSha256:'c'.repeat(64),fps:24,frameCount:72,audioDelayMs:0,entryPose:'VILA',exitPose:'VILA',calibrationRevision:'fixture-1',recording:{status:'pending'},review:{status:'pending'},...changes};
  const identity=recordedSpeechIdentity(row),proof={by:'synthetic-reviewer',at:'2026-10-22T00:00:00.000Z',identity};row.recording={status:'verified-recording',...proof};row.review=status==='pending'?{status}:{status,...proof};return row;
}

test('scoped config transports the active material separately from mutable selection options',async()=>{
  const filmedMaterial={revision:'native-film-v2-'+'c'.repeat(64),film:{schemaVersion:1,profileId:profile.id,transitions:{toShoe:null,fromShoe:null}}};
  const response=await sharedRoomPresentationRead({request:{url:'/api/presentation/shared-room/room-a/config?operatorSlug=north&roomId=room-a&packageRevision=7&dealerId=dragan',method:'GET'},playerId:'alice'},
    async(_args,work)=>work({filmedMaterial,presentationContext:{operatorSlug:'north',roomId:'room-a',packageRevision:7,dealerId:'dragan'}},
      {frozenDealerContext:{configuration:async()=>({owner:'web',filmedMaterial:{revision:'untrusted-configuration'}})}}));
  assert.deepEqual((await response.json()).filmedMaterial,filmedMaterial);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
});

test('shared selector uses committed card and active-room URL without native reads or action writes',async()=>{
  const h=fixture(),reply=await h.request({event:{...event,card:{r:'K',s:'♦'},private:'untrusted'}});
  assert.equal(reply.status,200,JSON.stringify(reply.body)+' '+String(h.failure));assert.deepEqual(reply.body.decision.sourceEvent,event);
  assert.equal(reply.body.video.id,first);assert.match(reply.body.video.src,/room-video\/north\/room-a\/7\/nora\//);
  assert.deepEqual(h.counts(),{reads:2,native:0,before:0,selects:1});assert.equal(reply.body.standard.id,first);
});

test('shared selection and shared idle advice use only the active request context, leaving generic history readers untouched',async()=>{
  const h=fixture(),generic=h.base.frozenDealerContext;
  h.base.frozenDealerContext={...generic};generic.resolve=()=>assert.fail('generic history reader must not handle the active room');
  assert.equal((await h.request()).status,200);
  let activeReads=0;
  const idle=fixture({options:{frozenDealerContext:{resolve:()=>assert.fail('generic idle context used')},
    withActiveRoomPresentation:async(args,work)=>{
      activeReads++;assert.equal(args.roomId,'room-a');assert.equal(args.presentationContext.packageRevision,7);
      return work({presentationContext:args.presentationContext},{signal:args.signal,frozenDealerContext:{resolve:async()=>idle.frozen}});
    }}});
  const result=await idle.request({sharedRoom:undefined},'/api/presentation/shared-room/room-a/idle-advice');
  assert.equal(result.status,200);assert.equal(result.body.provider,'idle_openclaw_off');assert.equal(activeReads,1);
});

test('scoped HTTP binding/config/media carry exact preconditions and preserve private Range/HEAD/304 responses',async()=>{
  const context={operatorSlug:'north',roomId:'room-a',packageRevision:7,dealerId:'nora'},calls=[];
  const read=async(request,status=200)=>sharedRoomPresentationRead({request,playerId:'alice'},async(args,work)=>{
    calls.push(args);assert.equal(args.roomId,'room-a');assert.equal(args.playerId,'alice');
    const respond=()=>new Response(request.method==='HEAD'||status===304?null:'verified bytes',{status,headers:{etag:'"sha256-'+ 'a'.repeat(64)+'"',
      'Cache-Control':'private, no-cache, must-revalidate',...(status===206?{'Content-Range':'bytes 0-13/4096'}:{})}});
    return work({configVersion:'config-a',windowId:'window-a',presentationContext:context},{frozenDealerContext:{
      selection:async()=>({dealer:'nora',roomId:'room-a',packageRevision:7}),configuration:async()=>({owner:'web',dealer:{id:'nora'}}),response:respond,layerResponse:respond}});
  });
  const binding=await read({url:'/api/presentation/shared-room/room-a/binding?configVersion=config-a&windowId=window-a',method:'GET'});
  assert.deepEqual((await binding.json()).presentationContext,context);assert.deepEqual(calls.at(-1).expected,{configVersion:'config-a',windowId:'window-a'});
  assert.equal(binding.headers.get('cache-control'),'private, no-store');
  const config=await read({url:'/api/presentation/shared-room/room-a/config?operatorSlug=north&roomId=room-a&packageRevision=7&dealerId=nora',method:'GET'});
  assert.equal((await config.json()).dealer.id,'nora');assert.deepEqual(calls.at(-1).presentationContext,context);
  for(const path of ['/api/presentation/room-video/north/room-a/7/nora/'+first,'/api/presentation/room-idle/north/room-a/7/nora','/api/presentation/room-layers/north/room-a/7/'+first]) {
    const range=await read({url:path,method:'GET',headers:{range:'bytes=0-13'}},206);
    assert.equal(range.status,206);assert.equal(range.headers.get('content-range'),'bytes 0-13/4096');assert.equal(await range.text(),'verified bytes');
    const head=await read({url:path,method:'HEAD'});assert.equal(head.body,null);assert.equal(head.headers.get('etag'),'"sha256-'+ 'a'.repeat(64)+'"');
    const cached=await read({url:path,method:'GET',headers:{'if-none-match':'"sha256-'+ 'a'.repeat(64)+'"'}},304);assert.equal(cached.status,304);assert.equal(cached.body,null);
  }
  assert.equal(await read({url:'/api/presentation/registered-video/north/room-a/7/nora/'+first,method:'GET'}),null);
  for(const url of [
    '/api/presentation/shared-room/room-a/binding?configVersion=config-a&windowId=window-a&windowId=other',
    '/api/presentation/shared-room/room-a/config?operatorSlug=north&roomId=other&packageRevision=7&dealerId=nora',
    '/api/presentation/room-video/north/room-a/07/nora/'+first,
    '/api/presentation/room-layers/north/room-a/7/not-a-uuid',
    '/api/presentation/shared-room/room-b/../room-a/binding?configVersion=config-a&windowId=window-a',
  ])await assert.rejects(sharedRoomPresentationRead({request:{url,method:'GET'},playerId:'alice'},()=>assert.fail('invalid request reached authority')));
});

test('active HTTP bridge authenticates canonical same-origin requests and rejects cross-room/header/path confusion before service work',async()=>{
  let invoked=0;
  const bridge=createSharedRoomPresentationBridge({origin:'https://ui.invalid',engineOrigin:'https://engine.invalid',service:()=>({
    async withActiveRoomPresentation(args){invoked++;assert.ok(args.request instanceof Request);assert.equal(args.request.headers.get('cookie'),'player_session=fixture');return args;},
    async withSharedCommittedReceipt(args){invoked++;return args;},
  })});
  const input=()=>({request:{method:'GET',url:'/api/presentation/room-video/north/room-a/7/nora/'+first,headers:{host:'engine.invalid',cookie:'player_session=fixture','sec-fetch-site':'same-origin'}},
    roomId:'room-a',playerId:'alice',presentationContext:{operatorSlug:'north',roomId:'room-a',packageRevision:7,dealerId:'nora'}});
  const original=input();assert.equal((await bridge.withActiveRoomPresentation(original,()=>{})).request.url,'https://engine.invalid'+original.request.url);
  for(const change of [args=>{args.roomId='room-b';},args=>{args.request.headers.host='evil.invalid';},args=>{args.request.headers.origin='https://evil.invalid';},
    args=>{args.request.headers.authorization='Bearer fixture';},args=>{args.request.headers['sec-fetch-site']='cross-site';},
    args=>{args.request.url+='?x=1#fragment';},args=>{args.request.url='/api/presentation/shared-room/room-x/../room-a/config';},
    args=>{args.request.method='POST';},args=>{args.request.url='https://evil.invalid'+args.request.url;}]) {
    const bad=input(),before=invoked;change(bad);assert.throws(()=>bridge.withActiveRoomPresentation(bad,()=>{}));assert.equal(invoked,before);
  }
  const post=input();post.request={...post.request,method:'POST',url:'/api/presentation/shared-room/room-a/idle-advice'};
  assert.throws(()=>bridge.withActiveRoomPresentation(post,()=>{}));post.request.headers.origin='https://ui.invalid';await bridge.withActiveRoomPresentation(post,()=>{});
  post.request.url='/api/presentation/select';await bridge.withSharedCommittedReceipt(post,()=>{});
  post.request.url='/api/other/../presentation/select';assert.throws(()=>bridge.withSharedCommittedReceipt(post,()=>{}));
});

test('HTTP disconnect cancels a private response returned after its active read instead of losing its body',async()=>{
  let cancelled=0,written=0;
  const req=Readable.from([]);req.method='GET';req.url='/api/presentation/room-video/north/room-a/7/nora/'+first;req.headers={host:'engine.invalid'};
  const res=new EventEmitter();res.writableEnded=false;res.destroyed=false;res.writeHead=()=>{written++;};res.end=()=>{written++;};
  const api=createPresentationApi({env:{},db:{},withActiveRoomPresentation:async()=>{
    res.destroyed=true;res.emit('close');return new Response(new ReadableStream({cancel(){cancelled++;}}));
  }});
  assert.equal(await api(req,res,new URL(req.url,'https://engine.invalid').pathname,'alice'),true);
  assert.equal(cancelled,1);assert.equal(written,0);assert.equal(res.listenerCount('close'),0);
});

test('already aborted requests and closed responses never begin shared presentation work',async()=>{
  for(const closed of ['request','response','both'])for(const pathname of [
    '/api/presentation/room-video/north/room-a/7/nora/'+first,
    '/api/presentation/shared-room/room-a/idle-advice','/api/presentation/select',
  ]) {
    const h=fixture();let calls=0,written=0;
    const method=pathname.includes('/room-video/')?'GET':'POST';
    const body={...h.body,...(pathname.endsWith('/idle-advice')?{sharedRoom:undefined}:{})};
    const req=Readable.from(method==='POST'?[JSON.stringify(body)]:[]);
    req.method=method;req.url=pathname;req.headers={host:'engine.invalid'};req.aborted=closed!=='response';
    const res=new Writable({write(_chunk,_encoding,callback){written++;callback();}});
    res.writeHead=()=>{written++;};
    if(closed!=='request')await new Promise(resolve=>{res.once('close',resolve);res.destroy();});
    const unexpected=async()=>{calls++;throw Error('closed request must not start service or provider work');};
    const api=createPresentationApi({...h.base,withActiveRoomPresentation:unexpected,withSharedCommittedReceipt:unexpected});
    try {
      assert.equal(await api(req,res,pathname,'alice'),true);
      assert.equal(calls,0,closed+' '+pathname);assert.equal(written,0);assert.equal(res.listenerCount('close'),0);
    } finally {if(!res.destroyed)await new Promise(resolve=>{res.once('close',resolve);res.destroy();});}
  }
});

test('shared marker never falls through without its port or with malformed context',async()=>{
  for(const change of [{sharedRoom:null},{sharedRoom:{roomId:'room-a',ver:3,talkId:'talk-3',actorId:'other'}},{version:4}]){
    const h=fixture(),reply=await h.request(change);assert.equal(reply.status,400);assert.equal(h.counts().native,0);assert.equal(h.counts().selects,0);
  }
  const absent=fixture({options:{withSharedCommittedReceipt:null}});assert.equal((await absent.request()).status,503);assert.equal(absent.counts().native,0);
  const h=fixture();h.capture.presentationContext={...h.capture.presentationContext,roomId:'other'};
  assert.equal((await h.request()).status,503);assert.equal(h.counts().native,0);
});

test('all inventory IDs and public media must remain in captured exact id/hash/dealer/language',async()=>{
  let observed;
  const h=fixture({options:{select:async(_body,{videoRegistry})=>{observed=videoRegistry;return{videoGenerationId:first,decision:{media:{}}};}}});
  h.frozen.inventory.videos.push({...h.video,id:second,sha256:'b'.repeat(64)});
  h.frozen.inventory.families.push({id:'nora/deal.player.centre/box3',dealerId:'nora',standardIds:[first,second],variantIds:[second]});
  assert.equal((await h.request()).status,200);assert.deepEqual(observed.videos.map(v=>v.id),[first]);assert.deepEqual(observed.families[0].standardIds,[first]);assert.deepEqual(observed.families[0].variantIds,[]);
  h.video.sha256='f'.repeat(64);assert.equal((await h.request()).status,503,'selected ID with wrong bytes cannot escape');
  const badUrl=fixture({options:{frozenDealerContext:{resolve:async()=>badUrl.frozen,publicVideo:()=>({id:first,sha256:'a'.repeat(64),src:'https://other.invalid/private'})}}});
  assert.equal((await badUrl.request()).status,503);
});

test('committed speech keeps caption identity and denies unapproved or other-language recordings',async()=>{
  for(const [metadata,allowed] of [[speech(),true],[speech('pending'),false],[speech('approved',{language:'en',exactText:'Good luck.'}),false]]){
    const h=fixture({sourceEvent:{type:'speak',line:'goodluck'}});h.video.classification.recordedSpeech=metadata;
    const reply=await h.request();assert.equal(reply.status,200,JSON.stringify(reply.body));
    assert.equal(Boolean(reply.body.video),allowed);if(allowed)assert.equal(reply.body.video.recordedSpeech.exactText,'Lycka till.');
    assert.equal(h.counts().native,0);assert.equal(h.counts().before,0);
    assert.equal((await h.request({event:{type:'speak',line:'invented'}})).status,409);
  }
});

test('shared embedded speech carries measured MP4 identity through its narrow public DTO to the player',async()=>{
  for(const status of ['approved','pending','rejected']){
    const h=fixture({sourceEvent:{type:'speak',line:'goodluck'}}),metadata={schemaVersion:2,sourceKind:'embedded-mp4-av',dealerId:'nora',
      lineId:'goodluck',takeId:'goodluck_sv_1',language:'sv',exactText:'Lycka till.',videoSha256:h.video.sha256,
      fps:24,frameCount:72,videoTrackId:1,audioTrackId:2,entryPose:'VILA',exitPose:'VILA',source:{status:'pending'},review:{status:'pending'}};
    const identity=recordedSpeechIdentity(metadata),proof=state=>({status:state,by:'synthetic-reviewer',at:'2026-10-26T00:00:00.000Z',identity:structuredClone(identity)});
    metadata.source=proof('verified-embedded-av');if(status!=='pending')metadata.review=proof(status);
    h.video.classification.recordedSpeech=metadata;h.video.bytes=4096;
    h.video.mediaTiming={schemaVersion:1,mediaId:first,sha256:h.video.sha256,size:h.video.bytes,
      recordedSpeechIdentitySha256:createHash('sha256').update(JSON.stringify(identity)).digest('hex'),
      video:{trackId:1,frameCount:72,fps:24,firstPtsUs:0,lastPtsUs:2958333,endUs:3000000},
      audio:[{trackId:2,firstPtsUs:0,endUs:3000000}],endUs:3000000,audioTailUs:0};
    const reply=await h.request();assert.equal(reply.status,200,JSON.stringify(reply.body));
    if(status==='approved'){
      assert.deepEqual(reply.body.video.mediaTiming,h.video.mediaTiming);assert.equal(reply.body.video.contentType,'video/mp4');assert.equal(reply.body.video.bytes,4096);
      assert.deepEqual(recordedSpeechForVideo(reply.body.video,{dealerId:'nora',lineId:'goodluck',language:'sv',takeId:'goodluck_sv_1'}),metadata);
      h.video.mediaTiming.audio[0].trackId=3;
      const changed=await h.request();assert.equal(changed.status,200);assert.equal(changed.body.video,null);assert.equal(changed.body.standard,null);
    }else{assert.equal(reply.body.video,null);assert.equal(reply.body.standard,null);}
    assert.equal(h.counts().native,0);assert.equal(h.counts().before,0);
  }
  const legacy=fixture({sourceEvent:{type:'speak',line:'goodluck'}});legacy.video.classification.recordedSpeech=speech();
  const old=await legacy.request();
  for(const key of ['contentType','bytes','mediaTiming'])assert.equal(Object.hasOwn(old.body.video,key),false,'v1 public shape is unchanged');
});

test('a changed frozen context or unexpected provider failure produces only sanitized shared failure',async()=>{
  const h=fixture({options:{select:async()=>{h.frozen.projectRevision='republished';throw Error('postgres://private-secret');}}});
  const reply=await h.request();assert.equal(reply.status,503);assert.deepEqual(reply.body,{error:'shared_room_presentation_unavailable'});
  assert.equal(JSON.stringify(reply.body).includes('private-secret'),false);
});

test('native branch remains available only when shared marker is absent',async()=>{
  const h=fixture();let native=0,before=0;
  const api=createPresentationApi({...h.base,db:{prepare:()=>({get:async()=>{native++;return{version:3,payload:JSON.stringify([event])};}})},beforeActionPresentation(){before++;}});
  const body={...h.body};delete body.sharedRoom;const req=Readable.from([JSON.stringify(body)]);Object.assign(req,{method:'POST',url:'/api/presentation/select',headers:{}});
  const res=new EventEmitter();res.writeHead=s=>res.status=s;res.end=t=>{res.body=JSON.parse(t);res.writableEnded=true;};
  await api(req,res,'/api/presentation/select','alice');assert.equal(res.status,200,JSON.stringify(res.body));assert.equal(native,1);assert.equal(before,1);
});

test('filmed selection uses the captured exact take and cannot borrow another profile clip',async()=>{
  const source={...event,box:0,clip:{action:'deal-left'}},h=fixture({dealerId:'dragan',sourceEvent:source});
  const take=profile.takes.find(row=>row.key==='1:iv');assert.ok(take);
  h.video.sha256=take.sha256;h.video.classification.eventId='deal.player.left';h.capture.material.media[0].sha256=take.sha256;
  const reply=await h.request();assert.equal(reply.status,200,JSON.stringify(reply.body));assert.equal(reply.body.video.id,first);
  assert.equal(reply.body.video.filmedTake.takeKey,'1:iv');
  h.capture.material.media[0].sha256='f'.repeat(64);const blocked=await h.request();assert.equal(blocked.status,200);assert.equal(blocked.body.video,null);
});

test('v2 selected shoe topology is server frozen even when the client disables transitions',async()=>{
  const source={...event,box:0,clip:{action:'deal-left'}},h=fixture({dealerId:'dragan',sourceEvent:source});
  const take=profile.takes.find(row=>row.key==='1:base');
  h.video.sha256=take.sha256;Object.assign(h.video.classification,{eventId:'deal.player.left',situation:'box0'});
  h.capture.material.media[0].sha256=take.sha256;
  const line=h.project.lines.find(row=>row.dealerId==='dragan'&&row.eventId==='transition.shoe'),transitions={};
  for(const [direction,situation,id,startPose,endPose] of [['toShoe','to-shoe',second,'VILA','REDO'],['fromShoe','from-shoe','10000000-0000-4000-8000-000000000003','REDO','VILA']]) {
    const sha256=createHash('sha256').update(situation).digest('hex');
    const video={...structuredClone(h.video),id,sha256,fileName:situation+'.mp4',classification:{...h.video.classification,eventId:'transition.shoe',situation,startPose,endPose}};
    h.frozen.inventory.videos.push(video);h.capture.material.media.push({id,sha256});
    line.variants.push({...structuredClone(line.variants[0]),id:'dragan.transition.shoe.slot.'+situation,videoGenerationId:id});
    transitions[direction]={id,sha256,durationMs:1000};
  }
  Object.assign(h.capture.material,{revision:'native-film-v2-'+'c'.repeat(64),film:{schemaVersion:1,profileId:profile.id,transitions}});
  for(const shoeTransitions of [undefined,false,true]) {
    const reply=await h.request({shoeTransitions});assert.equal(reply.status,200,JSON.stringify(reply.body));
    assert.equal(reply.body.video.filmedTake.takeKey,'1:base');
    assert.equal(reply.body.transitions.before.id,transitions.toShoe.id);assert.equal(reply.body.transitions.after.id,transitions.fromShoe.id);
  }
  h.frozen.inventory.videos=h.frozen.inventory.videos.filter(row=>row.id!==transitions.toShoe.id);
  const missing=await h.request({shoeTransitions:false});assert.equal(missing.status,503);
  assert.deepEqual(missing.body,{error:'shared_room_presentation_unavailable'});
});

test('idle rule cannot expose a clip outside captured material',async()=>{
  const source={type:'turn',box:3,handIndex:1,legalActions:['stand']},h=fixture({sourceEvent:source});
  const line=h.project.lines.find(row=>row.dealerId==='nora'&&row.eventId==='idle.ready');line.variants[0].videoGenerationId=first;
  line.variants.push({...structuredClone(line.variants[0]),id:'nora.idle.ready.rule',videoGenerationId:second,priority:50,triggerIds:['fixture.box3'],selection:{rules:true,model:false,random:false}});
  h.project.triggers.push({id:'fixture.box3',label:'Box',category:'deterministic',path:'event.box',op:'eq',value:3});
  h.project.dealerIdlePolicies=[{dealerId:'nora',policy:{schemaVersion:1,familyId:'nora/idle.ready/ready',base:[{videoId:first,weight:100,durationMs:1000}],variants:[{videoId:second,durationMs:1000,use:'rules',automatic:null}]}}];
  h.video.classification={dealerId:'nora',eventId:'idle.ready',kind:'idle',role:'standard',situation:'',label:'Own',notes:''};
  h.frozen.inventory.videos.push({...structuredClone(h.video),id:second,classification:{...h.video.classification,role:'alternative'}});
  const absent=await h.request({mode:'rules'});assert.equal(absent.status,200,JSON.stringify(absent.body));assert.equal(absent.body.idleRule,null);
  h.capture.material.media.push({id:second,sha256:h.video.sha256});
  const allowed=await h.request({mode:'rules'});assert.equal(allowed.status,200,JSON.stringify(allowed.body));assert.equal(allowed.body.idleRule.videoId,second);
});

test('disconnect aborts shared selection and removes its listener without writing a response',async()=>{
  let begin;const started=new Promise(resolve=>begin=resolve);
  const h=fixture({options:{withSharedCommittedReceipt:async({signal})=>{begin();await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}}});
  const req=Readable.from([JSON.stringify(h.body)]);Object.assign(req,{method:'POST',url:'/api/presentation/select',headers:{}});
  const res=new EventEmitter();let writes=0;res.writeHead=()=>writes++;res.end=()=>writes++;
  const running=createPresentationApi(h.base)(req,res,'/api/presentation/select','alice');await started;res.emit('close');await running;
  assert.equal(writes,0);assert.equal(res.listenerCount('close'),0);
});

test('shared port cannot return a Response, getters, undefined or oversized JSON as a success',async()=>{
  let getterCalls=0;
  for(const invalid of [new Response('{}'),undefined,{get video(){getterCalls++;return 'private';}}, {value:'x'.repeat(256*1024)}]){
    const h=fixture({options:{withSharedCommittedReceipt:async()=>invalid}}),reply=await h.request();
    assert.equal(reply.status,503);assert.deepEqual(reply.body,{error:'shared_room_presentation_unavailable'});assert.equal(h.counts().native,0);
  }
  assert.equal(getterCalls,0);
});

test('unlocked context revalidation rejects alias mutation rather than returning stale media',async()=>{
  const h=fixture({options:{select:async()=>{h.frozen.projectRevision='changed';return{videoGenerationId:first,decision:{}};}}});
  const reply=await h.request();assert.equal(reply.status,503);assert.equal(h.counts().reads,2);
});
