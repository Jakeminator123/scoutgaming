import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setImmediate as turn, setTimeout as delay } from 'node:timers/promises';
import { createSharedRoomChannel, projectSharedRoomSnapshot } from '../services/game/shared-room-channel.mjs';

const origin='https://game.invalid';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const request=(room='room-a')=>new Request(`${origin}/shared-room/${room}`,{headers:{origin}});
const binding=(room='room-a')=>({actorId:'player-a',sessionId:'session-a',operatorId:'operator-a',roomId:room,packageRevision:7,expiresAt:Date.now()+60000});
function snapshot(room='room-a',version=1,presentationVer=version) {
  return {contract:'blackjack-table/1',roomId:room,version,presentationVer,configVersion:'config-a',windowId:'window-a',phase:'betting',roundId:null,turnSeq:0,
    owners:['player-a',null,null,null,null,null,null],seatGen:[1,0,0,0,0,0,0],bets:Array.from({length:7},()=>({main:0,pp:0,tp:0})),
    deadline:20000,actionDeadline:null,plan:null,round:null,
    shoe:{id:'shoe-a',total:416,remaining:415,dealt:1,cutAfter:312,cutReached:false,commitment:'a'.repeat(64),shufflePending:false,decks:8,burn:1},
    players:[{id:'player-a',seats:[0],ready:false,leaving:false,online:true}],serverNow:1000,
    me:{id:'player-a',seats:[0],memberGen:1,active:true,available:100,pausedUntil:null,insuranceDue:false,lastSettlement:null}};
}
function presentation(room='room-a',ver=1) {
  return {roomId:room,ver,talkId:`talk-${ver}`,auditSeq:ver,kind:'window',status:'ready',windowId:'window-a',configVersion:'config-a',language:'en',startAt:1000,endAt:2000,
    events:[{type:'speak',line:'placebets',blocking:true,family:'placebets'}],lines:[{index:0,line:'placebets',lineId:'a'.repeat(32)}]};
}
class Socket extends EventEmitter {
  readyState=1;bufferedAmount=0;frames=[];closed=[];
  send(text,callback){this.frames.push(JSON.parse(text));callback?.();}
  close(code,reason){this.closed.push({code,reason});this.readyState=3;this.emit('close');}
}
async function until(check) {for(let n=0;n<100;n++){if(check())return;await turn();}assert.fail('Expected channel event did not arrive');}
function setup(t,options={}) {
  const calls=[],auth=new Map();
  const channel=createSharedRoomChannel({origin,
    authorize:async(_,{roomId})=>{calls.push(['authorize',roomId]);const b=binding(roomId);auth.set(roomId,b);return b;},
    revalidate:async b=>{calls.push(['revalidate',b.roomId]);return auth.get(b.roomId);},
    readSnapshot:async(room,actor)=>{calls.push(['snapshot',room,actor]);return snapshot(room);},
    readPresentation:async room=>{calls.push(['presentation',room]);return presentation(room);},...options});
  t.after(()=>channel.close());
  return {channel,calls,auth,async attach(room='room-a'){const prepared=await channel.prepare(request(room));const socket=new Socket();prepared.attach(socket);return socket;}};
}
const clean=socket=>{for(const event of ['message','error','close'])assert.equal(socket.listenerCount(event),0,event);};

