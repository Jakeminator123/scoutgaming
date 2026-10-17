import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperatorStore } from '../../../packages/operators/server/operator-store.mjs';
import { operatorAuditContext } from '../lib/operator-audit-context.mjs';
import { operatorMemoryPool } from './fixtures/operator-memory-pool.mjs';
const scope={environment:'audit-fixture',workspaceId:'isolated'}, actor='private@example.invalid';
const audit={actorId:'42',accessClass:'internal-admin',requestId:'11111111-1111-4111-8111-111111111111'};
const roleInput={actor,audit,operatorId:'north',roleId:'viewer',label:'Viewer',permissions:['overview.read'],delegable:true};
async function fixture(){
 const pool=operatorMemoryPool(),store=await createOperatorStore({sql:pool,scope,now:()=>1700000000000});
 await store.createOperator({actor,audit,operatorId:'north',slug:'north',name:'North'});
 await store.upsertRole(roleInput);
 return {pool,store};
}
test('every committed write persists exactly one safe scoped audit row and only native revisions',async()=>{
 const {pool,store}=await fixture();
 await store.upsertMembership({actor,audit,operatorId:'north',userId:'88',roleId:'viewer',status:'active'});
 await store.upsertMembership({actor,audit,operatorId:'north',userId:'88',roleId:'viewer',status:'suspended',expectedRevision:1});
 await store.upsertRole({...roleInput,permissions:['overview.read','reports.read']});
 await store.publishPackage({actor,audit,operatorId:'north',lanes:['mobile-phone'],games:['blackjack'],tables:[],branding:{secret:'never-journal-this'}});
 const journal=await store.listAuditEvents('north'),entries=journal.entries;
 assert.equal(entries.length,6);assert.equal(new Set(entries.map(row=>row.id)).size,6);
 assert.ok(entries.every(row=>row.actor==='42'&&row.accessClass==='internal-admin'&&row.requestId===audit.requestId));
 const updated=entries.find(row=>row.action==='membership.update');
 assert.deepEqual([updated.beforeRevision,updated.afterRevision],[1,2]);
 assert.deepEqual(updated.changes,{before:{roleId:'viewer',status:'active'},after:{roleId:'viewer',status:'suspended'}});
 const changedRole=entries.find(row=>row.action==='role.save'&&row.changes.before);
 assert.equal(changedRole.beforeRevision,null);assert.equal(changedRole.afterRevision,null);
 assert.deepEqual(changedRole.changes.after.permissions,['overview.read','reports.read']);
 assert.doesNotMatch(JSON.stringify(pool.tables.operator_audit_events),/private@example|never-journal-this/);
 assert.equal(journal.nextCursor,null);
});
test('an unavailable audit insert rolls every business mutation back, including creation',async()=>{
 const {pool,store}=await fixture();
 await store.upsertMembership({actor,audit,operatorId:'north',userId:'88',roleId:'viewer',status:'active'});
 const operations=[
 ()=>store.createOperator({actor,audit,operatorId:'south',slug:'south',name:'South'}),
 ()=>store.upsertRole({...roleInput,permissions:['overview.read','reports.read']}),
 ()=>store.upsertMembership({actor,audit,operatorId:'north',userId:'89',roleId:'viewer',status:'active'}),
 ()=>store.upsertMembership({actor,audit,operatorId:'north',userId:'88',roleId:'viewer',status:'suspended',expectedRevision:1}),
 ()=>store.publishPackage({actor,audit,operatorId:'north',lanes:['mobile-phone'],games:['blackjack'],tables:[],branding:{}}),
 ];
 for(const operation of operations){const before=structuredClone(pool.tables);pool.before('audit-write',()=>{throw Object.assign(Error('private database details'),{code:'42P01'});});
  await assert.rejects(operation,error=>error.statusCode===503&&!error.message.includes('private database'));assert.deepEqual(pool.tables,before);
 }
});
test('journal paginates identical timestamps without overlap and isolates workspace and operator',async()=>{
 const {pool,store}=await fixture();
 await store.createOperator({actor,audit,operatorId:'south',slug:'south',name:'South'});
 const first=await store.listAuditEvents('north',{limit:1}),second=await store.listAuditEvents('north',{limit:1,cursor:first.nextCursor});
 assert.equal(first.entries.length,1);assert.equal(second.entries.length,1);assert.notEqual(first.entries[0].id,second.entries[0].id);assert.equal(second.nextCursor,null);
 const other=await createOperatorStore({sql:pool,scope:{...scope,workspaceId:'different'}});
 assert.deepEqual((await other.listAuditEvents('north')).entries,[]);
 assert.equal((await store.listAuditEvents('south')).entries.length,1);
 for(const options of [{limit:0},{limit:101},{cursor:{atMs:0,id:'invalid'}}])await assert.rejects(store.listAuditEvents('north',options),e=>e.statusCode===400);
});
test('stale or malformed changes never add audit rows or mutate business state',async()=>{
 const {pool,store}=await fixture();
 await store.upsertMembership({actor,audit,operatorId:'north',userId:'88',roleId:'viewer',status:'active'});
 const before=structuredClone(pool.tables);
 await assert.rejects(store.upsertMembership({actor,audit,operatorId:'north',userId:'88',roleId:'viewer',status:'suspended',expectedRevision:99}),e=>e.statusCode===409);
 await assert.rejects(store.upsertRole({...roleInput,audit:{...audit,requestId:'cookie=private'}}),e=>e.statusCode===422);
 assert.deepEqual(pool.tables,before);
});
test('trusted identity maps to stable account ID and one server request correlation per action context',()=>{
 const identity={accountId:'7',user:'do-not-log@example.invalid',role:'admin'};
 const first=operatorAuditContext(identity),second=operatorAuditContext(identity);
 assert.equal(first.actorId,'7');assert.equal(first.accessClass,'internal-admin');assert.equal(first.requestId,second.requestId);
 assert.notEqual(operatorAuditContext({...identity}).requestId,first.requestId);
 assert.doesNotMatch(JSON.stringify(operatorAuditContext({user:'do-not-log@example.invalid',role:'admin'})),/do-not-log|@/);
});
