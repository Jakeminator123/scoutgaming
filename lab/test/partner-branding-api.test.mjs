import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudPresentationFixture} from './fixtures/cloud-presentation.mjs';
import { createOperatorStore } from '../../packages/operators/server/operator-store.mjs';
import { createPartnerBrandingApi as createApi, TABLE_COLOR_BRANDING_KEY } from '../lib/partner-branding-api.mjs';

const scope = { environment: 'isolated-fixture', workspaceId: 'qa' };
const clock = () => 1_700_000_000_000;
const actor = 'brand-actor';
const operatorId = 'operator-unibet';

function memoryPool() {
  const tables = { operators: [], operator_roles: [], operator_memberships: [], operator_packages: [], operatorAudits: [] };
  const pgError = code => Object.assign(new Error('fixture'), { code });
  const copy = row => structuredClone(row);
  async function dispatch(text, values = []) {
    const tag = /\/\* operator-store:([a-z-]+) \*\//.exec(text)?.[1];
    if (!tag) throw new Error(`untagged query: ${text}`);
    const [environment, workspace] = values;
    const scoped = name => tables[name].filter(row => row.environment_id === environment && row.workspace_id === workspace);
    if (tag === 'list-operators') return { rows: scoped('operators').sort((a, b) => a.slug.localeCompare(b.slug)).map(copy) };
    if (tag === 'operator-by-slug') return { rows: scoped('operators').filter(row => row.slug === values[2]).map(copy) };
    if (tag === 'operator-by-id') return { rows: scoped('operators').filter(row => row.operator_id === values[2]).map(copy) };
    if (tag === 'list-roles' || tag === 'guard-roles') return { rows: scoped('operator_roles').filter(row => row.operator_id === values[2]).sort((a, b) => a.role_id.localeCompare(b.role_id)).map(copy) };
    if (tag === 'get-role') return { rows: scoped('operator_roles').filter(row => row.operator_id === values[2] && row.role_id === values[3]).map(copy) };
    if (tag === 'get-membership') return { rows: scoped('operator_memberships').filter(row => row.operator_id === values[2] && row.user_id === values[3]).map(copy) };
    if (tag === 'list-memberships' || tag === 'guard-memberships') return { rows: scoped('operator_memberships').filter(row => row.operator_id === values[2]).sort((a, b) => a.user_id.localeCompare(b.user_id)).map(copy) };
    if (tag === 'current-package') return { rows: scoped('operator_packages').filter(row => row.operator_id === values[2]).sort((a, b) => Number(b.package_revision) - Number(a.package_revision)).slice(0, 1).map(copy) };
    if (tag === 'lock-operator') return { rows: scoped('operators').filter(row => row.operator_id === values[2]).map(copy) };
    if (tag === 'audit-write') { tables.operatorAudits.push(copy(values)); return {rows:[{event_id:values[3]}]}; }
    if (tag === 'create-operator') {
      if (scoped('operators').some(row => row.operator_id === values[2] || row.slug === values[3])) throw pgError('23505');
      const row = { environment_id: environment, workspace_id: workspace, operator_id: values[2], slug: values[3], name: values[4], status: values[5], created_at_ms: values[6] };
      tables.operators.push(row);
      return { rows: [copy(row)] };
    }
    if (tag === 'upsert-role') {
      if (!scoped('operators').some(row => row.operator_id === values[2])) throw pgError('23503');
      let row = tables.operator_roles.find(item => item.environment_id === environment && item.workspace_id === workspace && item.operator_id === values[2] && item.role_id === values[3]);
      if (!row) {
        row = { environment_id: environment, workspace_id: workspace, operator_id: values[2], role_id: values[3], label: values[4], permissions: values[5], delegable: values[6] };
        tables.operator_roles.push(row);
      } else Object.assign(row, { label: values[4], permissions: values[5], delegable: values[6] });
      return { rows: [copy(row)] };
    }
    if (tag === 'create-membership') {
      if (!scoped('operators').some(row => row.operator_id === values[2])) throw pgError('23503');
      if (!scoped('operator_roles').some(row => row.operator_id === values[2] && row.role_id === values[4])) throw pgError('23503');
      if (scoped('operator_memberships').some(row => row.operator_id === values[2] && row.user_id === values[3])) throw pgError('23505');
      const row = { environment_id: environment, workspace_id: workspace, operator_id: values[2], user_id: values[3], role_id: values[4], status: values[5], revision: 1, created_at_ms: values[6] };
      tables.operator_memberships.push(row);
      return { rows: [copy(row)] };
    }
    if (tag === 'publish-package') {
      if (!scoped('operators').some(row => row.operator_id === values[2])) throw pgError('23503');
      const revision = scoped('operator_packages').filter(row => row.operator_id === values[2]).reduce((max, row) => Math.max(max, Number(row.package_revision)), 0) + 1;
      const row = { environment_id: environment, workspace_id: workspace, operator_id: values[2], package_revision: revision, lanes: values[3], games: values[4], tables: values[5], branding: values[6], published_at_ms: values[7] };
      tables.operator_packages.push(row);
      return { rows: [copy(row)] };
    }
    throw new Error(`unknown tag ${tag}`);
  }
  async function query(text, values) {
    const command = String(text).trim();
    if (command === 'BEGIN' || command === 'COMMIT' || command === 'ROLLBACK' || command.startsWith('SET LOCAL')) {
      return { rows: [], command: command.startsWith('SET') ? 'SET' : command };
    }
    return dispatch(text, values);
  }
  return {
    query,
    async connect() { return { query, release() {} }; },
    packageCount: () => tables.operator_packages.length,
  };
}

