import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedProject } from '../lab/lib/studio-model.mjs';
import { createStudioRepository } from '../web/storage/studio-repository.mjs';
import { createStudioMemoryPool } from './fixtures/studio-memory-pool.mjs';
import { StudioStorageError } from '../web/storage/studio-contract.mjs';
import { createStudioGamePolicy, studioGamePolicyConfiguration, exactRegisteredDealerIdle } from '../web/storage/studio-game-policy.mjs';

const scope = Object.freeze({ environment: 'test', workspaceId: 'croupier' });
const idle = dealerId => ({ dealerId, engineKey: 'idle-1/idle/idle', available: true });
const administration = () => ({
  tiers: { classic: 'vera', high: 'astrid', vip: 'amira' },
  rooms: [{ id: 'room', name: 'Room', scene: 'Dark', felt: 'Green', dealer: 'vera', state: 'live' }],
  pitboss: { payout10x: true, streak5: true, randomWalkMin: 45 },
  tournaments: [{ id: 't1', name: 'Open', format: '20 rounds', buyin: 100, pool: 25000, entries: 0, cap: 250, starts: 'Tonight', state: 'registering' }],
  voiceReview: { privateReview: true }, genVerdicts: {}, genLandings: {},
});
const rejected = (code, status = 503) => error => error instanceof StudioStorageError && error.code === code && error.statusCode === status;
async function fixture({ dealerIdle = idle, fixtureScope = scope, indexed = false } = {}) {
  const pool = createStudioMemoryPool(), repository = createStudioRepository({ pool, scope: fixtureScope });
  await repository.initializeDocument('project', { value: createSeedProject(), revision: 'project-original', actor: 'import' });
  const admin = administration();
  if (indexed) Object.assign(admin,{gameLane:'fixture-indexed',gameLanes:[{schemaVersion:1,id:'fixture-indexed',label:'Fixture',renderer:'indexed-video',dealer:'vera',mediaCollection:'legacy-dealers'}]});
  await repository.initializeDocument('administration', { value: admin, revision: 'admin-original', actor: 'import' });
  return { pool, repository, policy: createStudioGamePolicy({ repository, scope: fixtureScope, dealerIdle }) };
}

test('saved lane is shared across policy instances with CAS and preserves every unrelated setting',async () => {
  const {policy,repository}=await fixture();
  const before=await policy.readAdministration();
  assert.equal((await policy.readGameConfiguration()).gameLane,'mobile-phone');
  await policy.saveAdministration({...before.value,gameLane:'mobile-phone'},before.revision,{actor:'operator'});
  const second=createStudioGamePolicy({repository,scope,dealerIdle:idle});
  assert.equal((await second.readGameConfiguration()).gameLane,'mobile-phone');
  const saved=await second.readAdministration();const {gameLane,...unchanged}=saved.value;
  assert.deepEqual(unchanged,before.value);
  await assert.rejects(policy.saveAdministration({...before.value,gameLane:'original'},before.revision,{actor:'other'}),rejected('studio_conflict',409));
  assert.equal((await second.readGameConfiguration()).gameLane,'mobile-phone');
});

test('shared configuration is explicitly enabled, Neon-scoped, inert and never substitutes zones or defaults', () => {
  assert.equal(studioGamePolicyConfiguration({}), null);
  const env = { CROUPIER_STUDIO_NEON_POLICY: '1', CROUPIER_STUDIO_ENVIRONMENT_ID: 'test', CROUPIER_STUDIO_WORKSPACE_ID: 'croupier',
    CROUPIER_GAME_DATABASE_URL: 'postgresql://user:secret@test.neon.tech/game?sslmode=require', CROUPIER_ZONES_DATABASE_URL: 'postgresql://user:secret@test.neon.tech/zones?sslmode=require' };
  const config = studioGamePolicyConfiguration(env);
  assert.deepEqual(config.scope, scope); assert.ok(Object.isFrozen(config)); assert.ok(Object.isFrozen(config.scope));
  for (const changes of [{ CROUPIER_STUDIO_ENVIRONMENT_ID: '' }, { CROUPIER_STUDIO_WORKSPACE_ID: undefined },
    { CROUPIER_GAME_DATABASE_URL: env.CROUPIER_ZONES_DATABASE_URL }, { CROUPIER_GAME_DATABASE_URL: 'postgresql://user:secret@localhost/game' },
    { CROUPIER_GAME_DATABASE_URL: 'postgresql://user:secret@wrong.example/game?sslmode=require' }]) {
    assert.throws(() => studioGamePolicyConfiguration({ ...env, ...changes }), rejected('studio_invalid_configuration'));
  }
});

