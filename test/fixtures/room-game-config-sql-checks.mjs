// Invoked only by the task-owned loopback PostgreSQL runner. No production resolver or media I/O.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createStudioRepository } from '../../packages/studio-registry/server/document-repository.mjs';
import { createOperatorStore } from '../../packages/operators/server/operator-store.mjs';
import { createRoomGameConfigApi } from '../../apps/studio/lib/room-game-config-api.mjs';
import { createSharedTableProofReadout } from '../../apps/studio/lib/shared-table-proof-readout.mjs';
import { cloudPresentationFixture } from '../../apps/studio/test/fixtures/cloud-presentation.mjs';
import { defaultPresentationLane } from '../../packages/presentation/contracts/studio-model.mjs';
import { withPackagePresentation } from '../../packages/presentation/server/presentation-package.mjs';
import { canonicalStudioJson } from '../../packages/studio-registry/server/document-contract.mjs';
import { createPostgresTableStore } from '../../services/game/games/blackjack/table/postgres-store.mjs';
import { createTableCoordinator } from '../../services/game/games/blackjack/table/coordinator.mjs';
import { deterministicRandom } from './blackjack-deterministic-random.mjs';
import { openProof, replayShuffle } from '../../services/game/games/blackjack/shoe-proof.mjs';
import { readRuntimeCatalogFixture } from './runtime-media-catalog.mjs';
import { runtimeCatalogJson, runtimeCatalogRevision } from '../../packages/studio-registry/server/runtime-catalog.mjs';

