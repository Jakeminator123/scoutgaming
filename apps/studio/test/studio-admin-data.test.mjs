import {createSeedProject,createEmptyProject,addDealer} from '../../../packages/presentation/contracts/studio-model.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioAdminData } from '../lib/studio-admin-data.mjs';
// Explicit persisted test catalogue; production has no built-in dealer lanes.
const SAVED_GAME_LANES=[{schemaVersion:1,id:'mobile-phone',label:'Saved Linnea room',renderer:'portrait-video',dealer:'linnea',mediaCollection:'linnea-presentation'}];

const scope = { environment: 'fixture', workspaceId: 'croupier' };
function fixture(options = {}) {
  const state = { document: { revision: 'studio-original', value: { gameLane:'mobile-phone',gameLanes:structuredClone(SAVED_GAME_LANES),rooms: [{ id: 'one', state: 'preview' }], tiers: { classic: 'vera' }, tournaments: [] } }, writes: [], reads: [], rows: [] };
  const db = { prepare(sql) {
    state.reads.push(sql);
    return { all: async () => state.rows, get: async () => ({ id: 7, username: 'someone', n: 1 }),
      run: async (...args) => { state.writes.push({ sql, args }); return { changes: 1 }; } };
  }, transaction: work => work() };
  const repository = { readDocument: async kind => {
    if (kind !== 'project') return structuredClone(state.document);
    state.projectReads = (state.projectReads ?? 0) + 1;
    if (state.projectReadError) throw Error('private database details');
    return state.project === null ? null : {value:state.project??addDealer(addDealer(addDealer(createSeedProject(),'linnea','Linnea'),'nora','Nora'),'elin','Elin')};
  }, async saveDocument(kind, options) {
    state.writes.push({ kind, options });
    if (state.document.revision !== options.expectedRevision) throw Object.assign(Error('Conflict'), { statusCode: 409 });
    state.document = { revision: 'studio-new', value: options.value }; return state.document;
  } };
  const data = createStudioAdminData({ db, boDb: db, repository, scope, now: () => '2026-10-03T00:00:00.000Z', ...options });
  const context = body => ({ body, actor: { user: 'operator', role: 'superadmin' }, scope });
  const call = (method, action, body) => data.handlers.get(`${method} /studio/api/admin/${action}`)(context(body));
  return { state, data, call, context };
}
test('configuration reads are saved revision only; missing data never seeds', async () => {
  const f = fixture(); assert.equal((await f.call('GET','config')).revision, 'studio-original');
  f.state.document = null;
  await assert.rejects(f.call('GET','config'), error => error.statusCode === 503);
  assert.deepEqual(f.state.writes, []);
});

test('modern administration readouts and room edits never synthesize legacy sections', async () => {
  const f = fixture();
  delete f.state.document.value.tiers;
  delete f.state.document.value.tournaments;
  for (const action of ['config', 'overview']) {
    const result = await f.call('GET', action);
    assert.deepEqual(result.rooms, f.state.document.value.rooms);
    for (const key of ['tiers', 'pitboss', 'tournaments']) assert.equal(result[key], undefined);
  }
  assert.deepEqual(f.state.writes, []);
  await f.call('POST', 'room', { id: 'one', state: 'live', expectedRevision: 'studio-original' });
  assert.equal(f.state.document.value.rooms[0].state, 'live');
  for (const key of ['tiers', 'pitboss', 'tournaments']) assert.equal(Object.hasOwn(f.state.document.value, key), false);
});

test('active lane requires admin and a current revision; it preserves the other administration data',async () => {
  const f=fixture(),body={lane:'mobile-phone',expectedRevision:'studio-original'};
  const handler=f.data.handlers.get('POST /studio/api/admin/game-lane');
  await assert.rejects(handler({...f.context(body),actor:{user:'player',role:'player'}}),error=>error.statusCode===403);
  await assert.rejects(f.call('POST','game-lane',{...body,lane:'unknown'}));
  assert.equal(f.state.writes.length,0);
  const before=structuredClone(f.state.document.value);
  assert.deepEqual(await f.call('POST','game-lane',body),{ok:true,revision:'studio-new'});
  assert.deepEqual(f.state.document.value,{...before,gameLane:'mobile-phone',gameLanes:SAVED_GAME_LANES});
  await assert.rejects(f.call('POST','game-lane',{...body,lane:'original'}),error=>error.statusCode===409);
  assert.equal(f.state.document.value.gameLane,'mobile-phone');
});