test('actor wallet hints cross rooms for inactive members without waking another actor or retaining closed sockets',async t=>{
  let available=100;const reads=[];
  const h=setup(t,{
    authorize:async(req,{roomId})=>({...binding(roomId),actorId:req.headers.get('x-fixture-actor')??'player-a'}),
    revalidate:async b=>b,
    readSnapshot:async(room,actor)=>{reads.push([room,actor]);const s=snapshot(room);s.me={...s.me,id:actor,available:actor==='player-a'?available:100};
      if(room==='room-b'){s.me.active=false;s.me.seats=[];s.players=[];s.owners=Array(7).fill(null);}return s;},
  });
  const a=await h.attach(),b=await h.attach('room-b');
  const other=new Socket();(await h.channel.prepare(new Request(`${origin}/shared-room/room-b`,{headers:{origin,'x-fixture-actor':'player-b'}}))).attach(other);
  await until(()=>a.frames.length===1&&b.frames.length===1&&other.frames.length===1);
  available=0;h.channel.emitCommitted('room-a');h.channel.emitActorsCommitted(['player-a','player-a'],{exceptRoom:'room-a'});
  await until(()=>a.frames.length===2&&b.frames.length===2);
  assert.equal(a.frames.at(-1).snapshot.me.available,0);assert.equal(b.frames.at(-1).snapshot.me.available,0);
  assert.equal(b.frames.at(-1).snapshot.me.active,false);assert.equal(other.frames.length,1);
  assert.ok(b.frames.every(f=>f.roomId==='room-b'&&f.snapshot.roomId==='room-b'));
  b.close(1000,'done');clean(b);const before=reads.filter(([,actor])=>actor==='player-a').length;
  available=25;h.channel.emitActorsCommitted(['player-a']);await until(()=>a.frames.length===3);
  assert.equal(reads.filter(([,actor])=>actor==='player-a').length,before+1);
  assert.equal(b.frames.length,2);assert.equal(other.frames.length,1);
  h.channel.close();clean(a);clean(other);h.channel.emitActorsCommitted(['player-a']);await turn();assert.equal(a.frames.length,3);
});

test('actor wallet hints revalidate each target room before reading and again before publishing',async t=>{
  for(const revokeAt of ['before-read','after-read']){
    let revoked=false,armed=false,reads=0;
    const h=setup(t,{revalidate:async b=>revoked?null:b,
      readSnapshot:async room=>{reads++;if(armed&&revokeAt==='after-read')revoked=true;return snapshot(room);}});
    const b=await h.attach('room-b');await until(()=>b.frames.length===1);
    const before=reads;armed=true;if(revokeAt==='before-read')revoked=true;
    h.channel.emitActorsCommitted(['player-a'],{exceptRoom:'room-a'});await until(()=>b.closed.length===1);
    assert.equal(b.closed[0].code,1008);assert.equal(b.frames.length,1);
    assert.equal(reads,before+(revokeAt==='after-read'?1:0));clean(b);
  }
});

test('required ports, exact origin and strict route fail closed before authorization/data',async t=>{
  assert.throws(()=>createSharedRoomChannel({origin}),{code:'shared_room_unavailable'});
  const h=setup(t);
  for(const value of [
    new Request(`${origin}/shared-room/room-a`,{headers:{origin:'https://foreign.invalid'}}),
    new Request(`${origin}/shared-room/room-a`,{method:'POST',headers:{origin}}),
    ...['/shared-room/room-a?actorId=other','/shared-room/room-a/','/shared-room/%72oom-a','/shared-room/room-a#ignored','/other/room-a','/shared-room/../room-a']
      .map(path=>({method:'GET',url:origin+path,headers:new Headers({origin})}))
  ])await assert.rejects(h.channel.prepare(value),{code:'shared_room_request_rejected'});
  assert.deepEqual(h.calls,[]);
  const denied=setup(t,{authorize:async()=>null});
  await assert.rejects(denied.channel.prepare(request()),{code:'shared_room_unauthorized'});
  assert.deepEqual(denied.calls,[]);
});

test('prepare only authorizes; attach reads public state and hints stay within the authorized room',async t=>{
  const h=setup(t),prepared=await h.channel.prepare(request());
  assert.deepEqual(h.calls,[['authorize','room-a']]);
  const a=new Socket();prepared.attach(a);
  assert.throws(()=>prepared.attach(new Socket()));
  const enginePrepared=await h.channel.prepare(new Request('https://engine.invalid/shared-room/room-b',{headers:{origin}}));
  const b=new Socket();enginePrepared.attach(b);
  await until(()=>a.frames.length===1&&b.frames.length===1);
  assert.equal(a.frames[0].snapshot.me.id,'player-a');
  assert.equal(b.frames[0].roomId,'room-b');
  assert.equal(h.calls.filter(c=>c[0]==='revalidate').length,4);
  assert.deepEqual(h.calls.filter(c=>c[0]==='snapshot'),[['snapshot','room-a','player-a'],['snapshot','room-b','player-a']]);
  h.channel.emitCommitted('room-a');
  await until(()=>a.frames.length===2);
  assert.equal(b.frames.length,1);
  a.emit('message','{"actorId":"other","op":"bet"}');
  assert.deepEqual(a.closed,[{code:1008,reason:'shared_room_read_only'}]);clean(a);
  const before=h.calls.length;h.channel.emitCommitted('room-a');await turn();assert.equal(h.calls.length,before);
});

