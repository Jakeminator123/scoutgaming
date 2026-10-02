import { createHash } from 'node:crypto';
import { readFile, mkdir, open, lstat, realpath } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPostgresStore } from '../web/storage/postgres-store.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url)),schemaPath=new URL('../ops/neon-game/product-schema.sql',import.meta.url);
const hash=value=>createHash('sha256').update(value).digest('hex');
const canonical=rows=>JSON.stringify(rows.map(row=>Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,value===null?null:String(value)]))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
const identifier=value=>{if(!/^[a-z_][a-z0-9_]*$/.test(value))throw Error('Invalid backup identifier');return `"${value}"`;};
const definitions=sql=>[...sql.matchAll(/CREATE TABLE (croupier_game|croupier_auth)\.([a-z_]+)\s*\(/g)].map(([,schema,table])=>({schema,table}));
const sequenceTables=[['croupier_game','transactions'],['croupier_game','partner_rounds'],['croupier_game','player_admin_events'],['croupier_auth','users']];
const samePath=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
function outsideCheckout(file){const path=resolve(file),part=relative(repo,path);if(part===''||part!=='..'&&!part.startsWith(`..${sep}`)&&!isAbsolute(part))throw Error('Private backups must remain outside Git checkout');return path;}
async function plainParent(path,create=false){
  const parent=dirname(path);let existing=parent;
  for(;;){try{const info=await lstat(existing);if(info.isSymbolicLink()||!info.isDirectory()||!samePath(resolve(await realpath(existing)),existing))throw Error('Unsafe private backup parent');break;}catch(error){if(error.code!=='ENOENT')throw error;const next=dirname(existing);if(next===existing)throw error;existing=next;}}
  if(create)await mkdir(parent,{recursive:true,mode:0o700});
  const info=await lstat(parent);if(info.isSymbolicLink()||!info.isDirectory()||!samePath(resolve(await realpath(parent)),parent))throw Error('Unsafe private backup parent');
}

export async function exportPostgresBackup({pool,destination}={}) {
  const path=outsideCheckout(destination),schemaSql=(await readFile(schemaPath,'utf8')).replace(/\r\n/g,'\n'),client=await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const tables=[],expected=definitions(schemaSql);
    const existing=(await client.query("SELECT table_schema AS schema,table_name AS table FROM information_schema.tables WHERE table_schema IN ('croupier_game','croupier_auth') AND table_type='BASE TABLE'")).rows;
    if(existing.length!==expected.length||existing.some(row=>!expected.some(item=>item.schema===row.schema&&item.table===row.table)))throw Error('Backup must include every installed product table');
    for(const {schema,table}of definitions(schemaSql)) {
      const rows=(await client.query(`SELECT * FROM ${identifier(schema)}.${identifier(table)}`)).rows;
      const columns=(await client.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position',[schema,table])).rows.map(row=>row.column_name);
      tables.push({schema,table,columns,rows,count:rows.length,sha256:hash(canonical(rows))});
    }
    const sequences=[];
    for(const [schema,table]of sequenceTables) {
      const name=(await client.query("SELECT pg_get_serial_sequence($1,'id') AS name",[`${schema}.${table}`])).rows[0].name;
      if(!/^(croupier_game|croupier_auth)\.[a-z_]+$/.test(name))throw Error('Unexpected database sequence');
      const row=(await client.query(`SELECT last_value,is_called FROM ${name}`)).rows[0];
      sequences.push({schema,table,lastValue:String(row.last_value),isCalled:row.is_called});
    }
    await client.query('COMMIT');
    const payload={schema:'croupier-postgres-backup-v1',schemaSql,schemaChecksum:hash(schemaSql),createdAt:new Date().toISOString(),tables,sequences};
    const envelope={payload,sha256:hash(JSON.stringify(payload))};
    await plainParent(path,true);
    const file=await open(path,'wx',0o600);try{await file.writeFile(JSON.stringify(envelope));await file.sync();}finally{await file.close();}
    return {sha256:envelope.sha256,tables:tables.map(({schema,table,count,sha256})=>({schema,table,count,sha256}))};
  }catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}finally{client.release();}
}

