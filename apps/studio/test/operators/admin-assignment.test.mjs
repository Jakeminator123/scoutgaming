// Bolag › Tilldelat (ADMIN-FORENKLING 4.4 och 5.3) mot riktig PostgreSQL-SQL
// (PGlite): Admins skrivning av `assignment` i paketets branding genom
// operator-package (action publish-assignment). Behörighet (bara en
// N1-administratör med konto, aldrig partnern), validering (allow kan inte
// vidga miljön), CAS, journalpost och att Partnerportalen läser resultatet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { partnerPostgresFixture, PARTNER_ORIGIN } from '../fixtures/partner-postgres.mjs';
import { createOperatorPackageApi } from '../../lib/operator-package-api.mjs';
import { createStudioAdminApi } from '../../lib/studio-admin-api.mjs';
import { PARTNER_ASSIGNMENT_KEY } from '../../lib/partner-assignment.mjs';
import { readPackagePresentation, publicPackageBranding } from '../../../../packages/presentation/server/presentation-package.mjs';

const origin = 'https://studio.fixture.invalid';
const admin = { user: 'assignment-admin', role: 'admin', accountId: '7' };

test('Admin publishes the company assignment on PostgreSQL', async t => {
  const f = await partnerPostgresFixture(t);
  const api = createOperatorPackageApi({ pool: f.pool, scope: f.scope, repository: f.repository, videoRegistry: {} });
  let actor = admin;
  const http = createStudioAdminApi({ authorize: async () => ({ ...actor, scope: f.scope }), allowedOrigins: [origin], publicHosts: ['studio.fixture.invalid'],
    handlers: api.handlers, preparations: api.preparations, mutationTransaction: f.config.presentationTransaction });
  const post = async (body, as = admin, headers = {}) => {
    actor = as;
    const response = await http.handle(new Request(`${origin}/studio/api/admin/operator-package`, { method: 'POST',
      headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }));
    return { status: response.status, body: await response.json() };
  };
  const pack = () => f.direct.getCurrentPackage('north');
  const audit = () => f.rows(`SELECT action, access_class, actor_id, changes FROM croupier_studio.operator_audit_events
    WHERE environment_id=$1 AND workspace_id=$2 AND operator_id='north' AND action='package.publish' ORDER BY after_revision`, [f.scope.environment, f.scope.workspaceId]);
  const allow = (extra = {}) => ({ dealer: true, tableAsset: false, background: false, language: true, limit: true, pause: true, ...extra });
  const body = async (assignment, extra = {}) => ({ action: 'publish-assignment', operatorId: 'north', expectedPackageRevision: (await pack()).revision, assignment, ...extra });
  const unchanged = async (call, status, message) => {
    const before = { north: await pack(), south: await f.direct.getCurrentPackage('south'), audit: (await audit()).length };
    const result = await call();
    assert.equal(result.status, status, `${message}: ${JSON.stringify(result.body)}`);
    assert.deepEqual({ north: await pack(), south: await f.direct.getCurrentPackage('south'), audit: (await audit()).length }, before, `${message}: inget ändrat`);
    return result;
  };
  const wanted = { allow: allow(), limitPresets: ['casual', 'prive'], languages: ['sv', 'en'] };

  await t.test('only an N1 administrator with an account writes the assignment', async () => {
    await unchanged(async () => post(await body(wanted), { user: 'no-account', role: 'admin' }), 403, 'an administrator without an account');
    await unchanged(async () => post(await body(wanted), { user: 'viewer', role: 'viewer', accountId: '8' }), 403, 'a non-admin role');
    await unchanged(async () => post(await body(wanted), admin, { origin: PARTNER_ORIGIN }), 403, 'another origin');
    // Partnern kan inte skriva `assignment`, inte ens genom sitt eget utseendeutkast.
    const view = await (await f.call('branding')).json();
    const partner = await f.call('branding', { body: { action: 'save-draft', expectedDraftRevision: view.draftRevision, expectedPackageRevision: view.packageRevision,
      branding: { ...view.branding, [PARTNER_ASSIGNMENT_KEY]: { allow: { pause: true } } } } });
    assert.equal(partner.status, 422, 'a partner draft carrying assignment');
    assert.equal((await pack()).branding[PARTNER_ASSIGNMENT_KEY], undefined, 'nothing assigned yet');
  });

  await t.test('allow only narrows the scene template; lists are known values', async () => {
    await unchanged(async () => post(await body({ ...wanted, allow: allow({ tableAsset: true }) })), 422, 'table graphic the scene template does not open');
    await unchanged(async () => post(await body({ ...wanted, allow: allow({ background: true }) })), 422, 'background the scene template does not open');
    await unchanged(async () => post(await body({ ...wanted, allow: { dealer: true } })), 422, 'allow without every key');
    await unchanged(async () => post(await body({ ...wanted, allow: allow({ pause: 'yes' }) })), 422, 'allow that is not yes/no');
    await unchanged(async () => post(await body({ ...wanted, limitPresets: ['vip'] })), 422, 'an unknown bet profile');
    await unchanged(async () => post(await body({ ...wanted, languages: ['sv', 'sv'] })), 422, 'a repeated language');
    await unchanged(async () => post(await body({ ...wanted, limitPresets: [] })), 422, 'limit open without a profile');
    await unchanged(async () => post(await body({ ...wanted, extra: true })), 422, 'an unknown assignment field');
    await unchanged(async () => post(await body(wanted, { extra: true })), 400, 'an unknown request field');
    await unchanged(async () => post(await body(wanted, { expectedPackageRevision: (await pack()).revision - 1 })), 409, 'a stale package revision (CAS)');
    await unchanged(async () => post(await body(wanted, { operatorId: 'ghost' })), 404, 'an unknown company');
  });

  await t.test('a valid assignment is a new package revision with a journal entry; nothing else changes', async () => {
    const before = await pack(), south = await f.direct.getCurrentPackage('south');
    const saved = await post(await body(wanted));
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.packageRevision, before.revision + 1);
    assert.deepEqual(saved.body.assignment.allow, allow());
    assert.deepEqual(saved.body.assignment.adjustable, { dealer: true, tableAsset: false, background: false });
    const after = await pack();
    // Listorna sparas i fast ordning; allt annat i paketet står kvar.
    assert.deepEqual(after.branding[PARTNER_ASSIGNMENT_KEY], { allow: allow(), limitPresets: ['casual', 'prive'], languages: ['en', 'sv'] });
    assert.deepEqual([after.lanes, after.games, after.tables], [before.lanes, before.games, before.tables]);
    assert.deepEqual(publicPackageBranding(after.branding), publicPackageBranding(before.branding));
    assert.deepEqual(readPackagePresentation(after), readPackagePresentation(before));
    assert.deepEqual(await f.direct.getCurrentPackage('south'), south, 'the other company is untouched');
    const [entry] = (await audit()).slice(-1);
    assert.deepEqual([entry.access_class, entry.actor_id], ['internal-admin', '7']);
    const changes = JSON.parse(entry.changes);
    assert.deepEqual(changes.before, { assignment: null });
    assert.deepEqual(changes.after.assignment, after.branding[PARTNER_ASSIGNMENT_KEY]);
    // Partnerportalen läser den publicerade tilldelningen.
    const read = await (await f.call('assignment')).json();
    assert.deepEqual(read.assignment.allow, allow());
    assert.deepEqual(read.assignment.limitPresets, ['casual', 'prive']);
    // Admin smalnar av: dealer och paus stängs.
    const narrowed = await post(await body({ allow: allow({ dealer: false, pause: false }), limitPresets: ['casual'], languages: ['sv'] }));
    assert.equal(narrowed.status, 200, JSON.stringify(narrowed.body));
    const closed = await (await f.call('assignment')).json();
    assert.equal(closed.assignment.allow.dealer, false);
    assert.equal(closed.assignment.allow.pause, false);
    const room = closed.rooms[0];
    assert.equal((await f.call('room-state', { body: { roomId: room.id, state: 'pending', expectedState: 'live', expectedPackageRevision: closed.packageRevision } })).status, 403,
      'the partner cannot pause once Admin closed allow.pause');
  });
});