test('lane creation and removal enforce role, CAS, replacement and preserve shared state', async () => {
  const f = fixture(), definition = { ...SAVED_GAME_LANES[0], id: 'mobile-two', label: 'Second mobile' };
  const body = { definition, expectedRevision: 'studio-original' };
  for (const action of ['game-lanes/create', 'game-lanes/remove']) {
    await assert.rejects(f.data.handlers.get(`POST /studio/api/admin/${action}`)({ ...f.context(body), actor: { user: 'viewer', role: 'reader' } }), e => e.statusCode === 403);
  }
  await assert.rejects(f.call('POST', 'game-lanes/create', { ...body, expectedRevision: 'stale' }), e => e.statusCode === 409);
  await f.call('POST', 'game-lanes/create', body);
  assert.deepEqual(f.state.document.value.gameLanes, [...SAVED_GAME_LANES, definition]);
  assert.equal(f.state.document.value.gameLane, 'mobile-phone');
  await assert.rejects(f.call('POST', 'game-lanes/create', { ...body, expectedRevision: 'studio-new' }));
  await assert.rejects(f.call('POST', 'game-lanes/remove', { lane: 'mobile-phone', replacementLane: null, expectedRevision: 'studio-new' }));
  await f.call('POST', 'game-lanes/remove', { lane: 'mobile-phone', replacementLane: 'mobile-two', expectedRevision: 'studio-new' });
  assert.equal(f.state.document.value.gameLane, 'mobile-two');
  assert.deepEqual(f.state.document.value.rooms, [{ id: 'one', state: 'preview' }]);
  await f.call('POST', 'game-lanes/remove', { lane: 'mobile-two', replacementLane: null, expectedRevision: 'studio-new' });
  assert.deepEqual(f.state.document.value.gameLanes, []);
  assert.equal(f.state.document.value.gameLane, null);
  await f.call('POST', 'game-lanes/create', { ...body, expectedRevision: 'studio-new' });
  assert.equal(f.state.document.value.gameLane, 'mobile-two');
  assert.ok(f.state.writes.every(write => write.kind === 'administration'));
});