test('missing saved rows and invalid scope fail closed without seeding any documents', async () => {
  const pool = createStudioMemoryPool(), repository = createStudioRepository({ pool, scope });
  const policy = createStudioGamePolicy({ repository, scope, dealerIdle: idle });
  assert.equal(pool.connects, 0);
  await assert.rejects(policy.readSaved(), rejected('studio_game_policy_missing'));
  assert.equal(pool.snapshot().documents.size, 0); assert.equal(pool.snapshot().audits.length, 0);
  assert.throws(() => createStudioGamePolicy({ repository, scope: { ...scope, workspaceId: 'other' }, dealerIdle: idle }), rejected('studio_scope_mismatch'));
});

test('Studio and Render adapters receive the same exact saved project and a scoped immutable two-document revision', async () => {
  const { pool, repository, policy } = await fixture();
  const second = createStudioGamePolicy({ repository, scope, dealerIdle: idle });
  const saved = await policy.readSaved(), other = await second.readSaved();
  assert.deepEqual(saved, other); assert.match(saved.revision, /^studio-game-[a-f0-9]{64}$/);
  assert.equal(saved.project.revision, 'project-original'); assert.equal(saved.projectRevision, 'project-original');
  assert.equal(saved.administrationRevision, 'admin-original'); assert.equal(saved.configurationSource, 'neon/croupier_studio');
  assert.ok(Object.isFrozen(saved.project.lines[0].variants[0])); assert.ok(Object.isFrozen(saved.administration.tiers));
  assert.throws(() => { saved.administration.tiers.classic = 'mei'; }, TypeError);
  assert.deepEqual(await policy.projectStore().load(), saved.project);
  const publicConfig = await policy.readGameConfiguration();
  assert.equal(publicConfig.revision, saved.revision); assert.equal(Object.hasOwn(publicConfig, 'voiceReview'), false);
  assert.equal(Object.hasOwn(publicConfig, 'genVerdicts'), false); assert.equal(pool.snapshot().audits.length, 2);
});

test('a save never uses a draft as policy; both source revisions affect the shared revision', async () => {
  const { policy, repository, pool } = await fixture();
  const original = await policy.readSaved(), draft = structuredClone(original.project);
  draft.lines[0].label = 'Saved new label';
  assert.equal((await policy.readProject()).lines[0].label, original.project.lines[0].label);
  const saved = await policy.projectStore({ actor: 'operator' }).save(draft, original.projectRevision);
  assert.notEqual(saved.revision, original.projectRevision); assert.equal(draft.revision, original.projectRevision);
  const afterProject = await policy.readSaved();
  assert.notEqual(afterProject.revision, original.revision); assert.equal(afterProject.administrationRevision, original.administrationRevision);
  const admin = structuredClone(afterProject.administration); admin.tiers.vip = 'mei';
  await policy.saveAdministration(admin, afterProject.administrationRevision, { actor: 'operator' });
  const afterAdmin = await policy.readSaved();
  assert.notEqual(afterAdmin.revision, afterProject.revision); assert.equal(afterAdmin.projectRevision, afterProject.projectRevision);
  assert.equal((await repository.listDocumentHistory('project')).length, 1);
  assert.equal((await repository.listDocumentHistory('administration')).length, 1);
  assert.equal(pool.snapshot().audits.filter(row => row.action === 'save_document').length, 2);
});