// One Admin click crosses the real HTTP/auth/preparation/SQL transaction path.
test('combined company publication is one SQL package transaction', async t => {
  const f = await partnerPostgresFixture(t);
  const doc = await f.raw.readDocument('project'), extra = structuredClone(f.lane);
  extra.id = 'second-scene'; extra.label = 'Second scene'; extra.operatorAdjustable = [];
  doc.value.lanes.push(extra);
  await f.raw.saveDocument('project', {value:doc.value, expectedRevision:doc.revision, actor:'fixture'});
  const registry = {loadCaptured:async snapshot=>({videos:snapshot.mediaRows.map(row=>({...row,dealer:row.classification.dealerId,bytes:row.size,available:true,integrity:'verified'})),families:[],summary:{readable:true,snapshotReadable:true}}),verifyCapturedMedia:async()=>{}};
  const api = createOperatorPackageApi({pool:f.pool,scope:f.scope,repository:f.repository,videoRegistry:registry});
  let actor = admin, revoke = false, authorizations = 0;
  const http = createStudioAdminApi({authorize:async()=>({...actor, ...(revoke && ++authorizations >= 3 ? {role:'viewer'} : {}), scope:f.scope}),
    allowedOrigins:[origin],publicHosts:['studio.fixture.invalid'],handlers:api.handlers,preparations:api.preparations,mutationTransaction:f.config.presentationTransaction});
  const pack = () => f.direct.getCurrentPackage('north');
  const assignment = {allow:{dealer:true,tableAsset:false,background:false,language:true,limit:true,pause:true},limitPresets:['casual'],languages:['sv']};
  const body = async patch => ({action:'publish-company-assignment',operatorId:'north',lanes:[f.lane.id,extra.id],expectedPackageRevision:(await pack()).revision,assignment,...patch});
  const post = async input => {const response=await http.handle(new Request(origin+'/studio/api/admin/operator-package',{method:'POST',
    headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify(input)}));return {status:response.status,body:await response.json()};};
  const snapshot = async () => ({north:await pack(),south:await f.direct.getCurrentPackage('south'),project:await f.raw.readDocument('project'),administration:await f.raw.readDocument('administration'),
    packages:await f.rows('SELECT row_to_json(t)::text AS row FROM croupier_studio.operator_packages t ORDER BY row'),
    audits:await f.rows('SELECT row_to_json(t)::text AS row FROM croupier_studio.operator_audit_events t ORDER BY row'),
    drafts:await f.rows('SELECT row_to_json(t)::text AS row FROM croupier_studio.operator_branding_drafts t ORDER BY row')});
  const unchanged = async (input,status) => {const before=await snapshot(),response=await post(input);assert.equal(response.status,status,JSON.stringify(response.body));assert.deepEqual(await snapshot(),before);};
  await t.test('rejects role, account, stale CAS, foreign company, invalid lanes and final assignment without changes', async () => {
    actor={user:'viewer',role:'viewer',accountId:'8'};await unchanged(await body(),403);
    actor={user:'anonymous-admin',role:'admin'};await unchanged(await body(),403);actor=admin;
    for(const [patch,status] of [[{expectedPackageRevision:1},409],[{expectedPackageRevision:null},400],[{operatorId:'ghost'},404],
      [{lanes:['unknown']},422],[{lanes:[f.lane.id,f.lane.id]},422],[{lanes:[extra.id]},422],
      [{assignment:{...assignment,languages:[]}},422],[{extra:true},400]]) await unchanged(await body(patch),status);
    revoke=true;authorizations=0;await unchanged(await body(),403);revoke=false;
    const context={body:await body(),actor:admin,scope:{...f.scope,workspaceId:'foreign'}};
    await assert.rejects(api.preparations.get('POST /studio/api/admin/operator-package')(context),e=>e.statusCode===403);
    const fallback=createOperatorPackageApi({pool:f.pool,scope:f.scope,project:doc.value});
    await assert.rejects(fallback.handlers.get('POST /studio/api/admin/operator-package')({...context,scope:f.scope}),e=>e.statusCode===503);
  });
  await t.test('an audit failure after package insertion rolls the whole transaction back', async () => {
    const connect=f.pool.connect;let inserted=false,failed=false;
    f.pool.connect=async()=>{const client=await connect();return {...client,query:async(sql,values)=>{
      if(sql.includes('operator-store:publish-package'))inserted=true;
      if(!failed&&sql.includes('operator-store:audit-write')){failed=true;throw Error('injected audit failure');}
      return client.query(sql,values);
    }};};
    try{await unchanged(await body(),503);assert.equal(inserted,true);assert.equal(failed,true);}finally{f.pool.connect=connect;}
  });
  await t.test('publishes both fields in one revision, one package audit, and keeps other companies and drafts', async () => {
    const view=await (await f.call('branding')).json();
    const draft=await f.call('branding',{body:{action:'save-draft',expectedDraftRevision:view.draftRevision,expectedPackageRevision:view.packageRevision,branding:{...view.branding,dealer:'paow'}}});
    assert.equal(draft.status,200);
    const before=await snapshot(),oldDraft=await f.direct.getBrandingDraft('north'),response=await post(await body());
    assert.equal(response.status,200,JSON.stringify(response.body));
    const after=await snapshot();assert.equal(after.north.revision,before.north.revision+1);assert.equal(after.packages.length,before.packages.length+1);
    assert.deepEqual(after.north.lanes,[f.lane.id,extra.id].sort());assert.deepEqual(after.north.branding.assignment,assignment);
    assert.deepEqual(after.south,before.south);assert.deepEqual(after.project,before.project);assert.deepEqual(after.administration,before.administration);
    assert.deepEqual([after.north.games,after.north.tables,after.north.rooms],[before.north.games,before.north.tables,before.north.rooms]);
    const audits=await f.rows("SELECT changes, actor_id, access_class FROM croupier_studio.operator_audit_events WHERE operator_id='north' AND action='package.publish' ORDER BY after_revision");
    assert.equal(audits.length,3);const entry=audits.at(-1),changes=JSON.parse(entry.changes);
    assert.deepEqual([entry.actor_id,entry.access_class],['7','internal-admin']);assert.deepEqual(changes.after.assignment,assignment);assert.deepEqual(changes.after.lanes,after.north.lanes);
    const nextDraft=await f.direct.getBrandingDraft('north');assert.deepEqual(nextDraft.branding,oldDraft.branding);assert.equal(nextDraft.basePackageRevision,after.north.revision);
    const partner=await (await f.call('assignment')).json();assert.deepEqual(partner.assignment.allow,assignment.allow);assert.deepEqual(partner.assignment.lanes.map(row=>row.id).sort(),after.north.lanes);
    assert.deepEqual(response.body.assignment.allow,assignment.allow);assert.equal(response.body.packageRevision,after.north.revision);
  });
});