test('room edit uses server actor and exact CAS; stale, spoofed and invalid edits do not save', async () => {
  const f = fixture();
  for (const body of [{ id: 'one', state: 'live', expectedRevision: 'stale' }, { id: 'one', state: 'anything', expectedRevision: 'studio-original' }, { id: 'one', state: 'live', expectedRevision: 'studio-original', actor: 'attacker' }]) {
    await assert.rejects(f.call('POST','room',body));
  }
  assert.equal(f.state.writes.length, 0);
  assert.deepEqual(await f.call('POST','room',{ id: 'one', state: 'live', expectedRevision: 'studio-original' }), { ok: true, revision: 'studio-new' });
  assert.equal(f.state.writes[0].options.actor, 'operator');
  assert.equal(f.state.writes[0].options.value.rooms[0].state, 'live');
});
test('the retired pit boss and tournament writes have no handler and nothing is written', async () => {
  const f = fixture();
  for (const action of ['pitboss', 'tournament']) assert.equal(f.data.handlers.has(`POST /studio/api/admin/${action}`), false, action);
  assert.equal(f.state.writes.length, 0);
});
test('partner metadata does not select credentials and incomplete runtime actions are absent', async () => {
  // Nyckel→bolag: each key names its company once game migration 012 has added the column, and the
  // companies offered for a new key are this scope's only. Before 012 the column is never named.
  for (const present of [false, true]) {
    const reads = [];
    const boDb = { prepare(sql) { reads.push(sql); return {
      get: async () => sql.includes(' FROM pg_attribute ') ? { present } : assert.fail(sql),
      all: async (...args) => {
        if (sql.includes(' FROM croupier_studio.operators ')) {
          assert.deepEqual(args, [scope.environment, scope.workspaceId]);
          return [{ operator_id: 'north', name: 'North', status: 'active' }, { operator_id: 'gone', name: 'Gone', status: 'suspended' }];
        }
        if (sql.includes(' FROM api_keys ')) return [{ id: 'x', scopes: '["launch"]', name: 'Partner', ...(present ? { operator_id: 'north' } : {}) },
          ...(present ? [{ id: 'y', scopes: 'not json', name: 'Other', operator_id: 'unknown-company' }] : [])];
        return assert.fail(sql);
      } }; } };
    const listed = await fixture({ boDb }).call('GET', 'apikeys');
    assert.equal(listed.operatorBinding, present ? 'ready' : 'pending');
    assert.deepEqual(listed.operators, [{ id: 'north', name: 'North', status: 'active' }, { id: 'gone', name: 'Gone', status: 'suspended' }]);
    assert.deepEqual(listed.keys[0].scopes, ['launch']);
    assert.deepEqual(listed.keys.map(key => [key.id, key.operatorId, key.operatorName]), present ? [['x', 'north', 'North'], ['y', 'unknown-company', null]] : [['x', null, null]]);
    assert.equal(Object.hasOwn(listed.keys[0], 'operator_id'), false);
    const keyRead = reads.find(sql => sql.includes(' FROM api_keys '));
    assert.ok(!/\b(?:key|secret)\b/.test(keyRead), keyRead);
    assert.equal(keyRead.includes('operator_id'), present, 'the column is named only once it exists');
  }
  const f = fixture();
  for (const action of ['players/password','players/status','apikeys/revoke','apikeys/credit','speech-qa','voiceline-review','tier']) {
    assert.equal(f.data.handlers.has(`POST /studio/api/admin/${action}`), false);
  }
  assert.equal(f.data.handlers.has('GET /studio/api/admin/voicelines'), false, 'the retired speech review has no reader');
});
test('self change, invalid role and wrong server scope are denied before mutation', async () => {
  const f = fixture();
  await assert.rejects(f.call('POST','users/remove',{ username: 'Operator' }));
  await assert.rejects(f.call('POST','users/role',{ username: 'someone', role: 'player' }));
  await assert.rejects(f.data.handlers.get('GET /studio/api/admin/users')({ ...f.context(), scope: { ...scope, workspaceId: 'other' } }));
  assert.equal(f.state.writes.length, 0);
  await f.call('POST','users/role',{ username: 'someone', role: 'admin' });
  assert.ok(f.state.writes.some(write => write.sql.startsWith('DELETE FROM lab_sessions')));
});

test('players expose an exact boolean password capability without changing account data',async()=>{
  const f=fixture();f.state.rows=[{id:'local',passwordChangeAllowed:true},{id:'integer-flag',passwordChangeAllowed:1},{id:'craig-only',passwordChangeAllowed:false},{id:'ambiguous',passwordChangeAllowed:'true'}];
  const result=await f.call('GET','players');
  assert.deepEqual(result.players.map(row=>row.passwordChangeAllowed),[true,true,false,false]);
  assert.match(f.state.reads.at(-1),/EXISTS\(SELECT 1 FROM player_accounts WHERE player_accounts.player_id=players.id\)/);
  assert.deepEqual(f.state.writes,[]);
});

test('Nora catalogue registration requires her saved dealer identity and staff role',async()=>{
 const f=fixture(),body={definition:{...SAVED_GAME_LANES[0],id:'nora-room',label:'Nora',dealer:'nora',mediaCollection:'nora-presentation'},expectedRevision:'studio-original'};
 f.state.project=createSeedProject();await assert.rejects(f.call('POST','game-lanes/create',body));assert.equal(f.state.writes.length,0);
 f.state.project=addDealer(createSeedProject(),'nora','Nora');
 await assert.rejects(f.data.handlers.get('POST /studio/api/admin/game-lanes/create')({...f.context(body),actor:{user:'viewer',role:'reader'}}),e=>e.statusCode===403);
 await f.call('POST','game-lanes/create',body);assert.equal(f.state.document.value.gameLanes.at(-1).dealer,'nora');
});