export async function runRoomGameConfigSqlChecks({ pool, createPool, restart }) {
  const target = (await pool.query('SELECT current_user AS role,current_database() AS database,inet_server_addr()::text AS address')).rows[0];
  assert.equal(target.role, 'studio_qa'); assert.equal(target.database, 'postgres');
  assert.ok(['127.0.0.1', '127.0.0.1/32'].includes(target.address));
  const scope = { environment: 'j08_sql_fixture', workspaceId: 'isolated' }, params = [scope.environment, scope.workspaceId];
  const actor = { user: 'j08-admin', role: 'admin' }, roomId = 'room-j08', operatorId = 'j08-operator';
  const cloud = cloudPresentationFixture({ lanes: [defaultPresentationLane('linnea')] });
  const room = { schemaVersion: 2, id: roomId, name: 'Isolated J08', operatorId, presentationLaneId: 'mobile-phone', gameLaneId: 'room-lane', state: 'live' };
  const administration = { rooms: [room], gameLane: 'room-lane', gameLanes: [{ schemaVersion: 1, id: 'room-lane', label: 'Room', renderer: 'portrait-video', dealer: 'linnea', mediaCollection: 'linnea-presentation' }] };
  let secondPool = createPool(), repository, otherRepository, api, otherApi, store, table, time = 100000, command = 0;
  const checks = [], check = async (name, work) => { await work(); checks.push(name); console.log(`ok - ${name}`); };
  // Synthetic timings and exact fixture metadata are explicit injection here only.
  // They establish transaction behaviour, never a real K04 media/planning acceptance.
  const resolveMaterial = ({ language }) => ({ revision: 'j08-test-only-planning', dealerId: 'linnea', language, leadMs: 1200, cardMs: 880,
    media: cloud.mediaRows.map(({ id, sha256 }) => ({ id, sha256 })) });
  const open = () => {
    repository = createStudioRepository({ pool, scope }); otherRepository = createStudioRepository({ pool: secondPool, scope });
    api = createRoomGameConfigApi({ repository, scope, resolveMaterial }); otherApi = createRoomGameConfigApi({ repository: otherRepository, scope, resolveMaterial });
    store = createPostgresTableStore({ pool, walletMode: 'demo' });
    table = createTableCoordinator({ store, clock: { now: () => time }, random: deterministicRandom('j08-config-sql') });
  };
  open();
  const invoke = (surface, method, body, identity = actor) => surface.handlers.get(`${method} /studio/api/admin/room-game-config`)({ scope, actor: identity, body,
    request: new Request(`https://fixture.invalid/studio/api/admin/room-game-config?operatorId=${operatorId}&roomId=${roomId}`, { method }) });
  const read = (surface = api) => invoke(surface, 'GET');
  const draftBody = (state, gameConfig = { language: 'sv', limitPreset: 'prive' }) => ({ action: 'save-draft', operatorId, roomId,
    expectedAdministrationRevision: state.administrationRevision, expectedPackageRevision: state.packageRevision, gameConfig });
  const publishBody = state => ({ action: 'publish', operatorId, roomId, expectedAdministrationRevision: state.administrationRevision,
    expectedPackageRevision: state.packageRevision, expectedDraftRevision: state.draft.revision });
  const save = async (gameConfig, surface = api) => invoke(surface, 'POST', draftBody(await read(surface), gameConfig));
  const publish = (state, surface = api, identity = actor) => invoke(surface, 'POST', publishBody(state), identity);
  const rows = async (tableName, order) => (await pool.query(`SELECT * FROM ${tableName} ORDER BY ${order}`)).rows;
  const persisted = async () => ({ documents: await rows('croupier_studio.documents', 'kind'), history: await rows('croupier_studio.document_history', 'kind,revision'),
    audits: await rows('croupier_studio.audit_events', 'event_id'), packageAudit: await rows('croupier_studio.operator_audit_events', 'event_id'),
    packages: await rows('croupier_studio.operator_packages', 'package_revision'), configs: await rows('croupier_game.shared_table_configs', 'version'), heads: await rows('croupier_game.shared_table_config_heads', 'room_id') });
  const status = wanted => error => error?.statusCode === wanted;
  const withPublication = (work, repo = repository) => repo.transaction(() => repo.withTransactionClient(async client => {
    const operators = await createOperatorStore({ sql: client, scope, transaction: callback => repo.withTransactionClient(callback) });
    const current = await operators.getCurrentPackage(operatorId);
    assert.ok(current, 'fixture must already have a published package');
    const input = { actor: actor.user, operatorId, expectedRevision: current.revision,
      lanes: current.lanes, games: current.games, tables: current.tables, branding: structuredClone(current.branding) };
    return work({ operators, input, current, client });
  }));
  const appearanceInput = (input, color) => ({ ...input, branding: { ...input.branding,
    roomOverrides: { ...input.branding.roomOverrides, [roomId]: { ...input.branding.roomOverrides?.[roomId], color } } } });
  await repository.initializeDocument('administration', { value: administration, revision: 'j08-initial', actor: actor.user });
  await repository.initializeDocument('project', { value: cloud.project, revision: cloud.project.revision, actor: actor.user });
  for (const { revision: _revision, updatedAt: _updatedAt, ...record } of cloud.mediaRows)
    await repository.registerMedia(record, { actor: actor.user });
  const catalog = readRuntimeCatalogFixture();
  await pool.query('INSERT INTO croupier_studio.runtime_media_catalogs(environment_id,workspace_id,revision,value) VALUES($1,$2,$3,$4::jsonb)',
    [...params, runtimeCatalogRevision(catalog), runtimeCatalogJson(catalog)]);
  await pool.query('INSERT INTO croupier_studio.operators(environment_id,workspace_id,operator_id,slug,name,status,created_at_ms) VALUES($1,$2,$3,$4,$5,$6,$7)', [...params, operatorId, 'j08-operator', 'Isolated operator', 'active', 1]);
  await pool.query('INSERT INTO croupier_studio.operator_packages(environment_id,workspace_id,operator_id,package_revision,lanes,games,tables,branding,published_at_ms) VALUES($1,$2,$3,1,$4,$5,$6,$7,1)',
    [...params, operatorId, '["mobile-phone"]', '["blackjack"]', JSON.stringify([roomId]), canonicalStudioJson(withPackagePresentation({}, cloud.presentation))]);
  // A real PostgreSQL trigger rejects the final audit write, after every earlier mutation.
  await pool.query(`CREATE FUNCTION croupier_studio.j08_fixture_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.actor='j08-sql-fault' THEN RAISE EXCEPTION 'isolated J08 injected SQL audit failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER j08_fixture_fail_audit AFTER INSERT ON croupier_studio.audit_events FOR EACH ROW EXECUTE FUNCTION croupier_studio.j08_fixture_fail_audit()`);
  // Transaction-local fixture switches exercise the actual INSERT/UPDATE/CAS
  // and final package audit in PostgreSQL. They never run outside this owned cluster.
  await pool.query(`CREATE FUNCTION croupier_game.j08_fixture_conflict_config_head() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF current_setting('j08.force_head_conflict',true)='on' THEN
      UPDATE croupier_game.shared_table_config_heads SET version=NEW.version WHERE room_id=NEW.room_id;
    END IF; RETURN NEW; END $$;
    CREATE TRIGGER j08_fixture_conflict_config_head AFTER INSERT ON croupier_game.shared_table_configs
      FOR EACH ROW EXECUTE FUNCTION croupier_game.j08_fixture_conflict_config_head();
    CREATE FUNCTION croupier_studio.j08_fixture_fail_package_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF current_setting('j08.fail_package_audit',true)='on' THEN RAISE EXCEPTION 'isolated J08 injected package audit failure'; END IF;
      RETURN NEW; END $$;
    CREATE TRIGGER j08_fixture_fail_package_audit AFTER INSERT ON croupier_studio.operator_audit_events
      FOR EACH ROW EXECUTE FUNCTION croupier_studio.j08_fixture_fail_package_audit()`);

  await check('j08-two-physical-clients-save-read-and-stale-admin-package-draft-cas', async () => {
    const a = await pool.connect(), b = await secondPool.connect();
    try { assert.notEqual((await a.query('SELECT pg_backend_pid() AS pid')).rows[0].pid, (await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid); }
    finally { a.release(); b.release(); }
    const initial = await read(), first = await save(); assert.deepEqual((await read(otherApi)).draft, first.draft);
    assert.equal(first.publication.ready, true); assert.equal(first.published, null);
    const before = await persisted();
    await assert.rejects(invoke(otherApi, 'POST', draftBody(initial)), status(409));
    await assert.rejects(invoke(otherApi, 'POST', { ...draftBody(first), expectedPackageRevision: 99 }), status(409));
    await assert.rejects(invoke(otherApi, 'POST', { ...publishBody(first), expectedDraftRevision: 'room-config-00000000-0000-4000-8000-000000000000' }), status(409));
    assert.deepEqual(await persisted(), before);
  });
  await check('j08-sql-save-failure-rolls-document-history-audit-back', async () => {
    const current = await read(), before = await persisted();
    await assert.rejects(invoke(api, 'POST', draftBody(current, { language: 'en', limitPreset: 'high' }), { ...actor, user: 'j08-sql-fault' }), status(503));
    assert.deepEqual(await persisted(), before); assert.deepEqual(await read(otherApi), current);
  });
  await check('j08-native-missing-material-and-wrong-language-or-hash-never-publish', async () => {
    const draft = await read(), before = await persisted();
    const missing = createRoomGameConfigApi({ repository, scope });
    assert.equal((await read(missing)).publication.ready, false); await assert.rejects(publish(draft, missing), status(422));
    for (const change of ['language', 'sha256']) {
      const invalid = createRoomGameConfigApi({ repository, scope, resolveMaterial: input => {
        const value = resolveMaterial(input); if (change === 'language') value.language = 'en'; else value.media[0].sha256 = 'f'.repeat(64); return value;
      } });
      await assert.rejects(publish(draft, invalid), status(422));
    }
    await assert.rejects(invoke(api, 'GET', undefined, { user: 'partner', role: 'partner' }), status(403));
    assert.deepEqual(await persisted(), before);
  });
  await check('j08-sql-publication-failure-rolls-package-config-head-draft-history-and-audits-back', async () => {
    const draft = await read(), before = await persisted();
    await assert.rejects(publish(draft, api, { ...actor, user: 'j08-sql-fault' }), status(503));
    assert.deepEqual(await persisted(), before); assert.deepEqual(await read(otherApi), draft);
  });
  let firstPublication;
  await check('j08-two-client-duplicate-publication-commits-one-package-and-one-config', async () => {
    const draft = await read(), result = await Promise.allSettled([publish(draft), publish(draft, otherApi)]);
    assert.equal(result.filter(row => row.status === 'fulfilled').length, 1);
    assert.equal(result.find(row => row.status === 'rejected').reason.statusCode, 409);
    firstPublication = result.find(row => row.status === 'fulfilled').value;
    assert.equal(firstPublication.packageRevision, 2); assert.equal(firstPublication.draft, null);
    const saved = await persisted(); assert.equal(saved.packages.length, 2); assert.equal(saved.configs.length, 1); assert.equal(saved.packageAudit.length, 1);
    const frozen = JSON.parse(saved.configs[0].body); assert.equal(frozen.language, 'sv'); assert.equal(frozen.betMs, 20000); assert.equal(frozen.actionMs, 15000);
    assert.equal(frozen.material.revision, 'j08-test-only-planning'); assert.equal(frozen.packageRevision, 2);
    assert.equal(JSON.parse(saved.packages.at(-1).branding).roomGameConfigVersions[roomId], frozen.configVersion);
    assert.equal(saved.heads[0].version, frozen.configVersion); assert.deepEqual(await read(otherApi), firstPublication);
  });
  let secondPublication;
  await check('j08-published-config-stays-frozen-through-window-round-settlement-and-reconstruction', async () => {
    const playerId = 'j08-player';
    await pool.query('INSERT INTO croupier_game.players(id,name,balance,created_at) VALUES($1,$2,$3,$4)', [playerId, 'Synthetic player', 1000, '2026-10-22T00:00:00.000Z']);
    const send = (op, body = {}) => table.command({ actorId: playerId }, { roomId, commandId: `j08-${++command}`, op, ...body });
    await send('join', { seats: [0], seatGens: { 0: 0 }, memberGen: 0 });
    const original = await table.snapshot(roomId, playerId), savedBody = (await persisted()).configs[0].body;
    assert.equal(original.configVersion, firstPublication.published.configVersion);
    secondPublication = await publish(await save({ language: 'en', limitPreset: 'high' }, otherApi), otherApi);
    assert.notEqual(secondPublication.published.configVersion, original.configVersion);
    table = createTableCoordinator({ store: createPostgresTableStore({ pool: secondPool, walletMode: 'demo' }), clock: { now: () => time }, random: deterministicRandom('j08-reconstructed') });
    assert.equal((await table.snapshot(roomId, playerId)).configVersion, original.configVersion);
    await send('bet', { seat: 0, field: 'main', chip: 5, windowId: original.windowId });
    await send('ready', { windowId: original.windowId });
    for (let step = 0; step < 12 && (await store.read.room(roomId)).phase !== 'settled'; step++) {
      const current = await store.read.room(roomId); assert.equal(current.configVersion, original.configVersion);
      time = Math.max(time + 1, current.actionDeadline ?? current.plan?.endAt ?? current.deadline ?? time + 20000);
      await table.seen(roomId, playerId);
      for (const tick of (await table.dueTicks()).filter(row => row.roomId === roomId && ['insurance.timeout', 'turn.autostand', 'window.close', 'round.settle'].includes(row.kind))) await table.tick(tick);
    }
    const settled = await store.read.room(roomId); assert.equal(settled.phase, 'settled'); assert.equal(settled.configVersion, original.configVersion);
    assert.equal((await pool.query('SELECT body FROM croupier_game.shared_table_configs WHERE room_id=$1 AND version=$2', [roomId, original.configVersion])).rows[0].body, savedBody);
    time = Math.max(time, settled.plan.endAt); await send('next', { roundId: settled.roundId });
    const next = await table.snapshot(roomId, playerId); assert.equal(next.phase, 'bets'); assert.notEqual(next.windowId, original.windowId);
    assert.equal(next.configVersion, secondPublication.published.configVersion);
  });
  await check('j08-sql-unchanged-publication-preserves-head-and-immutable-config-history', async () => {
    const before = await persisted();
    const result = await withPublication(({ operators, input }) => operators.publishPackage(input));
    const after = await persisted();
    assert.equal(result.revision, Number(before.packages.at(-1).package_revision) + 1);
    assert.deepEqual(after.heads, before.heads); assert.deepEqual(after.configs, before.configs);
    assert.equal(result.branding.roomGameConfigVersions[roomId], before.heads.find(row => row.room_id === roomId).version);
    assert.equal(after.packages.length, before.packages.length + 1); assert.equal(after.packageAudit.length, before.packageAudit.length + 1);
    assert.deepEqual(after.documents, before.documents); assert.deepEqual(after.audits, before.audits);
  });
  await check('j08-sql-n2-rotation-keeps-the-active-window-and-switches-only-the-next-window', async () => {
    const playerId = 'j08-player', original = await table.snapshot(roomId, playerId, { client: true }), before = await persisted();
    const originalRow = before.configs.find(row => row.room_id === roomId && row.version === original.configVersion);
    const originalConfig = JSON.parse(originalRow.body);
    const saved = await withPublication(({ operators, input }) => operators.publishPackage(appearanceInput(input, '#445566')), otherRepository);
    const after = await persisted(), nextVersion = saved.branding.roomGameConfigVersions[roomId];
    assert.notEqual(nextVersion, original.configVersion);
    assert.equal(after.heads.find(row => row.room_id === roomId).version, nextVersion);
    const nextConfig = JSON.parse(after.configs.find(row => row.room_id === roomId && row.version === nextVersion).body);
    assert.equal(nextConfig.packageRevision, saved.revision);
    assert.deepEqual({ ...nextConfig, configVersion: originalConfig.configVersion, packageRevision: originalConfig.packageRevision }, originalConfig);
    assert.equal(after.configs.find(row => row.version === original.configVersion).body, originalRow.body);
    assert.equal(after.configs.length, before.configs.length + 1);
    assert.equal(after.packageAudit.length, before.packageAudit.length + 1);
    assert.deepEqual(after.documents, before.documents); assert.deepEqual(after.history, before.history); assert.deepEqual(after.audits, before.audits);
    // Reconstruct from another physical pool. Current package/head changed,
    // but the already-open window must still read its old immutable config.
    table = createTableCoordinator({ store: createPostgresTableStore({ pool: secondPool, walletMode: 'demo' }),
      clock: { now: () => time }, random: deterministicRandom('j08-n2-reconstructed') });
    assert.equal((await table.snapshot(roomId, playerId)).configVersion, original.configVersion);
    const send = (op, body = {}) => table.command({ actorId: playerId }, { roomId, commandId: `j08-${++command}`, op, ...body });
    await send('bet', { seat: 0, field: 'main', chip: original.settings.chips[0], windowId: original.windowId });
    await send('ready', { windowId: original.windowId });
    for (let step = 0; step < 12 && (await store.read.room(roomId)).phase !== 'settled'; step++) {
      const current = await store.read.room(roomId); assert.equal(current.configVersion, original.configVersion);
      time = Math.max(time + 1, current.actionDeadline ?? current.plan?.endAt ?? current.deadline ?? time + 20000);
      await table.seen(roomId, playerId);
      for (const tick of (await table.dueTicks()).filter(row => row.roomId === roomId && ['insurance.timeout', 'turn.autostand', 'window.close', 'round.settle'].includes(row.kind)))
        await table.tick(tick);
    }
    const settled = await store.read.room(roomId); assert.equal(settled.phase, 'settled'); assert.equal(settled.configVersion, original.configVersion);
    time = Math.max(time, settled.plan.endAt); await send('next', { roundId: settled.roundId });
    const next = await table.snapshot(roomId, playerId);
    assert.equal(next.phase, 'bets'); assert.notEqual(next.windowId, original.windowId); assert.equal(next.configVersion, nextVersion);
    assert.equal((await read(otherApi)).published.configVersion, nextVersion);
  });
  await check('j08-sql-forged-bindings-foreign-operator-and-stale-package-cannot-write', async () => {
    for (const change of ['replace-binding', 'remove-binding', 'foreign-binding', 'foreign-operator', 'stale-package']) {
      const before = await persisted();
      await assert.rejects(withPublication(({ operators, input }) => {
        if (change === 'replace-binding') input.branding.roomGameConfigVersions[roomId] = 'room-config-30000000-0000-4000-8000-000000000001';
        if (change === 'remove-binding') delete input.branding.roomGameConfigVersions[roomId];
        if (change === 'foreign-binding') input.branding.roomGameConfigVersions['room-foreign'] = 'room-config-30000000-0000-4000-8000-000000000001';
        if (change === 'foreign-operator') input.operatorId = 'j08-foreign-operator';
        if (change === 'stale-package') input.expectedRevision -= 1;
        return operators.publishPackage(input);
      }), error => [403, 404, 409].includes(error?.statusCode), change);
      assert.deepEqual(await persisted(), before, `${change} must leave package, config, head and audit unchanged`);
    }
  });
  await check('j08-sql-head-cas-and-final-package-audit-failures-rollback-n2-rotation', async () => {
    for (const fault of ['force_head_conflict', 'fail_package_audit']) {
      const before = await persisted();
      await assert.rejects(withPublication(async ({ operators, input, client }) => {
        await client.query('SELECT set_config($3,$4,true) WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL', [...params, `j08.${fault}`, 'on']);
        return operators.publishPackage(appearanceInput(input, '#778899'));
      }), status(fault === 'force_head_conflict' ? 409 : 503));
      assert.deepEqual(await persisted(), before, `${fault} must roll back even an already-inserted config and changed head`);
    }
  });
  await check('j08-publication-takes-the-same-physical-room-lock-as-j07', async () => {
    const draft = await save(), before = await persisted(), holder = await secondPool.connect();
    const digest = createHash('sha256').update(`croupier-shared-table\0room\0${roomId}`).digest();
    let pending;
    try {
      await holder.query('BEGIN'); await holder.query('SELECT pg_advisory_xact_lock($1::integer,$2::integer)', [digest.readInt32BE(0), digest.readInt32BE(4)]);
      // J08's native repository lock timeout, not a driver timer, must refuse this publication.
      pending = publish(draft); await assert.rejects(pending, error => error?.statusCode === 423 && error?.code === 'studio_busy');
      assert.deepEqual(await persisted(), before);
    } finally { await holder.query('ROLLBACK'); holder.release(); if (pending) await pending.catch(() => {}); }
    await publish(draft);
  });
  let verifiedProof;
  const proofRead = (shoeId, repo = repository) => createSharedTableProofReadout({ repository: repo, scope }).handlers.get('GET /studio/api/admin/shared-table-proof')({ scope, actor,
    request: new Request(`https://fixture.invalid/studio/api/admin/shared-table-proof?roomId=${roomId}&shoeId=${shoeId}`) });
  await check('j08-real-pg-proof-hides-open-shoe-and-verifies-exact-closed-proof-with-global-audit', async () => {
    const liveShoe = JSON.parse((await pool.query('SELECT body FROM croupier_game.shared_table_shoes WHERE room_id=$1 LIMIT 1', [roomId])).rows[0].body);
    const openView = await proofRead(liveShoe.shoeId); assert.equal(openView.selected.proof, undefined);
    for (const name of ['nonce', 'samples', 'remaining', 'commandDraws', 'rawProof']) assert.ok(!JSON.stringify(openView).includes(name));
    const samples = Array(415).fill(0), cards = replayShuffle(samples);
    const proof = openProof('j08-closed-proof', { decks: 8, cutAfter: 312, total: 416, burn: 1 }, samples, 'a'.repeat(64));
    proof.draws = cards.slice(0, 313).map((card, i) => ({ position: i + 1, kind: i ? 'deal' : 'burn', card }));
    Object.assign(proof, { remaining: cards.slice(313), commandDraws: proof.draws.slice(1), closed: true, reason: 'cut-card' });
    await store.runLocked({ rooms: [roomId], players: [] }, async tx => {
      await tx.audit.openShoe({ room: roomId, shoeId: proof.shoeId, commitment: proof.commitment, openedAt: 0 });
      await tx.audit.append({ room: roomId, at: 0, type: 'engine.start', payload: { shoeId: proof.shoeId, draws: proof.commandDraws } });
      await tx.audit.closeShoe({ room: roomId, shoeId: proof.shoeId, proof, closedAt: 0, verdict: 'verified' });
    });
    verifiedProof = await proofRead(proof.shoeId, otherRepository);
    assert.equal(verifiedProof.selected.closedAt, 0); assert.equal(verifiedProof.selected.verification.status, 'verified');
    assert.equal(verifiedProof.selected.rawProof, JSON.stringify(proof)); assert.equal(verifiedProof.chain.ok, true);
    await assert.rejects(proofRead('other-room-shoe'), status(404));
    const before = (await pool.query('SELECT body FROM croupier_game.shared_table_shoes WHERE shoe_id=$1', [proof.shoeId])).rows[0].body;
    const tampered = JSON.parse(before); tampered.proof.commandDraws = [];
    await pool.query('UPDATE croupier_game.shared_table_shoes SET body=$2 WHERE shoe_id=$1', [proof.shoeId, JSON.stringify(tampered)]);
    assert.equal((await proofRead(proof.shoeId)).selected.verification.status, 'failed');
    await pool.query('UPDATE croupier_game.shared_table_shoes SET body=$2 WHERE shoe_id=$1', [proof.shoeId, before]);
  });
  await check('j08-physical-postgres-restart-preserves-publication-draft-configs-and-proof-bytes', async () => {
    await save({ language: 'en', limitPreset: 'casual' });
    const saved = await persisted(), receipt = await read();
    pool = await restart(); secondPool = createPool(); open();
    assert.deepEqual(await persisted(), saved); assert.deepEqual(await read(), receipt);
    assert.deepEqual(await proofRead('j08-closed-proof'), verifiedProof);
    assert.equal(createRoomGameConfigApi({ repository, scope }).handlers.size, 2);
    assert.equal((await read(createRoomGameConfigApi({ repository, scope }))).publication.ready, false);
  });
  return { checks };
}
