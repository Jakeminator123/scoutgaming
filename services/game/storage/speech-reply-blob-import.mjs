// One-time operator adapter. Never used as a runtime read/write fallback.
import { createHash } from 'node:crypto';
import { canonicalStudioJson, validateStudioScope } from '../../../packages/studio-registry/server/document-contract.mjs';
import { SpeechReplyLibraryError, speechReplyScopeHash, validateSpeechReplyRecord } from '../../../packages/presentation/server/speech-reply-library.mjs';
import { privateContentTypeMatches } from '../blob-media.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
const fail=(code='reply_library_import_unavailable',status=503)=>{throw new SpeechReplyLibraryError(code,status);};
const LIMIT=65536;
function location(blob,pathname){
  let url;try{url=new URL(blob?.url);}catch{fail();}
  if(blob.pathname!==pathname||url.protocol!=='https:'||!/^[a-z0-9]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname)
    ||url.pathname!==`/${pathname}`||url.port||url.username||url.password||url.search||url.hash)fail('reply_library_import_corrupt',409);
}
export function createSpeechReplyBlobImport({scope:inputScope,blobClient,repository,env=process.env,allowMissingMediaForDealers=new Set(),activeDealerIds}={}){
  const scope=validateStudioScope(inputScope),scopeHash=speechReplyScopeHash(scope),prefix=`croupier/reply-library/${scopeHash}/`;
  if(!blobClient||['list','get'].some(key=>typeof blobClient[key]!=='function'))fail();
  if(!(allowMissingMediaForDealers instanceof Set)||allowMissingMediaForDealers.size&&(!(activeDealerIds instanceof Set)||!activeDealerIds.size)
    ||[...allowMissingMediaForDealers].some(id=>typeof id!=='string'||activeDealerIds?.has(id)))fail('reply_library_import_missing_policy',400);
  const permittedMissing=new Set(allowMissingMediaForDealers);
  const auth=()=>({token:env.BLOB_READ_WRITE_TOKEN,abortSignal:AbortSignal.timeout(60000)});
  async function verifyMedia(record){
    let result;try{result=await blobClient.get(record.pathname,{...auth(),access:'private',useCache:false});}catch{fail();}
    if(!result||result.statusCode===404){if(result?.stream)await result.stream.cancel().catch(()=>{});return 404;}
    if(result.statusCode!==200||!result.stream)fail();location(result.blob,record.pathname);
    if(!privateContentTypeMatches(result.blob.contentType,record.contentType))fail('reply_library_import_media_mismatch',409);
    const reader=result.stream.getReader(),hash=createHash('sha256');let size=0;
    try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>record.size)fail('reply_library_import_media_mismatch',409);hash.update(next.value);}}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    if(size!==record.size||hash.digest('hex')!==record.sha256)fail('reply_library_import_media_mismatch',409);
    return 200;
  }
  async function readManifest(pathname){
    const result=await blobClient.get(pathname,{...auth(),access:'private',useCache:false});
    if(!result||result.statusCode!==200||!result.stream||result.blob?.size>LIMIT||!/^application\/json(?:;\s*charset=utf-8)?$/i.test(result.blob?.contentType))fail();
    location(result.blob,pathname);
    const reader=result.stream.getReader(),chunks=[];let size=0;
    try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>LIMIT)fail('reply_library_import_corrupt',409);chunks.push(Buffer.from(next.value));}}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    const bytes=Buffer.concat(chunks);let value;try{value=JSON.parse(bytes.toString('utf8'));}catch{fail('reply_library_import_corrupt',409);}
    validateSpeechReplyRecord(value,scope);
    // The SDK can decode a compressed response; blob.size is transport metadata.
    // The bounded decoded bytes and their SHA are the manifest identity.
    if(pathname!==`${prefix}${value.dealerId}/${value.id}.json`||typeof result.blob.etag!=='string'||!result.blob.etag)fail('reply_library_import_corrupt',409);
    return {pathname,etag:result.blob.etag,sha256:digest(bytes),value};
  }
  async function exportSnapshot(){
    const entries=[],seen=new Set(),cursors=new Set();let cursor;
    do{
      const page=await blobClient.list({...auth(),prefix,limit:1000,...(cursor?{cursor}:{})});
      if(!Array.isArray(page?.blobs)||page.blobs.length>1000)fail();
      for(const blob of page.blobs){
        if(typeof blob.pathname!=='string'||!blob.pathname.startsWith(prefix)||seen.has(blob.pathname)||entries.length>=100000)fail('reply_library_import_corrupt',409);
        seen.add(blob.pathname);const entry=await readManifest(blob.pathname),verified=[];
        for(const [kind,record] of Object.entries(entry.value.media)){
          const status=await verifyMedia(record);
          if(status===404&&permittedMissing.has(entry.value.dealerId)){
            verified.push({kind,pathname:record.pathname,sha256:record.sha256,size:record.size,state:'missing',status:404});continue;
          }
          if(status!==200)fail('reply_library_import_media_mismatch',409);
          verified.push({kind,pathname:record.pathname,sha256:record.sha256,size:record.size,state:'verified',status:200});
        }
        entries.push({...entry,verifiedMedia:verified});
      }
      if(page.hasMore){if(typeof page.cursor!=='string'||!page.cursor||cursors.has(page.cursor))fail();cursors.add(page.cursor);cursor=page.cursor;}else cursor=undefined;
    }while(cursor);
    entries.sort((a,b)=>a.pathname.localeCompare(b.pathname));
    const payload={schemaVersion:1,scope,entries};
    return {...payload,sha256:digest(canonicalStudioJson(payload)),count:entries.length};
  }
  async function importSnapshot(snapshot,{apply=false}={}){
    if(typeof apply!=='boolean'||!snapshot||snapshot.schemaVersion!==1||canonicalStudioJson(snapshot.scope)!==canonicalStudioJson(scope)||!Array.isArray(snapshot.entries)
      ||snapshot.count!==snapshot.entries.length||snapshot.sha256!==digest(canonicalStudioJson({schemaVersion:1,scope,entries:snapshot.entries})))fail('reply_library_import_snapshot_mismatch',409);
    if(repository?.scope?.environment!==scope.environment||repository?.scope?.workspaceId!==scope.workspaceId||typeof repository?.read!=='function'||typeof repository?.importValue!=='function')fail('reply_library_invalid_scope',400);
    const fresh=await exportSnapshot();if(fresh.sha256!==snapshot.sha256)fail('reply_library_import_source_changed',409);
    let existing=0;
    for(const entry of snapshot.entries){const value=validateSpeechReplyRecord(entry.value,scope),current=await repository.read(value.dealerId,value.id);
      if(current&&canonicalStudioJson(current)!==canonicalStudioJson(value))fail('reply_library_import_conflict',409);if(current)existing++;}
    if(!apply)return {apply:false,count:snapshot.count,existing,toCreate:snapshot.count-existing,sha256:snapshot.sha256};
    let created=0;for(const entry of snapshot.entries){const result=await repository.importValue(entry.value);if(result.created)created++;}
    for(const entry of snapshot.entries)if(canonicalStudioJson(await repository.read(entry.value.dealerId,entry.value.id))!==canonicalStudioJson(entry.value))fail('reply_library_import_readback_mismatch',409);
    if((await exportSnapshot()).sha256!==snapshot.sha256)fail('reply_library_import_source_changed',409);
    return {apply:true,count:snapshot.count,created,existing:snapshot.count-created,sha256:snapshot.sha256};
  }
  async function guarded(work){try{return await work();}catch(error){if(error instanceof SpeechReplyLibraryError)throw error;fail();}}
  return Object.freeze({exportSnapshot:()=>guarded(exportSnapshot),importSnapshot:(...args)=>guarded(()=>importSnapshot(...args))});
}