test('removing a game lane referenced by any existing room is rejected before writes regardless of room state or operator', async () => {
  for(const state of ['live','preview','pending']){
    const f=fixture(),room={schemaVersion:2,id:'room-existing',name:'Existing',operatorId:'another-operator',presentationLaneId:'published-presentation',gameLaneId:'mobile-phone',state};
    f.state.document.value.gameLanes=[...SAVED_GAME_LANES,{...SAVED_GAME_LANES[0],id:'spare'}];f.state.document.value.gameLane='spare';
    f.state.document.value.rooms.push(room);const before=structuredClone(f.state.document);
    await assert.rejects(f.call('POST','game-lanes/remove',{lane:'mobile-phone',replacementLane:'spare',expectedRevision:'studio-original'}),error=>error.statusCode===409);
    assert.deepEqual(f.state.document,before);assert.deepEqual(f.state.writes,[]);
    await f.call('POST','game-lanes/remove',{lane:'spare',replacementLane:'mobile-phone',expectedRevision:'studio-original'});
    assert.equal(f.state.document.value.gameLane,'mobile-phone');assert.deepEqual(f.state.document.value.rooms,before.value.rooms);
  }
});


test('config exposes only validated saved dealer IDs and labels after authorization without writing', async () => {
  const f=fixture();f.state.project=addDealer(createSeedProject(),'linnea','Linnea');
  f.state.project.dealers.find(row=>row.id==='linnea').privateNotes='private metadata';
  const result=await f.call('GET','config');
  assert.deepEqual(result.savedDealers,f.state.project.dealers.map(({id,label})=>({id,label})));
  assert.doesNotMatch(JSON.stringify(result.savedDealers),/private metadata|privateNotes|lines|voice/);
  assert.deepEqual(f.state.writes,[]);
  const before=f.state.projectReads;
  await assert.rejects(f.data.handlers.get('GET /studio/api/admin/config')({...f.context(),actor:{user:'player',role:'player'}}),e=>e.statusCode===403);
  assert.equal(f.state.projectReads,before);
});

test('missing, unreadable or invalid saved dealer registry is explicit null with no seeded fallback or raw error', async () => {
  for(const mode of ['missing','unreadable','duplicate','label','id']){
    const f=fixture();f.state.project=createSeedProject();
    if(mode==='missing')f.state.project=null;
    if(mode==='unreadable')f.state.projectReadError=true;
    if(mode==='duplicate')f.state.project.dealers.push({...f.state.project.dealers[0]});
    if(mode==='label')f.state.project.dealers[0].label='Bad\nlabel';
    if(mode==='id')f.state.project.dealers[0].id='constructor';
    const result=await f.call('GET','config');
    assert.equal(result.savedDealers,null,mode);assert.equal(result.revision,'studio-original');
    assert.doesNotMatch(JSON.stringify(result),/private database details/);assert.deepEqual(f.state.writes,[]);
  }
});

test('empty and custom saved registries require no built-in dealers or game lanes',async()=>{
  for(const project of [createEmptyProject(),addDealer(createEmptyProject(),'linnea','Linnea')]){
    const f=fixture();f.state.project=project;
    delete f.state.document.value.gameLane;delete f.state.document.value.gameLanes;
    const result=await f.call('GET','config');
    assert.deepEqual(result.savedDealers,project.dealers.map(({id,label})=>({id,label})));
    assert.deepEqual(result.gameLanes,[]);assert.equal(result.gameLane,null);assert.deepEqual(f.state.writes,[]);
  }
});

test('tier and new lane assignments reject removed identities and accept a saved playable Dragan',async()=>{
 const f=fixture({canAssignDealer:async id=>id==='dragan'});f.state.project={dealers:[{id:'dragan',label:'Dragan'}]};
 await assert.rejects(f.call('POST','game-lanes/create',{definition:{...SAVED_GAME_LANES[0],id:'removed',dealer:'unregistered',mediaCollection:'unregistered-presentation'},expectedRevision:'studio-original'}));
 await f.call('POST','tier',{tier:'classic',dealer:'dragan',expectedRevision:'studio-original'});assert.equal(f.state.document.value.tiers.classic,'dragan');
 f.state.project={dealers:[]};await assert.rejects(f.call('POST','tier',{tier:'classic',dealer:'dragan',expectedRevision:'studio-new'}));
 assert.equal(f.state.writes.length,1);
});
