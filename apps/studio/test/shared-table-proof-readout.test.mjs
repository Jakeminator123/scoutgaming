import test from 'node:test';
import assert from 'node:assert/strict';
import { createSharedTableProofReadout } from '../lib/shared-table-proof-readout.mjs';
import { openProof, replayShuffle } from '../../../services/game/games/blackjack/shoe-proof.mjs';
import { chainRow, GENESIS } from '../../../services/game/games/blackjack/table/audit-chain.mjs';

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
    assert.deepEqual(args,[scope.environment,scope.workspaceId,room.id,proof.shoeId]);
    return { rows:[{shoes:[JSON.stringify(state.shoe)],selected:JSON.stringify(state.shoe),audit:state.audit.map(a=>JSON.stringify(a)),total:String(state.total)}] };
  } };
  const repository = { transaction: work=>work(), withTransactionClient: work=>work(client),
    async readDocument() { reads++; return {value:{rooms:[state.room]}}; } };
  const handler = createSharedTableProofReadout({repository,scope}).handlers.get('GET /studio/api/admin/shared-table-proof');
  const call = (change={}) => handler({scope,actor:{role:'admin',user:'fixture'},
    request:new Request('https://studio.example.invalid/studio/api/admin/shared-table-proof?roomId=room-test&shoeId=shoe-test'),...change});
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
  for(const mutate of [s=>s.audit[0].hash='b'.repeat(64),s=>s.total=10001,s=>s.audit[0].seq=2,
    s=>{s.shoe.proof.commandDraws=[];}]) {
    const f=fixture(); mutate(f.state); const result=await f.call();
    assert.equal(result.selected.verification.status,'failed');
  }
});
test('shoe data from another room is rejected even after legitimate room authorization',async()=>{
  const f=fixture(); f.state.shoe.room='other';
  await assert.rejects(f.call(),e=>e.code==='studio_shared_proof_corrupt');
});
