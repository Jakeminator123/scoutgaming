import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {setTimeout as pause} from 'node:timers/promises';
import {createPostgresNativeTableCommand} from '../services/game/postgres-native-table.mjs';
import {fakeNativeTablePool} from './fixtures/native-table-fake-pool.mjs';
import {command as shoeCommand,newGame} from '../services/game/shoe-game.mjs';
import {createMovingSpeechRuntime} from '../services/game/moving-speech-runtime.mjs';
import {createMovingSpeechSourceSet} from '../services/game/moving-speech-bank.mjs';
import {DRAGAN_KEVIN_PROFILE as profile} from '../packages/presentation/contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs';
import {validateMovingSpeechStream} from '../packages/presentation/runtime/moving-speech-player.mjs';

const {WebSocket}=createRequire(new URL('../services/astrid-gpu-worker/gateway/package.json',import.meta.url))('ws');
const hash=value=>createHash('sha256').update(value).digest('hex');
const h='a'.repeat(64),sessionId='1'.repeat(32),restId='11111111-1111-4111-8111-111111111111';
const origin='https://moving-deal.fixture.invalid';
const context={operatorSlug:'fixture',roomId:'room-one',packageRevision:1,dealerId:'dragan'};
const bets=Array.from({length:7},(_,box)=>({main:box===3?5:0,pp:0,tp:0}));
async function until(check){
  for(let i=0;i<200;i++){if(check())return;await pause(5);}
  assert.fail('isolated native-deal integration did not settle');
}