test('fixed server binding is rechecked after reads and before any send',async t=>{
  for(const key of ['actorId','sessionId','operatorId','roomId','packageRevision','expiresAt']) {
    let checks=0;
    const h=setup(t,{revalidate:async b=>++checks===1?b:{...b,[key]:typeof b[key]==='number'?b[key]+1:'changed'}});
    const s=await h.attach();await until(()=>s.closed.length);
    assert.equal(s.frames.length,0,key);assert.equal(s.closed[0].code,1008,key);clean(s);
  }
  const h=setup(t);const s=await h.attach();await until(()=>s.frames.length===1);
  h.auth.delete('room-a');const reads=h.calls.filter(c=>c[0]==='snapshot').length;h.channel.emitCommitted('room-a');
  await until(()=>s.closed.length);assert.equal(s.frames.length,1);
  assert.equal(h.calls.filter(c=>c[0]==='snapshot').length,reads);clean(s);
});

test('hints during a read are not lost; obsolete pair is discarded and refreshes stay serialized',async t=>{
  const hold=deferred(),started=deferred();let reads=0,active=0,maxActive=0;
  const h=setup(t,{readSnapshot:async room=>{const version=++reads;active++;maxActive=Math.max(active,maxActive);
    if(version===1){started.resolve();await hold.promise;}active--;return snapshot(room,version);},
    readPresentation:async room=>presentation(room,reads)});
  const s=await h.attach();await started.promise;
  h.channel.emitCommitted('room-a');h.channel.emitCommitted('room-a');h.channel.emitCommitted('room-a');hold.resolve();
  await until(()=>s.frames.length===1);
  assert.equal(reads,2);assert.equal(maxActive,1);assert.equal(s.frames[0].snapshot.version,2);assert.equal(s.frames[0].presentation.ver,2);
});

test('mismatched versions retry, persistent mismatch/missing K04 contract and regressions never send stale state',async t=>{
  let reads=0;
  const h=setup(t,{readSnapshot:async room=>snapshot(room,2),readPresentation:async room=>++reads===1?{...presentation(room,1),windowId:'previous-window',configVersion:'previous-config'}:presentation(room,2)});
  const s=await h.attach();await until(()=>s.frames.length===1);assert.equal(reads,2);assert.equal(s.frames[0].presentation.ver,2);
  let mismatchReads=0;
  const bad=setup(t,{consistencyTimeoutMs:15,readSnapshot:async room=>{mismatchReads++;return snapshot(room,2);},readPresentation:async room=>presentation(room,3)});
  const bs=await bad.attach();await delay(30);assert.equal(mismatchReads,3);assert.equal(bs.frames.length,0);
  const old=setup(t,{readSnapshot:async room=>{const value=snapshot(room);delete value.presentationVer;return value;}});
  const os=await old.attach();await until(()=>os.closed.length);assert.equal(os.frames.length,0);
  let version=2;
  const reg=setup(t,{readSnapshot:async room=>snapshot(room,version),readPresentation:async room=>presentation(room,version)});
  const rs=await reg.attach();await until(()=>rs.frames.length===1);version=1;reg.channel.emitCommitted('room-a');
  await until(()=>rs.closed.length);assert.equal(rs.frames.length,1);assert.equal(rs.frames[0].snapshot.version,2);
});

test('reconnect rereads the current matching presentation, including empty and legacy states',async t=>{
  let version=1;
  const h=setup(t,{readSnapshot:async room=>snapshot(room,version),readPresentation:async room=>presentation(room,version)});
  const first=await h.attach();await until(()=>first.frames.length);first.close(1000,'client');clean(first);
  version=5;const second=await h.attach();await until(()=>second.frames.length);
  assert.equal(second.frames[0].snapshot.presentationVer,5);assert.equal(second.frames[0].presentation.talkId,'talk-5');
  const empty=setup(t,{readSnapshot:async room=>snapshot(room,0),readPresentation:async()=>null});
  const es=await empty.attach();await until(()=>es.frames.length);assert.equal(es.frames[0].presentation,null);
  const legacy=setup(t,{readPresentation:async room=>({roomId:room,ver:1,talkId:'legacy-1',auditSeq:1,kind:null,status:'legacy',events:[],lines:[]})});
  const ls=await legacy.attach();await until(()=>ls.frames.length);assert.equal(ls.frames[0].presentation.status,'legacy');
});

