// Real PostgreSQL upgrade acceptance. Only run through runSharedTableQa's
// owned-loopback runChecks injection; no autorun, connection strings or DDL export.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { createPostgresStore } from '../packages/storage/server/postgres-store.mjs';
import { createPostgresNativeTableCommand } from '../services/game/postgres-native-table.mjs';
import { prepareSharedSchema } from '../tools/prepare-shared-schema.mjs';

const PRODUCT_SHA256 = '831637c49f3fa2210c3c5804531b13807d2d8fb1feb2c324bc2a986493f7fb1a';
const observe = promise => { promise.catch(() => {}); return promise; };
const hash = text => createHash('sha256').update(text).digest('hex');
async function bounded(promise, message, timeout = 12000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(message)), timeout); })]); }
  finally { clearTimeout(timer); }
}
async function waitingForPlayers(pool, waiter, blocker) {
  const deadline = Date.now() + 2500;
  do {
    const row = (await pool.query(`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=$1
      AND relation='croupier_game.players'::regclass AND mode='AccessExclusiveLock' AND NOT granted) AS waiting,
      pg_blocking_pids($1) AS blockers`, [waiter])).rows[0];
    if (row.waiting && row.blockers.includes(blocker)) return;
    await delay(10);
  } while (Date.now() < deadline);
  assert.fail('the upgrade did not wait for its actual players AccessExclusiveLock');
}

