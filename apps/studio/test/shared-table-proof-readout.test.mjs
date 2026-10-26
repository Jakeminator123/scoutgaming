import test from 'node:test';
import assert from 'node:assert/strict';
import { createSharedTableProofReadout } from '../lib/shared-table-proof-readout.mjs';
import { openProof, replayShuffle } from '../../../services/game/games/blackjack/shoe-proof.mjs';
import { chainRow, GENESIS } from '../../../services/game/games/blackjack/table/audit-chain.mjs';
import { createTableCoordinator } from '../../../services/game/games/blackjack/table/coordinator.mjs';
import { createMemoryTableStore } from '../../../test/fixtures/blackjack-table-memory-store.mjs';
import { deterministicRandom } from '../../../test/fixtures/blackjack-deterministic-random.mjs';

const scope = { environment: 'proof_fixture', workspaceId: 'croupier' };
const room = { schemaVersion: 2, id: 'room-test', name: 'Test', operatorId: 'op-test', presentationLaneId: 'lane-test', gameLaneId: 'game-test', state: 'live' };
function fixture() {
  const samples = Array(415).fill(0), cards = replayShuffle(samples);
  const proof = openProof('shoe-test', { decks:8, cutAfter:312, total:416, burn:1 }, samples, 'a'.repeat(64));
  proof.draws = cards.slice(0,313).map((card,i) => ({position:i+1,kind:i?'deal':'burn',card}));
  Object.assign(proof, { remaining:cards.slice(313), commandDraws:proof.draws.slice(1), closed:true, reason:'cut-card' });
  const audit = [{ seq:1, ...chainRow(GENESIS,{room:room.id,at:1,type:'engine.start',payload:{shoeId:proof.shoeId,draws:proof.commandDraws}}) }];
  const shoe = { room:room.id, shoeId:proof.shoeId, commitment:proof.commitment, openedAt:1, closedAt:2, proof, verdict:'verified' };
  let reads = 0, queries = 0;
  const state = { room, shoe, audit, total:1, operator:true, published:true };
  const client = { async query(sql, args) {
    queries++; assert.deepEqual(args.slice(0,2),[scope.environment,scope.workspaceId]);
    const ownership = { environment_id:scope.environment,workspace_id:scope.workspaceId,operator_id:room.operatorId };
    if (sql.includes('operator-by-id')) return { rows:state.operator ? [{...ownership,slug:'test',name:'Test',status:'active',created_at_ms:1}] : [] };
    if (sql.includes('current-package')) return { rows:[{...ownership,package_revision:1,lanes:JSON.stringify(['lane-test']),games:JSON.stringify(['blackjack']),
      tables:JSON.stringify(state.published?[room.id]:[]),branding:'{}',published_at_ms:1}] };
    assert.ok(sql.includes('studio:shared-table-proof'));
    assert.deepEqual(args,[scope.environment,scope.workspaceId,room.id,state.shoe.shoeId]);
    return { rows:[{shoes:[JSON.stringify(state.shoe)],selected:JSON.stringify(state.shoe),audit:state.audit.map(a=>JSON.stringify(a)),total:String(state.total)}] };
  } };
  const repository = { transaction: work=>work(), withTransactionClient: work=>work(client),
    async readDocument() { reads++; return {value:{rooms:[state.room]}}; } };
  const handler = createSharedTableProofReadout({repository,scope}).handlers.get('GET /studio/api/admin/shared-table-proof');
  const call = (change={}) => handler({scope,actor:{role:'admin',user:'fixture'},
    request:new Request('https://studio.example.invalid/studio/api/admin/shared-table-proof?roomId=room-test&shoeId='+state.shoe.shoeId),...change});
  return {state,call,counts:()=>({reads,queries})};
}
test('closed shoe reconciles with persisted global engine audit, preserving proof serialization',async()=>{
  const f=fixture(), result=await f.call();
  assert.equal(result.selected.verification.status,'verified');
  assert.equal(result.chain.ok,true); assert.equal(result.chain.complete,true);
  assert.equal(result.selected.rawProof,JSON.stringify(f.state.shoe.proof));
  assert.ok(!Object.hasOwn(result,'audit'));
  assert.equal(result.shoes[0].proof,undefined);
});
test('open shoe never exposes nonce, samples, remaining cards or embedded proof',async()=>{
  const f=fixture(); delete f.state.shoe.closedAt;
  const result=await f.call(), text=JSON.stringify(result);
  for(const key of ['nonce','samples','commandDraws','rawProof','remaining']) assert.ok(!text.includes(key),key);
  assert.equal(result.selected.proof,undefined);
});
test('wrong role or scope is denied before any repository I/O',async()=>{
  for(const role of ['partner','staff','player',null]) {
    const f=fixture(); await assert.rejects(f.call({actor:{role,user:'x'}}),e=>e.statusCode===403);
    assert.deepEqual(f.counts(),{reads:0,queries:0});
  }
  const f=fixture(); await assert.rejects(f.call({scope:{...scope,workspaceId:'other'}}),e=>e.statusCode===403);
  assert.deepEqual(f.counts(),{reads:0,queries:0});
});
test('duplicate, unknown and invalid query inputs are denied before I/O',async()=>{
  for(const query of ['roomId=room-test&roomId=room-other','roomId=room-test&token=secret','roomId=../other']) {
    const f=fixture(); await assert.rejects(f.call({request:new Request('https://studio.example.invalid/?'+query)}),e=>e.statusCode===400);
    assert.deepEqual(f.counts(),{reads:0,queries:0});
  }
});
test('unknown room, inactive operator or no current package binding cannot read game data',async()=>{
  for(const change of [{room:{...room,id:'other'}},{operator:false},{published:false}]) {
    const f=fixture(); Object.assign(f.state,change);
    await assert.rejects(f.call(),e=>e.statusCode===404);
    assert.ok(f.counts().queries<=2);
  }
});
test('tampered or incomplete audit never yields verified proof',async()=>{
  for(const [mutate,status] of [[s=>s.audit[0].hash='b'.repeat(64),'failed'],[s=>s.total=10001,'incomplete'],[s=>s.audit[0].seq=2,'failed'],
    [s=>{s.shoe.proof.commandDraws=[];},'failed'],[s=>{s.total=10001;s.shoe={...s.shoe,proof:{...s.shoe.proof,shoeId:'other'}};},'failed']]) {
    const f=fixture(); mutate(f.state); const result=await f.call();
    assert.equal(result.selected.verification.status,status);
  }
});
test('shoe data from another room is rejected even after legitimate room authorization',async()=>{
  const f=fixture(); f.state.shoe.room='other';
  await assert.rejects(f.call(),e=>e.code==='studio_shared_proof_corrupt');
});