async function seeded(lanes = ['vip-table', 'mobile-phone']) {
  const pool = memoryPool();
  const store = await createOperatorStore({ sql: pool, scope, now: clock });
  await store.createOperator({ actor, operatorId, slug: 'unibet', name: 'Unibet' });
  await store.upsertRole({
    actor, operatorId, roleId: 'partner-admin', label: 'Partner administrator',
    permissions: ['overview.read', 'presentations.configure'], delegable: false,
  });
  await store.upsertMembership({ actor, operatorId, userId: 'staff-1', roleId: 'partner-admin', status: 'active' });
  await store.publishPackage({
    actor, operatorId, lanes, games: ['blackjack'], tables: ['table-a'],
    branding: { [TABLE_COLOR_BRANDING_KEY]: '#112233', name: 'Unibet' },
  });
  const listed = await store.listOperators();
  const bySlug = await store.getOperatorBySlug('unibet');
  const role = await store.getRole(operatorId, 'partner-admin');
  const membership = await store.getMembership(operatorId, 'staff-1');
  assert.equal(listed[0].slug, 'unibet');
  assert.equal(bySlug.id, operatorId);
  assert.equal(role.id, 'partner-admin');
  assert.equal(membership.roleId, 'partner-admin');
  return { pool, store };
}

function apiFor(store, lanes) {
  return createPartnerBrandingApi({
    store,
    readProject: async () => ({ project: { lanes } }),
  });
}

test('adjustable uses only saved package lanes and does not manufacture a standard lane', async () => {
  const { store } = await seeded(['mobile-phone', 'missing-lane']);
  const fallback = apiFor(store, [{ id: 'vip-table', operatorAdjustable: ['dealer'] }]);
  const fallen = await fallback.read({ operatorId });
  assert.deepEqual(fallen.adjustable, []);
  assert.equal(fallen.packageRevision, 1);
  const pinned = apiFor(store, [{ id: 'mobile-phone', operatorAdjustable: ['dealer'] }]);
  assert.deepEqual((await pinned.read({ operatorId })).adjustable, ['dealer']);
  const mixed = apiFor(store, [
    { id: 'mobile-phone', operatorAdjustable: ['table.color'] },
    { id: 'vip-table', operatorAdjustable: ['branding', 'background'] },
  ]);
  const { store: both } = await seeded(['vip-table', 'mobile-phone']);
  assert.deepEqual((await apiFor(both, [
    { id: 'mobile-phone', operatorAdjustable: ['table.color'] },
    { id: 'vip-table', operatorAdjustable: ['branding', 'background'] },
  ]).read({ operatorId })).adjustable, ['table.color', 'background', 'branding']);
  await assert.rejects(() => mixed.read({ operatorId: 'missing-operator' }), error => error.statusCode === 404);
});