export async function runSharedSchemaUpgradeChecks({ pool, createPool }) {
  assert.equal(typeof createPool, 'function');
  const targetSql = 'SELECT current_user AS role,current_database() AS database,inet_server_addr()::text AS address,inet_server_port() AS port,current_setting(\'server_version_num\')::integer/10000 AS major';
  const target = (await pool.query(targetSql)).rows[0];
  assert.equal(target.role, 'studio_qa'); assert.equal(target.database, 'postgres'); assert.ok(target.major >= 16);
  assert.ok(['127.0.0.1', '127.0.0.1/32'].includes(target.address), 'only the existing task-owned loopback cluster');
  const other = createPool(); assert.deepEqual((await other.query(targetSql)).rows[0], target);
  const checks = [], check = async (name, work) => { await work(); checks.push(name); console.log(`ok - ${name}`); };
  const suffix = randomUUID().replaceAll('-', ''), role = `upgrade_app_${suffix}`, trigger = `upgrade_fail_${suffix}`;
  const player = `upgrade-before-${suffix}`, nextPlayer = `upgrade-after-${suffix}`;
  const session = createHash('sha256').update(`synthetic-upgrade:${suffix}`).digest('hex');
  const bets = [{ main: 5, pp: 0, tp: 0 }, ...Array.from({ length: 6 }, () => ({ main: 0, pp: 0, tp: 0 }))];
  const firstRequest = { id: player, op: 'start', version: 0, requestId: `before-${suffix}`, bets };
  let roleCreated = false, firstResponse;

  async function snapshot() {
    const result = {};
    for (const [name, sql] of Object.entries({
      players: 'SELECT id,name,currency,balance::text,status,account_epoch::text,closed_at,created_at FROM croupier_game.players ORDER BY id',
      ledger: 'SELECT id::text,player_id,type,amount::text,currency,meta,at FROM croupier_game.transactions ORDER BY id',
      sessions: 'SELECT * FROM croupier_game.player_sessions ORDER BY digest',
      native: 'SELECT * FROM croupier_game.blackjack_tables ORDER BY player_id',
      presentation: 'SELECT * FROM croupier_game.native_presentations ORDER BY player_id',
      migrations: 'SELECT * FROM croupier_game.storage_migrations ORDER BY version',
    })) result[name] = (await pool.query(sql)).rows;
    return result;
  }
  async function assertSharedAbsent() {
    const objects = (await pool.query(`SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='croupier_game' AND (relname LIKE 'shared_%' OR relname='transactions_source_key')
      UNION ALL SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='croupier_game' AND proname LIKE 'shared_wallet_%'`)).rows;
    assert.deepEqual(objects, [], 'rollback leaves no new shared tables, indexes or functions');
    assert.deepEqual((await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='croupier_game'
      AND ((table_name='players' AND column_name='wallet_gen') OR (table_name='transactions' AND column_name IN ('source_key','source_fingerprint')))`)).rows, []);
  }
  async function catalog() {
    return (await pool.query(`SELECT 'relation' AS kind,c.relname AS name,c.oid::text AS identity,
      CASE WHEN c.relkind='i' THEN pg_get_indexdef(c.oid) ELSE c.relkind::text END AS definition
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='croupier_game'
      UNION ALL SELECT 'function',p.proname,p.oid::text,pg_get_functiondef(p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='croupier_game'
      UNION ALL SELECT 'trigger',c.relname||'.'||t.tgname,t.oid::text,pg_get_triggerdef(t.oid)
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='croupier_game' AND NOT t.tgisinternal
      UNION ALL SELECT 'column',c.relname||'.'||a.attname,a.attnum::text,
      format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text||':'||COALESCE(pg_get_expr(d.adbin,d.adrelid),'')
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
      WHERE n.nspname='croupier_game' AND a.attnum>0 AND NOT a.attisdropped
      ORDER BY kind,name,identity`)).rows;
  }
  async function apply(sql, onClient) {
    const client = await pool.connect(); let broken;
    try {
      onClient?.(client.processID);
      const output = await client.query(sql);
      assert.equal((Array.isArray(output) ? output.at(-1) : output).command, 'COMMIT');
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (rollback) { broken = rollback; }
      throw error;
    } finally { client.release(broken); }
  }
  // A real non-owner connection runs the unchanged legacy implementation. Its
  // single command checkout is leased locally so RESET ROLE precedes pool release.
  async function legacy(request) {
    const client = await pool.connect(); let leased = false, broken;
    try {
      await client.query(`SET ROLE "${role}"`);
      const rolePool = { query: (sql, values) => client.query(sql, values), async connect() {
        assert.equal(leased, false); leased = true;
        return { query: (sql, values) => client.query(sql, values), release() { assert.equal(leased, true); leased = false; } };
      } };
      const storage = createPostgresStore({ pool: rolePool });
      return await createPostgresNativeTableCommand({ pool: storage.gamePool })(request);
    } finally {
      try { await client.query('ROLLBACK'); await client.query('RESET ROLE'); } catch (error) { broken = error; }
      client.release(broken);
    }
  }

  try {
    await check('shared-schema-upgrade-populated-main-and-real-legacy-before', async () => {
      assert.equal((await pool.query("SELECT to_regclass('croupier_game.players') AS table_name")).rows[0].table_name, null);
      const product = (await readFile(new URL('../ops/neon-game/product-schema.sql', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
      assert.equal(hash(product), PRODUCT_SHA256, 'the populated baseline is the reviewed trusted-main product-v1 source');
      await pool.query(product);
      await pool.query(`INSERT INTO croupier_game.storage_migrations(version,checksum,source_hashes,applied_at)
        VALUES('product-v1',$1,'{}','2026-10-22T00:00:00.000Z')`, [PRODUCT_SHA256]);
      for (const id of [player, nextPlayer]) {
        await pool.query("INSERT INTO croupier_game.players(id,name,currency,balance,created_at) VALUES($1,'Synthetic upgrade player','USD',1000,'2026-10-22T00:00:00.000Z')", [id]);
        await pool.query("INSERT INTO croupier_game.transactions(player_id,type,amount,currency,meta,at) VALUES($1,'open',1000,'USD','synthetic old ledger','2026-10-22T00:00:00.000Z')", [id]);
      }
      await pool.query("INSERT INTO croupier_game.player_sessions(digest,player_id,expires,source_stamp,display_name) VALUES($1,$2,9999999999999,'synthetic-old-source','Synthetic player')", [session, player]);
      await pool.query(`CREATE ROLE "${role}" NOLOGIN`); roleCreated = true;
      await pool.query(`GRANT USAGE ON SCHEMA croupier_game TO "${role}";
        GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA croupier_game TO "${role}";
        GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA croupier_game TO "${role}"`);
      firstResponse = await legacy(firstRequest);
      assert.equal(firstResponse.balance, 995); assert.equal(firstResponse.version, 1); assert.ok(firstResponse.presentation.length > 0);
      assert.equal((await snapshot()).ledger.length, 3); await assertSharedAbsent();
    });
    const baseline = await snapshot();
    const prepared = await prepareSharedSchema({ expectedDatabase: 'postgres', expectedRole: 'studio_qa', minimumServerMajor: 16 });
    assert.equal(typeof prepared.sql, 'string'); assert.ok(prepared.manifest);

    await check('shared-schema-upgrade-wrong-database-rejected-before-ddl', async () => {
      const wrong = await prepareSharedSchema({ expectedDatabase: 'different_database', expectedRole: 'studio_qa', minimumServerMajor: 16 });
      await assert.rejects(apply(wrong.sql), { code: 'P0001', message: 'shared_schema_target_mismatch' });
      assert.deepEqual(await snapshot(), baseline); await assertSharedAbsent();
    });

    await check('shared-schema-upgrade-wrong-product-checksum-rejected-before-ddl', async () => {
      try {
        await pool.query("UPDATE croupier_game.storage_migrations SET checksum=$1 WHERE version='product-v1'", ['0'.repeat(64)]);
        const changed = await snapshot();
        await assert.rejects(apply(prepared.sql), { code: 'P0001', message: 'shared_schema_product_checksum_mismatch' });
        assert.deepEqual(await snapshot(), changed); await assertSharedAbsent();
      } finally { await pool.query("UPDATE croupier_game.storage_migrations SET checksum=$1 WHERE version='product-v1'", [PRODUCT_SHA256]); }
      assert.deepEqual(await snapshot(), baseline);
    });

    await check('shared-schema-upgrade-invalid-existing-balance-rejected-before-ddl', async () => {
      try {
        await pool.query('UPDATE croupier_game.players SET balance=-1 WHERE id=$1', [player]);
        const changed = await snapshot();
        await assert.rejects(apply(prepared.sql), { code: '23514', message: 'shared_schema_invalid_balance' });
        assert.deepEqual(await snapshot(), changed); await assertSharedAbsent();
      } finally { await pool.query('UPDATE croupier_game.players SET balance=$2 WHERE id=$1', [player, baseline.players.find(row => row.id === player).balance]); }
      assert.deepEqual(await snapshot(), baseline);
    });

    await check('shared-schema-upgrade-partial-column-install-rejected-without-repair', async () => {
      let installed = false;
      try {
        await pool.query('ALTER TABLE croupier_game.players ADD COLUMN wallet_gen BIGINT NOT NULL DEFAULT 0'); installed = true;
        const schemaBefore = await catalog();
        await assert.rejects(apply(prepared.sql), { code: 'P0001', message: 'shared_schema_not_empty' });
        assert.deepEqual(await catalog(), schemaBefore); assert.deepEqual(await snapshot(), baseline);
      } finally {
        // This field was created solely by this negative fixture, not by a
        // successful migration. Never drop any accepted shared schema or data.
        if (installed) await pool.query('ALTER TABLE croupier_game.players DROP COLUMN wallet_gen');
      }
      await assertSharedAbsent(); assert.deepEqual(await snapshot(), baseline);
    });

    await check('shared-schema-upgrade-player-lock-timeout-rolls-back-all-ddl', async () => {
      const writer = await other.connect(); let active = false, pending;
      try {
        await writer.query('BEGIN'); active = true;
        await writer.query("SET LOCAL statement_timeout='15000ms'; SET LOCAL idle_in_transaction_session_timeout='15000ms'");
        await writer.query('LOCK TABLE croupier_game.players IN ROW EXCLUSIVE MODE');
        let started;
        const connected = new Promise(resolve => { started = resolve; });
        pending = observe(apply(prepared.sql, started));
        const pid = await bounded(Promise.race([connected, pending.then(() => assert.fail('upgrade did not connect'))]), 'upgrade checkout timeout');
        await bounded(waitingForPlayers(pool, pid, writer.processID), 'upgrade lock wait not observed');
        await assert.rejects(bounded(pending, 'bounded migration lock timeout missing'), { code: '55P03' });
        assert.deepEqual(await snapshot(), baseline); await assertSharedAbsent();
      } finally {
        if (active) await writer.query('ROLLBACK').catch(() => {});
        await pending?.catch(() => {}); writer.release();
      }
    });

    await check('shared-schema-upgrade-mid-ddl-failure-rolls-back-008-and-009', async () => {
      let installed = false;
      try {
        await pool.query(`CREATE FUNCTION croupier_auth.${trigger}() RETURNS event_trigger LANGUAGE plpgsql AS $$
          BEGIN IF EXISTS(SELECT 1 FROM pg_event_trigger_ddl_commands() WHERE object_identity='croupier_game.shared_table_rooms')
            THEN RAISE EXCEPTION 'synthetic_upgrade_mid_migration' USING ERRCODE='P0001'; END IF; END $$;
          CREATE EVENT TRIGGER ${trigger} ON ddl_command_end WHEN TAG IN ('CREATE TABLE') EXECUTE FUNCTION croupier_auth.${trigger}()`);
        installed = true;
        await assert.rejects(apply(prepared.sql), error => error.code === 'P0001' && error.message === 'synthetic_upgrade_mid_migration');
        assert.deepEqual(await snapshot(), baseline); await assertSharedAbsent();
      } finally {
        if (installed) await pool.query(`DROP EVENT TRIGGER ${trigger}`);
        await pool.query(`DROP FUNCTION IF EXISTS croupier_auth.${trigger}()`);
      }
    });

    await check('shared-schema-upgrade-atomic-success-preserves-existing-data-and-readiness', async () => {
      await apply(prepared.sql); assert.deepEqual(await snapshot(), baseline);
      const storage = createPostgresStore({ pool, readProductSchema: () => readFile(new URL('../ops/neon-game/product-schema.sql', import.meta.url), 'utf8') });
      await storage.db.assertInstalled();
      assert.deepEqual((await pool.query('SELECT wallet_gen::text FROM croupier_game.players ORDER BY id')).rows, [{ wallet_gen: '0' }, { wallet_gen: '0' }]);
      assert.deepEqual((await pool.query('SELECT DISTINCT source_key,source_fingerprint FROM croupier_game.transactions')).rows, [{ source_key: null, source_fingerprint: null }]);
      assert.equal((await pool.query("SELECT to_regclass('croupier_game.shared_table_presentation_receiver') AS receiver")).rows[0].receiver, 'croupier_game.shared_table_presentation_receiver');
      assert.equal((await pool.query("SELECT count(*)::integer AS count FROM pg_trigger WHERE tgrelid='croupier_game.players'::regclass AND tgname='shared_wallet_player_guard' AND NOT tgisinternal")).rows[0].count, 1);
    });

    await check('shared-schema-upgrade-runtime-grants-and-old-code-replay-remain-compatible', async () => {
      const before = await snapshot();
      const generations = (await pool.query('SELECT id,wallet_gen::text FROM croupier_game.players ORDER BY id')).rows;
      await assert.rejects(legacy(firstRequest), { code: '42501' });
      assert.deepEqual(await snapshot(), before, 'a missing new guard-table grant cannot partly commit a legacy command');
      assert.deepEqual((await pool.query('SELECT id,wallet_gen::text FROM croupier_game.players ORDER BY id')).rows, generations);
      await pool.query(`GRANT SELECT ON croupier_game.shared_wallet_reservations,croupier_game.shared_wallet_hands TO "${role}"`);
      assert.deepEqual(await legacy(firstRequest), firstResponse, 'old code returns its pre-upgrade native receipt without a second debit');
      assert.deepEqual(await snapshot(), before);
      assert.deepEqual((await pool.query('SELECT id,wallet_gen::text FROM croupier_game.players ORDER BY id')).rows, generations, 'legacy replay does not advance wallet_gen');
      const next = await legacy({ id: nextPlayer, op: 'start', version: 0, requestId: `after-${suffix}`, bets });
      assert.equal(next.balance, 995); assert.equal(next.version, 1);
      const after = await snapshot(); assert.equal(after.ledger.length, 4);
      assert.deepEqual(after.sessions, before.sessions); assert.deepEqual(after.migrations, before.migrations);
      assert.equal((await pool.query('SELECT wallet_gen::text FROM croupier_game.players WHERE id=$1', [nextPlayer])).rows[0].wallet_gen, '1');
    });

    await check('shared-schema-upgrade-second-application-rejected-without-data-or-schema-change', async () => {
      const before = await snapshot(), schemaBefore = await catalog();
      const generations = (await pool.query('SELECT id,wallet_gen::text FROM croupier_game.players ORDER BY id')).rows;
      await assert.rejects(apply(prepared.sql), { code: 'P0001', message: 'shared_schema_not_empty' });
      assert.deepEqual(await catalog(), schemaBefore, 'second application preserves object identities and definitions');
      assert.deepEqual(await snapshot(), before);
      assert.deepEqual((await pool.query('SELECT id,wallet_gen::text FROM croupier_game.players ORDER BY id')).rows, generations);
      assert.deepEqual(await legacy(firstRequest), firstResponse);
      assert.deepEqual((await pool.query('SELECT id,wallet_gen::text FROM croupier_game.players ORDER BY id')).rows, generations);
    });
    return { pool, checks };
  } finally {
    if (roleCreated) {
      await pool.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA croupier_game FROM "${role}";
        REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA croupier_game FROM "${role}";
        REVOKE ALL PRIVILEGES ON SCHEMA croupier_game FROM "${role}";
        DROP ROLE "${role}"`);
    }
  }
}
