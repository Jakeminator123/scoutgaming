import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFile, lstat, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPostgresStore } from '../services/game/storage/postgres-store.mjs';

const SCHEMA_PATH = new URL('../ops/neon-game/product-schema.sql', import.meta.url);
const ident = value => { if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw Error('Unsupported SQL identifier'); return `"${value}"`; };
const hash = value => createHash('sha256').update(value).digest('hex');
const schemaTables = sql => [...sql.matchAll(/CREATE TABLE (croupier_game|croupier_auth)\.([a-z_]+)\s*\(/g)].map(([,schema,table])=>({schema,table}));
const canonical = rows => JSON.stringify(rows.map(row=>Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,value===null?null:String(value)]))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));

async function sourceDatabase(file) {
  const path=resolve(file), info=await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || resolve(await realpath(path)).toLowerCase()!==path.toLowerCase()) throw Error('Source must be a plain SQLite snapshot');
  const bytes=await readFile(path), before=hash(bytes), db=new DatabaseSync(path,{readOnly:true});
  try {
    if (db.prepare('PRAGMA integrity_check').get()?.integrity_check!=='ok' || db.prepare('PRAGMA foreign_key_check').get()) throw Error('SQLite snapshot integrity failed');
    const tables=db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>row.name);
    const sequences=db.prepare("SELECT 1 FROM sqlite_schema WHERE name='sqlite_sequence'").get()
      ? db.prepare('SELECT name,seq FROM sqlite_sequence').all().map(row=>({table:row.name,seq:String(row.seq)})) : [];
    return {path,db,tables,sequences,sha256:before,bytes:bytes.length};
  } catch(error) {db.close();throw error;}
}

export async function inspectSqliteMigration({playerPath,authPath,quiesced=false}={}) {
  if (!quiesced) throw Error('Confirm all source writers are stopped before migration');
  const sql=(await readFile(SCHEMA_PATH,'utf8')).replace(/\r\n/g,'\n'), definitions=schemaTables(sql), sources=[];
  try {
    for(const [schema,path]of [['croupier_game',playerPath],['croupier_auth',authPath]]) {
      const source=await sourceDatabase(path); sources.push({...source,schema});
      const known=new Set(definitions.filter(row=>row.schema===schema).map(row=>row.table));
      if(source.tables.some(table=>!known.has(table)))throw Error('Source contains an unsupported table; extend migration before continuing');
    }
    const tables=[];
    for(const definition of definitions.filter(row=>row.table!=='storage_migrations')) {
      const source=sources.find(row=>row.schema===definition.schema);
      if(!source.tables.includes(definition.table))continue;
      const statement=source.db.prepare(`SELECT * FROM ${ident(definition.table)}`);statement.setReadBigInts(true);
      const rows=statement.all().map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,typeof value==='bigint'?value.toString():value])));
      if(rows.some(row=>Object.values(row).some(value=>value instanceof Uint8Array)))throw Error('Unsupported binary SQLite column');
      tables.push({...definition,rows,columns:source.db.prepare(`PRAGMA table_info(${ident(definition.table)})`).all().map(row=>row.name),sha256:hash(canonical(rows))});
    }
    for(const source of sources)if(hash(await readFile(source.path))!==source.sha256)throw Error('Source snapshot changed during inspection');
    return {schemaSql:sql,schemaChecksum:hash(sql),sources:sources.map(({schema,sha256,bytes,sequences})=>({schema,sha256,bytes,sequences})),tables};
  } finally {for(const source of sources)source.db.close();}
}

export async function installProductSchema(pool) {
  const sql=(await readFile(SCHEMA_PATH,'utf8')).replace(/\r\n/g,'\n'),client=await pool.connect();
  try {
    if((await client.query("SELECT 1 FROM pg_namespace WHERE nspname='croupier_zones'")).rows.length)throw Error('Refusing to install game schema in the zones database');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO croupier_game.storage_migrations(version,checksum,source_hashes,applied_at) VALUES($1,$2,$3,$4)', ['product-v1',hash(sql),'{}',new Date().toISOString()]);
    await client.query('COMMIT');
    return {version:'product-v1',checksum:hash(sql)};
  } catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}finally{client.release();}
}