test('one repeatable-read snapshot prevents a mixed project/admin view while another deployment saves', async () => {
  const { pool, repository } = await fixture();
  let signal, continueRead;
  const started = new Promise(resolve => { signal = resolve; }), gate = new Promise(resolve => { continueRead = resolve; });
  const connect = pool.connect.bind(pool); let pause = true;
  pool.connect = async () => {
    const client = await connect(), query = client.query.bind(client); let readOnly = false;
    client.query = async (sql, values) => {
      if (sql.startsWith('BEGIN')) readOnly = sql.includes('READ ONLY');
      const result = await query(sql, values);
      if (pause && readOnly && sql.includes('studio:read-document') && values[2] === 'project') { pause = false; signal(); await gate; }
      return result;
    };
    return client;
  };
  const policy = createStudioGamePolicy({ repository, scope, dealerIdle: idle });
  const pending = policy.readSaved(); await started;
  const next = administration(); next.tiers.classic = 'mei';
  await repository.saveDocument('administration', { value: next, expectedRevision: 'admin-original', actor: 'other-deployment' });
  continueRead(); const saved = await pending;
  assert.equal(saved.administrationRevision, 'admin-original'); assert.equal(saved.administration.tiers.classic, 'vera');
  assert.equal((await policy.readSaved()).administration.tiers.classic, 'mei');
  const readClient = pool.calls.find(call => call.sql === 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY').client;
  const reads = pool.calls.filter(call => call.marker === 'read-document' && call.client === readClient);
  assert.equal(reads[0].client, reads[1].client);
  assert.ok(pool.calls.some(call => call.sql === 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));
});

test('simultaneous Studio saves preserve CAS, exactly one history row and no double audit', async () => {
  const { policy, pool } = await fixture();
  const source = await policy.readSaved(), first = structuredClone(source.project), second = structuredClone(source.project);
  first.lines[0].label = 'First'; second.lines[0].label = 'Second';
  const results = await Promise.allSettled([first, second].map(value => policy.saveProject(value, source.projectRevision, { actor: 'editor' })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected' && rejected('studio_conflict', 409)(result.reason)).length, 1);
  assert.equal(pool.snapshot().history.length, 1); assert.equal(pool.snapshot().audits.length, 3);
});

test('tier assignments require the exact registered dealer idle and do not accept neighbouring keys or approximate duration', async () => {
  for (const record of [null, true, { ...idle('vera'), dealerId: 'amira' }, { ...idle('vera'), engineKey: 'idle-2/idle/idle', durationMs: 3000 },
    { ...idle('vera'), engineKey: 'idle-1/idle/idle-base1' }, { ...idle('vera'), available: false }]) assert.equal(exactRegisteredDealerIdle(record, 'vera'), false);
  assert.equal(exactRegisteredDealerIdle(idle('vera'), 'vera'), true);
  const { repository, pool } = await fixture({indexed:true});
  const policy = createStudioGamePolicy({ repository, scope, dealerIdle: dealerId => dealerId === 'mei' ? null : idle(dealerId) });
  assert.equal(await policy.canAssignDealer('mei'), false); assert.equal(await policy.canAssignDealer('vera'), true); assert.equal(await policy.canAssignDealer('__proto__'), false);
  const saved = await policy.readSaved(), proposed = structuredClone(saved.administration); proposed.tiers.vip = 'mei';
  await assert.rejects(policy.saveAdministration(proposed, saved.administrationRevision, { actor: 'editor' }), rejected('studio_game_dealer_unavailable', 409));
  assert.equal(pool.snapshot().history.length, 0); assert.equal((await policy.readSaved()).administration.tiers.vip, 'amira');
});

test('missing registered idle for an active tier rejects reads and never borrows another dealer', async () => {
  const { policy } = await fixture({ indexed:true, dealerIdle: dealerId => dealerId === 'astrid' ? idle('vera') : idle(dealerId) });
  await assert.rejects(policy.readSaved(), rejected('studio_game_dealer_unavailable'));
  await assert.rejects(policy.readGameConfiguration(), rejected('studio_game_dealer_unavailable'));
});

test('invalid game domains, hidden administration data and incompatible animation choices cannot be saved', async () => {
  const { policy, pool } = await fixture(); const original = await policy.readSaved(); const connections = pool.connects;
  const cases = [value => { delete value.tiers.classic; }, value => { value.tiers.extra = 'vera'; }, value => { value.tiers.classic = 'unknown'; },
    value => { delete value.rooms; }, value => { value.rooms[0].dealer = 'unknown'; }, value => { value.pitboss.randomWalkMin = -1; },
    value => { value.tournaments[0].buyin = -100; }, value => { value.clipAssignments = {}; }];
  for (const change of cases) {
    const draft = structuredClone(original.administration); change(draft);
    await assert.rejects(policy.saveAdministration(draft, original.administrationRevision, { actor: 'editor' }), error => error instanceof StudioStorageError && error.statusCode === 422);
  }
  const project = structuredClone(original.project), dealLine = project.lines.find(line => line.eventId.startsWith('deal.'));
  dealLine.variants[0].assetId = project.assets.find(asset => asset.animation === 'reveal').id;
  await assert.rejects(policy.saveProject(project, original.projectRevision, { actor: 'editor' }), error => error instanceof StudioStorageError && error.statusCode === 422);
  assert.equal(pool.connects, connections); assert.equal(pool.snapshot().history.length, 0);
});

test('persisted missing domains and SQL/schema/media failures produce fixed errors without disk/default fallback', async () => {
  const { policy, pool } = await fixture();
  pool.corruptDocument(scope, 'administration', row => ({ ...row, value: { tiers: administration().tiers } }));
  await assert.rejects(policy.readSaved(), rejected('studio_corrupt_game_policy'));
  pool.failNext('read-document', new Error('secret connection Neon schema missing private path'));
  await assert.rejects(policy.readSaved(), error => rejected('studio_storage_unavailable')(error) && !error.message.includes('secret'));
  const broken = await fixture({ dealerIdle: () => { throw new Error('provider URL secret'); } });
  await assert.rejects(broken.policy.readSaved(), rejected('studio_game_media_unavailable'));
  assert.equal(broken.pool.connects, 2); // Explicit fixture imports only, no attempted policy DB read.
});

test('read-only project adapter forbids unauthenticated writes and snapshots the actor and draft before awaiting', async () => {
  const { policy, repository, pool } = await fixture(); const original = await policy.readSaved();
  await assert.rejects(policy.projectStore().save(original.project, original.projectRevision), rejected('studio_invalid_actor', 422));
  let release; const gate = new Promise(resolve => { release = resolve; });
  const delayed = createStudioGamePolicy({ repository, scope, dealerIdle: async dealerId => { await gate; return idle(dealerId); } });
  const draft = structuredClone(original.project), options = { actor: 'editor' };
  draft.lines[0].label = 'Intended saved label';
  const pending = delayed.saveProject(draft, original.projectRevision, options);
  draft.lines[0].label = 'Mutated after submit'; options.actor = 'different-user'; release();
  const result = await pending; assert.ok(Object.isFrozen(result));
  assert.equal(result.lines[0].label, 'Intended saved label');
  assert.equal((await repository.listDocumentHistory('project'))[0].actor, 'editor');
  assert.equal(pool.connects, pool.releases);
});

test('saved projection revisions are scoped even if document contents and source revision ids match', async () => {
  const first = await fixture(), second = await fixture({ fixtureScope: { environment: 'test', workspaceId: 'another-workspace' } });
  assert.notEqual((await first.policy.readSaved()).revision, (await second.policy.readSaved()).revision);
});
