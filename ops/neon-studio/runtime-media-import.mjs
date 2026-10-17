// Explicit one-off catalogue import. Importing this module performs no I/O.
// The active runtime never falls back to these local source files.
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {isAbsolute,join} from 'node:path';
import {StudioStorageError,canonicalStudioJson,studioStorageFailure,validateActor,validateStudioScope} from '../../packages/studio-registry/server/document-contract.mjs';
import {validateRuntimeMediaCatalog,validateRuntimeCatalogRecord,runtimeCatalogJson,runtimeCatalogRevision} from '../../packages/studio-registry/server/runtime-catalog.mjs';
import {planStudioMigrations,loadStudioMigrations} from './migrations.mjs';
import {validateMediaLayout} from '../../tools/media-layout.mjs';
import {validatePrivateMedia} from '../../lab/lib/cloud-media-store.mjs';

const sources=Object.freeze({layout:'media/layout.json',blobIndex:'media/blob-index.json',presentation:'media/catalog/presentation.json',legacy:'media/catalog/legacy.json'});
const versions='001,002,003,004,005,006,007,008,011,012,013,014';
const sha=/^[a-f0-9]{64}$/;
const hash=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>canonicalStudioJson(a)===canonicalStudioJson(b);
const fail=(code,status=409)=>{throw new StudioStorageError(`studio_runtime_import_${code}`,status);};
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const jsonMetadata=row=>['public','private'].includes(row.access)&&(row.storage?.contentType==='application/json'||row.logicalPath?.endsWith('.json'));
const safePath=value=>typeof value==='string'&&!/[\\\0:]/.test(value)&&!value.startsWith('/')&&value.split('/').every(part=>part&&part!=='.'&&part!=='..');

/** Read exactly four operator-selected source files, preserving all string values. */
export async function prepareRuntimeMediaImport({scope,sourceRoot,readMetadataBytes}={}) {
  scope=validateStudioScope(scope);
  if(typeof sourceRoot!=='string'||!isAbsolute(sourceRoot))fail('source_required',422);
  if(readMetadataBytes!==undefined&&typeof readMetadataBytes!=='function')fail('metadata_reader_invalid',422);
  const value={schemaVersion:1},sourceHashes={};
  for(const [kind,path] of Object.entries(sources)) {
    let bytes;
    try {bytes=await readFile(join(sourceRoot,path));}catch{fail('source_unavailable',503);}
    if(bytes.length>16*1024*1024)fail('source_invalid',422);
    try {value[kind]=JSON.parse(bytes.toString('utf8'));}catch{fail('source_invalid',422);}
    sourceHashes[path]={sha256:hash(bytes),size:bytes.length};
  }
  if(!Array.isArray(value.layout.files)||!Array.isArray(value.blobIndex.files))fail('source_invalid',422);
  const paths=new Set(value.layout.files.map(row=>row.path));
  const sourceIndexCount=value.blobIndex.files.length;
  // Old uploads and index-only rows are not authoritative layout entries.
  // Source artefacts without a Blob tuple remain metadata only, exactly as saved.
  value.blobIndex={...value.blobIndex,files:value.blobIndex.files.filter(row=>paths.has(row.logicalPath))};
  try{validateMediaLayout(value.layout);}catch{fail('source_invalid',422);}
  const layout=new Map(value.layout.files.map(row=>[row.path,row]));
  if(value.legacy?.schemaVersion!==2||!value.legacy.entries||Array.isArray(value.legacy.entries)||typeof value.legacy.entries!=='object')fail('source_invalid',422);
  for(const row of value.blobIndex.files.filter(jsonMetadata)) {
    const entry=layout.get(row.logicalPath),path=entry?.canonicalPath??row.logicalPath;
    if(!safePath(path)||!entry||row.storage.contentType!=='application/json'||row.sha256!==entry.sha256||row.size!==entry.size
      ||row.access!==entry.access||row.storage.sha256!==row.sha256||row.storage.size!==row.size)fail('metadata_identity_invalid',422);
    try{validatePrivateMedia(row.storage);}catch{fail('metadata_identity_invalid',422);}
    let bytes;
    try{bytes=readMetadataBytes?await readMetadataBytes(freeze(structuredClone(row))):await readFile(join(sourceRoot,'media',path));}
    catch{fail('metadata_unavailable',503);}
    if(!(bytes instanceof Uint8Array))fail('metadata_bytes_required',422);
    bytes=Buffer.from(bytes);
    if(bytes.length!==row.size||hash(bytes)!==row.sha256)fail('metadata_identity_invalid',422);
    const text=bytes.toString('utf8');
    if(!Buffer.from(text,'utf8').equals(bytes))fail('metadata_invalid',422);
    try{JSON.parse(text);}catch{fail('metadata_invalid',422);}
    const key='media/'+row.logicalPath;
    if(Object.hasOwn(value.legacy.entries,key)&&value.legacy.entries[key]!==text)fail('metadata_identity_invalid',422);
    value.legacy.entries[key]=text;
  }
  return checkedPrepared({schemaVersion:1,scope,value,revision:runtimeCatalogRevision(value),sourceHashes,sourceIndexCount});
}