// The production wallet/shoe/receipt command on a transactional in-memory pool and
// a real HTTP/WebSocket relay.
// Voice, provider session and media metadata are synthetic; this does not
// attest registered media bytes, actual GPU output, browser decode or lip sync.
async function fixture(t,{stallAfterFirstChunk=false}={}){
  const players={},tables={};
  for(const id of ['player-one','player-two']){
    players[id]={id,name:id,currency:'EUR',balance:'1000',status:'active'};
    const game=newGame();shoeCommand(game,{op:'state'},1000);
    const draws=[['8','♠'],['6','♥'],['9','♣'],['K','♦'],['5','♠']].map(([r,s])=>({r,s}));
    game.shoe.cards.splice(-draws.length,draws.length,...draws.reverse());
    tables[id]=JSON.stringify(game);
  }
  // Committed rows only: the pool replaces store.state when a command commits.
  const {pool,store}=fakeNativeTablePool({state:{players,tables}});
  const getPlayer=id=>({...store.state.players[id],balance:Number(store.state.players[id].balance)});
  const original=Buffer.from('synthetic rest bytes'),pcm=Buffer.alloc(384000,1);
  const clips=profile.takes.map((take,i)=>({videoId:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,
    sha256:take.sha256,bytes:100+i,fps:24,frameCount:take.frames,width:1080,height:1920}));
  const sourceSet=createMovingSpeechSourceSet({dealerId:'dragan',clips:[...clips,{videoId:restId,sha256:hash(original),
    bytes:original.length,fps:24,frameCount:24,width:1080,height:1920}],rest:{videoId:restId,frame:7}});
  const videos=sourceSet.clips.map(c=>({id:c.videoId,dealer:'dragan',sha256:c.sha256,bytes:c.bytes,size:c.bytes,available:true,
    storage:'private-blob',contentType:'video/mp4',classification:{dealerId:'dragan',kind:c.videoId===restId?'idle':'action'}}));
  const registry={videos};
  const frozenContext={schemaVersion:3,context,dealer:{id:'dragan'},inventory:registry,records:videos,
    project:{lines:[{dealerId:'dragan',variants:clips.map(c=>({videoGenerationId:c.videoId}))}]}};
  const bankRecord=(extension,contentType,bytes)=>({provider:'vercel-blob',
    pathname:`croupier/media/dealers/dragan/runtime/moving-bank/${restId}/${hash(bytes)}.${extension}`,
    contentType,size:bytes.length,sha256:hash(bytes)});
  const bank={schemaVersion:1,sourceSet,archive:bankRecord('bin','application/octet-stream',Buffer.from('bank')),
    receipt:bankRecord('json','application/json',Buffer.from('{}'))};
  const counters={commits:0,admits:0,tts:0,chunks:0,cancels:0},sockets=[],failures=[];
  let runtime,admission;
  const server=createServer(async(req,res)=>{
    if(!await runtime.handleHttp(req,res)){res.writeHead(404);res.end();}
  });
  t.after(async()=>{
    for(const socket of sockets)socket.terminate();
    await runtime?.close();await new Promise(resolve=>server.close(resolve));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=`ws://127.0.0.1:${server.address().port}/moving-speech-stream`;
  const receipt=playerId=>{const row=store.state.presentations[playerId];return row&&{version:row.version,payload:row.payload};};
  runtime=createMovingSpeechRuntime({server,origin,ticketSecret:'isolated-fixture-only'.repeat(3),bank,releaseSha256:h,
    readPresentation:async playerId=>receipt(playerId),
    readEvidence:async()=>({projectRevision:1,mediaReferences:videos.map(v=>({id:v.id,sha256:v.sha256})),frozenContext}),
    readRegistry:async()=>registry,
    publicVideo:(_frozen,id)=>({id,sha256:videos.find(v=>v.id===id).sha256,src:'/api/presentation/registered-video/fixture/'+id}),
    resolveOwner:async req=>req.headers.cookie==='owner=one'?'owner-one':'unrelated-owner',
    readRest:async()=>new Response(original,{headers:{'content-type':'video/mp4'}}),
    bankRead:async()=>assert.fail('no bank download or external provider is permitted'),
    onStreamFailure:value=>failures.push(value),onPreparationFailure:()=>{},onCleanupError:()=>assert.fail('unexpected cleanup error'),
    dealerRuntime:{async prepareMoving(){return {profileRevision:h,async assertFresh(){},
      async *source({signal,beforeCostly}){await beforeCostly();signal.throwIfAborted();counters.tts++;yield pcm;}};}},
    sessions:{async admit(args){
      counters.admits++;admission=args;await args.beforeCostly();
      return {sessionId,binding:{...args.binding,schemaVersion:1,sessionId,attemptId:'attempt-one',nonce:'2'.repeat(64)},
        async submit(){await args.beforeCostly();},async ready(){},handleUpgrade(){return false;},
        async cancel(){counters.cancels++;},
        async dispatch(input,{onChunk}){
          for(let from=0;from<input.plan.timeline.length;from+=12){
            args.signal.throwIfAborted();const rows=input.plan.timeline.slice(from,from+12);
            await onChunk({t:'lapp',id:input.plan.start.id,del:from/12,fran:from,
              rutor:rows.map(row=>({tagning:row.take,ruta:row.frame,rect:[1,2,30,40]}))},Buffer.from([rows.length,0,1,9]));
            counters.chunks++;
            if(stallAfterFirstChunk)await new Promise(resolve=>{
              args.signal.addEventListener('abort',resolve,{once:true});if(args.signal.aborted)resolve();
            });
          }
        }};
    }}});
  const grant={movingSpeech:{context,sessionRevision:'browser-one',ownerHash:hash('owner-one')}};
  const native=createPostgresNativeTableCommand({pool,
    publish:observation=>{
      // Prove both the receipt and wallet are committed before observation.
      assert.equal(receipt(observation.playerId).version,observation.view.version);
      assert.equal(getPlayer(observation.playerId).balance,observation.balance);
      counters.commits++;runtime.observeCommitted(observation);
    },onPublishError:()=>assert.fail('native commit was not observed')});
  const openingRequest={id:'player-one',dealer:'dragan',op:'start',version:0,requestId:'deal-one',bets};
  const open=()=>native(openingRequest,grant);
  const prepare=(view,overrides={})=>runtime.forContext(overrides.context??context,view.version,overrides.sessionRevision??'browser-one')
    .prepare({owner:'owner-one',playerId:'player-one',requestId:'speech-one',dealerId:'dragan',text:'Hej under utdelningen.',
      beforeCostly:async()=>{},...overrides});
  function connect(descriptor){
    const socket=new WebSocket(address,['moving-v1',`ticket.${descriptor.ticket}`],{headers:{origin,cookie:'owner=one'}});
    sockets.push(socket);const messages=[];
    const closed=new Promise(resolve=>socket.once('close',code=>resolve(code)));
    socket.on('error',()=>{});
    socket.on('message',(data,binary)=>{
      const value=binary?Buffer.from(data):JSON.parse(data.toString());messages.push(value);
      if(value.t==='ready')socket.send(JSON.stringify({t:'credit',id:value.plan.start.id,frames:24}));
      if(value.t==='lapp')socket.send(JSON.stringify({t:'credit',id:value.id,frames:value.rutor.length}));
    });
    return {socket,messages,closed};
  }
  return {store,native,open,openingRequest,grant,prepare,connect,receipt,getPlayer,runtime,counters,failures,
    get admission(){return admission;}};
}

test('native committed opening supplies exact persisted draws to moving WS once; playback cannot change wallet or cards',async t=>{
  const f=await fixture(t),opening=await f.open(),saved=f.receipt('player-one');
  assert.equal(opening.balance,995);assert.deepEqual(JSON.parse(saved.payload),opening.presentation);
  assert.deepEqual(await f.open(),opening);assert.equal(f.counters.commits,1);
  const descriptor=await f.prepare(opening);
  await validateMovingSpeechStream(descriptor,{dealerId:'dragan',requestId:'speech-one',exactText:'Hej under utdelningen.'});
  const client=f.connect(descriptor);await until(()=>client.messages.some(m=>m.t==='done'));
  const ready=client.messages.find(m=>m.t==='ready');
  const draws=opening.presentation.filter(e=>e.type==='deal');
  assert.deepEqual(ready.sequence.steps.map(s=>s.event.shoeDraw),draws.map(e=>e.shoeDraw));
  assert.deepEqual(ready.sequence.steps.map(s=>[s.event.to,s.event.box,s.event.faceDown]),
    draws.map(e=>[e.to,e.box??null,e.faceDown===true]));
  assert.equal(draws.at(-1).card,null);assert.ok(ready.sequence.steps.every(s=>!Object.hasOwn(s.event,'card')));
  for(const [k,row]of ready.plan.timeline.entries()){
    const source=ready.sequence.frames[k]??{take:'vila',frame:0,sourceSha256:ready.rest.sha256};
    assert.deepEqual(row,source);
  }
  assert.equal(hash(JSON.stringify(ready.sequence)),descriptor.sequenceSha256);
  assert.deepEqual(await f.open(),opening);assert.equal(f.counters.commits,1);
  assert.throws(()=>f.runtime.normalPresentation('player-one',opening.version),/reserved/);
  await assert.rejects(f.prepare(opening,{requestId:'duplicate-speech'}),/not_available/);
  client.socket.send(JSON.stringify({t:'played',id:ready.plan.start.id}));assert.equal(await client.closed,1000);
  await until(()=>f.counters.cancels===1);
  assert.equal(f.getPlayer('player-one').balance,995);
  assert.equal(f.store.state.transactions.length,1);
  assert.deepEqual(f.receipt('player-one'),saved);
  await assert.rejects(f.prepare(opening,{requestId:'already-played'}),/not_available/);
  assert.equal(f.counters.admits,1);assert.equal(f.counters.tts,1);assert.deepEqual(f.failures,[]);
});

test('committed native scope rejects another room, browser or player before provider admission and speech',async t=>{
  const f=await fixture(t),opening=await f.open();
  for(const overrides of [{context:{...context,roomId:'room-two'}},{sessionRevision:'browser-two'},{playerId:'player-two'}]){
    await assert.rejects(f.prepare(opening,overrides),/not_available/);
  }
  assert.equal(f.counters.admits,0);assert.equal(f.counters.tts,0);
  assert.equal(f.getPlayer('player-one').balance,995);assert.equal(f.getPlayer('player-two').balance,1000);
  // Rejected foreign scopes must not spend the original owner's reservation.
  const descriptor=await f.prepare(opening);assert.equal(descriptor.presentationVersion,opening.version);
});

test('later real native command cancels a stalled moving stream without another frame or debit',async t=>{
  const f=await fixture(t,{stallAfterFirstChunk:true}),opening=await f.open();
  const client=f.connect(await f.prepare(opening));await until(()=>f.counters.chunks===1);
  const later=await f.native({id:'player-one',dealer:'dragan',op:'act',action:'stand',version:opening.version,requestId:'stand-one'},f.grant);
  assert.equal(later.version,opening.version+1);assert.equal(f.receipt('player-one').version,later.version);
  await until(()=>f.counters.cancels===1);await client.closed;
  assert.equal(f.admission.signal.aborted,true);assert.equal(f.counters.chunks,1);
  assert.equal(client.messages.filter(m=>m.t==='lapp').length,1);assert.equal(client.messages.some(m=>m.t==='done'),false);
  await assert.rejects(f.prepare(opening,{requestId:'old-opening'}),/not_available/);
  assert.equal(f.counters.admits,1);assert.equal(f.counters.tts,1);
  assert.equal(f.getPlayer('player-one').balance,995);
  assert.equal(f.store.state.transactions.length,1);
});
