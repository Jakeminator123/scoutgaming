import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, scryptSync } from 'node:crypto';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStudioNativeAuthActions } from '../apps/studio/lib/studio-native-auth-actions.mjs';
import { createF11Observer, validateF11Manifest, runF11EvidenceCli, F11_TARGET, F11_MONEY_SQL } from '../tools/shared-room-f11-observer.mjs';
import { prepareF11Fixture, runF11Preview, runF11PreviewCli, validateF11Plan, f11FixtureIdentity,
  nextF11Command, correlateF11Log } from '../tools/run-f11-preview.mjs';
import { createF11LivePorts, validateF11DatabaseUrl, f11ProviderReceipt, readF11Fixture } from '../tools/f11-preview-ports.mjs';

const receiptHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const actors = ['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
function gatewayProof(instanceId, listeningAt, drainingAt=null) {
  const entry=(phase,at)=>({source:'render-app-log',logId:`${instanceId}-${phase}`,instanceId,
    fullInstanceId:`${instanceId}-full-pod`,serviceId:F11_TARGET.serviceId,sha:'a'.repeat(40),runtimeId:actors[instanceId.includes('old')?0:1],
    listenerId:2,phase,at,...(phase==='listening'?{binding:{address:'0.0.0.0',port:10000}}:{})});
  return {listening:entry('listening',listeningAt),draining:drainingAt===null?null:entry('draining',drainingAt)};
}
function logReceipt(payload, instanceId, logId, plan=livePlan()) {
  return {source:'render-api-capture',serviceId:plan.serviceId,deployment:{id:'dep-test',serviceId:plan.serviceId,commit:{id:plan.sha}},
    log:{id:logId,timestamp:new Date(payload.at).toISOString(),message:JSON.stringify(payload),
      labels:[{name:'resource',value:plan.serviceId},{name:'instance',value:instanceId},{name:'type',value:'app'}]}};
}
function provenanceBundle(connection, old=connection.processId===actors[0]) {
  const instanceId=`${F11_TARGET.serviceId}-${old?'old':'new'}`,gateway=gatewayProof(instanceId,old?0:49000,old?90000:null);
  return {socket:logReceipt({event:'shared_room_socket_identity',processId:connection.processId,socketNonce:connection.nonce,at:connection.at},instanceId,`log-${connection.nonce}`),
    gateway:Object.values(gateway).filter(Boolean).map(e=>logReceipt({event:'cloud_gateway_lifecycle',at:new Date(e.at).toISOString(),
      instanceId:e.fullInstanceId,runtimeId:e.runtimeId,commitSha:e.sha,phase:e.phase,listenerId:e.listenerId,...(e.binding?{binding:e.binding}:{})},instanceId,e.logId))};
}
function f11Manifest() {
  const m = {...F11_TARGET,schemaVersion:1,sha:'a'.repeat(40),syntheticOnly:true,
    roomId:'room-33333333-3333-4333-8333-333333333333',runId:'f11-run',actors:[...actors],startedAt:0,endedAt:120000};
  const ownership={schemaVersion:1,source:'preview-api-created',runId:m.runId,operatorId:m.runId,roomId:m.roomId,
    checkedAt:0,verifiedAt:0,absent:{operators:0,accounts:0,rooms:0,packages:0},
    readback:{...F11_TARGET,roomId:m.roomId,operatorId:m.runId,configVersion:'config-1',packageRevision:1,roomCount:1,accountCount:2},
    accounts:actors.map((actorId,i)=>({actorId,username:`${m.runId}-${i?'b':'a'}`,createdAt:0,
      openingId:`open-${i}`,openingCents:100000,currency:'USD',openingAt:new Date(0).toISOString()}))};
  m.ownership={...ownership,digest:receiptHash(ownership)};return m;
}
function f11Capture() {
  const m = f11Manifest(), events = [];
  const add = (type,at,data) => events.push({type,at,...data});
  const target = at => add('target',at,{...m,source:'provider-api',engineSha:m.sha,vercelSha:m.sha,healthStatus:200,ready:true,suspended:false});
  const ledger = (id,actorId,amountCents,type) => ({id,actorId,amountCents,type,roundId:'round-2',fingerprint:'b'.repeat(64),
    sourceKey:JSON.stringify(['tick',m.roomId,'system',`tick-${id}`,actorId,type])});
  const wallet = (at,stage,{holds=false,hands=0,settled=false,left=false}={}) => add('money',at,{...m,stage,source:'preview-sql',hands,
    members:stage==='before'?[]:actors.map(actorId=>({actorId,active:!left,memberGen:left?2:1})),
    balances:m.actors.map((actorId,i)=>({actorId,balanceCents:settled?(i?99500:100500):100000})),
    reservations:holds?[{id:'reservation-1',actorId:m.actors[0],amountCents:500}]:[],
    ledger:[...m.ownership.accounts.map(a=>({id:a.openingId,actorId:a.actorId,amountCents:a.openingCents,currency:a.currency,at:a.openingAt,type:'open',roundId:null,sourceKey:null,fingerprint:null})),...(settled?[ledger('1',m.actors[0],-500,'consume:stake'),ledger('2',m.actors[1],-500,'consume:stake'),ledger('3',m.actors[0],1000,'payout')]:[])],
    settlements:settled?[{roundId:'round-2',actorId:m.actors[0],ledgerId:'3',returnedCents:1000},
      {roundId:'round-2',actorId:m.actors[1],ledgerId:null,returnedCents:0}]:[]});
  const open = (at,connectionId,actorId,instanceId) => add('open',at,{connectionId,actorId,roomId:m.roomId,connectionNonce:`nonce-${connectionId}`,
    instanceProof:{source:'render-app-log',logId:`log-${connectionId}`,connectionNonce:`nonce-${connectionId}`,instanceId,serviceId:m.serviceId,sha:m.sha,at,
      gateway:gatewayProof(instanceId,instanceId==='instance-old'?0:49000,instanceId==='instance-old'?90000:null)}});
  const frame = (at,connectionId,actorId,version,phase='round') => add('frame',at,{connectionId,frame:{type:'shared-room-state',roomId:m.roomId,
    snapshot:{contract:'blackjack-table/1',configVersion:'config-1',roomId:m.roomId,me:{id:actorId},version,
      presentationVer:version,roundId:version<5?'round-1':'round-2',phase,turnSeq:version,windowId:`window-${version<5?1:2}`,
      owners:[...m.actors,null,null,null,null,null],seatGen:Array(7).fill(1),bets:Array.from({length:7},()=>({main:0,pp:0,tp:0})),
      round:phase==='round'?{phase:'decisions',active:0,boxes:[],hands:[],legalActions:['stand'],dealer:[{r:'8',s:'H',shoeDraw:2}]}:null,
      shoe:{id:'shoe-1',total:312,remaining:300,dealt:12,cutAfter:260,cutReached:false,commitment:'d'.repeat(64),shufflePending:false,decks:6,burn:1},
      plan:null,deadline:phase==='bets'?version*20000:null,actionDeadline:phase==='round'?version*15000:null},
    presentation:{roomId:m.roomId,ver:version,events:[{type:phase==='round'?'deal':'idle'}]}}});
  target(0);wallet(1,'before');open(1000,'old','11111111-1111-4111-8111-111111111111','instance-old');
  frame(2000,'old','11111111-1111-4111-8111-111111111111',1,'bets');frame(20000,'old','11111111-1111-4111-8111-111111111111',2);wallet(52000,'during',{holds:true});
  frame(40000,'old','11111111-1111-4111-8111-111111111111',3);wallet(61000,'during',{hands:2});
  open(50000,'new','22222222-2222-4222-8222-222222222222','instance-new');
  for(const [at,version,phase] of [[51000,4,'bets'],[60000,5,'round'],[75000,6,'round'],[89500,7,'round']]) {
    frame(at,'old','11111111-1111-4111-8111-111111111111',version,phase);frame(at+100,'new','22222222-2222-4222-8222-222222222222',version,phase);
  }
  add('close',90000,{connectionId:'old',code:1012});open(91000,'again','11111111-1111-4111-8111-111111111111','instance-new');
  frame(92000,'again','11111111-1111-4111-8111-111111111111',7);frame(105000,'new','22222222-2222-4222-8222-222222222222',8);frame(118000,'again','11111111-1111-4111-8111-111111111111',9,'settled');
  frame(118040,'again',actors[0],10,'bets');events.at(-1).frame.snapshot.owners=Array(7).fill(null);
  wallet(118050,'during',{settled:true,left:true});
  add('negative',118100,{source:'socket-capture',probe:'wrong-room',connectionId:'negative-room',actorId:m.actors[0],roomId:'f11-other',stateFrames:0,status:403});
  add('negative',118200,{source:'socket-capture',probe:'revoked-session',connectionId:'negative-session',actorId:m.actors[1],roomId:m.roomId,stateFrames:0,status:1008});
  wallet(119000,'after',{settled:true,left:true});target(120000);
  for(const row of events.filter(e=>e.type==='money')) {
    const snapshot=events.filter(e=>e.type==='frame'&&e.at<=row.at).sort((a,b)=>a.at-b.at).at(-1)?.frame.snapshot;
    row.roomHead=snapshot?{version:snapshot.version,presentationVer:snapshot.presentationVer,owners:[...snapshot.owners]}:null;
  }
  return {manifest:m,events:events.sort((a,b)=>a.at-b.at)};
}
function f11Review(capture=f11Capture()) {
  const observer=createF11Observer(capture.manifest);
  for(const event of capture.events) observer.observe(event);
  return observer.finish();
}
test('F11 accepts advancing revisions, simultaneous observed instances and reconciled money only for evidence review',()=>{
  const result=f11Review();
  assert.equal(result.status,'evidence-complete-review-required');assert.equal(result.acceptance,false);
  assert.equal(result.overlap.durationMs,40000);assert.equal(result.walletEffects,3);
  assert.equal(new Set(result.overlap.instances).size,2);
});
function longPlanCapture() {
  const c=f11Capture();c.manifest.endedAt=200000;
  const times=new Map([[40000,25000],[51000,70000],[51100,70100],[52000,72000],[60000,80000],[60100,80100],
    [61000,81000],[75000,120000],[75100,120100],[89500,160000],[89600,160100],[90000,179576],[91000,180000],
    [92000,180100],[105000,174353],[118000,198000],[118040,198040],[118050,198050],[118100,198100],
    [118200,198200],[119000,199000],[120000,200000]]);
  for(const e of c.events) {
    e.at=times.get(e.at)??e.at;
    if(e.type==='open') {e.instanceProof.at=e.at;if(e.connectionId==='old')e.instanceProof.gateway.draining.at=170000;}
    if(e.type==='frame') {
      const s=e.frame.snapshot;
      if(s.version===3)s.plan={turnAt:69800,endAt:69800};
      if(s.version===5)s.plan={turnAt:119394,endAt:119394};
      if(s.version===7)s.plan={turnAt:173682,endAt:173682};
    }
  }
  const initial=structuredClone(c.events.find(e=>e.type==='frame'&&e.frame.snapshot.version===3));
  initial.at=50010;initial.connectionId='new';initial.frame.snapshot.me.id=actors[1];c.events.push(initial);
  const fresh=c.events.find(e=>e.type==='frame'&&e.frame.snapshot.version===8);
  const again=c.events.find(e=>e.type==='frame'&&e.connectionId==='again');again.frame=structuredClone(fresh.frame);again.frame.snapshot.me.id=actors[0];
  for(const [at,version] of [[95000,5],[130000,6],[169000,7],[175000,8]]) {
    const sample=structuredClone(c.events.find(e=>e.stage==='during'&&e.hands));sample.at=at;
    sample.roomHead.version=version;sample.roomHead.presentationVer=version;c.events.push(sample);
  }
  c.events.sort((a,b)=>a.at-b.at);return c;
}
test('F11 accepts change-only long plans and a post-drain revision before delayed client 1012',()=>{
  const result=f11Review(longPlanCapture());
  assert.equal(result.overlap.startedAt,50000);assert.equal(result.overlap.endedAt,170000);
  assert.equal(result.overlap.oldClientClosedAt,179576);assert.equal(result.overlap.durationMs,120000);
  assert.equal(result.overlap.endedBy,'verified-public-gateway-drain');assert.equal(result.acceptance,false);
});
test('F11 rejects stale or frozen peers even after a valid activity window and with long plans',()=>{
  for(const mutate of [
    c=>{c.events=c.events.filter(e=>!(e.type==='frame'&&e.connectionId==='old'&&e.frame.snapshot.version===6));},
    c=>{c.events=c.events.filter(e=>!(e.type==='frame'&&e.frame.snapshot.version===6));}, // both freeze; independent SQL catches it
    c=>{c.events=c.events.filter(e=>!(e.type==='frame'&&e.connectionId==='old'&&e.frame.snapshot.version===7));},
    c=>{c.events.find(e=>e.type==='open'&&e.connectionId==='old').instanceProof.gateway.draining.at=179576;},
    c=>{c.events.find(e=>e.type==='frame'&&e.frame.snapshot.version===8&&e.connectionId==='new').at=169500;c.events.sort((a,b)=>a.at-b.at);},
    c=>{c.events=c.events.filter(e=>!(e.type==='frame'&&e.connectionId==='old'&&e.frame.snapshot.version===3));},
    c=>{c.events=c.events.filter(e=>!(e.type==='frame'&&e.connectionId==='new'&&e.at>130000));
      c.events.push({type:'close',at:130000,connectionId:'new',code:1000});c.events.sort((a,b)=>a.at-b.at);},
  ]) {const c=longPlanCapture();mutate(c);assert.throws(()=>f11Review(c),/continuous_overlap_not_proven/);}
  const quiet=f11Capture();for(const e of quiet.events.filter(e=>e.type==='frame'&&e.at>=51000&&e.at<90000)) {
    const first=quiet.events.find(row=>row.type==='frame'&&row.at===51000).frame;
    const actor=e.frame.snapshot.me.id;e.frame=structuredClone(first);e.frame.snapshot.me.id=actor;
  }
  assert.throws(()=>f11Review(quiet),/continuous_overlap_not_proven/);
});
test('F11 requires inactive memberships and released seats before logout and at final accounting',()=>{
  for(const mutate of [
    c=>{c.events=c.events.filter(e=>!(e.stage==='during'&&e.members.every(m=>!m.active)));},
    c=>{c.events.find(e=>e.stage==='after').members[1].active=true;},
    c=>{c.events.find(e=>e.stage==='after').roomHead.owners[0]=actors[0];},
    c=>{for(const e of c.events.filter(e=>e.stage==='during'))e.members.forEach(m=>{m.active=true;});}
  ]) {const c=f11Capture();mutate(c);assert.throws(()=>f11Review(c),/leave_before_logout_not_proven/);}
});
test('F11 rejects wrong host, full SHA, resource or synthetic scope before observing',()=>{
  for(const [key,value] of [['origin','https://www.scoutgaming.tech'],['engineOrigin','https://evil.invalid'],['sha','abcdef'],
    ['serviceId','srv-production'],['database','croupier_game'],['roomId','production-room'],['syntheticOnly',false],['actors',['alice','bob']]]) {
    assert.throws(()=>validateF11Manifest({...f11Manifest(),[key]:value}),/f11_/);
  }
  const c=f11Capture();c.events[0].engineSha='c'.repeat(40);assert.throws(()=>f11Review(c),/target_evidence_invalid/);
});
test('F11 refuses missing or request-only instance evidence and two sockets on the same instance',()=>{
  for(const mutate of [e=>delete e.instanceProof,e=>{e.instanceProof.source='rndr-id';},e=>{e.instanceProof.sha='c'.repeat(40);},
    e=>{e.instanceProof.connectionNonce='unrelated';}]) {
    const c=f11Capture();mutate(c.events.find(e=>e.type==='open'));assert.throws(()=>f11Review(c),/instance_evidence_required/);
  }
  const c=f11Capture();for(const e of c.events.filter(e=>e.type==='open')) {
    e.instanceProof.instanceId='instance-one';for(const p of Object.values(e.instanceProof.gateway).filter(Boolean))p.instanceId='instance-one';
  }
  assert.throws(()=>f11Review(c),/continuous_overlap_not_proven/);
});
test('F11 refuses a frozen old socket that only catches up after reconnect and one-sided dealer events',()=>{
  for(const mutate of [c=>{c.events=c.events.filter(e=>!(e.type==='frame'&&e.connectionId==='old'&&e.at>51000));},
    c=>{for(const e of c.events.filter(e=>e.type==='frame'&&e.connectionId==='old'))e.frame.presentation.events=[];}]) {
    const c=f11Capture();mutate(c);assert.throws(()=>f11Review(c),/continuous_overlap_not_proven/);
  }
});
test('F11 rejects conflicting state, revision regression, missing 1012 and reconnecting to another hand',()=>{
  for(const [mutate,code] of [
    [c=>{c.events.find(e=>e.type==='frame'&&e.connectionId==='new'&&e.frame.snapshot.phase==='round').frame.snapshot.round.dealer[0].r='9';},'state_conflict'],
    [c=>{c.events.find(e=>e.type==='frame'&&e.connectionId==='old'&&e.at===89500).frame.snapshot.turnSeq=0;},'revision_regressed'],
    [c=>{c.events.find(e=>e.type==='close').code=1006;},'continuous_overlap_not_proven'],
    [c=>{c.events.find(e=>e.type==='frame'&&e.connectionId==='again').frame.snapshot.roundId='other-hand';},'state_conflict']]) {
    const c=f11Capture();mutate(c);assert.throws(()=>f11Review(c),new RegExp(code));
  }
});
test('F11 requires both negative probes without leaked state and actual reservation/settlement accounting',()=>{
  for(const [mutate,code] of [
    [c=>{c.events=c.events.filter(e=>e.type!=='negative');},'negative_probes_required'],
    [c=>{c.events.find(e=>e.type==='negative').stateFrames=1;},'negative_probe_invalid'],
    [c=>{c.events=c.events.filter(e=>e.stage!=='during');},'continuous_overlap_not_proven'],
    [c=>{c.events.find(e=>e.stage==='after').balances[0].balanceCents++;},'balance_mismatch'],
    [c=>{c.events.find(e=>e.stage==='after').hands=1;},'unsettled_money'],
    [c=>{const r=c.events.find(e=>e.stage==='after');r.ledger.push({...r.ledger.find(e=>e.type==='consume:stake'),id:'99'});},'duplicate_wallet_effect'],
    [c=>{const r=c.events.find(e=>e.stage==='after');r.settlements.push({...r.settlements[0]});},'duplicate_settlement'],
    [c=>{c.events.find(e=>e.stage==='after').settlements[0].returnedCents++;},'payout_mismatch']]) {
    const c=f11Capture();mutate(c);assert.throws(()=>f11Review(c),new RegExp(code));
  }
});
test('F11 requires settlement for every debited actor and exact audited round, including losing hands',()=>{
  for(const mutate of [r=>{r.settlements=r.settlements.filter(s=>s.returnedCents>0);},
    r=>{r.settlements.find(s=>s.returnedCents===0).roundId='different-round';},
    r=>{r.ledger.find(e=>e.actorId==='22222222-2222-4222-8222-222222222222'&&e.type==='consume:stake').roundId='different-round';}]) {
    const c=f11Capture();mutate(c.events.find(e=>e.stage==='after'));
    assert.throws(()=>f11Review(c),/consumption_without_settlement/);
  }
  const c=f11Capture();delete c.events.find(e=>e.stage==='after').ledger.find(e=>e.type==='consume:stake').roundId;
  assert.throws(()=>f11Review(c),/ledger_invalid/);
});

test('F11 requires complete shared snapshots and consistent ownership but permits player-specific projections',()=>{
  for(const key of ['contract','configVersion','windowId','turnSeq','round','shoe','plan','deadline','actionDeadline','owners','seatGen','bets']) {
    const c=f11Capture();for(const e of c.events.filter(e=>e.type==='frame'))delete e.frame.snapshot[key];
    assert.throws(()=>f11Review(c),/frame_invalid|snapshot_contract_incomplete/,key);
  }
  for(const key of ['owners','seatGen']) {
    const c=f11Capture(),s=c.events.find(e=>e.type==='frame'&&e.connectionId==='new').frame.snapshot;
    s[key][0]=key==='owners'?'22222222-2222-4222-8222-222222222222':2;
    assert.throws(()=>f11Review(c),/state_conflict/,key);
  }
  const c=f11Capture();for(const e of c.events.filter(e=>e.type==='frame')) {
    e.frame.snapshot.me.available=e.connectionId==='new'?5:10;
    e.frame.snapshot.serverNow=e.at;e.frame.snapshot.players=[{id:'11111111-1111-4111-8111-111111111111',online:e.connectionId==='new'}];
  }
  assert.equal(f11Review(c).acceptance,false);
});

test('F11 reconnect cannot conceal a regressed presentation behind a newer room version',()=>{
  const c=f11Capture(),e=c.events.find(e=>e.type==='frame'&&e.connectionId==='again');
  e.frame.snapshot.version=8;e.frame.snapshot.presentationVer=1;e.frame.presentation.ver=1;
  // Keep subsequent global room revisions distinct so the cross-connection reconnect gate must catch this.
  for(const row of c.events.filter(row=>row.type==='frame'&&row.at>e.at))row.frame.snapshot.version++;
  assert.throws(()=>f11Review(c),/continuous_overlap_not_proven/);
});

test('F11 observer cannot recover after rejected evidence or mutate an already consumed monetary sample',()=>{
  const c=f11Capture(),o=createF11Observer(c.manifest);
  assert.throws(()=>o.observe({type:'token-secret',at:0}),/event_type_invalid/);
  assert.throws(()=>o.observe(c.events[0]),/observer_poisoned/);
  const good=createF11Observer(c.manifest);
  for(const row of c.events) {good.observe(row);if(row.stage==='after')row.balances[0].balanceCents=1;}
  assert.equal(good.finish().acceptance,false);
});
test('F11 reports and errors omit credentials, cookie/header fields, dealer text and filesystem details',async()=>{
  const c=f11Capture(),secret='secret-never-in-receipt';
  c.manifest.cookie=secret;
  for(const e of c.events) {e.authorization=secret;if(e.type==='frame') {e.frame.headers={cookie:secret};e.frame.presentation.events.push({type:'speak',line:secret});}}
  const serialized=JSON.stringify(f11Review(c));assert.equal(serialized.includes(secret),false);assert.equal(serialized.includes('cookie'),false);
  const output=[];
  assert.equal(await runF11EvidenceCli(['--run','--manifest','m','--events','e'],{output:x=>output.push(x),size:async()=>{throw Error(secret);}}),1);
  assert.deepEqual(output.map(x=>JSON.parse(x)),[{status:'unverifiable',acceptance:false,code:'f11_evidence_unavailable'}]);
});
test('F11 help, absent --run and malformed arguments never read files or invoke external work',async()=>{
  for(const args of [[],['--help'],['--manifest','m','--events','e'],['--run','--help']]) {
    let reads=0;await runF11EvidenceCli(args,{read:()=>{reads++;throw Error('read');},size:()=>{reads++;throw Error('stat');},output:()=>{}});
    assert.equal(reads,0);
  }
});
test('F11 explicit offline CLI validates bounded evidence and keeps missing instance metadata unverifiable',async()=>{
  const c=f11Capture(),files={m:JSON.stringify(c.manifest),e:c.events.map(e=>JSON.stringify(e)).join('\n')},output=[];
  assert.equal(await runF11EvidenceCli(['--run','--manifest','m','--events','e'],{
    size:async path=>({size:files[path].length}),read:async path=>files[path],output:x=>output.push(x)}),0);
  assert.equal(JSON.parse(output[0]).acceptance,false);
  delete c.events.find(e=>e.type==='open').instanceProof;files.e=c.events.map(e=>JSON.stringify(e)).join('\n');
  assert.equal(await runF11EvidenceCli(['--run','--manifest','m','--events','e'],{
    size:async path=>({size:files[path].length}),read:async path=>files[path],output:x=>output.push(x)}),1);
  assert.deepEqual(JSON.parse(output.at(-1)),{status:'unverifiable',acceptance:false,code:'f11_instance_evidence_required'});
});

const livePlan=()=>({...F11_TARGET,schemaVersion:1,syntheticOnly:true,sha:'a'.repeat(40),runId:'f11-run',
  roomKey:'44444444-4444-4444-8444-444444444444',sourceLaneId:'existing-lane',gameConfig:{language:'en',limitPreset:'standard'},chip:5,durationMs:120000});
function creationPorts() {
  const plan=livePlan(),identity=f11FixtureIdentity(plan),calls=[],files=new Map();let read=0,clock=0;
  const ports={now:()=>clock,sleep:async ms=>{clock+=ms;},provider:async()=>({...F11_TARGET,source:'provider-api',engineSha:plan.sha,
    vercelSha:plan.sha,ready:true,suspended:false,healthStatus:200}),
    inspect:async()=>{calls.push('inspect');return ++read===1?{at:0,database:plan.database,sourceReady:true,unchangedHash:'a'.repeat(64),
      absent:{operators:0,accounts:0,rooms:0,packages:0}}:{at:clock,unchangedHash:'a'.repeat(64),room:{id:identity.roomId,
        operatorId:plan.runId,presentationLaneId:plan.sourceLaneId},packageRevision:1,configVersion:'config-1',roomCount:1,
        accounts:actors.map((actorId,i)=>({actorId,username:identity.usernames[i],createdAt:0,status:'active',balanceCents:100000,
          openings:[{id:`open-${i}`,type:'open',amountCents:100000,currency:'USD',at:new Date(0).toISOString(),sourceKey:null,fingerprint:null}]}))};},
    adminLogin:async()=>{calls.push('login');},
    http:async(_actor,method,path,body)=>{calls.push(`${method} ${path.split('?')[0]}`);
      if(path.endsWith('operator-create'))return {ok:true,operator:{id:plan.runId,slug:plan.runId,status:'active'},missingRoles:[]};
      if(method==='GET')return {ok:true,ready:true,operator:{id:plan.runId},presentationLaneId:plan.sourceLaneId,
        packageRevision:null,rooms:[],projectRevision:'project-1',administrationRevision:'admin-1'};
      assert.equal(body.operatorId,plan.runId);assert.equal(body.expectedPackageRevision,null);
      return {ok:true,duplicate:false,room:{id:identity.roomId,operatorId:plan.runId,presentationLaneId:plan.sourceLaneId},packageRevision:1,
        published:{configVersion:'config-1',packageRevision:1,gameConfig:plan.gameConfig}};},
    register:async(index,username)=>{calls.push(`register ${username}`);return {id:actors[index]};},
    save:async(name,value)=>{files.set(name,structuredClone(value));},progress:()=>{},close:async()=>{calls.push('closed');}};
  return {plan,identity,ports,calls,files,setClock:value=>{clock=value;}};
}

test('live F11 import/help/read and missing run flag never construct credentials or mutation ports',async()=>{
  let created=0,stdin=0;
  const options={read:async()=>JSON.stringify(livePlan()),input:{async *[Symbol.asyncIterator](){stdin++;yield '{}';}},
    output:()=>{},portsFactory:()=>{created++;assert.fail('network port');}};
  for(const args of [[],['--help'],['--read','plan'],['--run'],['--run','plan','--output','out']])await runF11PreviewCli(args,options);
  assert.equal(created,0);assert.equal(stdin,0);
  await assert.rejects(prepareF11Fixture(livePlan(),new Proxy({},{get:()=>assert.fail('port access')})),/explicit_run_required/);
  await assert.rejects(runF11Preview(livePlan(),null),/explicit_run_required/);
  await assert.rejects(createF11LivePorts({credentials:{}}),/explicit_run_required/);
});
test('F11 common HTTP transport satisfies the actual Studio login CSRF gate; missing Sec-Fetch-Site stops before SQL',async t=>{
  const plan=livePlan(),password='f11-fixture-password',salt='f11-fixture-salt';
  const account={id:'7',username:'f11-admin',role:'admin',salt,hash:scryptSync(password,salt,64).toString('hex')};
  let dbCalls=0;const requests=[];
  const boDb={transaction:work=>work(),prepare(sql){dbCalls++;return {
    all:async()=>{assert.ok(sql.includes('FROM users WHERE lower(username)'));return [account];},
    get:async()=>{if(sql==="SELECT v FROM meta WHERE k='jwt_secret'")return {v:'a'.repeat(64)};
      assert.equal(sql,'SELECT epoch FROM bo_auth_epochs WHERE user_id=?');return {epoch:0};}};}};
  const gameDb={prepare(sql){dbCalls++;assert.ok(sql.includes('FROM player_accounts'));return {all:async()=>[]};}};
  const actions=createStudioNativeAuthActions({boDb,gameDb,scope:{environment:plan.environment,workspaceId:plan.workspaceId},
    authorize:async()=>assert.fail('login must not authorize an existing session'),publicOrigin:plan.origin,
    rateLimit:async()=>true,clientAddress:()=> 'fixture-client'});
  const temp=await mkdtemp(join(tmpdir(),'f11-auth-contract-'));t.after(()=>rm(temp,{recursive:true,force:true}));
  const ports=await createF11LivePorts({run:true,plan,credentials:{admin:{user:account.username,pass:password},
    databaseUrl:`postgresql://fixture:synthetic@${plan.databaseHost}/${plan.database}?sslmode=require`},
    outputDirectory:join(temp,'output'),provenanceFile:join(temp,'provider.ndjson'),
    fetchImpl:async(url,init)=>{const request=new Request(url,init);requests.push(request.clone());
      if(new URL(url).pathname==='/studio/api/auth/login')return actions.handle(request);
      assert.equal(request.headers.get('sec-fetch-site'),'same-origin');return Response.json({ok:true});}});
  t.after(()=>ports.close());
  await ports.adminLogin();assert.ok(dbCalls>0);
  const login=requests[0],headers=new Headers(login.headers);headers.delete('sec-fetch-site');const before=dbCalls;
  const denied=await actions.handle(new Request(login.url,{method:'POST',headers,body:await login.text()}));
  assert.equal(denied.status,403);assert.equal(dbCalls,before);
  await ports.http('admin','POST','/studio/api/admin/operator-create',{slug:plan.runId,name:plan.runId});
  assert.equal(requests.length,2);assert.match(requests[1].headers.get('cookie'),/^bo_jwt=/);
});
test('live F11 binds API UUIDs to absence checks, exact SQL readback and a durable creation receipt',async()=>{
  const f=creationPorts(),result=await prepareF11Fixture(f.plan,f.ports,{run:true});
  assert.equal(f.calls[0],'inspect');assert.deepEqual(result.actors,actors);
  assert.equal(result.ownership.roomId,f.identity.roomId);assert.equal(result.ownership.operatorId,f.plan.runId);
  assert.deepEqual(f.files.get('creation.json').steps.map(row=>row.state),['requested','verified','requested','verified','requested','verified','requested','verified']);
  assert.ok(f.files.has('ownership.json'));
  const m={...f11Manifest(),roomId:f.identity.roomId,ownership:result.ownership};assert.doesNotThrow(()=>validateF11Manifest(m));
});
test('live F11 refuses existing fixtures before login, UUID collisions and wrong SQL identities',async()=>{
  const existing=creationPorts();existing.ports.inspect=async()=>({at:0,database:existing.plan.database,absent:{operators:1,accounts:0,rooms:0,packages:0}});
  await assert.rejects(prepareF11Fixture(existing.plan,existing.ports,{run:true}),/fixture_already_exists/);assert.deepEqual(existing.calls,[]);
  const collision=creationPorts();collision.ports.register=async()=>({id:actors[0]});
  await assert.rejects(prepareF11Fixture(collision.plan,collision.ports,{run:true}),/account_creation_unverified/);
  assert.equal(collision.files.get('creation.json').steps.at(-1).state,'requested');
  const wrong=creationPorts(),inspect=wrong.ports.inspect;let reads=0;
  wrong.ports.inspect=async()=>{const row=await inspect();if(++reads===2)row.accounts[0].actorId=actors[1];return row;};
  await assert.rejects(prepareF11Fixture(wrong.plan,wrong.ports,{run:true}),/account_readback_invalid/);
  const stale=creationPorts(),read=stale.ports.inspect;
  stale.ports.inspect=async()=>{const row=await read();if(row.configVersion)row.configVersion='different-published-config';return row;};
  await assert.rejects(prepareF11Fixture(stale.plan,stale.ports,{run:true}),/fixture_readback_invalid/);
});
test('F11 ownership reads real PostgreSQL package rows while raw administration has no rooms',async t=>{
  const {createPglitePool}=await import('./fixtures/pglite-pool.mjs');
  const pool=await createPglitePool();t.after(()=>pool.end());
  for(const file of ['001-studio-metadata.sql','005-operators.sql','023-operator-package-rooms.sql'])
    await pool.query(await readFile(new URL(`../ops/neon-studio/${file}`,import.meta.url),'utf8'));
  const f=creationPorts(),{plan,identity}=f,scope=[plan.environment,plan.workspaceId],dealer='fixture-dealer';
  const laneId=`room-lane-${receiptHash([plan.sourceLaneId,dealer]).slice(0,24)}`;
  const project={revision:'project-1',lanes:[{id:plan.sourceLaneId,layers:{dealer:{default:dealer}}}]};
  const administration={gameLanes:[{schemaVersion:1,id:laneId,label:'Fixture',renderer:'portrait-video',dealer,mediaCollection:`${dealer}-presentation`}]};
  for(const [kind,revision,value] of [['project','project-1',project],['administration','admin-1',administration]])
    await pool.query('INSERT INTO croupier_studio.documents(environment_id,workspace_id,kind,revision,value) VALUES($1,$2,$3,$4,$5)',[...scope,kind,revision,value]);
  const operator=id=>pool.query('INSERT INTO croupier_studio.operators VALUES($1,$2,$3,$3,$3,\'active\',0)',[...scope,id]);
  const room=(id,operatorId)=>({schemaVersion:2,id,name:id,operatorId,presentationLaneId:plan.sourceLaneId,gameLaneId:laneId,state:'live'});
  const ownRoom=room(identity.roomId,identity.operatorId),existingRoom=room('existing-room','existing');
  const pack=(owner,revision,rooms,branding={})=>pool.query(`INSERT INTO croupier_studio.operator_packages
    (environment_id,workspace_id,operator_id,package_revision,lanes,games,tables,branding,published_at_ms,rooms)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,0,$9)`,[...scope,owner,revision,JSON.stringify([plan.sourceLaneId]),'["blackjack"]',
      JSON.stringify((rooms??[]).map(row=>row.id)),JSON.stringify(branding),rooms===null?null:JSON.stringify(rooms)]);
  await operator('existing');await pack('existing',1,null);await pack('existing',2,[existingRoom]);
  const read=async()=>{
    const client=await pool.connect();
    try {await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');return await readF11Fixture(client,plan,identity,{now:f.ports.now});}
    finally {await client.query('ROLLBACK');await client.release();}
  };
  const before=await read();assert.deepEqual(before.absent,{operators:0,accounts:0,rooms:0,packages:0});
  assert.equal(before.roomCount,0);assert.equal(before.sourceReady,true);
  const api=f.ports.http;f.ports.inspect=read;
  f.ports.http=async(actor,method,path,body)=>{
    const response=await api(actor,method,path,body);
    if(path.endsWith('operator-create'))await operator(identity.operatorId);
    else if(method==='POST') {
      await pack(identity.operatorId,1,[ownRoom],{roomGameConfigVersions:{[identity.roomId]:'config-1'}});
      const config={configVersion:'config-1',roomId:identity.roomId,operatorId:identity.operatorId,packageRevision:1,
        presentationLaneId:plan.sourceLaneId,...plan.gameConfig};
      await pool.query('INSERT INTO croupier_game.shared_table_configs VALUES($1,$2,$3)',[identity.roomId,'config-1',JSON.stringify(config)]);
      await pool.query('INSERT INTO croupier_game.shared_table_config_heads VALUES($1,$2)',[identity.roomId,'config-1']);
      // The real repository changes document revision while stripping the derived
      // rooms view; its persisted value remains unchanged for this new own room.
      await pool.query("UPDATE croupier_studio.documents SET revision='admin-2' WHERE environment_id=$1 AND workspace_id=$2 AND kind='administration'",scope);
    }
    f.setClock(20);return response;
  };
  f.ports.register=async(index,username)=>{
    const id=actors[index],at=new Date(10).toISOString();
    await pool.query('INSERT INTO croupier_game.players(id,name,created_at) VALUES($1,$2,$3)',[id,username,at]);
    await pool.query('INSERT INTO croupier_game.player_accounts VALUES($1,$2,$3,$4)',[`username:${username}`,id,'fixture-salt','fixture-hash']);
    await pool.query("INSERT INTO croupier_game.transactions(player_id,type,amount,currency,at) VALUES($1,'open',1000,'USD',$2)",[id,at]);return {id};
  };
  const result=await prepareF11Fixture(plan,f.ports,{run:true}),after=await read();
  assert.deepEqual(after.room,ownRoom);assert.equal(after.packageRevision,1);assert.equal(after.configVersion,'config-1');
  assert.equal(after.unchangedHash,before.unchangedHash);assert.equal(result.ownership.readback.roomCount,1);
  assert.equal(result.ownership.readback.packageRevision,1);assert.equal(result.ownership.accounts.length,2);
  const raw=(await pool.query("SELECT value FROM croupier_studio.documents WHERE environment_id=$1 AND workspace_id=$2 AND kind='administration'",scope)).rows[0].value;
  assert.equal(Object.hasOwn(raw,'rooms'),false);
  for(const mutation of [
    "UPDATE croupier_studio.documents SET value=value||'{\"changed\":true}'::jsonb WHERE kind='administration'",
    "UPDATE croupier_studio.operator_packages SET rooms=jsonb_set(rooms::jsonb,'{0,name}','\"changed existing room\"')::text WHERE operator_id='existing' AND package_revision=2"
  ]) {
    const client=await pool.connect();try {
      await client.query('BEGIN');await client.query(mutation);
      const changed=await readF11Fixture(client,plan,identity);assert.notEqual(changed.unchangedHash,before.unchangedHash);
    } finally {await client.query('ROLLBACK');await client.release();}
  }
  for(const mutation of [
    "UPDATE croupier_game.shared_table_configs SET body=jsonb_set(body::jsonb,'{packageRevision}','2')::text",
    "UPDATE croupier_studio.operator_packages SET branding='{\"roomGameConfigVersions\":{}}' WHERE operator_id=$1",
    "UPDATE croupier_studio.operator_packages SET rooms=jsonb_set(rooms::jsonb,'{0,operatorId}','\"other-owner\"')::text WHERE operator_id=$1"
  ]) {
    const client=await pool.connect();try {
      await client.query('BEGIN');await client.query(mutation,mutation.includes('$1')?[identity.operatorId]:undefined);
      await assert.rejects(readF11Fixture(client,plan,identity),error=>['f11_fixture_readback_invalid','studio_corrupt_operator'].includes(error.code));
    } finally {await client.query('ROLLBACK');await client.release();}
  }
  await pack(identity.operatorId,2,[]);
  const superseded=await read();assert.equal(superseded.roomCount,0);assert.equal(superseded.room,undefined);
  assert.equal(superseded.absent.packages,2,'historical packages still prohibit reusing the fixture identity');
});
test('F11 opening transactions are retained, exact and mandatory in every monetary sample',()=>{
  for(const change of [row=>row.ledger.shift(),row=>{row.ledger[0].amountCents=1;},row=>{row.ledger[0].actorId=actors[1];},
    row=>{row.ledger[0].sourceKey='invented';},row=>{row.ledger.push({...row.ledger[0],id:'extra-open'});}]) {
    const c=f11Capture();change(c.events.find(row=>row.type==='money'&&row.stage==='during'));
    assert.throws(()=>f11Review(c),/opening_ledger/);
  }
  const m=f11Manifest();m.ownership.accounts[0].cookie='private';
  const {digest,...rest}=m.ownership;m.ownership.digest=receiptHash(rest);
  assert.throws(()=>validateF11Manifest(m),/ownership_accounts_invalid/);
  const mismatch=f11Capture();mismatch.events.find(row=>row.type==='money'&&row.stage==='during').balances[0].balanceCents++;
  assert.throws(()=>f11Review(mismatch),/balance_mismatch/);
});
test('F11 read-only SQL returns actual room revisions, owners and scoped membership generations',async t=>{
  const {createPglitePool}=await import('./fixtures/pglite-pool.mjs');const pool=await createPglitePool();t.after(()=>pool.end());
  const roomId=f11Manifest().roomId,owners=[...actors,null,null,null,null,null];
  const read=async()=>{const client=await pool.connect();try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');return (await client.query(F11_MONEY_SQL,[roomId,actors])).rows[0];
  } finally {await client.query('ROLLBACK');await client.release();}};
  const empty=await read();assert.equal(empty.roomHead,null);assert.deepEqual(empty.members,[]);
  for(const actor of actors) {
    await pool.query('INSERT INTO croupier_game.players(id,name,created_at) VALUES($1,$1,$2)',[actor,new Date(0).toISOString()]);
    await pool.query('INSERT INTO croupier_game.shared_table_members(room_id,player_id,active,body) VALUES($1,$2,true,$3)',
      [roomId,actor,JSON.stringify({roomId,actorId:actor,active:true,memberGen:1})]);
  }
  await pool.query('INSERT INTO croupier_game.shared_table_rooms(room_id,body) VALUES($1,$2)',
    [roomId,JSON.stringify({roomId,version:27,presentationVer:13,owners})]);
  const active=await read();assert.deepEqual(active.roomHead,{version:27,presentationVer:13,owners});
  assert.deepEqual(active.members,actors.map(actorId=>({actorId,active:true,memberGen:1})));
  await pool.query("UPDATE croupier_game.shared_table_members SET active=false,body=jsonb_set(body::jsonb,'{memberGen}','2')::text WHERE room_id=$1",[roomId]);
  await pool.query('UPDATE croupier_game.shared_table_rooms SET body=$2 WHERE room_id=$1',
    [roomId,JSON.stringify({roomId,version:29,presentationVer:13,owners:Array(7).fill(null)})]);
  const left=await read();assert.deepEqual(left.members,actors.map(actorId=>({actorId,active:false,memberGen:2})));
  assert.equal(left.roomHead.version,29);assert.ok(left.roomHead.owners.every(owner=>owner===null));
  assert.equal(left.hands,0);assert.deepEqual(left.reservations,[]);
});
test('F11 DB and provider inputs pin the exact endpoint, database and frozen deployment without cloud credentials',()=>{
  const valid=`postgresql://fixture:synthetic@${F11_TARGET.databaseHost}/${F11_TARGET.database}?sslmode=require`;
  assert.equal(new URL(validateF11DatabaseUrl(valid)).hostname,F11_TARGET.databaseHost);
  for(const value of [valid.replace(F11_TARGET.database,'production'),valid.replace(F11_TARGET.databaseHost,'localhost'),
    valid.replace('sslmode=require','sslmode=disable'),`${valid}&host=evil.invalid`,`${valid}&sslrootcert=secret`])
    assert.throws(()=>validateF11DatabaseUrl(value),/database_target_invalid/);
  const p=livePlan(),receipt={source:'provider-api-capture',at:1,service:{id:p.serviceId,branch:'preview',suspended:'not_suspended',serviceDetails:{url:p.engineOrigin}},
    deployment:{id:'dep-test',serviceId:p.serviceId,status:'live',commit:{id:p.sha}},vercel:{id:'dpl_test',projectId:p.projectId,readyState:'READY',meta:{githubCommitSha:p.sha}}};
  assert.equal(f11ProviderReceipt(receipt,p,1).engineSha,p.sha);
  for(const r of [{...receipt,at:-60000},{...receipt,service:{...receipt.service,id:'production'}},
    {...receipt,deployment:{...receipt.deployment,commit:{id:'b'.repeat(40)}}}])assert.throws(()=>f11ProviderReceipt(r,p,1),/provider_receipt_invalid/);
});
test('F11 provenance binds the real socket to public listening and drain on the same gateway tuple',()=>{
  const p=livePlan(),c={at:1,processId:actors[0],nonce:actors[1],closeCode:1012,closedAt:99576},receipt=provenanceBundle(c);
  assert.equal(correlateF11Log(receipt,c,p).instanceId,`${p.serviceId}-old`);
  const modify=(r,index,change)=>{const payload=JSON.parse(r.gateway[index].log.message);change(payload);r.gateway[index].log.message=JSON.stringify(payload);};
  for(const mutate of [r=>{r.socket.log.labels[0].value='other';},r=>{r.socket.log.message='{}';},r=>{r.socket.log.labels[1].value='old';},
    r=>{r.socket.deployment.commit.id='b'.repeat(40);},r=>{r.gateway=[];},r=>{r.gateway.pop();},
    r=>modify(r,0,p=>{p.binding.address='127.0.0.1';}),r=>modify(r,0,p=>{p.binding.port=31000;}),
    r=>modify(r,1,p=>{p.listenerId=1;}),r=>modify(r,1,p=>{p.runtimeId=actors[1];}),
    r=>modify(r,1,p=>{p.instanceId='different-full-pod';}),r=>modify(r,1,p=>{p.commitSha='b'.repeat(40);}),
    r=>{r.gateway[1].log.labels[1].value=`${p.serviceId}-different`;},
    r=>{modify(r,1,p=>{p.at=new Date(0).toISOString();});r.gateway[1].log.timestamp=new Date(0).toISOString();},
    r=>{modify(r,0,p=>{p.at=new Date(2).toISOString();});r.gateway[0].log.timestamp=new Date(2).toISOString();}]) {
    const r=structuredClone(receipt);mutate(r);assert.throws(()=>correlateF11Log(r,c,p),/f11_/);
  }
  const withStartup=structuredClone(receipt),startup=structuredClone(receipt.gateway);
  for(const row of startup) {const payload=JSON.parse(row.log.message);payload.listenerId=1;payload.at=new Date(0).toISOString();
    if(payload.binding)payload.binding.address='127.0.0.1';row.log.message=JSON.stringify(payload);row.log.id+='-startup';row.log.timestamp=payload.at;}
  withStartup.gateway.unshift(...startup);
  assert.equal(correlateF11Log(withStartup,c,p).gateway.draining.at,90000);
});
test('F11 live provenance port reads complete original socket and lifecycle rows without network access',async t=>{
  const plan=livePlan(),connection={at:1,processId:actors[0],nonce:actors[1],closeCode:1012,closedAt:99576};
  const bundle=provenanceBundle(connection),temp=await mkdtemp(join(tmpdir(),'f11-provenance-'));
  t.after(()=>rm(temp,{recursive:true,force:true}));const provenanceFile=join(temp,'provider.ndjson');
  await writeFile(provenanceFile,[bundle.socket,...bundle.gateway].map(row=>JSON.stringify(row)).join('\n')+'\n{"incomplete":');
  const ports=await createF11LivePorts({run:true,plan,credentials:{admin:{user:'fixture',pass:'synthetic'},
    databaseUrl:`postgresql://fixture:synthetic@${plan.databaseHost}/${plan.database}?sslmode=require`},
    outputDirectory:join(temp,'output'),provenanceFile,fetchImpl:async()=>assert.fail('network access')});
  t.after(()=>ports.close());const actual=await ports.provenance(connection);
  assert.deepEqual(actual,bundle);assert.equal(correlateF11Log(actual,connection,plan).gateway.draining.at,90000);
});
test('F11 commands retain actual generations, turn sequence and deadlines and stop new bets while draining',()=>{
  const s={...f11Capture().events.find(row=>row.type==='frame').frame.snapshot,serverNow:100,me:{id:actors[0],active:true,memberGen:4},
    players:[{id:actors[0],ready:false}],settings:{chips:[5],limits:{min:5,max:100}},deadline:20000};
  assert.deepEqual(nextF11Command(s,{seat:0,chip:5}),{op:'bet',windowId:s.windowId,seat:0,field:'main',chip:5});
  assert.deepEqual(nextF11Command(s,{seat:0,chip:5,draining:true}),{op:'leave',memberGen:4});
  for(const phase of ['bets','settled'])for(const ready of [false,true]) {
    const waiting={...s,phase,players:[{id:actors[0],ready}],bets:s.bets.map((bet,i)=>i?bet:{...bet,main:5})};
    assert.deepEqual(nextF11Command(waiting,{seat:0,chip:5,draining:true}),{op:'leave',memberGen:4});
  }
  const hand={...s,phase:'round',roundId:'round-own',turnSeq:8,plan:{turnAt:200},actionDeadline:500,
    round:{active:0,hands:[{box:0}],legalActions:['stand']}};
  assert.equal(nextF11Command(hand,{seat:0,chip:5}),null);
  assert.deepEqual(nextF11Command(hand,{seat:0,chip:5,elapsedMs:101}),{op:'act',roundId:'round-own',turnSeq:8,box:0,handIndex:0,action:'stand'});
  assert.equal(nextF11Command(hand,{seat:0,chip:5,elapsedMs:500}),null);assert.equal(hand.serverNow,100);
});

// Replay captured public state through independently injectable clock/socket/SQL
// ports. No server, credentials, dependency installation or external I/O.
function runningPorts({restart=true}={}) {
  const f=creationPorts(),source=f11Capture(),sockets=[],commands=[],progress=[],processes=[actors[0],actors[1]];
  let clock=0,nonce=0,lastVersion=null,failedOnce=false;const left=[false,false];
  const frameAt=()=>source.events.filter(row=>row.type==='frame'&&row.frame.snapshot.version<=9&&row.at<=clock).at(-1)?.frame??source.events.find(row=>row.type==='frame').frame;
  const state=index=>{const frame=structuredClone(frameAt());frame.roomId=f.identity.roomId;frame.snapshot.roomId=f.identity.roomId;
    frame.snapshot.version+=left.filter(Boolean).length;frame.snapshot.owners=frame.snapshot.owners.map(owner=>left[actors.indexOf(owner)]?null:owner);
    frame.presentation.roomId=f.identity.roomId;frame.snapshot.me={id:actors[index],active:!left[index],memberGen:left[index]?2:1,seats:left[index]?[]:[index]};
    frame.snapshot.serverNow=clock;frame.snapshot.settings={configVersion:'config-1',language:'en',betMs:20000,actionMs:15000,refill:1000,chips:[5],limits:{min:5,max:100,sideMax:5}};
    frame.snapshot.players=actors.map(id=>({id,ready:false,leaving:false,online:true,seats:[]}));return frame;};
  const send=c=>c.callbacks.frame(state(c.index));
  f.ports.now=()=>clock;f.ports.progress=value=>progress.push(value);
  f.ports.sleep=async ms=>{
    clock+=ms;f.setClock(clock);
    const current=frameAt().snapshot.version;
    if(current!==lastVersion){lastVersion=current;for(const c of sockets)if(!c.closed)send(c);}
    if(restart&&clock>=90000)for(const c of sockets)if(!c.closed&&c.index===0&&c.processId===processes[0]){c.closed=true;c.callbacks.close(1012);}
  };
  f.ports.socket=async(index,_room,callbacks)=>{
    const processId=restart&&clock>=50000?processes[1]:processes[0],socketNonce=`00000000-0000-4000-8000-${String(++nonce).padStart(12,'0')}`;
    const c={index,processId,closed:false,callbacks};sockets.push(c);callbacks.identity(`v1.${processId}.${socketNonce}`);send(c);
    return {close:async()=>{if(!c.closed){c.closed=true;callbacks.close(1000);}}};
  };
  f.ports.command=async(index,roomId,body)=>{assert.equal(roomId,f.identity.roomId);commands.push({index,...structuredClone(body)});
    if(!failedOnce){failedOnce=true;throw Error('unknown outcome');}
    if(body.op==='leave') {left[index]=true;f.calls.push(`leave:${index}`);for(const c of sockets)if(!c.closed)send(c);
      return {status:200,body:{snapshot:state(index).snapshot}};}
    return {status:409,body:{}};};
  f.ports.money=async()=>{
    const base=structuredClone(source.events.find(row=>row.type==='money'&&row.stage===(clock>=120000?'after':'before')));
    for(const row of base.ledger)if(row.sourceKey){const key=JSON.parse(row.sourceKey);key[1]=f.identity.roomId;row.sourceKey=JSON.stringify(key);}
    const snapshot=state(0).snapshot;if(left.every(Boolean))f.calls.push('sql:cleared');
    return {...base,members:sockets.length?actors.map((actorId,i)=>({actorId,active:!left[i],memberGen:left[i]?2:1})):[],
      roomHead:sockets.length?{version:snapshot.version,presentationVer:snapshot.presentationVer,owners:snapshot.owners}:null,
      hands:clock>=20000&&clock<100000?2:0,
      reservations:clock>=50000&&clock<60000?[{id:'own-hold',actorId:actors[0],amountCents:500}]:[]};
  };
  f.ports.negative=async()=>{clock++;return {connectionId:`negative-${++nonce}`,status:403,stateFrames:0};};
  f.ports.revoke=async()=>{assert.ok(left.every(Boolean));assert.ok(f.calls.includes('sql:cleared'));f.calls.push('logout');};
  f.ports.provenance=async c=>provenanceBundle(c);
  return {...f,sockets,commands,progress,getClock:()=>clock};
}
test('F11 driver captures two sockets, preserves ambiguous command IDs and closes only its ports',async()=>{
  const f=runningPorts(),result=await runF11Preview(f.plan,f.ports,{run:true});
  assert.equal(result.status,'evidence-complete-review-required',JSON.stringify(result));assert.equal(result.acceptance,false);
  const retries=f.commands.filter(row=>row.index===0);assert.equal(retries[0].commandId,retries[1].commandId);
  assert.ok(f.progress.some(row=>row.status==='awaiting-external-restart'));assert.ok(f.sockets.every(c=>c.closed));assert.equal(f.calls.at(-1),'closed');
  assert.ok(f.files.has('capture.ndjson'));assert.ok(f.files.has('manifest.json'));
  assert.ok(f.calls.indexOf('leave:0')<f.calls.indexOf('sql:cleared'));
  assert.ok(f.calls.indexOf('leave:1')<f.calls.indexOf('sql:cleared'));
  assert.ok(f.calls.indexOf('sql:cleared')<f.calls.indexOf('logout'));
});
test('F11 timeout without external restart is unverifiable and releases its own resources',async()=>{
  const f=runningPorts({restart:false}),result=await runF11Preview(f.plan,f.ports,{run:true});
  assert.equal(result.acceptance,false);assert.equal(result.code,'f11_restart_not_observed');
  assert.ok(f.getClock()<=165000);assert.ok(f.sockets.every(c=>c.closed));assert.equal(f.calls.at(-1),'closed');
  assert.ok(f.files.has('creation.json'));assert.ok(f.files.has('review.json'));
});
test('F11 refuses logout when money is clear but SQL membership remains active',async()=>{
  const f=runningPorts(),money=f.ports.money;f.ports.money=async()=>{const row=await money();
    if(row.members.length)row.members[1].active=true;return row;};
  const result=await runF11Preview(f.plan,f.ports,{run:true});
  assert.equal(result.code,'f11_own_fixture_needs_settlement');assert.equal(result.acceptance,false);
  assert.ok(!f.calls.includes('logout'));assert.ok(f.sockets.every(c=>c.closed));
});
test('F11 a mid-run read failure stops betting, drains only its fixture and sanitizes the error',async()=>{
  const f=runningPorts(),money=f.ports.money;let reads=0,closed=0;
  f.ports.money=async()=>{if(++reads===2)throw Error('private-connection-secret');return money();};
  f.ports.close=async()=>{closed++;};
  const result=await runF11Preview(f.plan,f.ports,{run:true});
  assert.equal(result.status,'unverifiable');assert.equal(result.acceptance,false);assert.equal(result.obligationsCleared,true);
  assert.equal(closed,1);assert.ok(f.sockets.every(c=>c.closed));
  assert.ok(f.files.get('connections.json').every(row=>row.processId&&row.connectionNonce&&row.closedAt!==null));
  assert.equal(JSON.stringify([...f.files]).includes('private-connection-secret'),false);
});

let sequence = 0;
const fresh = () => import(`../services/game/shared-room-qa-context.mjs?case=${++sequence}`);
const expected = () => ({ host: '127.0.0.1', port: 35432, database: 'croupier_qa_k04', role: 'studio_qa', systemIdentifier: '7561234567890123456' });
const inert = () => assert.fail('Startup identity verification must not invoke policy, auth, media or database mutation ports');
function fixture() {
  const target = expected(), calls = [];
  const row = { address: target.host, port: target.port, database: target.database, role: target.role,
    session_role: target.role, listeners: target.host, system_identifier: target.systemIdentifier };
  const pool = { options: { host: target.host, port: target.port, database: target.database, user: target.role, connectionTimeoutMillis: 5000 },
    connect: inert, async query(query) { calls.push(query); return { rows: [row] }; } };
  const storage = { pool, gamePool: { query: inert, connect: inert }, db: { prepare: inert, assertInstalled: inert }, boDb: { prepare: inert } };
  const scope = { environment: 'test', workspaceId: 'shared-qa-k04' };
  const studioPolicyRuntime = { scope, repository: { scope: { ...scope }, sharedTransaction: inert },
    policy: { readSaved: inert, projectStore: inert, readGameConfiguration: inert } };
  const studioMediaRuntime = Object.fromEntries(['videoRegistry', 'videoResponse', 'videoRegistryCaptured', 'videoResponseCaptured', 'publicMediaResponse', 'hasPublicMedia', 'readMetadata'].map(name => [name, inert]));
  return { pool, expected: target, httpPort: 34173, storage, studioPolicyRuntime, studioMediaRuntime, privateMedia: inert, row, calls };
}
async function withEnv(values, work) {
  const previous = process.env;
  process.env = { PATH: previous.PATH, SystemRoot: previous.SystemRoot, ...values };
  try { return await work(); } finally { process.env = previous; }
}
const denied = async (module, value, code) => {
  await assert.rejects(module.registerSharedRoomQaContext(value), { code });
  assert.throws(() => module.consumeSharedRoomQaContext(), { code: 'shared_room_qa_context_unavailable' });
};

test('ordinary startup has no QA ports and seals a later registration, even with a QA-looking environment flag', async () => withEnv({ CROUPIER_SHARED_ROOM_QA: '1' }, async () => {
  const m = await fresh(), f = fixture();
  assert.equal(m.consumeSharedRoomQaContext(), null); assert.equal(m.consumeSharedRoomQaContext(), null);
  await assert.rejects(m.registerSharedRoomQaContext(f), { code: 'shared_room_qa_already_registered' }); assert.equal(f.calls.length, 0);
}));

test('verified one-use context preserves actual ports and publishes only the explicit loopback listener', async () => withEnv({}, async () => {
  const m = await fresh(), f = fixture();
  assert.equal(await m.registerSharedRoomQaContext(f), undefined);
  const context = m.consumeSharedRoomQaContext();
  for (const name of ['storage', 'studioPolicyRuntime', 'studioMediaRuntime', 'privateMedia']) assert.equal(context[name], f[name]);
  assert.equal(context.host, '127.0.0.1'); assert.equal(context.port, f.httpPort); assert.equal(context.publicOrigin, 'http://127.0.0.1:34173');
  assert.deepEqual(context.target, f.expected); assert.ok(Object.isFrozen(context)); assert.ok(Object.isFrozen(context.target));
  assert.equal(f.calls.length, 1); assert.match(f.calls[0].text, /^SELECT /); assert.match(f.calls[0].text, /pg_control_system\(\)/);
  assert.equal(f.calls[0].query_timeout, 5000);
  assert.throws(() => m.consumeSharedRoomQaContext(), { code: 'shared_room_qa_context_unavailable' });
  await assert.rejects(m.registerSharedRoomQaContext(f), { code: 'shared_room_qa_already_registered' });
}));

test('a dedicated synthetically named QA role is accepted without changing its pool', async () => withEnv({}, async () => {
  const m = await fresh(), f = fixture(); f.expected.role = f.pool.options.user = f.row.role = f.row.session_role = 'croupier_qa_k04';
  await m.registerSharedRoomQaContext(f); assert.equal(m.consumeSharedRoomQaContext().storage.pool, f.pool);
}));

test('remote, DNS, socket and wildcard targets fail before any SQL query', async () => withEnv({}, async () => {
  for (const host of ['localhost', '::1', '/tmp/pg', '0.0.0.0', '127.0.0.2', 'fixture.neon.tech']) {
    const m = await fresh(), f = fixture(); f.expected.host = host;
    await denied(m, f, 'shared_room_qa_loopback_required'); assert.equal(f.calls.length, 0);
  }
}));

test('production database or role, incomplete identity and unspecified listener are refused before SQL', async () => withEnv({}, async () => {
  for (const [key, value] of [['database', 'croupier_game'], ['database', 'postgres'], ['database', 'croupier_qa_'], ['role', 'croupier_game'],
    ['systemIdentifier', null], ['systemIdentifier', ''], ['systemIdentifier', 7561234567890123456], ['systemIdentifier', '12'], ['extra', true]]) {
    const m = await fresh(), f = fixture(); f.expected[key] = value;
    await denied(m, f, 'shared_room_qa_target_invalid'); assert.equal(f.calls.length, 0);
  }
  for (const httpPort of [0, 80, 65536, '34173', 35432]) {
    const m = await fresh(), f = fixture(); f.httpPort = httpPort;
    await denied(m, f, 'shared_room_qa_loopback_required'); assert.equal(f.calls.length, 0);
  }
}));

test('pool routing overrides, alternate connections and unbounded connection waits cannot hide behind expected metadata', async () => withEnv({}, async () => {
  for (const [key, value] of [['host', 'localhost'], ['host', '/tmp/pg'], ['port', 35433], ['database', 'croupier_game'], ['user', 'croupier_game'],
    ['connectionString', 'postgresql://redacted.invalid/db'], ['hostaddr', '127.0.0.1'], ['service', 'remote'], ['stream', {}], ['ssl', {}],
    ['connectionTimeoutMillis', 0], ['connectionTimeoutMillis', undefined], ['connectionTimeoutMillis', 10001]]) {
    const m = await fresh(), f = fixture(); f.pool.options[key] = value;
    await denied(m, f, 'shared_room_qa_pool_target_invalid'); assert.equal(f.calls.length, 0);
  }
}));

test('actual server identity must match every independently expected field and loopback listener', async () => withEnv({}, async () => {
  for (const [key, value] of [['address', '10.0.0.1'], ['address', null], ['port', 35433], ['database', 'croupier_game'], ['role', 'other'],
    ['session_role', 'croupier_game'], ['listeners', '*'], ['listeners', 'localhost'], ['system_identifier', '7561234567890123457']]) {
    const m = await fresh(), f = fixture(); f.row[key] = value;
    await denied(m, f, 'shared_room_qa_identity_mismatch'); assert.equal(f.calls.length, 1);
  }
  for (const rows of [[], [{}, {}]]) {
    const m = await fresh(), f = fixture(); f.pool.query = async () => ({ rows });
    await denied(m, f, 'shared_room_qa_identity_mismatch');
  }
}));

test('real process environment rejects production and provider execution despite a supplied fake env option', async () => {
  for (const [name, value, code] of [['NODE_ENV', 'production', 'shared_room_qa_production_process'], ['CROUPIER_CLOUD_RUNTIME', '1', 'shared_room_qa_production_process'], ['CROUPIER_STUDIO_ENVIRONMENT_ID', 'production', 'shared_room_qa_production_process'], ['RENDER', 'true', 'shared_room_qa_provider_process'],
    ['VERCEL', '1', 'shared_room_qa_provider_process'], ['FLY_APP_NAME', 'qa-app', 'shared_room_qa_provider_process'], ['K_SERVICE', 'qa', 'shared_room_qa_provider_process']]) {
    await withEnv({ [name]: value }, async () => {
      const m = await fresh(), f = fixture(); await denied(m, { ...f, env: {} }, code); assert.equal(f.calls.length, 0);
    });
  }
});

test('cloud credentials and inherited PG routing are refused without including their values in errors', async () => {
  for (const name of ['BLOB_READ_WRITE_TOKEN', 'NEON_API_KEY', 'AWS_ACCESS_KEY_ID', 'OPENAI_API_KEY', 'DATABASE_URL', 'PGHOST', 'PGPASSWORD',
    'CROUPIER_GAME_DATABASE_URL', 'CROUPIER_INGRESS_SECRET', 'CUSTOM_SERVICE_CREDENTIAL']) {
    await withEnv({ [name]: 'redacted-test-value' }, async () => {
      const m = await fresh(), f = fixture(); await denied(m, f, 'shared_room_qa_cloud_credentials'); assert.equal(f.calls.length, 0);
    });
  }
});

test('production scope, missing test marker or mismatched repository scope never reaches SQL', async () => withEnv({}, async () => {
  for (const mutate of [f => { f.studioPolicyRuntime.scope.environment = 'production'; }, f => { f.studioPolicyRuntime.scope.workspaceId = 'live'; },
    f => { f.studioPolicyRuntime.repository.scope.workspaceId = 'shared-qa-other'; }, f => { f.studioPolicyRuntime.scope.extra = true; }]) {
    const m = await fresh(), f = fixture(); mutate(f); await denied(m, f, 'shared_room_qa_scope_invalid'); assert.equal(f.calls.length, 0);
  }
}));

test('storage pool identity and required real application ports are checked without invoking them', async () => withEnv({}, async () => {
  for (const [mutate, code] of [[f => { f.storage.pool = { ...f.pool }; }, 'shared_room_qa_storage_invalid'],
    [f => { f.storage.boDb.prepare = null; }, 'shared_room_qa_storage_invalid'], [f => { f.studioPolicyRuntime.policy.readSaved = null; }, 'shared_room_qa_policy_invalid'],
    [f => { f.studioMediaRuntime.videoRegistryCaptured = null; }, 'shared_room_qa_media_invalid'], [f => { f.privateMedia = null; }, 'shared_room_qa_media_invalid']]) {
    const m = await fresh(), f = fixture(); mutate(f); await denied(m, f, code); assert.equal(f.calls.length, 0);
  }
}));

test('SQL failures are sanitized, keep the context closed and cannot be retried into a grant', async () => withEnv({}, async () => {
  const m = await fresh(), f = fixture(); f.pool.query = async () => { throw Error('redacted-test-database-detail'); };
  await denied(m, f, 'shared_room_qa_identity_unavailable');
  await assert.rejects(m.registerSharedRoomQaContext(f), { code: 'shared_room_qa_already_registered' });
}));

test('consume before asynchronous identity verification completes poisons that registration', async () => withEnv({}, async () => {
  const m = await fresh(), f = fixture(); let release;
  f.pool.query = () => new Promise(resolve => { release = () => resolve({ rows: [f.row] }); });
  const registering = m.registerSharedRoomQaContext(f); registering.catch(() => {});
  assert.throws(() => m.consumeSharedRoomQaContext(), { code: 'shared_room_qa_context_unavailable' });
  release(); await assert.rejects(registering, { code: 'shared_room_qa_startup_race' });
  assert.throws(() => m.consumeSharedRoomQaContext(), { code: 'shared_room_qa_context_unavailable' });
}));

test('guards run again after SQL and at consume, before yielding ports', async () => withEnv({}, async () => {
  for (const when of ['during-query', 'before-consume']) {
    const m = await fresh(), f = fixture();
    if (when === 'during-query') f.pool.query = async () => { process.env.RENDER = 'true'; return { rows: [f.row] }; };
    try {
      if (when === 'during-query') await denied(m, f, 'shared_room_qa_provider_process');
      else { await m.registerSharedRoomQaContext(f); process.env.RENDER = 'true'; assert.throws(() => m.consumeSharedRoomQaContext(), { code: 'shared_room_qa_provider_process' }); }
    } finally { delete process.env.RENDER; }
  }
  for (const mutate of [f => { f.pool.options.host = 'remote.invalid'; }, f => { f.studioPolicyRuntime.scope.environment = 'production'; },
    f => { f.studioMediaRuntime.videoResponse = null; }]) {
    const m = await fresh(), f = fixture(); await m.registerSharedRoomQaContext(f); mutate(f);
    assert.throws(() => m.consumeSharedRoomQaContext(), /shared_room_qa_/);
    assert.throws(() => m.consumeSharedRoomQaContext(), { code: 'shared_room_qa_context_unavailable' });
  }
}));


test('independent identity assertion can precede fixture construction without registering any app ports', async () => withEnv({}, async () => {
  const m = await fresh(), f = fixture();
  const target = await m.assertSharedRoomQaIdentity({ pool: f.pool, expected: f.expected });
  assert.deepEqual(target, f.expected); assert.notEqual(target, f.expected); assert.ok(Object.isFrozen(target)); assert.equal(f.calls.length, 1);
  assert.equal(m.consumeSharedRoomQaContext(), null);
}));

test('identity assertion rejects remote targets and changed actual clusters before any fixture grant', async () => withEnv({}, async () => {
  const m = await fresh(), f = fixture();
  f.pool.options.host = 'remote.invalid';
  await assert.rejects(m.assertSharedRoomQaIdentity({ pool: f.pool, expected: f.expected }), { code: 'shared_room_qa_pool_target_invalid' });
  assert.equal(f.calls.length, 0); f.pool.options.host = '127.0.0.1'; f.row.system_identifier = '7561234567890123457';
  await assert.rejects(m.assertSharedRoomQaIdentity({ pool: f.pool, expected: f.expected }), { code: 'shared_room_qa_identity_mismatch' });
  assert.equal(m.consumeSharedRoomQaContext(), null);
}));

test('registration rechecks actual identity after a successful pre-fixture assertion', async () => withEnv({}, async () => {
  const m = await fresh(), f = fixture(); await m.assertSharedRoomQaIdentity({ pool: f.pool, expected: f.expected });
  f.row.database = 'croupier_game'; await denied(m, f, 'shared_room_qa_identity_mismatch'); assert.equal(f.calls.length, 2);
}));


test('the consumed storage cannot exchange the identity-verified pool for a lookalike after registration', async () => withEnv({}, async () => {
  const m = await fresh(), f = fixture(); await m.registerSharedRoomQaContext(f);
  f.storage.pool = { ...f.pool, options: { ...f.pool.options } };
  assert.throws(() => m.consumeSharedRoomQaContext(), { code: 'shared_room_qa_storage_invalid' });
  assert.throws(() => m.consumeSharedRoomQaContext(), { code: 'shared_room_qa_context_unavailable' });
}));
