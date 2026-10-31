import test from 'node:test';
import assert from 'node:assert/strict';
import { createF11Observer, validateF11Manifest, runF11EvidenceCli } from '../tools/shared-room-f11-observer.mjs';

const f11Manifest = () => ({ schemaVersion: 1, sha: 'a'.repeat(40), syntheticOnly: true,
  origin: 'https://preview.scoutgaming.tech', engineOrigin: 'https://croupier-k06-k07-staging.onrender.com',
  serviceId: 'srv-dbf61l0m7kps73ft7mk0', projectId: 'prj_7dgyvW5zakx1qJ8YaH5pueVTVi14',
  neonProjectId: 'red-violet-36066351', branchId: 'br-plain-voice-b9yu49xi', database: 'croupier_staging',
  environment: 'staging_k06_k07', workspaceId: 'croupier', roomId: 'f11-room', runId: 'f11-run',
  actors: ['f11-alice','f11-bob'], startedAt: 0, endedAt: 120000 });
function f11Capture() {
  const m = f11Manifest(), events = [];
  const add = (type,at,data) => events.push({type,at,...data});
  const target = at => add('target',at,{...m,source:'provider-api',engineSha:m.sha,vercelSha:m.sha,healthStatus:200,ready:true,suspended:false});
  const ledger = (id,actorId,amountCents,type) => ({id,actorId,amountCents,type,roundId:'round-2',fingerprint:'b'.repeat(64),
    sourceKey:JSON.stringify(['tick',m.roomId,'system',`tick-${id}`,actorId,type])});
  const wallet = (at,stage,{holds=false,hands=0,settled=false}={}) => add('money',at,{...m,stage,source:'preview-sql',hands,
    balances:m.actors.map((actorId,i)=>({actorId,balanceCents:settled?(i?9500:10500):10000})),
    reservations:holds?[{id:'reservation-1',actorId:m.actors[0],amountCents:500}]:[],
    ledger:settled?[ledger('1',m.actors[0],-500,'consume:stake'),ledger('2',m.actors[1],-500,'consume:stake'),ledger('3',m.actors[0],1000,'payout')]:[],
    settlements:settled?[{roundId:'round-2',actorId:m.actors[0],ledgerId:'3',returnedCents:1000},
      {roundId:'round-2',actorId:m.actors[1],ledgerId:null,returnedCents:0}]:[]});
  const open = (at,connectionId,actorId,instanceId) => add('open',at,{connectionId,actorId,roomId:m.roomId,connectionNonce:`nonce-${connectionId}`,
    instanceProof:{source:'render-app-log',logId:`log-${connectionId}`,connectionNonce:`nonce-${connectionId}`,instanceId,serviceId:m.serviceId,sha:m.sha,at}});
  const frame = (at,connectionId,actorId,version,phase='round') => add('frame',at,{connectionId,frame:{type:'shared-room-state',roomId:m.roomId,
    snapshot:{contract:'blackjack-table/1',configVersion:'config-1',roomId:m.roomId,me:{id:actorId},version,
      presentationVer:version,roundId:version<5?'round-1':'round-2',phase,turnSeq:version,windowId:`window-${version<5?1:2}`,
      owners:[...m.actors,null,null,null,null,null],seatGen:Array(7).fill(1),bets:Array.from({length:7},()=>({main:0,pp:0,tp:0})),
      round:phase==='round'?{phase:'decisions',active:0,boxes:[],hands:[],legalActions:['stand'],dealer:[{r:'8',s:'H',shoeDraw:2}]}:null,
      shoe:{id:'shoe-1',total:312,remaining:300,dealt:12,cutAfter:260,cutReached:false,commitment:'d'.repeat(64),shufflePending:false,decks:6,burn:1},
      plan:null,deadline:phase==='bets'?version*20000:null,actionDeadline:phase==='round'?version*15000:null},
    presentation:{roomId:m.roomId,ver:version,events:[{type:phase==='round'?'deal':'idle'}]}}});
  target(0);wallet(1,'before');open(1000,'old','f11-alice','instance-old');
  frame(2000,'old','f11-alice',1,'bets');frame(20000,'old','f11-alice',2);wallet(52000,'during',{holds:true});
  frame(40000,'old','f11-alice',3);wallet(61000,'during',{hands:2});
  open(50000,'new','f11-bob','instance-new');
  for(const [at,version,phase] of [[51000,4,'bets'],[60000,5,'round'],[75000,6,'round'],[89500,7,'round']]) {
    frame(at,'old','f11-alice',version,phase);frame(at+100,'new','f11-bob',version,phase);
  }
  add('close',90000,{connectionId:'old',code:1012});open(91000,'again','f11-alice','instance-new');
  frame(92000,'again','f11-alice',7);frame(105000,'new','f11-bob',8);frame(118000,'again','f11-alice',9,'settled');
  add('negative',118100,{source:'socket-capture',probe:'wrong-room',connectionId:'negative-room',actorId:m.actors[0],roomId:'f11-other',stateFrames:0,status:403});
  add('negative',118200,{source:'socket-capture',probe:'revoked-session',connectionId:'negative-session',actorId:m.actors[1],roomId:m.roomId,stateFrames:0,status:1008});
  wallet(119000,'after',{settled:true});target(120000);
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
  const c=f11Capture();for(const e of c.events.filter(e=>e.type==='open'))e.instanceProof.instanceId='instance-one';
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
    [c=>{c.events=c.events.filter(e=>e.stage!=='during');},'active_money_not_observed'],
    [c=>{c.events.find(e=>e.stage==='after').balances[0].balanceCents++;},'balance_mismatch'],
    [c=>{c.events.find(e=>e.stage==='after').hands=1;},'unsettled_money'],
    [c=>{const r=c.events.find(e=>e.stage==='after');r.ledger.push({...r.ledger[0],id:'99'});},'duplicate_wallet_effect'],
    [c=>{const r=c.events.find(e=>e.stage==='after');r.settlements.push({...r.settlements[0]});},'duplicate_settlement'],
    [c=>{c.events.find(e=>e.stage==='after').settlements[0].returnedCents++;},'payout_mismatch']]) {
    const c=f11Capture();mutate(c);assert.throws(()=>f11Review(c),new RegExp(code));
  }
});
test('F11 requires settlement for every debited actor and exact audited round, including losing hands',()=>{
  for(const mutate of [r=>{r.settlements=r.settlements.filter(s=>s.returnedCents>0);},
    r=>{r.settlements.find(s=>s.returnedCents===0).roundId='different-round';},
    r=>{r.ledger.find(e=>e.actorId==='f11-bob').roundId='different-round';}]) {
    const c=f11Capture();mutate(c.events.find(e=>e.stage==='after'));
    assert.throws(()=>f11Review(c),/consumption_without_settlement/);
  }
  const c=f11Capture();delete c.events.find(e=>e.stage==='after').ledger[0].roundId;
  assert.throws(()=>f11Review(c),/ledger_invalid/);
});

test('F11 requires complete shared snapshots and consistent ownership but permits player-specific projections',()=>{
  for(const key of ['contract','configVersion','windowId','turnSeq','round','shoe','plan','deadline','actionDeadline','owners','seatGen','bets']) {
    const c=f11Capture();for(const e of c.events.filter(e=>e.type==='frame'))delete e.frame.snapshot[key];
    assert.throws(()=>f11Review(c),/frame_invalid|snapshot_contract_incomplete/,key);
  }
  for(const key of ['owners','seatGen']) {
    const c=f11Capture(),s=c.events.find(e=>e.type==='frame'&&e.connectionId==='new').frame.snapshot;
    s[key][0]=key==='owners'?'f11-bob':2;
    assert.throws(()=>f11Review(c),/state_conflict/,key);
  }
  const c=f11Capture();for(const e of c.events.filter(e=>e.type==='frame')) {
    e.frame.snapshot.me.available=e.connectionId==='new'?5:10;
    e.frame.snapshot.serverNow=e.at;e.frame.snapshot.players=[{id:'f11-alice',online:e.connectionId==='new'}];
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
