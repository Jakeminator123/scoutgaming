import test from 'node:test';
import assert from 'node:assert/strict';
import {completeChatWithSpeech} from '../web/generated-speech-chat.mjs';
import {createRegisteredChatContext,createPublishedChatResolver,cancelPlayerChats} from '../web/registered-chat-context.mjs';

const context={operatorSlug:'north',roomId:'paow-room',packageRevision:7,dealerId:'paow'};
const clone=structuredClone;
const error=status=>value=>value.statusCode===status;
function fixture() {
  const saved={operator:{id:'north-id',slug:'north',status:'active'},
    package:{operatorId:'north-id',revision:7,lanes:['paow-presentation'],tables:['paow-room'],games:['blackjack']},
    administration:{rooms:[{schemaVersion:2,id:'paow-room',name:'PAOW room',operatorId:'north-id',presentationLaneId:'paow-presentation',gameLaneId:'portrait-paow',state:'live'}],
      gameLanes:[{schemaVersion:1,id:'portrait-paow',label:'PAOW',dealer:'paow',renderer:'portrait-video',mediaCollection:'paow-presentation'}]}};
  const presentation={schemaVersion:2,projectRevision:'published-project',assets:[],lanes:[{id:'paow-presentation',dealers:['paow'],layers:{dealer:{allowed:['paow'],default:'paow'}}}],
    registeredDealers:[{id:'paow',label:'PAOW',idle:{id:'00000000-0000-4000-8000-000000000001',sha256:'a'.repeat(64),size:4096,contentType:'video/mp4',pathname:'croupier/media/dealers/paow/review/uploads/00000000-0000-4000-8000-000000000001/'+ 'a'.repeat(64)+'.mp4',classification:{dealerId:'paow',eventId:'idle.ready',kind:'idle',role:'standard',situation:'',label:'Idle',notes:'',playback:'once'}}}]};
  const reads=[];
  const resolvePublishedContext=createPublishedChatResolver({
    readCurrentContext:async slug=>{reads.push(slug);return clone(saved);},
    readPresentation:()=>clone(presentation),
  });
  return {saved,presentation,reads,authorize:createRegisteredChatContext({resolvePublishedContext})};
}
test('published registered dealer can authorize text chat without any idle bytes or provider',async()=>{
  const f=fixture(),input=clone(context);
  const granted=await f.authorize({dealerId:'paow',presentationContext:input});
  assert.equal(granted.dealerId,'paow');assert.equal(granted.registered,true);
  assert.deepEqual(granted.presentationContext,context);assert.ok(Object.isFrozen(granted.presentationContext));
  input.dealerId='astrid';input.packageRevision=10;
  assert.equal(await granted.recheck(),true);assert.deepEqual(f.reads,['north','north']);
  assert.equal(granted.presentationContext.dealerId,'paow');assert.equal(granted.presentationContext.packageRevision,7);
  assert.deepEqual(Object.keys(granted).sort(),['dealerId','presentationContext','recheck','registered']);
});
test('former local dealer names cannot bypass the published context',async()=>{
  const authorize=createRegisteredChatContext({resolvePublishedContext:()=>assert.fail('Existing dealer must not read Studio')});
  for(const dealerId of ['astrid','vera','amira','mei']){
    await assert.rejects(authorize({dealerId}),error(400));
  }
});
test('safe syntax is not registration: extra dealer requires exact published context',async()=>{
  const f=fixture();
  for(const value of [
    {dealerId:'paow'}, {dealerId:'new-dealer'}, {dealerId:'../paow',presentationContext:context},
    {dealerId:'constructor',presentationContext:context}, {dealerId:'paow',presentationContext:{...context,dealerId:'astrid'}},
    {dealerId:'paow',presentationContext:{...context,secret:'do-not-read'}}, {dealerId:'paow',presentationContext:{...context,packageRevision:0}},
    {dealerId:'paow',presentationContext:{...context,operatorSlug:'North'}}, {dealerId:'paow',presentationContext:{...context,roomId:'../private'}},
  ])await assert.rejects(f.authorize(value),error(400));
  const getter={...context};Object.defineProperty(getter,'dealerId',{get(){assert.fail('must not call accessor');},enumerable:true});
  await assert.rejects(f.authorize({dealerId:'paow',presentationContext:getter}),error(400));
  assert.equal(f.reads.length,0);
});
test('foreign operator/room/dealer, revoked room and removed package all fail closed',async()=>{
  for(const change of [
    f=>f.saved.operator.slug='other',f=>f.saved.operator.status='suspended',
    f=>f.saved.administration.rooms[0].operatorId='other-id',f=>f.saved.administration.rooms[0].state='preview',
    f=>f.saved.package.tables=[],f=>f.saved.package.lanes=[],f=>f.saved.package=null,
    f=>f.presentation.lanes[0].layers.dealer.allowed=[],f=>f.presentation.registeredDealers=[],
  ]){
    const f=fixture();change(f);await assert.rejects(f.authorize({dealerId:'paow',presentationContext:context}),err=>[403,503].includes(err.statusCode));
  }
});
test('fresh recheck blocks withdrawal or package change during async chat generation',async()=>{
  for(const [status,change] of [[409,f=>f.saved.package.revision++],[403,f=>f.saved.administration.rooms[0].state='preview'],[403,f=>f.saved.operator.status='suspended']]){
    const f=fixture(),granted=await f.authorize({dealerId:'paow',presentationContext:context});change(f);
    await assert.rejects(granted.recheck(),error(status));assert.equal(f.reads.length,2);
  }
});
test('missing/unavailable/misbound resolver never exposes underlying errors or grants another dealer',async()=>{
  await assert.rejects(createRegisteredChatContext()({dealerId:'paow',presentationContext:context}),error(503));
  for(const resolvePublishedContext of [
    ()=>{throw Error('SECRET_CONNECTION_STRING');},async()=>null,
    async()=>({dealer:{id:'astrid'},context}),async()=>({dealer:{id:'paow'},context:{...context,packageRevision:8}}),
  ]){
    const authorize=createRegisteredChatContext({resolvePublishedContext});
    await assert.rejects(authorize({dealerId:'paow',presentationContext:context}),err=>err.statusCode===503&&err.message==='chat_dealer_unavailable');
  }
});

