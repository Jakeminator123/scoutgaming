// Radera permanent (bolag, spelbord, scenmallar) på riktig PostgreSQL-SQL (PGlite, en session):
// produktens Studio-repository, operatörsbutik och Admin-API:t med den nativa grinden.
// Bolagen north och south har publicerade paket och spelbord (partner-postgres-fixturen).
// Syntetiska data; ingen produktionsdatabas.
import test from 'node:test';
import assert from 'node:assert/strict';
import {partnerPostgresFixture} from './fixtures/partner-postgres.mjs';
import {createResourceLifecycleApi} from '../lib/resource-lifecycle-api.mjs';
import {createPermanentDeletionApi} from '../lib/permanent-deletion-api.mjs';
import {createStudioAdminApi} from '../lib/studio-admin-api.mjs';
import {readOperatorLifecycle} from '../../../packages/operators/server/operator-lifecycle.mjs';
import {STANDARD_OPERATOR_ROLES} from '../lib/operator-admin-api.mjs';

const origin='https://admin.fixture.invalid';
async function fixture(t,role='admin'){
 const f=await partnerPostgresFixture(t);
 const actor={user:'delete-admin',role,scope:f.scope};
 const handlers=new Map([...createResourceLifecycleApi({repository:f.repository,scope:f.scope,now:f.config.now}).handlers,
  ...createPermanentDeletionApi({repository:f.repository,scope:f.scope,now:f.config.now}).handlers]);
 const api=createStudioAdminApi({handlers,authorize:async()=>actor,allowedOrigins:[origin],publicHosts:[new URL(origin).host],mutationTransaction:f.config.presentationTransaction});
 const send=async(action,body)=>{const response=await api.handle(new Request(origin+'/studio/api/admin/'+action,body===undefined?{}:{method:'POST',
  headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};};
 const lifecycle=async()=>(await send('resource-lifecycle')).body;
 const pack=operatorId=>f.direct.getCurrentPackage(operatorId);
 const administrationRevision=async()=>(await f.repository.readDocument('administration')).revision;
 async function archiveOperator(operatorId){
  const result=await send('operator-lifecycle',{operatorId,archived:true,expectedPackageRevision:(await pack(operatorId))?.revision??null,expectedAdministrationRevision:await administrationRevision()});
  assert.equal(result.status,200,JSON.stringify(result.body));
 }
 async function archiveRoom(operatorId,roomId){
  const result=await send('room-lifecycle',{operatorId,roomId,archived:true,expectedPackageRevision:(await pack(operatorId)).revision,expectedAdministrationRevision:await administrationRevision()});
  assert.equal(result.status,200,JSON.stringify(result.body));
 }
 async function remove(target,confirmName){
  const check=await send('resource-delete-check',target);assert.equal(check.status,200,JSON.stringify(check.body));
  return {check:check.body,result:await send('resource-delete',{...target,confirmName:confirmName??check.body.name,token:check.body.token})};
 }
 const count=async(table,operatorId)=>Number((await f.rows(`SELECT count(*)::integer AS n FROM croupier_studio.${table} WHERE environment_id=$1 AND workspace_id=$2 AND operator_id=$3`,
  [f.scope.environment,f.scope.workspaceId,operatorId]))[0].n);
 return {...f,send,lifecycle,pack,archiveOperator,archiveRoom,remove,count};
}

test('an empty company in the trash is deleted with its own rows; an active one and a wrong name are refused',async t=>{
 const f=await fixture(t);
 await f.direct.createOperator({actor:'fixture',operatorId:'empty',slug:'empty',name:'Tomt bolag'});
 for(const role of STANDARD_OPERATOR_ROLES)await f.direct.upsertRole({actor:'fixture',operatorId:'empty',roleId:role.id,label:role.label,permissions:[...role.permissions],delegable:role.delegable});
 const active=await f.send('resource-delete-check',{kind:'operator',id:'empty'});
 assert.equal(active.body.allowed,false);assert.deepEqual(active.body.blockers.map(row=>row.code),['operator_active']);
 await f.archiveOperator('empty');
 const wrong=await f.remove({kind:'operator',id:'empty'},'Fel namn');
 assert.equal(wrong.check.allowed,true,JSON.stringify(wrong.check));assert.equal(wrong.result.status,409);assert.equal(wrong.result.body.code,'studio_delete_name_mismatch');
 assert.equal(await f.count('operators','empty'),1);
 const {result}=await f.remove({kind:'operator',id:'empty'});
 assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.deleted.name,'Tomt bolag');
 for(const table of ['operators','operator_roles','operator_memberships','operator_packages','operator_audit_events','operator_branding_drafts'])assert.equal(await f.count(table,'empty'),0,table);
 assert.equal((await f.lifecycle()).operators.some(row=>row.id==='empty'),false);
 // The other companies are untouched.
 assert.ok(await f.count('operator_packages','north')>0);assert.ok(await f.count('operator_audit_events','south')>0);
});

test('a company with a published package is refused with the published versions and its archived rooms listed',async t=>{
 const f=await fixture(t);
 await f.archiveOperator('north');
 const before=await f.rows('SELECT operator_id,package_revision FROM croupier_studio.operator_packages ORDER BY 1,2');
 const {check,result}=await f.remove({kind:'operator',id:'north'});
 assert.equal(check.allowed,false);
 const codes=check.blockers.map(row=>row.code);assert.ok(codes.includes('operator_published'));assert.ok(codes.includes('operator_rooms_in_trash'));
 assert.ok(check.blockers.find(row=>row.code==='operator_published').items.length>0);
 assert.deepEqual(check.blockers.find(row=>row.code==='operator_rooms_in_trash').items.map(row=>row.id).sort(),[f.id('north-a'),f.id('north-b')]);
 assert.equal(result.status,409);assert.equal(result.body.code,'studio_resource_delete_blocked');
 assert.deepEqual(await f.rows('SELECT operator_id,package_revision FROM croupier_studio.operator_packages ORDER BY 1,2'),before);
 assert.equal(await f.count('operators','north'),1);
});

// Ett tomt bolag i papperskorgen med standardroller; varje prov nedan lägger till precis ett hinder.
async function emptyCompanyInTrash(f,operatorId='empty'){
 await f.direct.createOperator({actor:'fixture',operatorId,slug:operatorId,name:'Tomt bolag'});
 for(const role of STANDARD_OPERATOR_ROLES)await f.direct.upsertRole({actor:'fixture',operatorId,roleId:role.id,label:role.label,permissions:[...role.permissions],delegable:role.delegable});
}

test('a published package alone refuses the deletion, without any room in the trash',async t=>{
 const f=await fixture(t);
 await emptyCompanyInTrash(f,'solo');
 const pack=await f.pack('solo');
 await f.direct.publishPackage({actor:'fixture',operatorId:'solo',expectedRevision:pack?.revision??null,lanes:[f.lane.id],games:pack?.games??[],tables:[],branding:pack?.branding??{}});
 await f.archiveOperator('solo');
 const before=await f.count('operator_packages','solo');
 const {check,result}=await f.remove({kind:'operator',id:'solo'});
 assert.deepEqual(check.blockers.map(row=>row.code),['operator_published'],JSON.stringify(check));
 assert.equal(result.status,409);assert.equal(result.body.code,'studio_resource_delete_blocked');
 assert.equal(await f.count('operators','solo'),1);assert.equal(await f.count('operator_packages','solo'),before);
});

test('players pointing at the company refuse the deletion after game-014; before 014 they cannot point and nothing blocks',async t=>{
 const f=await fixture(t);
 await emptyCompanyInTrash(f);await f.archiveOperator('empty');
 // Before game-014: the engine's players table (product schema) has no operator_id.
 await f.pool.query(`INSERT INTO croupier_game.players (id,name,created_at) VALUES ('p-1','Spelare ett','fixture')`);
 const before=(await f.send('resource-delete-check',{kind:'operator',id:'empty'})).body;
 assert.equal(before.allowed,true,JSON.stringify(before));
 // After game-014: one of this company's players and one of another's.
 await f.pool.query(`ALTER TABLE croupier_game.players ADD COLUMN operator_id text;UPDATE croupier_game.players SET operator_id='empty';
  INSERT INTO croupier_game.players (id,name,created_at,operator_id) VALUES ('p-2','Annans spelare','fixture','north')`);
 const {check,result}=await f.remove({kind:'operator',id:'empty'});
 assert.deepEqual(check.blockers,[{code:'operator_players',items:[{id:'p-1',name:'Spelare ett'}]}]);
 assert.equal(result.status,409);assert.equal(result.body.code,'studio_resource_delete_blocked');
 assert.equal(await f.count('operators','empty'),1);
 // The players move elsewhere: nothing points at the company and it is deleted.
 await f.pool.query(`UPDATE croupier_game.players SET operator_id='north'`);
 const after=await f.remove({kind:'operator',id:'empty'});
 assert.equal(after.check.allowed,true,JSON.stringify(after.check));assert.equal(after.result.status,200,JSON.stringify(after.result.body));
 assert.equal(await f.count('operators','empty'),0);
});

test('a key table that exists but cannot be read refuses the deletion instead of counting as absent',async t=>{
 const f=await fixture(t);
 await emptyCompanyInTrash(f);await f.archiveOperator('empty');
 // The engine's key table exists (product schema); this role may read Studio and the players, not the keys.
 await f.pool.query(`CREATE ROLE studio_limited NOLOGIN;GRANT USAGE ON SCHEMA croupier_studio, croupier_auth, croupier_game TO studio_limited;
  GRANT SELECT ON croupier_game.players TO studio_limited;
  GRANT ALL ON ALL TABLES IN SCHEMA croupier_studio TO studio_limited;GRANT ALL ON ALL SEQUENCES IN SCHEMA croupier_studio TO studio_limited`);
 await f.pool.query('SET ROLE studio_limited');t.after(()=>f.pool.query('RESET ROLE').catch(()=>{}));
 const {check,result}=await f.remove({kind:'operator',id:'empty'});
 assert.deepEqual(check.blockers,[{code:'operator_check_unreadable',items:[{id:'croupier_auth.api_keys',name:'API-nycklar'}]}]);
 assert.equal(result.status,409);assert.equal(result.body.code,'studio_resource_delete_blocked');
 await f.pool.query('RESET ROLE');
 assert.equal(await f.count('operators','empty'),1);
 // Readable and empty: the same company is allowed.
 assert.equal((await f.send('resource-delete-check',{kind:'operator',id:'empty'})).body.allowed,true);
});

test('a room in the trash is deleted, leaves every list and is journalled; a live room is refused',async t=>{
 const f=await fixture(t),roomId=f.id('north-a');
 const live=await f.send('resource-delete-check',{kind:'room',id:roomId,operatorId:'north'});
 assert.deepEqual(live.body.blockers.map(row=>row.code),['room_not_in_trash']);
 await f.archiveRoom('north',roomId);
 const archivedRevision=(await f.pack('north')).revision;
 assert.ok((await f.lifecycle()).rooms.some(row=>row.id===roomId&&row.archivedAt));
 const {check,result}=await f.remove({kind:'room',id:roomId,operatorId:'north'});
 assert.equal(check.allowed,true,JSON.stringify(check));assert.equal(result.status,200,JSON.stringify(result.body));
 assert.equal(result.body.packageRevision,archivedRevision+1);
 const listed=await f.lifecycle();
 assert.equal(listed.rooms.some(row=>row.id===roomId),false);assert.equal(listed.operators.find(row=>row.id==='north').archivedRoomCount,0);
 const pack=await f.pack('north');
 assert.equal(readOperatorLifecycle(pack.branding).rooms.length,0);assert.equal(pack.tables.includes(roomId),false);
 assert.equal((await f.repository.readDocument('administration')).value.rooms.some(row=>row.id===roomId),false);
 // The package history keeps the archived version; the journal names the deletion.
 assert.equal(readOperatorLifecycle((await f.direct.getPackage('north',archivedRevision)).branding).rooms[0].room.id,roomId);
 const [event]=await f.rows(`SELECT action,changes FROM croupier_studio.operator_audit_events WHERE environment_id=$1 AND operator_id='north' AND after_revision=$2`,[f.scope.environment,pack.revision]);
 assert.equal(event.action,'package.publish');assert.deepEqual(JSON.parse(event.changes).after.lifecycle,{resourceType:'room',resourceId:roomId,archived:true,deleted:true});
 // The other room and company keep playing.
 assert.ok((await f.repository.readDocument('administration')).value.rooms.some(row=>row.id===f.id('north-b')));
 assert.equal((await f.send('resource-delete-check',{kind:'room',id:roomId,operatorId:'north'})).status,404);
});

test('a scene template used by a room is refused; an unused one is deleted and journalled in the document history',async t=>{
 const f=await fixture(t);
 const used=await f.remove({kind:'composition',id:f.lane.id});
 assert.equal(used.check.allowed,false);
 const codes=used.check.blockers.map(row=>row.code);assert.ok(codes.includes('composition_used_by_rooms'));assert.ok(codes.includes('composition_assigned'));
 assert.equal(used.check.blockers.find(row=>row.code==='composition_used_by_rooms').items.length,3);
 assert.equal(used.result.status,409);assert.equal(used.result.body.code,'studio_resource_delete_blocked');
 const saved=await f.repository.readDocument('project'),spare={...structuredClone(f.lane),id:'spare-template',label:'Reservmall'};
 await f.raw.saveDocument('project',{value:{...saved.value,lanes:[...saved.value.lanes,spare]},expectedRevision:saved.revision,actor:'fixture'});
 const {check,result}=await f.remove({kind:'composition',id:'spare-template'});
 assert.equal(check.allowed,true,JSON.stringify(check));assert.equal(result.status,200,JSON.stringify(result.body));
 const after=await f.repository.readDocument('project');
 assert.equal(after.value.lanes.some(row=>row.id==='spare-template'),false);assert.ok(after.value.lanes.some(row=>row.id===f.lane.id));
 const [audit]=await f.rows(`SELECT action,subject,actor FROM croupier_studio.audit_events WHERE environment_id=$1 AND revision=$2`,[f.scope.environment,after.revision]);
 assert.deepEqual(audit,{action:'save_document',subject:'project',actor:'delete-admin'});
 const history=await f.rows(`SELECT value FROM croupier_studio.document_history WHERE environment_id=$1 AND kind='project' AND replaced_by=$2`,[f.scope.environment,after.revision]);
 assert.ok(history[0].value.lanes.some(row=>row.id==='spare-template'));
});

test('a stale check token and a non-admin are refused without writes',async t=>{
 const f=await fixture(t);
 await f.archiveRoom('north',f.id('north-a'));
 const check=(await f.send('resource-delete-check',{kind:'room',id:f.id('north-a'),operatorId:'north'})).body;
 await f.archiveRoom('north',f.id('north-b'));
 const stale=await f.send('resource-delete',{kind:'room',id:f.id('north-a'),operatorId:'north',confirmName:check.name,token:check.token});
 assert.equal(stale.status,409);assert.equal(stale.body.code,'studio_conflict');
 assert.equal(readOperatorLifecycle((await f.pack('north')).branding).rooms.length,2);
 const viewer=await fixture(t,'viewer');
 assert.equal((await viewer.send('resource-delete-check',{kind:'composition',id:viewer.lane.id})).status,403);
});