export async function migrateSqliteToPostgres({pool,playerPath,authPath,quiesced=false}={}) {
  const snapshot=await inspectSqliteMigration({playerPath,authPath,quiesced}),client=await pool.connect();
  try {
    if(snapshot.tables.find(row=>row.schema==='croupier_auth'&&row.table==='api_keys')?.rows.some(row=>row.wallet_url&&!row.revoked_at))throw Error('Active external wallets need reservation/reconciliation verification before PostgreSQL cutover');
    if((await client.query("SELECT 1 FROM pg_namespace WHERE nspname='croupier_zones'")).rows.length)throw Error('Refusing to import into the zones database');
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(1129467984)');
    const marker=(await client.query("SELECT checksum FROM croupier_game.storage_migrations WHERE version='product-v1'")).rows[0];
    if(marker?.checksum!==snapshot.schemaChecksum)throw Error('Target schema checksum does not match the explicit product migration');
    if((await client.query("SELECT 1 FROM croupier_game.storage_migrations WHERE version='sqlite-import-v1'")).rows.length)throw Error('SQLite import already completed; refusing overwrite');
    for(const {schema,table}of schemaTables(snapshot.schemaSql).filter(row=>row.table!=='storage_migrations')) {
      if((await client.query(`SELECT 1 FROM ${ident(schema)}.${ident(table)} LIMIT 1`)).rows.length)throw Error('Target contains existing product data; refusing overwrite');
    }
    const results=[];
    for(const {schema,table,rows,columns,sha256}of snapshot.tables) {
      const available=(await client.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2',[schema,table])).rows.map(row=>row.column_name);
      if(columns.some(column=>!available.includes(column)))throw Error('Source has an unsupported column; refusing lossy import');
      const name=`${ident(schema)}.${ident(table)}`,names=columns.map(ident).join(',');
      for(let offset=0;offset<rows.length;offset+=250){
        const batch=rows.slice(offset,offset+250),values=batch.flatMap(row=>columns.map(column=>row[column]));
        const groups=batch.map((_,row)=>`(${columns.map((_,column)=>`$${row*columns.length+column+1}`).join(',')})`).join(',');
        await client.query(`INSERT INTO ${name} (${names}) VALUES ${groups}`,values);
      }
      const imported=(await client.query(`SELECT ${names} FROM ${name}`)).rows;
      if(hash(canonical(imported))!==sha256)throw Error('Imported data does not match the complete source history');
      if(['transactions','partner_rounds','users'].includes(table)) {
        const oldSequence=snapshot.sources.find(source=>source.schema===schema).sequences.find(item=>item.table===table)?.seq??'0';
        await client.query(`SELECT setval(pg_get_serial_sequence($1,'id'),GREATEST(COALESCE((SELECT MAX(id) FROM ${name}),0),$2::bigint,1),EXISTS(SELECT 1 FROM ${name}) OR $2::bigint>0)`,[`${schema}.${table}`,oldSequence]);
      }
      results.push({schema,table,count:rows.length,sha256});
    }
    await client.query('INSERT INTO croupier_game.storage_migrations(version,checksum,source_hashes,applied_at) VALUES($1,$2,$3,$4)', ['sqlite-import-v1',snapshot.schemaChecksum,JSON.stringify(snapshot.sources),new Date().toISOString()]);
    await client.query('COMMIT');
    return {sources:snapshot.sources,tables:results};
  }catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}finally{client.release();}
}

async function main(args) {
  const options=Object.fromEntries(args.map(arg=>{const match=/^--([a-z-]+)=(.+)$/.exec(arg);if(!match)throw Error('Use --player=PATH --auth=PATH --quiesced=yes --mode=plan|install|apply');return[match[1],match[2]];}));
  if(Object.keys(options).some(key=>!['player','auth','quiesced','mode'].includes(key)))throw Error('Unknown migration option');
  const mode=options.mode??'plan';
  if(mode==='plan'){
    const plan=await inspectSqliteMigration({playerPath:options.player,authPath:options.auth,quiesced:options.quiesced==='yes'});
    console.log(JSON.stringify({sources:plan.sources,tables:plan.tables.map(({schema,table,rows,sha256})=>({schema,table,count:rows.length,sha256}))}));return;
  }
  const store=createPostgresStore({connectionString:process.env.CROUPIER_GAME_DATABASE_URL,zonesConnectionString:process.env.CROUPIER_ZONES_DATABASE_URL});
  try {
    if(mode==='install')console.log(JSON.stringify(await installProductSchema(store.pool)));
    else if(mode==='apply')console.log(JSON.stringify(await migrateSqliteToPostgres({pool:store.pool,playerPath:options.player,authPath:options.auth,quiesced:options.quiesced==='yes'})));
    else throw Error('Unknown migration mode');
  }finally{await store.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(()=>{console.error('PostgreSQL migration failed; no connection details or private rows are printed.');process.exitCode=1;});