test('explicit public projection preserves public shoe counters but strips private nested data',async t=>{
  const h=setup(t,{readSnapshot:async room=>{
    const s=snapshot(room);s.game={private:'secret'};s.audit={nonce:'secret'};
    Object.assign(s.shoe,{cards:['secret'],proof:{nonce:'secret'},nonce:'secret',samples:[999]});
    const hand={box:0,splitFrom:null,stake:10,pp:0,tp:0,cards:[{r:'10',s:'S',shoeDraw:2,serial:99,private:'secret'}],done:false,doubled:false,insured:0,result:null,sideReturn:0,sideLabels:[]};
    s.round={boxes:[hand],hands:[hand],dealer:[{r:'9',s:'H',shoeDraw:3}],phase:'decisions',active:0,holeDraw:5,legalActions:['hit','stand'],holeCard:{r:'A',s:'S',shoeDraw:5},events:['secret']};
    s.me.secret='secret';s.me.lastSettlement={roundId:'round-before',settledAt:1,returned:20,staked:10,net:10,hands:[hand],ledgerId:'secret'};
    return s;
  },readPresentation:async room=>{const p=presentation(room);p.audit={secret:true};p.events[0].private='secret';p.lines[0].rawAudio='secret';return p;}});
  const s=await h.attach();await until(()=>s.frames.length);
  assert.deepEqual(s.frames[0].snapshot.shoe,snapshot().shoe);
  assert.equal(s.frames[0].snapshot.round.hands[0].cards[0].shoeDraw,2);
  assert.equal(s.frames[0].snapshot.me.lastSettlement.net,10);
  assert.equal(JSON.stringify(s.frames).includes('secret'),false);
  assert.equal(Object.hasOwn(s.frames[0].snapshot.round,'holeCard'),false);
  for(const invalid of [
    s=>({...s,roomId:'other-room'}),s=>({...s,me:{...s.me,id:'other-player'}}),
    s=>({...s,round:{phase:'decisions',holeDraw:5,dealer:[{r:'A',s:'S',shoeDraw:5}]}})
  ]){const bad=setup(t,{readSnapshot:async room=>invalid(snapshot(room))});const socket=await bad.attach();await until(()=>socket.closed.length);assert.equal(socket.frames.length,0);}
  const faceDown=setup(t,{readPresentation:async room=>({...presentation(room),lines:[],events:[{type:'deal',faceDown:true,card:{r:'A',s:'S'}}]})});
  const fs=await faceDown.attach();await until(()=>fs.closed.length);assert.equal(fs.frames.length,0);
});

test('expiry, capacity, buffer bounds and socket errors close and remove subscriptions',async t=>{
  let clock=Date.now();const h=setup(t,{now:()=>clock,maxConnections:1});const s=await h.attach();await until(()=>s.frames.length);
  const extra=await h.channel.prepare(request());const extraSocket=new Socket();assert.throws(()=>extra.attach(extraSocket));assert.equal(extraSocket.closed[0].code,1013);
  clock=h.auth.get('room-a').expiresAt;h.channel.emitCommitted('room-a');await until(()=>s.closed.length);assert.equal(s.closed[0].code,1008);clean(s);
  const buffered=setup(t);const prepared=await buffered.channel.prepare(request());const bs=new Socket();bs.bufferedAmount=256*1024;prepared.attach(bs);
  await until(()=>bs.closed.length);assert.equal(bs.closed[0].code,1013);assert.equal(bs.frames.length,0);clean(bs);
  const small=setup(t,{maxBufferedBytes:256});const ss=await small.attach();await until(()=>ss.closed.length);assert.equal(ss.closed[0].code,1013);assert.equal(ss.frames.length,0);
  const broken=setup(t);const es=await broken.attach();es.emit('error',new Error('private error'));assert.deepEqual(es.closed,[{code:1011,reason:'shared_room_unavailable'}]);clean(es);
  const exp=setup(t,{authorize:async(_,{roomId})=>({...binding(roomId),expiresAt:Date.now()+20}),revalidate:async b=>b});
  const xs=await exp.attach();await delay(40);assert.equal(xs.closed[0].code,1008);clean(xs);
});

