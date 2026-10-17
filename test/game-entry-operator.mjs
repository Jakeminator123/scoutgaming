import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedProject, defaultPresentationLane } from '../packages/presentation/contracts/studio-model.mjs';
import { historicalDealerProject } from './fixtures/historical-dealer-project.mjs';
import { createStudioRepository } from '../web/storage/studio-repository.mjs';
import { createStudioGamePolicy } from '../web/storage/studio-game-policy.mjs';
import { createOperatorPackageReader } from '../web/storage/operator-package-reader.mjs';
import { createGameEntrySelector, OPERATOR_NOT_FOUND_HTML, requestedOperator } from '../web/game-entry-operator.mjs';
import { decorateGameEntryHtml } from '../web/public/game-entry-contract.mjs';
import { gameLaneFromDocument } from '../web/public/game-lanes.mjs';
import { createStudioMemoryPool } from './fixtures/studio-memory-pool.mjs';
import { operatorPackageSql, operatorRow, packageRow } from './fixtures/operator-package-sql.mjs';

const scope = Object.freeze({ environment: 'test', workspaceId: 'croupier' });
const env = { CROUPIER_STUDIO_NEON_POLICY: '1' };
const html = '<!doctype html><html lang="sv"><body></body></html>';
const idle = dealerId => ({ dealerId, engineKey: 'idle-1/idle/idle', available: true });
const legacy = { schemaVersion: 1, id: 'legacy', label: 'Legacy', renderer: 'indexed-video', dealer: 'vera', mediaCollection: 'legacy-dealers' };
const mobile = { schemaVersion: 1, id: 'mobile-phone', label: 'Mobile Phone Lane', renderer: 'portrait-video', dealer: 'astrid', mediaCollection: 'astrid-presentation' };
const administration = (lanes = {}) => ({
  tiers: { classic: 'vera', high: 'astrid', vip: 'amira' },
  rooms: [{ id: 'room', name: 'Room', scene: 'Dark', felt: 'Green', dealer: 'vera', state: 'live' }],
  pitboss: { payout10x: true, streak5: true, randomWalkMin: 45 },
  tournaments: [], ...lanes,
});
const historicalPresentationLane = (id, dealers, dealer) => ({ ...defaultPresentationLane('astrid'), id, label: `${id} lane`, dealers,
  layers: { ...defaultPresentationLane('astrid').layers, dealer: { enabled: true, ...dealer } } });


async function fixture({ lanes = {gameLane:mobile.id,gameLanes:[mobile]}, projectLanes, operators, packages, project = createSeedProject() } = {}) {
  const pool = createStudioMemoryPool(), repository = createStudioRepository({ pool, scope });
  project.lanes = projectLanes ?? [defaultPresentationLane('astrid')];
  await repository.initializeDocument('project', { value: project, revision: 'project-original', actor: 'import' });
  await repository.initializeDocument('administration', { value: administration(lanes), revision: 'admin-original', actor: 'import' });
  const policy = createStudioGamePolicy({ repository, scope, dealerIdle: idle });
  const reads = { configuration: 0, saved: 0 };
  const counted = { readGameConfiguration: () => { reads.configuration += 1; return policy.readGameConfiguration(); },
    readSaved: () => { reads.saved += 1; return policy.readSaved(); } };
  const db = operatorPackageSql({
    operators: operators ?? [operatorRow(scope, 'sg-test', 'sg-test'), operatorRow(scope, 'no-package', 'no-package'),
      operatorRow(scope, 'paused', 'paused', 'suspended')],
    packages: packages ?? [packageRow(scope, 'sg-test', 1, ['legacy']), packageRow(scope, 'sg-test', 2, ['mobile-phone'], '{"felt":"#0a5"}')],
  });
  const logs = [];
  const log = (...line) => logs.push(line.join(' '));
  const packageReader = createOperatorPackageReader({ sql: db.sql, scope, log });
  const select = createGameEntrySelector({ policy: counted, packages: packageReader, log });
  const page = async query => {
    const entry = await select(new URLSearchParams(query));
    return entry.status === 404 ? { status: 404, body: OPERATOR_NOT_FOUND_HTML } : { status: 200, body: decorateGameEntryHtml(html, env, entry.selection), selection: entry.selection };
  };
  return { page, select, db, logs, reads };
}

