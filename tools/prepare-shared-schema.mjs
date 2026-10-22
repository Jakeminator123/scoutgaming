#!/usr/bin/env node
// OFFLINE preparation only: no database driver, credentials, connection or apply mode.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const productSha256 = '831637c49f3fa2210c3c5804531b13807d2d8fb1feb2c324bc2a986493f7fb1a';
const sources = [
  ['008-shared-wallet.sql', 'fdff425ee30557dc6874b021bbaf163c9db7e1ac8ce5fef499f1dec36346fd81'],
  ['009-shared-blackjack.sql', '73853e23080baf9c1257893f6b74a68dab7067862ad9787a9f3f6b1d01a72515'],
  ['010-presentation-receiver.sql', '214d9259d7d83b9084e12e3807e1ebf8fbbc5dc801392f361f4763a2b64cce43'],
];
const tables = ['shared_wallet_reservations', 'shared_wallet_hands', ...[
  'rooms', 'members', 'presence', 'receipts', 'ticks', 'pauses', 'configs', 'config_heads',
  'audit', 'shoes', 'outbox', 'delivery', 'presentation_receiver',
].map(name => 'shared_table_' + name)];
const indexes = ['transactions_source_key', 'shared_wallet_reservations_player', 'shared_wallet_hands_player',
  'shared_table_member_rooms', 'shared_table_pending_outbox'];
const functions = ['shared_wallet_player_guard', 'shared_wallet_reservation_guard',
  'shared_wallet_reservation_changed', 'shared_wallet_hand_guard'];
const triggerRelations = ['players', 'shared_wallet_reservations', 'shared_wallet_reservations', 'shared_wallet_hands'];
const hash = text => createHash('sha256').update(text).digest('hex');
const literal = text => "'" + text.replaceAll("'", "''") + "'";
const list = names => names.map(literal).join(',');
function identifier(value) {
  if (typeof value !== 'string' || !/^[a-z_][a-z0-9_]{0,62}$/.test(value)) throw Error('Explicit simple database and role names are required');
  return value;
}