function checkedPrepared(input) {
  if(!exact(input,['schemaVersion','scope','value','revision','sourceHashes','sourceIndexCount'])||input.schemaVersion!==1||!sha.test(input.revision??''))fail('prepared_invalid',422);
  const scope=validateStudioScope(input.scope),value=validateRuntimeMediaCatalog(input.value);
  if(runtimeCatalogRevision(value)!==input.revision||!exact(input.sourceHashes,Object.values(sources))
    ||!Number.isSafeInteger(input.sourceIndexCount)||input.sourceIndexCount<value.blobIndex.files.length||input.sourceIndexCount>20000)fail('prepared_invalid',422);
  for(const proof of Object.values(input.sourceHashes))if(!exact(proof,['sha256','size'])||!sha.test(proof.sha256??'')||!Number.isSafeInteger(proof.size)||proof.size<1||proof.size>16*1024*1024)fail('prepared_invalid',422);
  return freeze({schemaVersion:1,scope,value,revision:input.revision,sourceHashes:structuredClone(input.sourceHashes),sourceIndexCount:input.sourceIndexCount});
}
function summary(prepared) {
  const indexed=new Set(prepared.value.blobIndex.files.map(row=>row.logicalPath));
  return {revision:prepared.revision,sourceHashes:prepared.sourceHashes,counts:{layout:prepared.value.layout.files.length,
    sourceIndex:prepared.sourceIndexCount,importedIndex:indexed.size,excludedIndex:prepared.sourceIndexCount-indexed.size,
    sourceWithoutBlob:prepared.value.layout.files.filter(row=>row.access==='source'&&!indexed.has(row.path)).length,
    presentation:prepared.value.presentation.items.length,legacy:Object.keys(prepared.value.legacy.entries).length,
    jsonMetadata:prepared.value.blobIndex.files.filter(jsonMetadata).length,
    jsonMetadataBytes:prepared.value.blobIndex.files.filter(jsonMetadata).reduce((total,row)=>total+row.size,0)},
    blobVerification:'metadata-only'};
}
async function verifiedSchema({pool,schemaCheck}) {
  const optional=new Set((await loadStudioMigrations()).filter(row=>row.deploymentOptional).map(row=>row.version));
  const plan=await schemaCheck({pool});
  const applied=Array.isArray(plan?.applied)?plan.applied.map(row=>row?.version):[];
  // Keep the importer's required schema exact; only reviewed optional versions may extend it.
  // Every applied row, including optional rows, is still rechecked against the locked ledger.
  if(!plan?.schemaPresent||plan.toApply?.length!==0||new Set(applied).size!==applied.length
    ||applied.filter(version=>!optional.has(version)).join(',')!==versions
    ||plan.applied.some(row=>!sha.test(row.checksum??'')||!sha.test(row.structureChecksum??'')))fail('schema_unverified');
  return plan;
}
async function transaction({pool,scope,write=false},work) {
  if(typeof pool?.connect!=='function')fail('configuration',503);
  let client,begun=false;
  try {
    client=await pool.connect();
    if(typeof client?.query!=='function'||typeof client?.release!=='function')fail('configuration',503);
    await client.query(write?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;
    await client.query("SET LOCAL statement_timeout='10000ms'; SET LOCAL lock_timeout='3000ms'; SET LOCAL idle_in_transaction_session_timeout='10000ms'");
    if(write) {
      await client.query('/* runtime-media-import:migration-lock */ SELECT pg_advisory_xact_lock($1::integer,$2::integer)',[1129467987,1398035778]);
      const digest=createHash('sha256').update(`croupier-studio\0${canonicalStudioJson(scope)}`).digest();
      await client.query('/* runtime-media-import:scope-lock */ SELECT pg_advisory_xact_lock($1::integer,$2::integer)',[digest.readInt32BE(0),digest.readInt32BE(4)]);
    }
    const result=await work(client);
    const committed=await client.query('COMMIT');begun=false;
    if(committed?.command==='ROLLBACK')fail('rolled_back',503);
    return result;
  }catch(error){
    if(begun)try{await client.query('ROLLBACK');}catch{/* Never leak secondary driver details. */}
    throw studioStorageFailure(error);
  }finally{try{client?.release?.();}catch{/* Caller owns pool lifecycle. */}}
}
async function currentPlan(client,prepared,schema,{lock=false}={}) {
  const target=(await client.query(`/* runtime-media-import:target */ SELECT current_database() AS database,current_user AS role,
    inet_server_addr()::text AS address,inet_server_port() AS port`)).rows[0];
  if(!same(target,schema.target))fail('target_changed');
  const ledger=(await client.query('/* runtime-media-import:ledger */ SELECT version,checksum,structure_checksum FROM croupier_studio.storage_migrations ORDER BY version')).rows;
  if(!same(ledger,schema.applied.map(row=>({version:row.version,checksum:row.checksum,structure_checksum:row.structureChecksum}))))fail('schema_unverified');
  const rows=(await client.query(`/* runtime-media-import:catalog */ SELECT revision,value FROM croupier_studio.runtime_media_catalogs
    WHERE environment_id=$1 AND workspace_id=$2${lock?' FOR UPDATE':''}`,[prepared.scope.environment,prepared.scope.workspaceId])).rows;
  if(rows.length>1)fail('target_invalid');
  const current=rows.length?validateRuntimeCatalogRecord(rows[0]):null;
  const value={schemaVersion:1,scope:prepared.scope,target,expectedRevision:current?.revision??null,...summary(prepared),
    operation:current?.revision===prepared.revision?'unchanged':current?'replace':'insert'};
  return freeze({...value,planHash:hash(canonicalStudioJson(value))});
}

/** Read-only: returns a reviewable hash binding exact source, target and current revision. */
export async function planRuntimeMediaImport({pool,prepared,schemaCheck=planStudioMigrations}={}) {
  const source=checkedPrepared(prepared),schema=await verifiedSchema({pool,schemaCheck});
  return transaction({pool,scope:source.scope},client=>currentPlan(client,source,schema));
}

/** Explicit apply only; the reviewed plan must still match under both advisory locks. */
export async function applyRuntimeMediaImport({pool,prepared,expectedPlan,confirm,actor,schemaCheck=planStudioMigrations}={}) {
  if(confirm!==true||!sha.test(expectedPlan?.planHash??''))fail('confirmation_required',422);
  actor=validateActor(actor);
  const source=checkedPrepared(prepared),reviewed=structuredClone(expectedPlan),schema=await verifiedSchema({pool,schemaCheck});
  return transaction({pool,scope:source.scope,write:true},async client=>{
    const actual=await currentPlan(client,source,schema,{lock:true});
    if(!same(actual,reviewed))fail('plan_changed');
    const parameters=[source.scope.environment,source.scope.workspaceId];
    if(actual.operation==='unchanged')return {scope:source.scope,revision:source.revision,changed:false,planHash:actual.planHash};
    const json=runtimeCatalogJson(source.value);
    const sql=actual.expectedRevision===null
      ? `/* runtime-media-import:insert */ INSERT INTO croupier_studio.runtime_media_catalogs(environment_id,workspace_id,revision,value)
        VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(environment_id,workspace_id) DO NOTHING RETURNING revision,value`
      : `/* runtime-media-import:update */ UPDATE croupier_studio.runtime_media_catalogs SET revision=$3,value=$4::jsonb,updated_at=now()
        WHERE environment_id=$1 AND workspace_id=$2 AND revision=$5 RETURNING revision,value`;
    const saved=(await client.query(sql,[...parameters,source.revision,json,...(actual.expectedRevision===null?[]:[actual.expectedRevision])])).rows;
    if(saved.length!==1)fail('conflict');
    const checked=validateRuntimeCatalogRecord(saved[0]);
    if(checked.revision!==source.revision||runtimeCatalogJson(checked.value)!==json)fail('write_mismatch');
    await client.query(`/* runtime-media-import:audit */ INSERT INTO croupier_studio.audit_events
      (environment_id,workspace_id,event_id,action,subject,revision,actor) VALUES($1,$2,$3::uuid,$4,$5,$6,$7)`,
      [...parameters,randomUUID(),'import_document','runtime-media-catalog',source.revision,actor]);
    return {scope:source.scope,revision:source.revision,previousRevision:actual.expectedRevision,changed:true,planHash:actual.planHash};
  });
}