export async function restorePostgresBackup({pool,source,quiesced=false}={}) {
  if(!quiesced)throw Error('Stop all target writers before restore');
  const path=outsideCheckout(source);await plainParent(path);const info=await lstat(path);if(!info.isFile()||info.isSymbolicLink())throw Error('Invalid private backup');
  const envelope=JSON.parse(await readFile(path,'utf8')),payload=envelope?.payload;
  const schemaSql=(await readFile(schemaPath,'utf8')).replace(/\r\n/g,'\n');
  if(payload?.schema!=='croupier-postgres-backup-v1'||hash(JSON.stringify(payload))!==envelope.sha256||payload.schemaChecksum!==hash(schemaSql)||payload.schemaSql!==schemaSql)throw Error('Backup checksum or product schema mismatch');
  const expected=definitions(schemaSql);
  if(payload.tables?.length!==expected.length||new Set(payload.tables.map(row=>`${row.schema}.${row.table}`)).size!==expected.length||payload.tables.some(row=>!expected.some(item=>item.schema===row.schema&&item.table===row.table)||row.count!==row.rows.length||hash(canonical(row.rows))!==row.sha256))throw Error('Backup table manifest mismatch');
  if(payload.sequences?.length!==sequenceTables.length||new Set(payload.sequences.map(row=>`${row.schema}.${row.table}`)).size!==sequenceTables.length||payload.sequences.some(row=>!sequenceTables.some(([schema,table])=>schema===row.schema&&table===row.table)||!/^[1-9]\d*$/.test(row.lastValue)||typeof row.isCalled!=='boolean'))throw Error('Invalid or incomplete backup sequences');
  const client=await pool.connect();
  try {
    if((await client.query("SELECT 1 FROM pg_namespace WHERE nspname='croupier_zones'")).rows.length)throw Error('Refusing to restore into the zones database');
    await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(1129467984)');
    const installed=(await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema IN ('croupier_game','croupier_auth') LIMIT 1")).rows;
    if(installed.length)throw Error('Restore requires empty schemas; existing data is never overwritten');
    await client.query(schemaSql);
    for(const entry of payload.tables) {
      const name=`${identifier(entry.schema)}.${identifier(entry.table)}`,columns=entry.columns.map(identifier).join(',');
      for(let offset=0;offset<entry.rows.length;offset+=250){
        const batch=entry.rows.slice(offset,offset+250),values=batch.flatMap(row=>entry.columns.map(column=>row[column]));
        const groups=batch.map((_,row)=>`(${entry.columns.map((_,column)=>`$${row*entry.columns.length+column+1}`).join(',')})`).join(',');
        await client.query(`INSERT INTO ${name} (${columns}) VALUES ${groups}`,values);
      }
      const restored=(await client.query(`SELECT * FROM ${name}`)).rows;
      if(hash(canonical(restored))!==entry.sha256)throw Error('Restored history mismatch');
    }
    for(const sequence of payload.sequences){
      await client.query("SELECT setval(pg_get_serial_sequence($1,'id'),$2::bigint,$3::boolean)",[`${sequence.schema}.${sequence.table}`,sequence.lastValue,sequence.isCalled]);
    }
    await client.query('COMMIT');return {sha256:envelope.sha256,tables:payload.tables.map(({schema,table,count})=>({schema,table,count}))};
  }catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}finally{client.release();}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,file,assertion]=process.argv.slice(2),store=createPostgresStore({connectionString:process.env.CROUPIER_GAME_DATABASE_URL,zonesConnectionString:process.env.CROUPIER_ZONES_DATABASE_URL});
 (async()=>{try{if(mode==='export')console.log(JSON.stringify(await exportPostgresBackup({pool:store.pool,destination:file})));else if(mode==='restore')console.log(JSON.stringify(await restorePostgresBackup({pool:store.pool,source:file,quiesced:assertion==='--quiesced=yes'})));else throw Error('Use export FILE or restore FILE --quiesced=yes');}catch{console.error('Private PostgreSQL backup/restore failed; no private values are printed.');process.exitCode=1;}finally{await store.close();}})();
}