test('blackjack publication is required on the same atomic snapshot, including after async work',async()=>{
  for(const games of [[],['roulette'],null,'blackjack']){
    const f=fixture();f.saved.package.games=games;
    await assert.rejects(f.authorize({dealerId:'paow',presentationContext:context}),error(403));
    assert.deepEqual(f.reads,['north']);
  }
  const f=fixture(),granted=await f.authorize({dealerId:'paow',presentationContext:context});
  assert.deepEqual(f.reads,['north']);
  f.saved.package.games=[];
  await assert.rejects(granted.recheck(),error(403));
  assert.deepEqual(f.reads,['north','north'],'one atomic read per check, no independent game/package lookup');
});


test('registered dealer without an enabled stream stays text-only and never uses Astrid fullfile speech',async()=>{
  const f=fixture(),granted=await f.authorize({dealerId:'paow',presentationContext:context});
  const previews=[];
  const result=await completeChatWithSpeech({
    request:{requestId:'paow-text'},status:{dealerId:granted.dealerId},owner:'session',
    readOwner:async()=>'session',readStatus:granted.recheck,
    decide:async()=>({kind:'generatedText',exactText:'Hej från PAOW.'}),onDecision:text=>previews.push(text),
    service:{generate:()=>assert.fail('Registered chat must not generate speech')},
    // The server provides a stream only after private profile opt-in.
    streamService:null,
  });
  assert.deepEqual(result,{kind:'generatedText',exactText:'Hej från PAOW.'});
  assert.deepEqual(previews,['Hej från PAOW.']);assert.equal(f.reads.length,3);
});

test('publication withdrawn during model work blocks even the early text preview',async()=>{
  const f=fixture(),granted=await f.authorize({dealerId:'paow',presentationContext:context});
  await assert.rejects(completeChatWithSpeech({
    request:{requestId:'paow-stale'},status:{dealerId:granted.dealerId},owner:'session',
    readOwner:async()=>'session',readStatus:granted.recheck,
    decide:async()=>{f.saved.package.revision++;return {kind:'generatedText',exactText:'Stale text.'};},
    onDecision:()=>assert.fail('Stale preview must never be sent'),
    service:{generate:()=>assert.fail('No speech on stale selection')},
    streamService:{prepare:()=>assert.fail('No speech on stale selection')},
  }),error(409));
});

test('logout/account changes cancel actual registered and built-in turns only for the affected player',()=>{
  const own=new AbortController(),base=new AbortController(),foreign=new AbortController(),invalid=new AbortController();
  const active=new Map([[JSON.stringify(['player-1','paow']),own],[JSON.stringify(['player-1','astrid']),base],
    [JSON.stringify(['player-2','paow']),foreign],['malformed',invalid]]);
  assert.equal(cancelPlayerChats(active,'player-1','player_logged_out'),2);
  assert.equal(own.signal.reason,'player_logged_out');assert.equal(base.signal.reason,'player_logged_out');
  assert.equal(foreign.signal.aborted,false);assert.equal(invalid.signal.aborted,false);
  assert.equal(cancelPlayerChats(active,'absent','player_logged_out'),0);
});