test('a matching revision publishes branding and keeps lanes, games and tables', async () => {
  const { pool, store } = await seeded();
  const api = apiFor(store, [
    { id: 'mobile-phone', operatorAdjustable: ['table.color', 'branding'] },
    { id: 'vip-table', operatorAdjustable: [] },
  ]);
  const saved = await api.write({
    operatorId, actor, expectedRevision: 1,
    branding: { [TABLE_COLOR_BRANDING_KEY]: '#00ff00', logo: 'mark' },
  });
  assert.equal(saved.packageRevision, 2);
  assert.deepEqual(saved.lanes, ['mobile-phone', 'vip-table']);
  assert.deepEqual(saved.branding, { [TABLE_COLOR_BRANDING_KEY]: '#00ff00', logo: 'mark', name: 'Unibet' });
  const current = await store.getCurrentPackage(operatorId);
  assert.equal(current.revision, 2);
  assert.deepEqual([...current.lanes], ['mobile-phone', 'vip-table']);
  assert.deepEqual([...current.games], ['blackjack']);
  assert.deepEqual([...current.tables], ['table-a']);
  assert.equal(pool.packageCount(), 2);
});

test('the wrong revision is 409 and a key outside the lane is 422', async () => {
  const { pool, store } = await seeded(['mobile-phone']);
  const colorOnly = apiFor(store, [{ id: 'mobile-phone', operatorAdjustable: ['table.color'] }]);
  await assert.rejects(
    () => colorOnly.write({ operatorId, actor, expectedRevision: 4, branding: { name: 'Nord' } }),
    error => error.statusCode === 422,
  );
  await assert.rejects(
    () => colorOnly.write({ operatorId, actor, expectedRevision: 9, branding: { [TABLE_COLOR_BRANDING_KEY]: '#00ff00' } }),
    error => error.statusCode === 409,
  );
  const brandingOnly = apiFor(store, [{ id: 'mobile-phone', operatorAdjustable: ['branding'] }]);
  await assert.rejects(
    () => brandingOnly.write({ operatorId, actor, expectedRevision: 1, branding: { [TABLE_COLOR_BRANDING_KEY]: '#00ff00' } }),
    error => error.statusCode === 422,
  );
  await assert.rejects(
    () => brandingOnly.write({ operatorId, actor, expectedRevision: 1, branding: { constructor: 'nope' } }),
    error => error.statusCode === 422,
  );
  assert.equal(pool.packageCount(), 1);
  assert.equal((await store.getCurrentPackage(operatorId)).revision, 1);
});

import {withPackagePresentation} from '../../web/storage/presentation-package.mjs';
import { defaultPresentationLane } from '../../packages/presentation/contracts/studio-model.mjs';
import { defaultCompositionSettings } from '../../packages/presentation/contracts/composition-settings.mjs';
import { layerAssetPath } from '../../web/presentation-layers.mjs';

const tableId='11111111-1111-4111-8111-111111111111', backgroundId='22222222-2222-4222-8222-222222222222';
function makePresentation(layered=true) {
  const assets=[['table',tableId,'Bordbild','image/png'],['background',backgroundId,'Bakgrundsfilm','video/webm']].map(([role,id,label,contentType])=>{
    const asset={schemaVersion:1,id,role,label,contentType,sha256:'a'.repeat(64),size:32,width:1920,height:1080};
    return {...asset,pathname:layerAssetPath(asset)};
  });
  const lane={...defaultPresentationLane('astrid'),label:'Tilldelad presentation',dealers:['astrid','nora'],operatorAdjustable:['table','table.color','background','dealer','branding'],
    layers:{table:{enabled:true,default:tableId,allowed:[tableId],colors:['#112233']},background:{enabled:true,mode:'video',default:backgroundId,allowed:[backgroundId]},dealer:{enabled:true,default:'astrid',allowed:['astrid','nora']}},
    ...(layered?{composition:defaultCompositionSettings()}: {})};
  return cloudPresentationFixture({lanes:[lane],assets}).presentation;
}