let recordedShoe;
async function coordinatorShoe() {
  // Generate the real coordinator's audit shape, including round.started with
  // null round_id and its explicit triggerEvent shared with engine.start.parent.
  recordedShoe??=(async()=>{
    const store=createMemoryTableStore(),player='proof-player';
    store.test.fund(player,100000);store.test.publish('proof-config-old',{});
    let time=100000,command=0;
    const table=createTableCoordinator({store,clock:{now:()=>time},random:deterministicRandom('j08-proof-references')});
    const send=(op,extra={})=>table.command({actorId:player},{roomId:room.id,commandId:'proof-'+(++command),op,...extra});
    await send('join',{seats:[0,1,2,3,4,5,6],seatGens:{0:0,1:0,2:0,3:0,4:0,5:0,6:0},memberGen:0});
    const shoeId=(await store.read.room(room.id)).game.shoe.id,references=[];
    for(let round=0;round<40&&!store.test.audit().some(row=>row.type==='shoe.closed');round++) {
      const windowId=(await table.snapshot(room.id,player)).windowId;
      for(let seat=0;seat<7;seat++)await send('bet',{seat,field:'main',chip:5,windowId});
      if(round===1) {
        time=(await table.snapshot(room.id,player)).deadline;await table.seen(room.id,player);
        const close=(await table.dueTicks()).find(tick=>tick.roomId===room.id&&tick.kind==='window.close');
        assert.ok(close);await table.tick(close);
      }else await send('ready',{windowId});
      const started=await store.read.room(room.id);
      if(started.game.shoe.id===shoeId)references.push({roomId:room.id,shoeId,roundId:started.roundId,configVersion:started.configVersion});
      if(round===0)store.test.publish('proof-config-new',{language:'sv'});
      for(let step=0;step<60&&(await table.snapshot(room.id,player)).phase==='round';step++) {
        const state=await table.snapshot(room.id,player);
        time=Math.max(time,state.plan.endAt,state.actionDeadline??0);await table.seen(room.id,player);
        for(let ticks=0;ticks<100;ticks++) {
          const due=await table.dueTicks();if(!due.length)break;
          for(const tick of due)await table.tick(tick);
          assert.ok(ticks<99,'scheduler must settle');
        }
      }
      const settled=await table.snapshot(room.id,player);assert.equal(settled.phase,'settled');
      await send('next',{roundId:settled.roundId});
    }
    const shoe=await store.runLocked({rooms:[room.id],players:[]},tx=>tx.audit.shoe(shoeId));
    assert.ok(shoe?.closedAt!=null,'real cut card closes the first shoe');
    assert.equal(shoe.verdict,'verified');
    // A subsequent configuration is deliberately not represented in this proof.
    store.test.publish('proof-head-not-used',{});
    return {shoe,audit:store.test.audit(),references};
  })();
  return structuredClone(await recordedShoe);
}
async function tracedFixture() {
  const f=fixture(),evidence=await coordinatorShoe();
  Object.assign(f.state,{shoe:evidence.shoe,audit:evidence.audit,total:evidence.audit.length});
  return {...f,references:evidence.references};
}
function rechain(state) {
  let previous=GENESIS;
  state.audit=state.audit.map(row=>{
    const next={seq:row.seq,...chainRow(previous,{room:row.room,roundId:row.round_id,at:row.at,parent:row.parent,type:row.type,payload:JSON.parse(row.payload)})};
    previous=next.hash;return next;
  });
}