test('saved explicit entry reads no operator storage and never creates another dealer',async()=>{
 const f=await fixture(),result=await f.page('');
 assert.equal(result.status,200);assert.equal(result.selection.dealer,'astrid');assert.equal(result.selection.presentation,'local');
 assert.deepEqual(result.selection.registeredDealers,[{id:'astrid',label:'Astrid'}]);assert.deepEqual(f.db.calls,[]);
 assert.equal((await f.page('?dealer=amira')).status,404);assert.equal((await f.page('?dealer=unknown')).status,404);
});
test('published operator entry carries exact package revision and escaped metadata',async()=>{
 const f=await fixture(),result=await f.page('?operator=sg-test');
 assert.equal(result.status,200);assert.equal(result.selection.operator,'sg-test');assert.equal(result.selection.packageRevision,2);
 assert.equal(result.selection.localDealer,'astrid');assert.match(result.body,/data-game-registered-dealers=/);assert.match(result.body,/data-game-package-revision="2"/);
 assert.deepEqual(result.selection.choices.dealers,['astrid']);
});
test('unknown, suspended and ambiguous operator identities cannot reach another package',async()=>{
 const f=await fixture();for(const query of ['?operator=nobody','?operator=paused'])assert.equal((await f.page(query)).status,404);
 const count=f.db.calls.length;for(const query of ['?operator=','?operator=Bad','?operator=play','?operator=sg-test&operator=sg-test'])assert.equal((await f.page(query)).status,404);
 assert.equal(f.db.calls.length,count);assert.equal(requestedOperator(new URLSearchParams('lane=mobile-phone')),undefined);
});
test('unreadable storage and missing publication cannot select the saved default',async()=>{
 const f=await fixture();assert.equal((await f.page('?operator=no-package')).status,404);
 f.db.state.fail=Object.assign(Error('unavailable'),{code:'42501'});
 await assert.rejects(f.page('?operator=sg-test'),error=>error.statusCode===503);
});
test('published lane intersection is authoritative, including an empty intersection',async()=>{
 const beta={...mobile,id:'beta'};
 const f=await fixture({lanes:{gameLane:mobile.id,gameLanes:[mobile,beta]},projectLanes:[defaultPresentationLane('astrid'),{...defaultPresentationLane('astrid'),id:'beta'}],packages:[packageRow(scope,'sg-test',4,['beta'])]});
 for(const query of ['?operator=sg-test','?operator=sg-test&lane=mobile-phone'])assert.equal((await f.page(query)).selection.lane,'beta');
 const missing=await fixture({packages:[packageRow(scope,'sg-test',5,['missing'])]});await assert.rejects(missing.page('?operator=sg-test'),error=>error.statusCode===503);
});
test('explicit dealer outside a saved presentation is rejected rather than substituted',async()=>{
 const f=await fixture();for(const query of ['?dealer=vera','?operator=sg-test&dealer=vera','?dealer=astrid&dealer=mei'])assert.equal((await f.page(query)).status,404);
 const bad=await fixture({project:historicalDealerProject('vera'),projectLanes:[historicalPresentationLane('mobile-phone',['vera'],{default:'vera',allowed:['vera']})]});
 await assert.rejects(bad.page('?operator=sg-test'),error=>error.statusCode===503);
});
test('all choices are escaped and tampered dealer authority is rejected',async()=>{
 const lane=defaultPresentationLane('astrid');lane.layers.table.colors=['#112233','#aabbcc'];lane.layers.table.default='#112233';lane.layers.background.mode='image';lane.layers.background.allowed=['room"<script>'];lane.layers.background.default='room"<script>';
 const f=await fixture({projectLanes:[lane]}),result=await f.page('');assert.equal(result.body.includes('<script'),false);
 const data={gameLane:'mobile-phone',gameDealer:'astrid',gamePresentation:'local',gameLocalDealer:'astrid',gameRegisteredDealers:JSON.stringify(result.selection.registeredDealers),gameChoices:JSON.stringify(result.selection.choices)};
 assert.deepEqual(gameLaneFromDocument(data).choices.tableColors,['#112233','#aabbcc']);
 for(const choices of ['{','null',JSON.stringify({...result.selection.choices,dealers:['unknown']}),JSON.stringify({...result.selection.choices,dealerDefault:'mei'})])assert.throws(()=>gameLaneFromDocument({...data,gameChoices:choices}));
});
test('policy failures reject and invalid selectors do not access policy',async()=>{
 const policy={readGameConfiguration:async()=>{throw Error('policy');},readSaved:async()=>{throw Error('policy');}};
 const select=createGameEntrySelector({policy,packages:{resolve:async()=>null}});
 await assert.rejects(select(''));await assert.rejects(select('?operator=sg-test'));assert.equal((await select('?operator=Bad')).status,404);
 assert.throws(()=>createGameEntrySelector({policy:{}}));
});
test('historical indexed configuration remains readable but cannot launch',async()=>{
 const f=await fixture({lanes:{gameLane:'legacy',gameLanes:[legacy]}});
 await assert.rejects(f.page(''),/cloud/);
});