test('read timeout and cancellation release listeners; late auth/read completion cannot send or start more reads',async t=>{
  const never=deferred();let signal;
  const h=setup(t,{readTimeoutMs:15,readSnapshot:async(_room,_actor,options)=>{signal=options.signal;return never.promise;}});
  const s=await h.attach();await delay(30);assert.equal(s.closed[0].code,1011);assert.equal(signal.aborted,true);clean(s);
  never.resolve(snapshot());await turn();assert.equal(s.frames.length,0);
  const held=deferred(),started=deferred();let reads=0;
  const cancel=setup(t,{revalidate:async b=>{started.resolve();await held.promise;return b;},readSnapshot:async room=>{reads++;return snapshot(room);}});
  const cs=await cancel.attach();await started.promise;cancel.channel.close();held.resolve();await turn();await turn();
  assert.equal(reads,0);assert.equal(cs.frames.length,0);clean(cs);
  const throwing=setup(t,{readPresentation:async()=>{throw new Error('database password private');}});
  const ts=await throwing.attach();await until(()=>ts.closed.length);assert.deepEqual(ts.closed,[{code:1011,reason:'shared_room_unavailable'}]);assert.equal(ts.frames.length,0);
});

test('committed game state waits for delayed receiver without sending mixed versions or closing a healthy channel',async t=>{
  let ver=1,reads=0;
  const h=setup(t,{maxReadAttempts:2,consistencyTimeoutMs:500,
    readSnapshot:async room=>{reads++;return snapshot(room,2,2);},
    readPresentation:async room=>presentation(room,ver)});
  const socket=await h.attach();
  await until(()=>reads===2);await turn();
  assert.equal(socket.frames.length,0);assert.deepEqual(socket.closed,[]);
  ver=2;h.channel.emitCommitted('room-a');
  await until(()=>socket.frames.length===1);
  assert.equal(socket.frames[0].snapshot.presentationVer,2);
  assert.equal(socket.frames[0].presentation.ver,2);assert.deepEqual(socket.closed,[]);
  h.channel.close();clean(socket);
});

test('a receiver that never catches up closes once within its explicit consistency deadline',async t=>{
  const h=setup(t,{maxReadAttempts:1,consistencyTimeoutMs:15,
    readSnapshot:async room=>snapshot(room,2,2),readPresentation:async room=>presentation(room,1)});
  const socket=await h.attach();await delay(30);
  assert.deepEqual(socket.closed,[{code:1011,reason:'shared_room_unavailable'}]);
  assert.equal(socket.frames.length,0);clean(socket);
});

test('client settings reject malformed money, timing, language and bootstrap values before exposure',()=>{
  const cfg={configVersion:'config-a',language:'en',betMs:20000,actionMs:15000,
    limits:{min:0.5,max:2000,sideMax:0},chips:[0.5,1,5],refill:1000};
  const state={...snapshot(),unopened:false,settings:cfg};
  assert.deepEqual(projectSharedRoomSnapshot(state,binding()).settings,cfg);
  for(const change of [
    {configVersion:'other'},{language:'de'},{betMs:0},{betMs:1.5},{actionMs:-1},{refill:-1},{refill:null},
    {limits:null},{limits:{min:0,max:10,sideMax:5}},{limits:{min:10,max:5,sideMax:5}},
    {limits:{min:1,max:10,sideMax:-1}},{chips:[]},{chips:[null]},{chips:[1,-1]},{chips:[1,1]},
  ])assert.throws(()=>projectSharedRoomSnapshot({...state,settings:{...cfg,...change}},binding()),{code:'shared_room_unavailable'});
  assert.throws(()=>projectSharedRoomSnapshot({...state,settings:null},binding()),{code:'shared_room_unavailable'});
  assert.throws(()=>projectSharedRoomSnapshot({...state,unopened:'false'},binding()),{code:'shared_room_unavailable'});
});