test('closed proof references follow real coordinator rounds and their frozen versions, never the current head',async()=>{
  const f=await tracedFixture(),result=await f.call();
  assert.equal(result.selected.verification.status,'verified');
  assert.deepEqual(result.selected.traceability,{status:'verified',references:f.references});
  assert.deepEqual([...new Set(f.references.map(row=>row.configVersion))],['proof-config-old','proof-config-new']);
  assert.ok(f.state.audit.some(row=>row.type==='round.started'&&row.round_id===null));
  assert.ok(f.state.audit.some(row=>row.type==='engine.start'&&f.state.audit[row.parent-1].type==='table.tick'));
  assert.ok(!JSON.stringify(result).includes('proof-head-not-used'));
});
test('legacy proof integrity remains readable when historical round binding is missing',async()=>{
  const f=fixture(),result=await f.call();
  assert.equal(result.selected.verification.status,'verified');
  assert.deepEqual(result.selected.traceability,{status:'unavailable',reason:'round_binding_missing'});
  assert.equal(result.selected.rawProof,JSON.stringify(f.state.shoe.proof));
  const partial=await tracedFixture();
  const started=partial.state.audit.find(row=>row.type==='round.started'),payload=JSON.parse(started.payload);
  delete payload.configVersion;started.payload=JSON.stringify(payload);rechain(partial.state);
  const value=await partial.call();
  assert.equal(value.selected.verification.status,'verified');
  assert.deepEqual(value.selected.traceability,{status:'unavailable',reason:'round_binding_missing'});
});
test('valid audit hashes cannot turn cross-room, ambiguous or causally invalid round bindings into verified references',async()=>{
  for(const mutate of [
    s=>{const start=s.audit.find(row=>row.type==='engine.start');s.audit[start.parent-1].room='foreign-room';},
    s=>{const start=s.audit.find(row=>row.type==='engine.start');s.audit[start.parent-1].type='player.bet';},
    s=>{const started=s.audit.find(row=>row.type==='round.started'),payload=JSON.parse(started.payload);payload.configVersion='../forged';started.payload=JSON.stringify(payload);},
    s=>{const started=s.audit.find(row=>row.type==='round.started'),duplicate=s.audit.find(row=>row.type==='presentation.plan');duplicate.type='round.started';duplicate.round_id=null;duplicate.payload=started.payload;},
    s=>{const start=s.audit.find(row=>row.type==='engine.start');start.parent=start.seq+1;},
    s=>{const first=s.audit.find(row=>row.type==='engine.start'),draw=s.audit.find(row=>row.type.startsWith('engine.')&&row.type!=='engine.start'&&row.round_id!==first.round_id&&JSON.parse(row.payload).draws?.length);assert.ok(draw);draw.round_id=first.round_id;},
    s=>{const start=s.audit.find(row=>row.type==='engine.start'),payload=JSON.parse(start.payload);payload.cause.eventId++;start.payload=JSON.stringify(payload);},
  ]) {
    const f=await tracedFixture();mutate(f.state);rechain(f.state);
    const result=await f.call();assert.equal(result.chain.ok,true);assert.equal(result.selected.verification.status,'verified');
    assert.deepEqual(result.selected.traceability,{status:'failed',reason:'round_binding_invalid'});
  }
});
test('missing matching start never borrows a foreign round or a later config record',async()=>{
  for(const mutate of [
    s=>{s.audit.find(row=>row.type==='round.started').type='historical.start';},
    s=>{s.audit.find(row=>row.type==='round.started').room='foreign-room';},
  ]) {
    const f=await tracedFixture();mutate(f.state);rechain(f.state);
    const result=await f.call();
    assert.deepEqual(result.selected.traceability,{status:'unavailable',reason:'round_binding_missing'});
  }
});
test('incomplete or unverified proof never releases even otherwise valid round references',async()=>{
  for(const [mutate,traceability]of [
    [s=>{s.total++;},{status:'unavailable',reason:'audit_incomplete'}],
    [s=>{s.audit[0].hash='b'.repeat(64);},{status:'failed',reason:'audit_invalid'}],
    [s=>{s.shoe.proof.commandDraws=[];},{status:'failed',reason:'proof_unverified'}],
  ]) {
    const f=await tracedFixture();mutate(f.state);const result=await f.call();
    assert.deepEqual(result.selected.traceability,traceability);
  }
  const open=await tracedFixture();delete open.state.shoe.closedAt;
  const result=await open.call();assert.equal(result.selected.traceability,undefined);
  for(const key of ['roundId','configVersion','nonce','samples','commandDraws','rawProof','remaining'])assert.ok(!JSON.stringify(result).includes(key));
});