test('canonical package rejects incompatible baked layer choices while retaining approved playback',async()=>{
  const presentation=makePresentation(false);
  const current={operatorId,revision:1,lanes:['mobile-phone'],games:['blackjack'],tables:['room-1'],branding:withPackagePresentation({},presentation)};
  let writes=0;
  const api=createPartnerBrandingApi({store:{getCurrentPackage:async()=>current,publishPackage:async()=>{writes++;return current;}},readProject:async()=>assert.fail('published package must be authoritative')});
  assert.deepEqual((await api.read({operatorId})).adjustable,['dealer','branding']);
  for(const branding of [{table:tableId},{background:backgroundId},{color:'#112233'}])await assert.rejects(api.write({operatorId,actor,expectedRevision:1,branding}),error=>error.statusCode===422);
  assert.equal(writes,0);
  const saved=await api.write({operatorId,actor,expectedRevision:1,branding:{lane:'mobile-phone',dealer:'nora'}});
  assert.equal(saved.presentation.lanes[0].layers.dealer.default,'astrid');
  assert.equal(writes,1);
});
test('canonical separate layers accept exact assigned assets and preserve games and room IDs',async()=>{
  const presentation=makePresentation();
  let current={operatorId,revision:1,lanes:['mobile-phone'],games:['blackjack'],tables:['room-1'],branding:withPackagePresentation({},presentation)};
  const api=createPartnerBrandingApi({store:{getCurrentPackage:async()=>current,publishPackage:async input=>{current={...input,revision:current.revision+1};return current;}},readProject:async()=>assert.fail('no live catalogue fallback')});
  await assert.rejects(api.write({operatorId,actor,expectedRevision:1,branding:{background:'foreign-asset'}}),error=>error.statusCode===422);
  const saved=await api.write({operatorId,actor,expectedRevision:1,branding:{lane:'mobile-phone',background:backgroundId,table:tableId,color:'#112233',dealer:'nora'}});
  assert.equal(saved.packageRevision,2);
  assert.equal(saved.branding.table,tableId);
  assert.equal(saved.presentation.assets.find(asset=>asset.id===tableId).contentType,'image/png');
  assert.deepEqual(current.games,['blackjack']);
  assert.deepEqual(current.tables,['room-1']);
  assert.deepEqual(current.lanes,['mobile-phone']);
});

test('a package changed after the read is rejected by the atomic publisher',async()=>{
  const presentation=makePresentation();
  const current={operatorId,revision:1,lanes:['mobile-phone'],games:['blackjack'],tables:['room-1'],branding:withPackagePresentation({},presentation)};
  let attempts=0;
  const api=createPartnerBrandingApi({store:{getCurrentPackage:async()=>structuredClone(current),publishPackage:async input=>{
    attempts++;
    assert.equal(input.expectedRevision,1);
    throw Object.assign(Error('changed while awaiting publication'),{statusCode:409});
  }},readProject:async()=>assert.fail('no live fallback')});
  await assert.rejects(api.write({operatorId,actor,expectedRevision:1,branding:{dealer:'nora'}}),error=>error.statusCode===409);
  assert.equal(attempts,1);
  assert.equal(current.revision,1);
});

function createPartnerBrandingApi(options) {
  const readAdministration=async()=>{
    const pack=await options.store.getCurrentPackage(operatorId);
    return {revision:'admin-fixture',value:{gameLane:'portrait-astrid',gameLanes:[{schemaVersion:1,id:'portrait-astrid',label:'Astrid',renderer:'portrait-video',dealer:'astrid',mediaCollection:'astrid-presentation'}],
      rooms:pack.tables.map((id,index)=>({schemaVersion:2,id,name:id,operatorId,gameLaneId:'portrait-astrid',presentationLaneId:pack.lanes[index%pack.lanes.length],state:'live'}))}};
  };
  return createApi({...options,readAdministration,withWriteContext:work=>work({store:options.store,readAdministration,reauthorize:async()=>true})});
}


test('empty and unresolved package selections cannot be republished through branding',async()=>{
 for(const lanes of [[],['mobile-phone']]){
  let writes=0;const current={operatorId,revision:1,lanes,games:['blackjack'],tables:[],branding:{name:'Company'}};
  const api=createPartnerBrandingApi({store:{getCurrentPackage:async()=>current,publishPackage:async()=>{writes++;return current;}},readProject:async()=>({lanes:[]})});
  assert.deepEqual((await api.read({operatorId})).adjustable,[]);
  for(const branding of [{},{name:'Changed'}])await assert.rejects(api.write({operatorId,actor,expectedRevision:1,branding}),error=>error.statusCode===409);
  assert.equal(writes,0);assert.equal(current.revision,1);assert.deepEqual(current.branding,{name:'Company'});
 }
});
