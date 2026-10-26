// Inject an owned loopback cluster and full pg_dump/pg_restore callbacks. No auto-run or cloud connection.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareLissabonRetirement } from '../tools/prepare-lissabon-retirement.mjs';
import { planStudioMigrations,applyStudioMigrations } from '../ops/neon-studio/migrations.mjs';
import { createPostgresStore } from '../packages/storage/server/postgres-store.mjs';

const targetQuery="SELECT current_database() AS database,session_user AS role,host(inet_server_addr()) AS host";
async function snapshot(pool) {
  const data={};
  const tables=(await pool.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('croupier_game','croupier_auth','croupier_studio') ORDER BY schemaname,tablename")).rows;
  for (const {schemaname,tablename} of tables) {
    assert.match(schemaname,/^[a-z_]+$/); assert.match(tablename,/^[a-z_]+$/);
    data[schemaname+'.'+tablename]=(await pool.query(`SELECT row_to_json(t)::text AS row FROM ${schemaname}.${tablename} t ORDER BY row_to_json(t)::text`)).rows.map(row=>row.row);
  }
  data.sequences=(await pool.query("SELECT schemaname,sequencename,sequenceowner,start_value,min_value,max_value,increment_by,cycle,cache_size,last_value FROM pg_sequences WHERE schemaname IN ('croupier_game','croupier_auth','croupier_studio') ORDER BY schemaname,sequencename")).rows;
  return data;
}

async function schemaSnapshot(pool) {
  return (await pool.query(`SELECT 'relation' AS kind,n.nspname||'.'||c.relname AS name,
    c.relkind::text||':'||c.relowner::regrole::text||':'||COALESCE(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,c.relowner))::text AS definition
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('croupier_game','croupier_auth','croupier_studio')
    UNION ALL SELECT 'column',n.nspname||'.'||c.relname||'.'||a.attname,
    format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text||':'||COALESCE(pg_get_expr(d.adbin,d.adrelid),'')
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE n.nspname IN ('croupier_game','croupier_auth','croupier_studio') AND a.attnum>0 AND NOT a.attisdropped
    UNION ALL SELECT 'constraint',n.nspname||'.'||c.relname||'.'||k.conname,pg_get_constraintdef(k.oid,true)
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('croupier_game','croupier_auth','croupier_studio')
    UNION ALL SELECT 'trigger',n.nspname||'.'||c.relname||'.'||t.tgname,pg_get_triggerdef(t.oid)
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('croupier_game','croupier_auth','croupier_studio') AND NOT t.tgisinternal
    ORDER BY kind,name,definition`)).rows;
}

export async function runLissabonRetirementChecks({pool,createRestorePoint}={}) {
  assert.equal(typeof createRestorePoint,'function','full isolated backup/restore is required');
  assert.deepEqual((await pool.query(targetQuery)).rows[0],{database:'postgres',role:'studio_qa',host:'127.0.0.1'});
  assert.equal((await pool.query("SELECT count(*)::integer AS count FROM pg_namespace WHERE nspname IN ('croupier_game','croupier_auth','croupier_studio')")).rows[0].count,0);
  const checks=[],check=async(name,work)=>{await work();checks.push(name);console.log('ok - '+name);};
  const source=async name=>(await readFile(new URL('../ops/'+name,import.meta.url),'utf8')).replaceAll('\r\n','\n');
  const evidence={database:'postgres',role:'studio_qa',releaseSha:'1'.repeat(40),rollbackSha:'2'.repeat(40),consumerInventorySha256:'3'.repeat(64),backupSha256:'4'.repeat(64),restoreReceiptSha256:'5'.repeat(64)};
  const prepared=await prepareLissabonRetirement(evidence);
  async function apply(sql=prepared.sql) {
    const client=await pool.connect();
    try { await client.query(sql); } catch(error) { await client.query('ROLLBACK');throw error; } finally {client.release();}
  }
  await pool.query(await source('neon-game/product-schema.sql'));
  await pool.query("INSERT INTO croupier_game.storage_migrations VALUES ('product-v1',$1,'{}','2026-10-26T00:00:00Z')",[prepared.manifest.productChecksum]);
  for (const file of ['006-player-profile.sql','007-roulette-tables.sql','008-shared-wallet.sql','009-shared-blackjack.sql','010-presentation-receiver.sql']) await pool.query(await source('neon-game/'+file));
  const plan=await planStudioMigrations({pool}); await applyStudioMigrations({pool,expectedTarget:plan.target,confirm:true});
  await pool.query("INSERT INTO croupier_game.players(id,name,balance,currency,created_at) VALUES ('synthetic-j09','Synthetic J09',321.25,'USD','2026-10-26T00:00:00Z')");
  await pool.query("INSERT INTO croupier_game.transactions(player_id,type,amount,currency,meta,at) VALUES ('synthetic-j09','open',321.25,'USD','synthetic','2026-10-26T00:00:00Z')");
  await pool.query("INSERT INTO croupier_auth.users(username,role,created_at) VALUES ('synthetic-j09','admin','2026-10-26T00:00:00Z')");
  await pool.query("INSERT INTO croupier_studio.operators VALUES ('test','j09','operator','synthetic-j09','Synthetic J09','active',1)");
  await pool.query(`INSERT INTO croupier_studio.operator_packages VALUES ('test','j09','operator',1,'[]','[]','[]','{"synthetic":true,"frozen":"j09"}',1)`);
  const baseline=await snapshot(pool);
  await check('readiness-preserves-schema-and-data',async()=>{const before=await schemaSnapshot(pool);await apply(prepared.readinessSql);assert.deepEqual(await snapshot(pool),baseline);assert.deepEqual(await schemaSnapshot(pool),before);});
  await check('target-identity',async()=>{
    const wrong=await prepareLissabonRetirement({...evidence,database:'wrong'});
    await assert.rejects(apply(wrong.sql),/lissabon_retirement_target_mismatch/); assert.deepEqual(await snapshot(pool),baseline);
  });
  await check('product-checksum',async()=>{
    await pool.query("UPDATE croupier_game.storage_migrations SET checksum='wrong' WHERE version='product-v1'");
    await assert.rejects(apply(),/lissabon_retirement_ledger_mismatch/);
    await pool.query("UPDATE croupier_game.storage_migrations SET checksum=$1 WHERE version='product-v1'",[prepared.manifest.productChecksum]);
    assert.deepEqual(await snapshot(pool),baseline);
  });
  for (const [name,insert,cleanup] of [
    ['profiles',"INSERT INTO croupier_game.lissabon_profiles VALUES ('synthetic-j09','synthetic')","DELETE FROM croupier_game.lissabon_profiles"],
    ['sessions',"INSERT INTO croupier_game.lissabon_profile_sessions VALUES ('synthetic','synthetic-j09',42)","DELETE FROM croupier_game.lissabon_profile_sessions"]]) {
    await check('nonempty-'+name,async()=>{await pool.query(insert);const before=await snapshot(pool);await assert.rejects(apply(),/lissabon_retirement_not_empty/);assert.deepEqual(await snapshot(pool),before);await pool.query(cleanup);});
  }
  for (const [name,create,drop,expected] of [
    ['view','CREATE VIEW public.j09_view AS SELECT * FROM croupier_game.lissabon_profiles','DROP VIEW public.j09_view',/unknown_dependency/],
    ['foreign-key','CREATE TABLE public.j09_fk (player_id text REFERENCES croupier_game.lissabon_profiles(player_id))','DROP TABLE public.j09_fk',/unknown_dependency/],
    ['row-type','CREATE FUNCTION public.j09_type(croupier_game.lissabon_profiles) RETURNS integer LANGUAGE sql AS \'SELECT 1\'','DROP FUNCTION public.j09_type(croupier_game.lissabon_profiles)',/unknown_dependency/],
    ['index','CREATE INDEX j09_index ON croupier_game.lissabon_profile_sessions(expires)','DROP INDEX croupier_game.j09_index',/structure_mismatch/],
    ['row-security','ALTER TABLE croupier_game.lissabon_profiles ENABLE ROW LEVEL SECURITY','ALTER TABLE croupier_game.lissabon_profiles DISABLE ROW LEVEL SECURITY',/owner_or_state_mismatch/],
    ['column','ALTER TABLE croupier_game.lissabon_profiles ADD COLUMN extra text','ALTER TABLE croupier_game.lissabon_profiles DROP COLUMN extra',/structure_mismatch/],
  ]) await check('unknown-'+name,async()=>{await pool.query(create);const before=await snapshot(pool);await assert.rejects(apply(),expected);assert.deepEqual(await snapshot(pool),before);await pool.query(drop);});
  // Removing a test column leaves a tombstone, which must also be rejected.
  await check('dropped-column-drift',async()=>{await assert.rejects(apply(),/structure_mismatch/);await pool.query('ALTER TABLE croupier_game.lissabon_profiles RENAME TO j09_drift');await pool.query('CREATE TABLE croupier_game.lissabon_profiles (player_id text PRIMARY KEY REFERENCES croupier_game.players(id),name_key text UNIQUE NOT NULL)');await pool.query('DROP TABLE croupier_game.j09_drift');});
  await check('unknown-table-trigger',async()=>{
    await pool.query('CREATE FUNCTION public.j09_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$');
    await pool.query('CREATE TRIGGER j09_trigger BEFORE INSERT ON croupier_game.lissabon_profiles FOR EACH ROW EXECUTE FUNCTION public.j09_trigger()');
    await assert.rejects(apply(),/structure_mismatch/);assert.deepEqual(await snapshot(pool),baseline);
    await pool.query('DROP TRIGGER j09_trigger ON croupier_game.lissabon_profiles');await pool.query('DROP FUNCTION public.j09_trigger()');
  });
  await check('bounded-writer-lock',async()=>{
    const writer=await pool.connect();
    try {await writer.query('BEGIN');await writer.query('LOCK TABLE croupier_game.lissabon_profiles IN ROW EXCLUSIVE MODE');await assert.rejects(apply(),{code:'55P03'});}
    finally {await writer.query('ROLLBACK');writer.release();}
    assert.deepEqual(await snapshot(pool),baseline);
  });
  await check('unknown-ledger-trigger',async()=>{
    await pool.query("CREATE FUNCTION public.j09_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'j09_injected_failure'; END $$");
    await pool.query('CREATE TRIGGER j09_fail BEFORE INSERT ON croupier_game.storage_migrations FOR EACH ROW EXECUTE FUNCTION public.j09_fail()');
    await assert.rejects(apply(),/unknown_ledger_hook/);assert.deepEqual(await snapshot(pool),baseline);
    await pool.query('DROP TRIGGER j09_fail ON croupier_game.storage_migrations');await pool.query('DROP FUNCTION public.j09_fail()');
  });
  await check('atomic-failure-after-both-drops',async()=>{
    // Inject an error at the ledger boundary to exercise interruption of the actual transaction body.
    const interrupted=prepared.sql.replace('INSERT INTO croupier_game.storage_migrations','SELECT 1/0;\nINSERT INTO croupier_game.storage_migrations');
    assert.notEqual(interrupted,prepared.sql);
    await assert.rejects(apply(interrupted),{code:'22012'});assert.deepEqual(await snapshot(pool),baseline);
  });
  const schemaBefore=await schemaSnapshot(pool),restorePoint=await createRestorePoint();
  await check('successful-optional-contraction-preserves-active-data',async()=>{
    await apply();const after=await snapshot(pool),expected=structuredClone(baseline);
    delete expected['croupier_game.lissabon_profiles'];delete expected['croupier_game.lissabon_profile_sessions'];
    assert.equal(after['croupier_game.storage_migrations'].length,2);
    after['croupier_game.storage_migrations']=after['croupier_game.storage_migrations'].filter(row=>JSON.parse(row).version!=='game-011-retire-lissabon');
    assert.deepEqual(after,expected);
    await createPostgresStore({pool}).db.assertInstalled({source:await source('neon-game/product-schema.sql')});
  });
  await check('no-blind-reapply',async()=>{const before=await snapshot(pool);await assert.rejects(apply(),/owner_or_state_mismatch/);assert.deepEqual(await snapshot(pool),before);});
  await check('full-backup-restores-older-schema-and-all-active-data',async()=>{
    const restored=await restorePoint.restore();assert.deepEqual(await snapshot(restored),baseline);
    const schemaAfter=await schemaSnapshot(restored);
    assert.deepEqual(schemaAfter.filter((row,index)=>JSON.stringify(row)!==JSON.stringify(schemaBefore[index])),[], 'restored schema, owners and effective ACL must match');
    assert.equal(schemaAfter.length,schemaBefore.length);
    await createPostgresStore({pool:restored}).db.assertInstalled({source:await source('neon-game/product-schema.sql')});
    assert.equal((await restored.query("SELECT balance::text FROM croupier_game.players WHERE id='synthetic-j09'")).rows[0].balance,'321.25');
  });
  return {checks};
}