export async function prepareSharedSchema({ expectedDatabase, expectedRole, minimumServerMajor = 18 } = {}) {
  identifier(expectedDatabase); identifier(expectedRole);
  if (!Number.isInteger(minimumServerMajor) || minimumServerMajor < 16 || minimumServerMajor > 18) throw Error('Unsupported minimum PostgreSQL major');
  const sourceHashes = {}, bodies = [];
  for (const [file, expected] of [['product-schema.sql', productSha256], ...sources]) {
    const source = (await readFile(new URL('../ops/neon-game/' + file, import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
    if (hash(source) !== expected) throw Error('Schema source changed: ' + file);
    sourceHashes['ops/neon-game/' + file] = expected;
    if (file === 'product-schema.sql') continue;
    // Only these exact pinned bytes may have their outer transaction removed.
    if ((source.match(/^BEGIN;$/gm) || []).length !== 1 || (source.match(/^COMMIT;$/gm) || []).length !== 1
      || !/COMMIT;\s*$/.test(source)) throw Error('Unexpected schema transaction: ' + file);
    bodies.push('-- Source: ' + file + '\n' + source.replace(/^BEGIN;\n/m, '').replace(/^COMMIT;\s*$/m, ''));
  }
  const sql = `-- REVIEW ARTIFACT ONLY. Execute only after explicit target-specific authorization.
-- Fresh installation of shared schema onto existing product-v1. No blind retry.
-- The operator must verify project, branch and DIRECT endpoint separately.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '10s';
SET LOCAL search_path = pg_catalog;
DO $shared_target$
BEGIN
  IF current_database() <> ${literal(expectedDatabase)} OR current_user <> ${literal(expectedRole)}
     OR session_user <> ${literal(expectedRole)}
     OR current_setting('server_version_num')::integer < ${minimumServerMajor * 10000}
     OR pg_is_in_recovery() OR current_setting('transaction_read_only') <> 'off' THEN
    RAISE EXCEPTION 'shared_schema_target_mismatch' USING ERRCODE='P0001';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='croupier_game'
      AND nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user))
    OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='croupier_game' AND c.relname IN ('players','transactions','storage_migrations')
        AND c.relkind='r' AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) <> 3 THEN
    RAISE EXCEPTION 'shared_schema_owner_mismatch' USING ERRCODE='P0001';
  END IF;
END $shared_target$;
-- Concurrent attempts serialize here; existing writers are bounded by lock_timeout.
SELECT pg_advisory_xact_lock(1935897197,810);
LOCK TABLE croupier_game.players,croupier_game.transactions IN ACCESS EXCLUSIVE MODE;
LOCK TABLE croupier_game.storage_migrations IN SHARE MODE;
DO $shared_preflight$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM croupier_game.storage_migrations
      WHERE version='product-v1' AND checksum=${literal(productSha256)}) THEN
    RAISE EXCEPTION 'shared_schema_product_checksum_mismatch' USING ERRCODE='P0001';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='croupier_game' AND (left(c.relname,7)='shared_' OR c.relname='transactions_source_key'))
    OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='croupier_game' AND left(p.proname,7)='shared_')
    OR EXISTS(SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
      WHERE n.nspname='croupier_game' AND left(t.typname,7)='shared_')
    OR EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid IN ('croupier_game.players'::regclass,'croupier_game.transactions'::regclass)
      AND NOT a.attisdropped AND a.attname IN ('wallet_gen','source_key','source_fingerprint'))
    OR EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='croupier_game' AND left(t.tgname,7)='shared_') THEN
    RAISE EXCEPTION 'shared_schema_not_empty' USING ERRCODE='P0001';
  END IF;
  IF EXISTS(SELECT 1 FROM croupier_game.players WHERE balance < 0 OR balance::text IN ('NaN','Infinity','-Infinity')) THEN
    RAISE EXCEPTION 'shared_schema_invalid_balance' USING ERRCODE='23514';
  END IF;
END $shared_preflight$;
${bodies.join('\n')}
DO $shared_postflight$
DECLARE name text; has_rows boolean;
BEGIN
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='croupier_game' AND c.relname IN (${list(tables)})
      AND c.relkind='r' AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) <> ${tables.length}
    OR (SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='croupier_game' AND c.relname IN (${list(indexes)})
        AND i.indisvalid AND i.indisready) <> ${indexes.length}
    OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='croupier_game' AND p.proname IN (${list(functions)})
        AND p.pronargs=0 AND p.prorettype='trigger'::regtype AND NOT p.prosecdef
        AND p.proowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) <> 4
    OR (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_proc p ON p.oid=t.tgfoid
      WHERE n.nspname='croupier_game' AND t.tgenabled='O' AND NOT t.tgisinternal
        AND p.proname=t.tgname AND (t.tgname,c.relname) IN (${functions.map((name,i) => '('+literal(name)+','+literal(triggerRelations[i])+')').join(',')})) <> 4 THEN
    RAISE EXCEPTION 'shared_schema_structure_mismatch' USING ERRCODE='P0001';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid='croupier_game.players'::regclass AND a.attname='wallet_gen'
        AND a.atttypid='bigint'::regtype AND a.attnotnull AND pg_get_expr(d.adbin,d.adrelid)='0')
    OR (SELECT count(*) FROM pg_attribute WHERE attrelid='croupier_game.transactions'::regclass
        AND attname IN ('source_key','source_fingerprint') AND atttypid='text'::regtype AND NOT attnotnull) <> 2
    OR NOT EXISTS(SELECT 1 FROM pg_index WHERE indexrelid='croupier_game.transactions_source_key'::regclass AND indisunique)
    OR EXISTS(SELECT 1 FROM croupier_game.players WHERE wallet_gen<>0)
    OR EXISTS(SELECT 1 FROM croupier_game.transactions WHERE source_key IS NOT NULL OR source_fingerprint IS NOT NULL) THEN
    RAISE EXCEPTION 'shared_schema_columns_mismatch' USING ERRCODE='P0001';
  END IF;
  FOREACH name IN ARRAY ARRAY[${list(tables)}] LOOP
    IF EXISTS(SELECT 1 FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) AS rights(privilege)
      WHERE NOT has_table_privilege(current_user,'croupier_game.'||name,privilege)) THEN
      RAISE EXCEPTION 'shared_schema_privilege_mismatch' USING ERRCODE='42501';
    END IF;
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM croupier_game.%I)',name) INTO STRICT has_rows;
    IF has_rows THEN RAISE EXCEPTION 'shared_schema_unexpected_data' USING ERRCODE='P0001'; END IF;
  END LOOP;
END $shared_postflight$;
COMMIT;
`;
  return { sql, manifest: { format: 1, expectedDatabase, expectedRole, minimumServerMajor,
    sourceHashes, sqlSha256: hash(sql), tables: [...tables], indexes: [...indexes], functions: [...functions],
    lockTimeoutMs: 2000, statementTimeoutMs: 30000, idleTransactionTimeoutMs: 10000,
    atomic: true, freshOnly: true, modifiesExistingData: false, writesMigrationLedger: false,
    applies: false, productionApproved: false } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2), options = {}; let sqlOnly = false;
    for (let i=0; i<args.length; i++) {
      if (args[i] === '--sql') { sqlOnly = true; continue; }
      const keys = { '--database': 'expectedDatabase', '--role': 'expectedRole' };
      const key = Object.hasOwn(keys,args[i]) ? keys[args[i]] : undefined;
      if (!key || options[key] !== undefined || !args[i+1] || args[i+1].startsWith('--')) throw Error('Usage: prepare-shared-schema.mjs --database NAME --role NAME [--sql]');
      options[key] = args[++i];
    }
    const prepared = await prepareSharedSchema(options);
    process.stdout.write(sqlOnly ? prepared.sql : JSON.stringify(prepared.manifest,null,2)+'\n');
  } catch (error) { console.error(error.message); process.exitCode=1; }
}
